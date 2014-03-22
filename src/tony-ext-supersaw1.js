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
	var proto=global.tony.AudioContextProxy.prototype;

	//Pre-compute offsets for the detuned oscillators.
	// * detune - frequency-multiplier to detune the oscillator from the central frequency.
	//				This can be modulated by the "width" parameter.
	//				Values from www.ghostfact.com/jp-8000-supersaw/
	// * gain - multiplier to set the gain-level of the oscillator.
	//				Default to 1/6 because there are 6 detuned oscilators.
	//				Half are negative-gains to make distortion less likely.
	// * isCentre - True for the central oscillator.
	var oscFactors=[
		{ detune: -0.107, gain: 1/6, type: "sawtooth" },
		{ detune: -0.061, gain: -1/6, type: "sawtooth" },
		{ detune: -0.0157, gain: 1/6, type: "sawtooth" },
		{ detune: 0, gain: 1, isCentre: true, type: "sawtooth" },
		{ detune: 0.02, gain: 1/6, type: "sawtooth" },
		{ detune: 0.064, gain: -1/6, type: "sawtooth" },
		{ detune: 0.11, gain: 1/6, type: "sawtooth" }
	];

	/**
	* Create a "supersaw" oscillator.
	* @param settings (object) - Optional settings object.
	* @returns (CompositeNode) - Supersaw oscillator node. 
	*/
	proto.createSupersaw1=function(settings) {
		return this.createComposite(function(dest, settings) {
			var one=this.createSingleValueSource(1);

			//Expose parameters that can be configured and/or modulated from external nodes.
			this.frequency=this.createParam(one, 440);
			this.detune=this.createParam(one, 0);
			this.width=this.createParam(one, 0.5);
			this.mix=this.createParam(one, 0.7);

			//Create a gain node for the level of the centre-oscillator (gain=1-mix).
			var centreMix=this.createGain({ gain: 1 }).connect(dest);
			var invertMixLevel=this.createGain({ gain: -1 }).connect(centreMix.gain);
			this.mix.connect(invertMixLevel);

			//Create a gain node for the level of the detuned-oscillators (gain=mix).
			var detuneMix=this.createGain({ gain: 0 }).connect(dest);
			this.mix.connect(detuneMix.gain);

			//Use exponential-scaling for the "width" parameter.
			//The WaveshaperNode would give more control - but all browsers currently have broken implementation.
			var nonLinearWidth=this.createGain({ gain: 0 });
			this.width.connect(nonLinearWidth).connect(nonLinearWidth.gain);

			//Create bank of oscillators.
			for(var i=0;i<oscFactors.length;i++) {
				var oscFactor=oscFactors[i];

				//All oscillators share central frequency and detune so that they stay in sync.
				var osc=this.createOscillator({ type: oscFactor.type, frequency: 0, gain: oscFactor.gain });
				this.frequency.connect(osc.frequency);
				this.detune.connect(osc.detune);

				//Customise each oscillator.
				if(oscFactor.isCentre) {
					//Connect centre oscillator to it's output mixer.
					osc.connect(centreMix);
				} else {
					//Detune oscillator relative to the centre-frequency.
					var frequencyOffset=this.createGain({ gain: 0 }).connect(osc.frequency);
					this.frequency.connect(frequencyOffset);
					nonLinearWidth.connect(this.createGain({ gain: oscFactor.detune }).connect(frequencyOffset.gain));

					//Connect oscillator to it's output mixer.
					osc.connect(detuneMix);
				}
			}

		}, settings);
	};
})(this);
