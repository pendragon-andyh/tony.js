/*!
* Tony.JS WebAudio Library - http://github.com/pendragon-andyh/tony.js/
* Copyright 2014, Andy Harman
*
* Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
* modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
* WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
* COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
* ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
;
(function(global) {
	"use strict";

	//Dependencies from global object.
	var AudioContext=global.AudioContext||global.webkitAudioContext;
	var OfflineAudioContext=global.OfflineAudioContext||global.webkitOfflineAudioContext;

	//Tony.js is actually the "init" function enhanced.
	var t=global['tony']=init, defaultContext;

	/**
	* Create audio-context proxy.
	* @param c (AudioContext?) - Optional AudioContext (if not specified then use default).
	* @returns (AudioContextProxy) - Proxy object for the supplied AudioContext.
	*/
	function init(c) { return new AudioContextProxy(c||t.context); }

	//Expose the default (singleton) AudioContext.
	Object.defineProperty(t, "context", {
		"get": function() { return defaultContext||(defaultContext=new AudioContext()); },
		"set": function(v) { defaultContext=v; }
	});

	/**
	* Access to AudioContextProxy class so we can extend it.
	* @expose
	*/
	t.AudioContextProxy=AudioContextProxy;

	/**
	* Calculate the frequency for the specified MIDI note-number.
	* @param noteId (int)
	* @returns (double)
	*/
	t.convertNoteToFrequency=function(noteId) {
		return Math.pow(2, (noteId-69)/12)*440.0;
	};

	/**
	* Create an OfflineAudioContext to allow non-realtime processing of sounds.
	* Can be used to pre-build samples that are then played back later via the BufferSourceNode.
	* @param channels (int) - 1 is mono, 2 is stereo.
	* @param len (int) - Number of samples to collect (e.g. if sampleRate is 48000 then 48000 is 1 second of audio).
	* @param sampleRate (int) - Webkit source code says this must be between 44100 and 96000 samples per second).
	* @param initFn (function) - Function to initialize the context (arg is destination, this is proxy for the offline context).
	* @param callbackFn (function) - Callback function to be called when rendering is complete (arg is output buffer).
	*/
	t.compileOfflineAudioBuffer=function(channels, len, sampleRate, initFn, callbackFn) {
		var c=new OfflineAudioContext(channels, len, sampleRate);
		var proxy=init(c);
		c.oncomplete=function(ev) { callbackFn(ev.renderedBuffer); };
		initFn.call(proxy, c.destination);
		c.startRendering();
	};

	/**
	* Represents wrapper for passed-in AudioContext instance.
	* @constructor
	* @param context (AudioContext)
	*/
	function AudioContextProxy(context) {
		//Access to AudioContext that we are wrapping.
		Object.defineProperty(this, "context", {
			"get": function() { return context; }
		});

		//WebKit only starts timing after first node is created.
		context.createGain();
	}

	//Reflect over a sample AudioContext - add wrapper methods/properties to proxy-prototype.
	var proto=AudioContextProxy.prototype;
	var exampleContext=new OfflineAudioContext(1, 1, 48000);
	for(var memberName in exampleContext) {
		(function(m) {
			if(typeof exampleContext[m]=="function") {
				proto[m]=function() {
					var c=this.context;
					return this.enhanceNode(this.createObjectFromFactoryFunction(c, c[m], arguments));
				};
			} else {
				Object.defineProperty(proto, m, {
					"get": function() { return this.context[m]; },
					"set": function(v) { this.context[m]=v; }
				});
			}
		})(memberName);
	}

	/**
	* Use "creationFn" to create a new object (and apply settings if specified).
	* Allows creation of nodes in a fluent-like way.
	* @param self (object) - The object that the factory-function will be applied-to.
	* @param creationFn (function) - Factory function.
	* @param args (Arguments) - Arguments applied to the calling function.
	* @returns (object) - The newly-created object.
	*/
	proto.createObjectFromFactoryFunction=function(self, creationFn, args) {
		//Get settings object if specified (last argument is simple object).
		var settings;
		if(typeof (args[args.length-1])=="object") {
			settings=[].pop.call(args);
		}

		//Create object with remaining arguments.
		var obj=creationFn.apply(self, args);

		//Apply settings.
		for(var m in settings) {
			if(obj&&settings.hasOwnProperty(m)) {
				this.setValue(obj, m, settings[m]);
			}
		}

		return obj;
	};

	/**
	* Apply useful enhancements to new nodes.
	* @param node (object) - The node-instance to be enhanced.
	* @returns (object) - To allow chaining.
	*/
	proto.enhanceNode=function(node) {
		if(node) {
			//Make common methods more fluent.
			var origConnect=node.connect, origStart=node.start, origStop=node.stop;
			if(origConnect) {
				node.connect=function() {
					origConnect.apply(node, arguments);
					return node;
				};
			}
			if(origStart||node.onStart) {
				node.start=function(when) {
					if(origStart) { origStart.apply(node, arguments); }
					if(node.onStart) { node.onStart(when); }
					return node;
				};
			}
			if(origStop||node.onStop) {
				node.stop=function(when) {
					if(origStop) { origStop.apply(node, arguments); }
					if(node.onStop) { node.onStop(when); }
					return node;
				};
			}

			//If node supports "start" and "stop" methods then add a "play" convenience method.
			if(node.start&&node.stop&&!node.play) {
				node.play=function(duration, when) {
					var startTime=when||(node.context?node.context.currentTime:0);
					node.start(startTime).stop(startTime+(duration||0.25));
					return node;
				};
			}

			//Apply post-processing if defined (e.g. by the compositeNode).
			if(this.postFn) { this.postFn(node); }
		}
		return node;
	};

	/**
	* Set a node-member's value.
	* @param node (object)
	* @param memberName (string) - Name of member on object.
	* @param value (object) - Value to set the member to.
	*/
	proto.setValue=function(node, memberName, value) {
		var s=node[memberName];
		if(s&&s.setValueAtTime) {
			//If AudioParam..
			if(!value.length&&(value||value===0)) {
				//If single value.
				s.value=value;
			} else if(this.start) {
				//If in compositeNode then add start method to schedule envelope.
				s.value=value[0];
				var origStartFunc=node.start, that=this;
				node.start=function(when) {
					that.applyEnvelope(s, when, value);
					if(origStartFunc) { origStartFunc.call(this, when); }
				}
			} else {
				//Otherwise schedule envelope for now.
				this.applyEnvelope(s, this.currentTime, value);
			}
		} else if(memberName=="gain"&&!s&&node.connect) {
			//If setting "gain" then weld a gain node onto current node.
			var gn=this.createGain({ gain: value });
			node.connect(gn);
			node.gain=gn.gain;
			node.connect=function() { gn.connect.apply(gn, arguments); };
			node.disconnect=function() { gn.disconnect.apply(gn, arguments); };
		} else {
			//Otherwise set normal value.
			node[memberName]=value;
		}
	};

	/**
	* Apply envelope for the specified AudioParam.
	* @param audioParam (AudioParam)
	* @param when (double) - Time that envelope will start.
	* @param steps (Array) - array containing points of the envelope.
	* @note - elements of values array are 2-item arrays where 1st item is target-value and 2nd is duration.
	*/
	proto.applyEnvelope=function(audioParam, when, steps) {
		audioParam.cancelScheduledValues(when);

		//Set start value.
		var step=steps[0];
		if(!step.length) {
			audioParam.setValueAtTime(step, when);
		}

		//Step through array of remaining points.
		for(var i=0;i<steps.length;i++) {
			step=steps[i];
			if(step.length) {
				var value=step[0];

				//Use an exponential ramp for values that are positive. Otherwise use linear ramp.
				if(value<0) {
					audioParam.linearRampToValueAtTime(value, when+=step[1]||0.1);
				} else if(value==0) {
					audioParam.exponentialRampToValueAtTime(value||0.0001, when+=step[1]||0.1);
					if(i+1==steps.length) { audioParam.linearRampToValueAtTime(0, when+0.0001); }
				} else {
					audioParam.exponentialRampToValueAtTime(value, when+=step[1]||0.1);
				}
			}
		}
	};

	/**
	* Create a new BufferSourceNode to play single value. Can be used to offset modulation of AudioParam.
	* @param (float) - The value to be played.
	* @returns (BufferSourceNode)
	*/
	proto.createSingleValueSource=function(value) {
		//Buffer must be at-least 2 samples long or BufferSourceNode will ignore.
		var b=this.createBuffer(1, 2, this.sampleRate), d=b.getChannelData(0);
		d[0]=d[1]=value;
		return this.createBufferSource({ loop: true, buffer: b });
	};

	/**
	* Create a new enhanced scriptProcessorNode.
	* The arguments are identical to the AudioContext version, however an additional "onaudioprocess" function
	* and "settings" object can be added.
	* @returns (scriptProcessorNode)
	*/
	proto.createScriptProcessor=function() {
		var c=this.context, args=arguments;
		var obj=this.createObjectFromFactoryFunction(c, c.createScriptProcessor, args);
		if(typeof (args[args.length-1])=="function") {
			obj.onaudioprocess=[].pop.call(args);
		}
		return this.enhanceNode(obj);
	};

	/**
	* Create a scriptProcessorNode to be used as a sound source (e.g. an oscillator).
	* @param bufferSize (int) - Number of samples to be processed in each frame.
	* @param inputChannels (int) - Number of input channels.
	* @param inputChannels (int) - Number of ouput channels.
	* @param processingFn (function) - Function to perform JavaScript processing.
	* @returns (ScriptProcessorNode)
	*/
	proto.createScriptSource=function(bufferSize, inputChannels, outputChannels, processingFn) {
		var factoryFn=function(bufferSize, inputChannels, outputChannels, processFn) {
			//Create a ScriptProcessNode with one extra channel than specified.
			var jsn=this.createScriptProcessor(bufferSize, (inputChannels||0)+1, outputChannels);

			//Keep track of connections.
			var connections=[], origConnect=jsn.connect;
			jsn.connect=function(a, b, c) {
				origConnect.apply(jsn, arguments);
				connections.push([a, b]);
				return this;
			};

			//Drive 1.0 through extra channel. Forces Node to stay alive - and shows exactly when processing starts/stops.
			var buffer=this.createBuffer(1, 2, this.sampleRate), d=buffer.getChannelData(0);
			d[0]=d[1]=1;
			var mergeToChannel=this.createChannelMerger((inputChannels||0)+1);
			mergeToChannel.connect(jsn);
			var oneNode=this.createBufferSource();
			oneNode.loop=true;
			oneNode.buffer=buffer;
			oneNode.connect(mergeToChannel, 0, inputChannels);
			jsn.start=function(when) {
				oneNode.start(when);
			};
			jsn.stop=function(when) {
				oneNode.stop(when);
			};

			//Disconnect all outputs when the node is supposed to finish.  Allows garbage-collection.
			oneNode.onended=function() {
				while(connections.length) { jsn.disconnect.apply(jsn, connections.pop()); }
				return this;
			};

			//Wrap the passed-in processing function - so that we only call it when the node is active.
			var firstActive=null, lastActive=null;
			jsn.onaudioprocess=function(ev) {
				if(lastActive==null) {
					//Check if processing should start.
					var activeData=ev.inputBuffer.getChannelData(inputChannels), len=activeData.length;
					if(firstActive==null) {
						for(var i=0;i<len;i++) { if(activeData[i]) { firstActive=i; } }
					}

					if(firstActive!=null) {
						//Check if processing should stop.
						if(!activeData[len-1]) {
							for(var i=firstActive+1;i<len;i++) { if(!activeData[i]) { lastActive=i; } }
						}

						//Do the real processing.
						processingFn.call(jsn, ev, firstActive, lastActive||(len-1), ev.inputBuffer, ev.outputBuffer);
						firstActive=0;
					}
				}
			};

			jsn.lookupBufferValue=function(pos, data) {
				var len=data.length;
				var indexF=(pos%1)*len, index1= ~ ~indexF, interpolationFactor=indexF-index1, index2=index1+1;
				return ((1-interpolationFactor)*data[index1])+(interpolationFactor*(data[index2]||data[0]));
			};
			jsn.calcSawtoothValue=function(pos) {
				return ((pos%1)*2)-1;
			};

			return jsn;
		};

		return this.enhanceNode(this.createObjectFromFactoryFunction(this.context, factoryFn, arguments));
	};

	/**
	* Create "CompositeNode" container that allows multiple child nodes to be controlled as a single unit.
	* @param initFn (function) - Function to initialize contents of composite.
	* @param settings (object?) - Settings to pass into the initFn function.
	* @returns (CompositeNode)
	*/
	proto.createComposite=function(initFn, settings) {
		var factoryFn=function(parentProxy) {
			var node=new AudioContextProxy(parentProxy.context);
			var startQ=[], stopQ=[], connections=[], startTime, incompleteCount=0, oneNode;

			//Use a gain-node to allow connection to other nodes.
			var dest=parentProxy.createGain();
			node.destination=dest;
			node.gain=dest.gain;
			node.connect=function(a, b, c) {
				dest.connect(a, b, c);
				connections.push([a, b]);
				return this;
			};
			node.disconnect=function(a, b) {
				dest.disconnect(a, b);
				return this;
			};
			node.disconnectAll=function() {
				while(connections.length) { dest.disconnect.apply(dest, connections.pop()); }
				return this;
			};

			//Allow future sound to be cancelled.
			node.cancel=function(fadeTime) {
				if(startTime>this.currentTime) {
					this.disconnectAll();
				}
				return this;
			};

			//This executes whenever a new node is created.
			node.postFn=function(obj) {
				//Register all nodes that need to be scheduled.
				if(obj.start) { startQ.push(obj); }
				if(obj.stop) { stopQ.push(obj); }

				//When all work is complete then disconnect from destination to allow early garbage collection.
				if("onended" in obj) {
					var This=this;
					incompleteCount++;
					obj.onended=function() {
						if(! --incompleteCount) { This.disconnectAll(); }
					}
				}
			}

			//Add start/stop methods to trigger all source nodes.
			node.start=function(when) {
				startTime=when||this.currentTime;
				for(var i=0;i<startQ.length;i++) { startQ[i].start(startTime); }
				return this;
			};
			node.stop=function(when) {
				for(var i=0;i<stopQ.length;i++) { stopQ[i].stop(when||this.currentTime); }
				return this;
			};
			/*
			node.play=function(duration, when) {
			when=when||this.currentTime;
			return node.start(when).stop(when+duration);
			};
			*/

			node.createOne=function() {
				return oneNode||(oneNode=this.createSingleValueSource(1));
			};

			//Create a node that looks like a real AudioParam.
			node.createParam=function(defaultValue) {
				//Drive 1.0 through a GainNode - so output reflects modulated value of "gain" property.
				var gn=this.createGain({ gain: defaultValue });
				this.createOne().connect(gn);
				var param=gn.gain;

				//Allow param to be connected to a specific destination channel.
				param.connect=function() {
					gn.connect.apply(gn, arguments);
					return param;
				};

				return param;
			};

			//Initialize contents.
			initFn.call(node, dest, settings);

			return node;
		};

		return this.enhanceNode(this.createObjectFromFactoryFunction(this, factoryFn, [this, settings]));
	};

	/**
	* Define an instrument object that can be played.
	* @param playFn (function) - A function that sets up the audio nodes for a single note.
	* @param defaults (object) - Optional settings to pass into playFn.
	* @param dest (AudioNode?) - Destination that sound will be played-to.
	* @returns (CompositeNode) - The created composite node.
	*/
	proto.createInstrument=function(playFn, defaults, dest) {
		var self=this;

		return {
			play: function(perfArgs, when) {
				//Return a CompositeNode containing the sound scheduled to start & stop.
				var settings=this.createSettings(perfArgs, when);
				return self.createComposite(playFn, settings).connect(dest||self.destination).play(settings.duration||0.25, settings.startTime);
			},
			start: function(perfArgs, when) {
				//Return a CompositeNode containing the started sound.
				var settings=this.createSettings(perfArgs, when);
				return self.createComposite(playFn, settings).connect(dest||self.destination).start(settings.startTime);
			},
			createSettings: function(perfArgs, when) {
				//If arg is name then create note setting.
				if(perfArgs&&typeof perfArgs!="object") {
					perfArgs={ note: perfArgs };
				}

				//If we have note then create frequency setting.
				if(perfArgs.note&&!perfArgs.frequency) {
					perfArgs.frequency=t.convertNoteToFrequency(perfArgs.note)||440;
				}

				//Merge performance and configuration settings.
				var settings={ startTime: when||self.currentTime }, m;
				for(m in defaults) { settings[m]=defaults[m]; }
				for(m in perfArgs) { settings[m]=perfArgs[m]; }

				return settings;
			},
			defaults: defaults
		};
	};

	/**
	* Setup-and-play a sound.
	* @param initFn (function) - Function to setup audio nodes for sound.
	* @param arg (object?) - Settings to pass to initFn.
	* @param duration (double?) - The duration of the sound (in seconds).
	* @param when (double?) - Time (seconds relative to context's currentTime) that sound will start playing (0 = immediately).
	* @param dest (AudioNode?) - Destination that sound will be played-to.
	* @returns (AudioContextProxy) - The created composite node.
	*/
	proto.playFunction=function(initFn, arg, duration, when, dest) {
		var settings=arg||{};

		//If arg is name then create note setting.
		if(arg&&typeof arg!="object") {
			settings={ note: arg };
		}

		//If we have note then create frequency setting.
		if(settings.note&&!settings.frequency) {
			settings.frequency=t.convertNoteToFrequency(settings.note)||440;
		}

		return this.createComposite(initFn, settings)
			.connect(dest||this.destination)
			.play(duration, when);
	};
})(this);
