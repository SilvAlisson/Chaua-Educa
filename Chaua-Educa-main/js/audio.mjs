import {lightningStrikeAt} from './lightning.mjs';

const AUDIO_NOTES = Object.freeze({
    countdown: [440], 'snake-warning': [330, 220], 'hawk-warning': [740, 494], fruit: [660, 880],
    shield: [330, 494, 660], 'shield-break': [220, 147], feather: [523, 659, 784, 1046],
    'feather-end': [660, 440], pepper: [440, 554, 659, 880, 1108], 'pepper-end': [880, 659, 440],
    'tutorial-step': [523, 659], 'tutorial-complete': [659, 784, 1046], correct: [660, 880, 990],
    incorrect: [260, 196], lose: [392, 330, 220], win: [523, 659, 784, 1046, 1318]
});

const THUNDER_CLIPS = Object.freeze([
    Object.freeze({offset: .08, duration: .90, delay: .12, gain: .72}), // short: ~0.87–0.93 s
    Object.freeze({offset: 2.62, duration: 1.35, delay: .32, gain: .61}), // medium: ~1.31–1.39 s
    Object.freeze({offset: .04, duration: 2.45, delay: .54, gain: .53}) // long: ~2.38–2.53 s
]);

const SHORT_VOLUME_TYPES = new Set(['countdown','snake-warning','hawk-warning','feather-end','pepper-end']);

// Local wind ambience plus two CC0 real thunder recordings. No synthesized thunder crackle.
export class ForestAudio {
    constructor(contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)(), fetchThunder=url=>fetch(url)) {
        this.contextFactory=contextFactory;this.enabled=false;this.context=null;
        this.liveTones=new Set();this.volume=.7;this.voices=0;this.nextFilter=0;this.visible=true;this.active=false;this.lastFlap=-Infinity;
        this.lastThunderStrike=-1;
        this.thunderBuffer=null;
        this.thunderLoading=null;
        this.thunderLoadFailed=false;
        this.thunderVoices=new Set();
        this.fetchThunder=fetchThunder;
    }
    setVolume(value) {
        this.volume=Number.isFinite(value)?Math.max(0,Math.min(1,value)):.7;
        try {if(this.master)this.master.gain.setTargetAtTime(this.enabled&&this.visible?this.volume:0,this.context.currentTime,.04);} catch {}
    }
    setEnabled(enabled) {
        this.enabled=enabled;
        if(!enabled)this.stopThunder();
        try {if(!enabled && this.master)this.master.gain.setTargetAtTime(0,this.context.currentTime,.025);} catch {}
    }
    ensure() {
        if(!this.enabled||!this.visible)return false;
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
                this.wind.connect(this.filter).connect(this.ambient).connect(this.master);
                this.wind.start();
            }
            if(['suspended','interrupted'].includes(this.context.state)&&this.visible)this.context.resume().catch(()=>{});
            this.master.gain.setTargetAtTime(this.visible?this.volume:0,this.context.currentTime,.04);
            this.prewarmThunder();
            return true;
        } catch { this.context=null;this.thunderBuffer=null;this.thunderLoading=null;return false; }
    }
    tone(frequency,when,duration=.18,volume=.045,type='sine',end=frequency) {
        if(this.voices>=24)return;
        const c=this.context,o=c.createOscillator(),g=c.createGain();
        this.voices++;
        let released=false;
        const release=()=>{
            if(released)return;released=true;this.voices=Math.max(0,this.voices-1);
            this.liveTones.delete(o);o.disconnect();g.disconnect();
        };
        try {
            this.liveTones.add(o);o.type=type;o.frequency.setValueAtTime(frequency,when);o.frequency.exponentialRampToValueAtTime(Math.max(30,end),when+duration);
            g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(volume,when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
            o.connect(g).connect(this.master);o.onended=release;o.start(when);o.stop(when+duration+.015);
        } catch {release();}

    }
    play(type) {
        if(!this.enabled||!this.visible)return;
        if(type==='thunder'){if(this.ensure())this.playThunder(1,lightningStrikeAt(0));return;}
        // UI-only events should never initialize an audio device.
        const notes=AUDIO_NOTES;
        if(type!=='flap'&&!notes[type])return;
        if(!this.ensure())return;
        const now=this.context.currentTime;
        try {
            if(type==='flap') {
                if(now-this.lastFlap<.15)return;
                this.lastFlap=now;this.tone(210,now,.09,.15,'triangle',70);this.tone(140,now+.02,.07,.12,'sine',50);return;
            }
            const seq = notes[type];
            const vol = SHORT_VOLUME_TYPES.has(type) ? .08 : .18;
            const wave = type === 'shield-break' ? 'triangle' : 'sine';
            for (let i = 0; i < seq.length; i++) {
                this.tone(seq[i], now + i * .075, .18, vol, wave);
            }
        } catch { /* Audio failure never blocks the game. */ }
    }
    // Real MP3 samples are fetched from this Pages deployment once and decoded
    // asynchronously after a user interaction. Neither fetch nor decode runs
    // synchronously inside a render frame.
    prewarmThunder() {
        if(!this.context||this.thunderBuffer||this.thunderLoadFailed)return this.thunderLoading;
        if(this.thunderLoading)return this.thunderLoading;
        const context=this.context;
        const source=new URL('../sounds/thunder-real.mp3?v=1.0.11-real-thunder',import.meta.url);
        this.thunderLoading=Promise.resolve()
            .then(()=>this.fetchThunder(source.href))
            .then(response=>{
                if(!response?.ok)throw new Error('Thunder recording unavailable');
                return response.arrayBuffer();
            })
            .then(bytes=>context.decodeAudioData(bytes))
            .then(buffer=>{
                // Two distinct real recordings are packed into a single MP3.
                if(!buffer||buffer.duration<5.2)throw new Error('Truncated thunder recording');
                if(this.context===context)this.thunderBuffer=buffer;
                return buffer;
            })
            .catch(()=>{
                this.thunderLoadFailed=true;
                return null;
            });
        return this.thunderLoading;
    }
    beginFlight() {
        this.stopThunder();
        this.lastThunderStrike=-1;
    }
    stopThunder() {
        const now=this.context?.currentTime??0;
        for(const voice of this.thunderVoices){
            try {
                voice.gain.gain.cancelScheduledValues(now);
                voice.gain.gain.setTargetAtTime(0,now,.012);
                voice.source.stop(now+.08);
            } catch { /* Already finished or interrupted by device */ }
        }
        this.thunderVoices.clear();
    }
    playThunder(storm=1,strike=lightningStrikeAt(0)) {
        if(!this.enabled||!this.visible||!this.context||this.context.state!=='running')return;
        // No artificial hiss/white noise fallback. If still loading, skip only
        // this strike rather than playing a late, out-of-sync sample.
        if(!this.thunderBuffer){this.prewarmThunder();return;}
        try {
            const c=this.context,now=c.currentTime;
            // Three real thunder excerpts, each fully inside its own source
            // section. They never cross the separator in the packaged MP3.
            // The short/medium/long categories stay inside the requested audible
            // duration ranges even with the tiny deterministic pitch variation.
            const variant=((Math.trunc(strike.index||0)%3)+3)%3;
            const clip=THUNDER_CLIPS[variant];
            const usable=Math.max(.1,Math.min(clip.duration,this.thunderBuffer.duration-clip.offset));
            const playbackRate=Math.max(.97,Math.min(1.03,1+((strike.pitch??1)-1)*.28));
            const start=now+clip.delay;
            const gainValue=Math.min(.72,Math.max(.04,storm*clip.gain*(strike.amplitude??1)));
            const source=c.createBufferSource(),gain=c.createGain();
            source.buffer=this.thunderBuffer;
            source.playbackRate.setValueAtTime(playbackRate,now);
            gain.gain.setValueAtTime(0,now);
            gain.gain.setValueAtTime(0,start);
            gain.gain.linearRampToValueAtTime(gainValue,start+.035);
            // Fade ends inside the requested source segment; no abrupt cutoff.
            const playbackSeconds=usable/playbackRate;
            const tail=Math.min(.55,Math.max(.16,playbackSeconds*.18));
            gain.gain.setTargetAtTime(0,start+playbackSeconds-tail,Math.max(.035,tail*.19));
            source.connect(gain).connect(this.master);
            const voice={source,gain};
            this.thunderVoices.add(voice);
            source.onended=()=>{
                this.thunderVoices.delete(voice);
                try{source.disconnect();gain.disconnect();}catch{}
            };
            source.start(start,clip.offset,usable);
        } catch { /* Browser audio interruption must not affect the game. */ }
    }
    update(state,visible,time,stage,rain=0,storm=0,wind=0) {
        if(!this.context || this.context.state==='closed')return;
        try {
        if(this.visible!==visible){
            this.visible=visible;
            if(!visible){
                this.stopThunder();
                for(const oscillator of this.liveTones){try{oscillator.stop();}catch{}}
            }
            this.master.gain.setTargetAtTime(this.enabled&&visible?this.volume:0,this.context.currentTime,.025);
            // Muting a gain node does NOT stop Biquad processing. Suspend the
            // audio graph when hidden and resume it on focus restoration.
            const context=this.context;
            if(!visible&&context.state==='running'){
                context.suspend().then(()=>{
                    // Focus may have returned before suspension completed.
                    if(this.visible&&this.enabled&&context.state==='suspended')
                        return context.resume();
                }).catch(()=>{});
            }else if(visible&&this.enabled&&context.state==='suspended'){
                context.resume().catch(()=>{});
            }
        }
        const active=this.enabled&&visible&&['menu','playing','countdown','arrival'].includes(state);
        const c=this.context;
        if(active!==this.active) {
            this.active=active;this.ambient.gain.setTargetAtTime(active ? .2 : 0,c.currentTime,.25);
            if(!active)this.stopThunder();
        }
        const stormVisible=['playing','arrival'].includes(state);
        if(!stormVisible&&this.thunderVoices.size)this.stopThunder();
        if(!active||c.state!=='running')return;
        const audibleStorm=stormVisible?storm:0;
        if(audibleStorm>.05){
            const strike=lightningStrikeAt(time);
            if(strike.active&&strike.index!==this.lastThunderStrike){
                this.lastThunderStrike=strike.index;
                this.playThunder(audibleStorm,strike);
            }
        }
        if(c.currentTime>=this.nextFilter){
            this.nextFilter=c.currentTime+.1;
            const windFrequency = 750 + Math.sin(time * .6) * 180 + stage * 90 + wind * 350;
            this.filter.frequency.setTargetAtTime(windFrequency + rain * 1450 + storm * 450,c.currentTime,.5);
        }
        } catch { /* Device interruption must not stop the rendering loop. */ }
    }
}
