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
	var t=global.tony;

	//Map chromatic scale note-names to frequencies.
	var noteNames=[["C"], ["C#", "Db"], ["D"], ["D#", "Eb"], ["E"], ["F"], ["F#", "Gb"], ["G"], ["G#", "Ab"], ["A"], ["A#", "Bb"], ["B"]];
	noteMap={};
	for(var n=0;n<noteNames.length;n++) {
		for(var oct=0;oct<9;oct++) {
			for(var m in noteNames[n]) { noteMap[noteNames[n][m]+oct]=((oct+1)*12)+n; }
		}
	}

	/**
	* Calculate the frequency for the specified note-name or note-number.
	* @param noteId (object) - Note name or MIDI note number.
	* @returns (double)
	*/
	t.convertNoteToFrequency=function(noteId) {
		var noteNumber=noteMap[noteId]||noteId;
		return Math.pow(2, (noteNumber-69)/12)*440.0;
	};
})(this);
