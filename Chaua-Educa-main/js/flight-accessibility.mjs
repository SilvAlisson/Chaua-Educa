// UI cues follow existing warnings; they never predict or change encounters.
export function nativeKeyboardTarget(target) {
    return !!target?.closest?.('button,a,input,select,textarea,summary,[contenteditable="true"],[role="tab"]');
}
const snakeActive=e=>e.kind==='wood'&&['warning','windup','striking'].includes(e.snake?.phase);
const hawkActive=(e,g)=>e.kind==='hawk'&&!e.harmless&&e.x>g.x+100;
export class FlightCues {
    constructor(){this.reset();}
    reset(){this.seen=new WeakSet();this.beat=null;}
    countdown(number){const changed=number!==null&&number!==this.beat;this.beat=number;return changed;}
    hasWarnings(g){return ['playing','arrival'].includes(g.state)&&g.entities.some(e=>snakeActive(e)||hawkActive(e,g));}
    warnings(g){
        if(!['playing','arrival'].includes(g.state))return [];
        const cues=[];
        for(const e of g.entities){
            const snake=snakeActive(e),hawk=hawkActive(e,g);
            if((!snake&&!hawk)||this.seen.has(e))continue;
            this.seen.add(e);
            cues.push(snake?{sound:'snake-warning',text:'Cobra à frente · observe o bote e busque espaço livre acima.'}:
                {sound:'hawk-warning',text:'Gavião à frente · observe a rota marcada e procure espaço livre.'});
        }
        return cues;
    }
}
