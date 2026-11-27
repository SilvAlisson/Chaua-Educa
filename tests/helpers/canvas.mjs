// Minimal Canvas test double. Real pixels and alpha are checked by Playwright.
export function canvasSpy(){
 const draws=[],fills=[],patterns=[],transforms=[],stack=[];
 const c={globalAlpha:1,globalCompositeOperation:'source-over',
  drawImage(...args){draws.push(args);},
  fillRect(...args){fills.push(args);},
  createPattern(image,repetition){const pattern={image,repetition};patterns.push(pattern);return pattern;},
  createLinearGradient(){return {addColorStop(){}};},
  createRadialGradient(){return {addColorStop(){}};},
  save(){stack.push({globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation});},
  restore(){Object.assign(this,stack.pop()||{});},
  translate(...args){transforms.push(['translate',...args]);},
  scale(...args){transforms.push(['scale',...args]);}
 };
 for(const name of ['clearRect','beginPath','closePath','rect','clip','moveTo','lineTo','arc','ellipse','rotate','stroke','fill','quadraticCurveTo','bezierCurveTo','setTransform'])c[name]=()=>{};
 return {c,draws,fills,patterns,transforms};
}
export function installCanvasMock(t){
 const previous=globalThis.OffscreenCanvas,surfaces=[];
 globalThis.OffscreenCanvas=class{
  constructor(width,height){this.width=width;this.height=height;this.spy=canvasSpy();surfaces.push(this);}
  getContext(){return this.spy.c;}
 };
 t.after(()=>{if(previous===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=previous;});
 return surfaces;
}
