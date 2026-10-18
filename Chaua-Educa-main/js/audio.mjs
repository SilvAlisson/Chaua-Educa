// Synthesized local ambience: no network audio, timers or autoplay before interaction.
export class ForestAudio {
    constructor(contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)()) {
        this.contextFactory=contextFactory;this.enabled=false;this.context=null;
        this.volume=.7;this.voices=0;this.nextFilter=0;this.visible=true;this.nextChirp=0;this.active=false;this.lastFlap=-Infinity;
    }
    setVolume(value) {
        this.volume=Number.isFinite(value)?Math.max(0,Math.min(1,value)):.7;
        try {if(this.master)this.master.gain.setTargetAtTime(this.enabled&&this.visible?this.volume:0,this.context.currentTime,.04);} catch {}
    }
    setEnabled(enabled) {
        this.enabled=enabled;
        try {if(!enabled && this.master)this.master.gain.setTargetAtTime(0,this.context.currentTime,.025);} catch {}
    }
    ensure() {
        if(!this.enabled)return false;
        try {
            if(!this.context) {
                const c=this.context=this.contextFactory();
                this.master=c.createGain();this.master.gain.value=this.volume;this.master.connect(c.destination);
                const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);
                let last=0;
                for(let i=0;i<data.length;i++) {
                    last=(last+(Math.random()*2-1)*.035)/1.035;
                    data[i]=last*Math.min(1,i/256,(data.length-1-i)/256);
                }
                this.wind=c.createBufferSource();this.wind.buffer=buffer;this.wind.loop=true;
                this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=900;
                this.ambient=c.createGain();this.ambient.gain.value=0;
                this.wind.connect(this.filter).connect(this.ambient).connect(this.master);this.wind.start();
            }
            if(this.context.state==='suspended')this.context.resume().catch(()=>{});
            this.master.gain.setTargetAtTime(this.visible?this.volume:0,this.context.currentTime,.04);
            return true;
        } catch { this.context=null;return false; }
    }
    tone(frequency,when,duration=.18,volume=.045,type='sine',end=frequency) {
        if(this.voices>=24)return;
        const c=this.context,o=c.createOscillator(),g=c.createGain();
        this.voices++;
        let released=false;
        const release=()=>{
            if(released)return;released=true;this.voices=Math.max(0,this.voices-1);
            o.disconnect();g.disconnect();
        };
        try {
            o.type=type;o.frequency.setValueAtTime(frequency,when);o.frequency.exponentialRampToValueAtTime(Math.max(30,end),when+duration);
            g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(volume,when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
            o.connect(g).connect(this.master);o.onended=release;o.start(when);o.stop(when+duration+.015);
        } catch {release();}

    }
    play(type) {
        if(!this.enabled)return;
        // UI-only events should never initialize an audio device.
        const notes={fruit:[660,880],shield:[330,494,660],'shield-break':[220,147],feather:[523,659,784,1046],
            'feather-end':[660,440],'tutorial-step':[523,659],'tutorial-complete':[659,784,1046],correct:[660,880,990],incorrect:[260,196],lose:[392,330,220],win:[523,659,784,1046,1318]};
        if(type!=='flap'&&!notes[type])return;
        if(!this.ensure())return;
        const now=this.context.currentTime;
        try {
            if(type==='flap') {
                if(now-this.lastFlap<.15)return;
                this.lastFlap=now;this.tone(180,now,.1,.018,'triangle',65);return;
            }
            notes[type].forEach((f,i)=>this.tone(f,now+i*.075,.18,type==='feather-end' ? .025 : .05,type==='shield-break'?'triangle':'sine'));
        } catch { /* Audio failure never blocks the game. */ }
    }
    update(state,visible,time,stage) {
        if(!this.context || this.context.state==='closed')return;
        try {
        if(this.visible!==visible){
            this.visible=visible;
            this.master.gain.setTargetAtTime(this.enabled&&visible?this.volume:0,this.context.currentTime,.025);
        }
        const active=this.enabled&&visible&&['menu','playing','countdown','arrival'].includes(state);
        const c=this.context;
        if(active!==this.active) {
            this.active=active;this.ambient.gain.setTargetAtTime(active ? .2 : 0,c.currentTime,.25);
        }
        if(!active||c.state!=='running')return;
        if(c.currentTime>=this.nextFilter){
            this.nextFilter=c.currentTime+.1;
            this.filter.frequency.setTargetAtTime(750+Math.sin(time*.6)*180+stage*90,c.currentTime,.5);
        }
        if(c.currentTime>=this.nextChirp) {
            this.nextChirp=c.currentTime+5+(Math.sin(time)*.5+.5)*5;
            this.tone(1650,c.currentTime,.13,.012,'sine',2300);
            this.tone(2100,c.currentTime+.18,.16,.009,'sine',1450);
        }
        } catch { /* Device interruption must not stop the rendering loop. */ }
    }
}
