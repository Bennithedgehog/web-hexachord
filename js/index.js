//Author: Corentin Guichaoua

// Vue.config.devtools = true
// Vue.config.performance = true


// ============================================================================

// Reload the screen after 2 minutes of inactivity.
let timeout = null;
function restartTimeout() {
  clearTimeout(timeout);
//   timeout = setTimeout(() => window.location.reload(), 1000 * 120); // 2 mins
}
document.addEventListener('touchdown', restartTimeout);
document.addEventListener('mousemove', restartTimeout);
//An additional listener is added upon connecting a Midi Input

// ============================================================================
// Geometry constants and coordinate conversions

const xstep=Math.sqrt(3)/2 //Ratio of horizontal to vertical spacing = height of an equilateral triangle
const baseSize=50 //Base scale: height of a vartical step (in svg coordinates)

// Conversion between tonnetz coordinates and svg coordinates
const logicalToSvgX = node => node.x * xstep * baseSize;
const logicalToSvgY = node => (node.y + node.x/2) * baseSize;
const logicalToSvg = node => ({x:logicalToSvgX(node), y:logicalToSvgY(node)})


// ============================================================================
// Vue components and mixins

var piano; //Variable to hold the virtual piano (built later once JZZ is loaded)
//var midiBus; //Variable to hold the bus for upgoing midiEvents (built once Vue is loaded)
var proto; //Variable to hold the main app Object (built once everything is loaded)



// Global object to store recording and its state
var record = {
    startTime:undefined,
    SMF:undefined,
    recording:false
}

// Wait for libraries to be loaded
fallback.ready(function(){

// The App's main object, handling global concerns
proto = new Vue({
    el: '#proto',
    components: {clockOctave,songLoader,pianoKeyboard,playRecorder,tonnetzView,languageSelector,intervalTable},
    data: {
        // The list of all 3-interval Tonnetze
        tonnetze: tonnetze3,
        // The selected interval set
        intervals: tonnetze3[9],
        // The type of representation for the main window ('tonnetz' or 'chicken')
        type: 'tonnetz',
        // The list of all notes: their name and their status
        notes: Array.from(Array(12),(_x,index) => ({id:index,count:0})),
        // notes: (strings[language] || strings.en).notes.map( function(note_name_local, index) { 
        //     // use text for display and id for CSS styling
        //     return {text: note_name_local, id: strings.en.notes[index], count: 0};
        // }),
        // Synthetiser engine
        synth: JZZ.synth.Tiny(),
        //synth:JZZ.synth.MIDIjs({ 
            //TODO: Use a soundfont from our own server
            //soundfontUrl: "https://raw.githubusercontent.com/mudcube/MIDI.js/master/examples/soundfont/", 
            //instrument: "acoustic_grand_piano" })
                //.or(function(){ proto.loaded(); alert('Cannot load MIDI.js!\n' + this.err()); })
                //.and(function(){ proto.loaded(); }),
        // Azerty keyboard bindings
        ascii: JZZ.input.ASCII({
                A:'C5', W:'C#5', S:'D5', E:'D#5', D:'E5', F:'F5',
                T:'F#5', G:'G5', Z:'G#5', H:'A5', U:'A#5', J:'B5', K:'C6'
                }),
        
        // Should trajectory drawing be active?
        trace: false,
        // The localisation strings
        allStrings: strings,
        // The picked locale
        language: language || en
    },
    computed:{
        complementNotes: function(){
            return this.notes.map(note => ({id:note.id, count:note.count?0:1}));
        },
        strings: function(){
            return strings[this.language]
        },
        chordName: function(){
            const noteNames = ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#'];
            const chordTypes = [
                // Triads
                { intervals: [0,4,7],        name: 'Major' },
                { intervals: [0,3,7],        name: 'Minor' },
                { intervals: [0,3,6],        name: 'Diminished' },
                { intervals: [0,4,8],        name: 'Augmented' },
                { intervals: [0,2,7],        name: 'Sus2' },
                { intervals: [0,5,7],        name: 'Sus4' },
                { intervals: [0,4,6],        name: 'Major ♭5' },
                { intervals: [0,3,8],        name: 'Minor ♯5' },
                // Power chord
                { intervals: [0,7],          name: 'Power' },
                // 6th chords
                { intervals: [0,4,7,9],      name: 'Major 6th' },
                { intervals: [0,3,7,9],      name: 'Minor 6th' },
                // 7th chords
                { intervals: [0,4,7,11],     name: 'Major 7th' },
                { intervals: [0,4,7,10],     name: 'Dom 7th' },
                { intervals: [0,3,7,10],     name: 'Minor 7th' },
                { intervals: [0,3,7,11],     name: 'Minor-Major 7th' },
                { intervals: [0,3,6,10],     name: 'Half-Dim 7th' },
                { intervals: [0,3,6,9],      name: 'Dim 7th' },
                { intervals: [0,4,8,10],     name: 'Aug 7th' },
                { intervals: [0,4,8,11],     name: 'Aug Major 7th' },
                { intervals: [0,4,6,11],     name: 'Major 7th ♭5' },
                { intervals: [0,5,7,10],     name: '7sus4' },
                { intervals: [0,2,7,10],     name: '7sus2' },
                // Add chords
                { intervals: [0,2,4,7],      name: 'Add9' },
                { intervals: [0,2,3,7],      name: 'Minor Add9' },
                { intervals: [0,4,5,7],      name: 'Add11' },
                // 9th chords
                { intervals: [0,2,4,7,11],   name: 'Major 9th' },
                { intervals: [0,2,4,7,10],   name: 'Dom 9th' },
                { intervals: [0,2,3,7,10],   name: 'Minor 9th' },
                { intervals: [0,2,3,7,11],   name: 'Minor-Major 9th' },
                { intervals: [0,2,4,7,9],    name: '6/9' },
                { intervals: [0,2,5,7,10],   name: '9sus4' },
                // 11th chords
                { intervals: [0,2,4,5,7,10], name: 'Dom 11th' },
                { intervals: [0,2,3,5,7,10], name: 'Minor 11th' },
                { intervals: [0,2,4,5,7,11], name: 'Major 11th' },
                // 13th chords
                { intervals: [0,2,4,5,7,9,10],  name: 'Dom 13th' },
                { intervals: [0,2,3,5,7,9,10],  name: 'Minor 13th' },
                { intervals: [0,2,4,5,7,9,11],  name: 'Major 13th' },
            ];

            var active = this.notes
                .map(function(n, i){ return n.count > 0 ? i : -1; })
                .filter(function(i){ return i >= 0; });

            if(active.length < 2) return active.length === 1 ? { name: noteNames[active[0]], intervals: null } : null;

            for(var r = 0; r < active.length; r++){
                var root = active[r];
                var normalized = active.map(function(i){ return (i - root + 12) % 12; }).sort(function(a,b){ return a-b; });
                for(var c = 0; c < chordTypes.length; c++){
                    var chord = chordTypes[c];
                    if(chord.intervals.length === normalized.length &&
                       chord.intervals.every(function(v, i){ return v === normalized[i]; })){
                        return { name: noteNames[root] + ' ' + chord.name, intervals: normalized };
                    }
                }
            }

            var normalized = active.map(function(i){ return (i - active[0] + 12) % 12; }).sort(function(a,b){ return a-b; });
            return { name: active.map(function(i){ return noteNames[i]; }).join(' + '), intervals: normalized };
        }
    },
    created: function(){
        //Delay connection of MIDI devices to let JZZ finish its initialisation
        let deviceUpdate=this.deviceUpdate; // This is required to bring deviceUpdate into the lambda's context
        setTimeout(function(){deviceUpdate({inputs:{added:JZZ().info().inputs}})},1000);
        //Add a watcher to connect (and disconnect) new devices to the app
        JZZ().onChange(this.deviceUpdate);
    },
    methods:{
        //Handler for JZZ device change event
        deviceUpdate: function({inputs:{added,removed}}){
            console.log('Updating MIDI devices');
            if(added){
                for(device of added){
                    JZZ().openMidiIn(device.name)
                      .connect(midiBus.midiThru) // Send the keyboard's events to the midi bus which will relay them
                      .connect(restartTimeout); // Reset the page's timeout upon input
                    console.log('Added device: ',device);
                }
            }
            if(removed){
                for(device of removed){
                    JZZ().openMidiIn(device.name).disconnect(midiBus.midiThru);
                    console.log('Removed device: ',device);
                }
            }
            this.resetNotes(); // Connection/Disconnection can cause unbalanced note events
        },
        
        //Handler for Midi events coming from JZZ
        midiHandler: function (midiEvent){
            noteIndex = (midiEvent.getNote()+3) %12
            if(midiEvent.isNoteOn()){
                this.notes[noteIndex].count++;
            }else if(midiEvent.isNoteOff()){
                if(this.notes[noteIndex].count > 0){
                    this.notes[noteIndex].count--;
                }else{
                    console.log('Warning: ignored unbalanced noteOff event', midiEvent);
                }
            }
        },
        resetNotes: function(){
            for (note of this.notes){
                note.count = 0;
            }
        },
        traceToggle: function(){
            this.trace = !this.trace;
        },
        // Handlers for playback events fired from the app
        noteOn: function(pitches){
            //var notes = this.node2Notes(nodes);
            for (var pitch of pitches){
                midiBus.midiThru.noteOn(0,pitch,100);
            }
        },
        noteOff: function(pitches){
            //var notes = this.node2Notes(nodes);
            for (var pitch of pitches){
                midiBus.midiThru.noteOff(0,pitch,100);
            }
        },
        // Hard reset for the whole page
        reset(option) {
            if(option){
                window.location.search = '?hl='+option;
                console.log(window.location)
            }
            else{
                window.location.reload();
            }
        }
    },
    mounted(){
        //Handle midiBus events
        midiBus.$on('note-on',this.noteOn);
        midiBus.$on('note-off',this.noteOff);

        //Connect the Midi
        this.ascii.connect(midiBus.midiThru);
        midiBus.midiThru.connect(this.synth);
        midiBus.midiThru.connect(this.midiHandler);   
    }
})

}) // fallback.ready