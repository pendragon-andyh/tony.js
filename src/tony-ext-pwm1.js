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

	/**
	* Create a "pulse width modulation" oscillator.
	* This is like a square-wave, but where you can modulate the mark-space-ratio of the waveform.
	* @param settings (object) - Optional settings object.
	* @returns (CompositeNode) - Supersaw oscillator node. 
	*/
	proto.createPwmOscillator1=function(settings) {
		return this.createComposite(function(dest, settings) {
			var one=this.createSingleValueSource(1);

			//Expose parameters that can be configured and/or modulated from external nodes.
			this.frequency=this.createParam(440, one);
			this.detune=this.createParam(0, one);
			this.width=this.createParam(0, one);

			//Create the oscillator.
			var osc=this.createOscillator({ type: "triangle", frequency:0 });
			this.frequency.connect(osc.frequency);
			this.detune.connect(osc.detune);

			//Expose parameter to allow the mark-space ratio to be configured and/or modulated from external nodes.

			//Use a wave shaper to convert the sine-wave into a square-ish wave.
			//The are 256 points on the curve. The 1st 128 all result in -1, the second 128 result in +1.
			var shape=new Float32Array(256);
			for(var i=0;i<128;i++) {
				shape[i]= -1;
				shape[255-i]=1;
			}
			var shaper=this.createWaveShaper({ curve: shape });
			osc.connect(shaper);

			//Normally the sine wave goes between -1 and +1.  By connecting the "width" parameter we change the
			//wave-shaper's input to (width-1) and (width+1).
			//The waveshaper will clip any values outside of the range of -1 and +1.
			this.width.connect(shaper);

			shaper.connect(dest);
		}, settings);
	};
})(this);
