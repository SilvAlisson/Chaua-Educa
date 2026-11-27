// WebGL presentation for the game and its presentation screens. Keep a single game clock.
// The existing artwork specifies the drawing order, atlas rectangles and poses.
import {Container, Sprite, Texture, MeshGeometry, Rectangle, Matrix, Graphics, GraphicsPath, TextureSource, ImageSource, RenderTexture, Color, WebGLRenderer} from './vendor/pixi/pixi-8.6.6.mjs';
import {SceneGradient, dashPath, WetFruitMesh} from './pixi-paint.mjs';
import {GLYPHS, GLYPH_URL} from './pixi-glyphs.mjs';
import {SCENE_REBUILD_CONTROL,WET_FOOD_CACHE_CONTROL} from './perf-ab.mjs';

let glyphAtlas;
const sourceCaches=new WeakMap();
async function loadGlyphAtlas(){
 if(glyphAtlas)return glyphAtlas;
 const atlas=new Image();
 atlas.src=GLYPH_URL.href;
 await atlas.decode();
 glyphAtlas=await createImageBitmap(atlas);
 return glyphAtlas;
}

const DEFAULT_STATE={
 globalAlpha:1,globalCompositeOperation:'source-over',font:'10px Nunito',
 textAlign:'start',textBaseline:'alphabetic',fillStyle:'#000',strokeStyle:'#000',
 lineWidth:1,lineCap:'butt',lineJoin:'miter',dash:[]
};
const BLEND_MODES={'source-atop':'source-atop','destination-in':'destination-in',screen:'screen'};


export async function createPixiRenderer(original, {background = false} = {}){
 const canvas=document.createElement('canvas');
 canvas.style.cssText=background
  ? 'position:absolute;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none'
  : 'position:absolute;inset:0;pointer-events:none';
 canvas.setAttribute('aria-hidden','true');
 await loadGlyphAtlas();
 const gpu=new WebGLRenderer();
 await gpu.init({canvas,width:original.width,height:original.height,antialias:true,resolution:1,backgroundAlpha:background?1:0});
 const gl=gpu.gl;
 gpu.state.blendModesMap['source-atop']=[gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE];
 gpu.state.blendModesMap['destination-in']=[gl.ZERO,gl.SRC_ALPHA];
 if(!background)original.parentElement.style.position='relative';
 original.after(canvas);
 canvas.hidden=true;
 sourceCaches.set(gpu,new WeakMap());
 const scene=new PixiScene(canvas,gpu,background&&!SCENE_REBUILD_CONTROL);
 const presentation=new Container();
 presentation.addChild(scene.root);
 if(background){
  const backdrop=new SeasonalAtlasLayer();
  presentation.addChildAt(backdrop.container,0);
  scene.drawSeasonalAtlas=(atlas,state,x,y,width,height)=>
   backdrop.draw(scene.source(atlas).source,atlas,state,x,y,width,height);
  scene.seasonalLayer=backdrop.container;
 }
 return {
  canvas,
  context:scene,
  createSurface:(width,height)=>new RenderSurface(gpu,width,height),
  dispose(){canvas.remove();original.style.visibility='';scene.resetEntities();presentation.destroy({children:true});gpu.destroy();},
  draw(paint){
   if(gpu.gl.isContextLost())throw new Error('Contexto WebGL perdido. Recarregue o teste.');
   if(canvas.width!==original.width||canvas.height!==original.height)gpu.resize(original.width,original.height);
   scene.begin();
   paint(scene);
   scene.finish();
   gpu.render(presentation);
   canvas.hidden=false;
   original.style.visibility='hidden';
  }
 };
}

// A backdrop keeps the same sprite pair and the same four atlas views across frames.
class SeasonalAtlasLayer {
 constructor(){
  this.container=new Container();
  this.container.visible=false;
  this.layers=[new Sprite(),new Sprite()];
  this.container.addChild(...this.layers);
  this.textures=[];
 }
 draw(source,atlas,{from,to,mix},x,y,width,height){
  if(source!==this.source){
   for(const texture of this.textures)texture.destroy();
   const cellWidth=atlas.naturalWidth/2,cellHeight=Math.floor(atlas.naturalHeight/2);
   this.textures=Array.from({length:4},(_,index)=>new Texture({source,
    frame:new Rectangle((index%2)*cellWidth,index<2?0:atlas.naturalHeight-cellHeight,cellWidth,cellHeight)
   }));
   this.source=source;
  }
  const crossfade=from!==to&&mix>.002&&mix<.998;
  const [base,overlay]=this.layers;
  base.texture=this.textures[mix>=.998?to:from];
  base.position.set(x,y);base.setSize(width,height);
  overlay.visible=crossfade;
  if(crossfade){
   overlay.texture=this.textures[to];
   overlay.position.set(x,y);overlay.setSize(width,height);overlay.alpha=mix;
  }
  this.container.visible=true;
 }
}

class DrawPool {
 constructor(){
  this.sprites=[];this.graphics=[];this.groups=[];this.wetFruits=[];
  this.begin();
 }
 begin(){this.spriteCount=this.graphicCount=this.groupCount=this.wetFruitCount=0;}
 releaseUnusedMasks(){
  for(let i=this.groupCount;i<this.groups.length;i++)this.groups[i].mask=null;
 }
 destroy(){
  for(const group of this.groups){group.mask=null;group.destroy();}
  for(const sprite of this.sprites){sprite.barkTexture?.destroy();sprite.destroy();}
  for(const graphic of this.graphics)graphic.destroy();
  for(const mesh of this.wetFruits){mesh.shader.destroy();mesh.destroy();}
 }
}

// Preserve insertion order and only touch the scene graph when a child
// enters, leaves, or moves relative to other children.
class RetainedChildren {
 constructor(){
  this.parents=new WeakMap();
  this.touched=[];
  this.frame=0;
 }
 begin(){this.frame++;this.touched.length=0;this.edits=0;}
 visit(parent){
  let cursor=this.parents.get(parent);
  if(!cursor){cursor={parent,frame:-1,count:0};this.parents.set(parent,cursor);}
  if(cursor.frame!==this.frame){
   cursor.frame=this.frame;
   cursor.count=0;
   this.touched.push(cursor);
  }
  return cursor;
 }
 place(parent,node){
  const cursor=this.visit(parent),index=cursor.count++;
  if(parent.children[index]!==node){
   if(node.parent===parent)parent.setChildIndex(node,index);
   else parent.addChildAt(node,index);
   this.edits++;
  }
 }
 finish(){
  for(const {parent,count} of this.touched){
   if(parent.children.length>count){
    this.edits+=parent.children.length-count;
    parent.removeChildren(count);
   }
  }
 }
}

class PixiScene {
 constructor(canvas,gpu,retain=false){
  this.canvas=canvas;
  this.gpu=gpu;
  this.state={...DEFAULT_STATE,matrix:new Matrix()};
  this.root=new Container();
  this.sources=sourceCaches.get(gpu);
  this.patterns=new WeakMap();
  this.framePool=new DrawPool();
  this.pool=this.framePool;
  this.retained=retain?new RetainedChildren():null;
  this.entities=new Map();
  this.entityScope=null;
  this.entitiesCreated=0;this.entitiesReleased=0;this.peakEntities=0;
  this.frameEdits=0;this.totalEdits=0;this.renderedFrames=0;
  this.parents=[];
  this.matrix=new Matrix();
 }
 begin(){
  if(this.seasonalLayer)this.seasonalLayer.visible=false;
  this.frameEdits=0;
  this.pool=this.framePool;
  if(this.retained){
   this.retained.begin();
   this.retained.visit(this.root);
   this.pool.begin();
  }else this.recycleNodes();
  this.parent=this.root;
  this.parents.length=0;
  this.stack=[];
  this.state={...DEFAULT_STATE,matrix:new Matrix()};
  this.dirty=false;
 }
 recycleNodes(){
  if(this.seasonalLayer)this.frameEdits+=this.root.children.length;
  this.root.removeChildren();
  for(let i=0;i<this.pool.groupCount;i++){
   const group=this.pool.groups[i];
   if(this.seasonalLayer)this.frameEdits+=group.children.length;
   group.mask=null;group.removeChildren();
  }
  this.pool.begin();
 }
 attach(node){
  if(this.retained)this.retained.place(this.parent,node);
  else{
   this.parent.addChild(node);
   if(this.seasonalLayer)this.frameEdits++;
  }
 }
 beginEntity(key){
  if(!this.retained||key==null)return;
  let entry=this.entities.get(key);
  if(!entry){
   entry={container:new Container(),pool:new DrawPool(),parent:null,frame:0};
   this.entities.set(key,entry);
   this.entitiesCreated++;
  }
  this.attach(entry.container);
  this.retained.visit(entry.container);
  entry.frame=this.retained.frame;
  entry.parent=this.parent;
  this.entityScope=entry;
  this.parent=entry.container;
  this.pool=entry.pool;
  this.pool.begin();
 }
 endEntity(){
  if(!this.entityScope)return;
  this.parent=this.entityScope.parent;
  this.entityScope=null;
  this.pool=this.framePool;
 }
 releaseEntity(key,entry){
  entry.pool.destroy();
  entry.container.destroy();
  this.entities.delete(key);
  this.entitiesReleased++;
 }
 resetEntities(){
  for(const [key,entry] of this.entities)this.releaseEntity(key,entry);
 }
 finish(){
  if(this.retained){
   this.retained.finish();
   this.frameEdits=this.retained.edits;
   this.framePool.releaseUnusedMasks();
   for(const [key,entry] of this.entities){
    if(entry.frame!==this.retained.frame)this.releaseEntity(key,entry);
    else entry.pool.releaseUnusedMasks();
   }
   this.peakEntities=Math.max(this.peakEntities,this.entities.size);
  }
  this.renderedFrames++;
  this.totalEdits+=this.frameEdits;
 }
 sceneGraphReport(){
  return {mode:this.retained?'persistent':'rebuild',activeEntities:this.entities.size,
   peakEntities:this.peakEntities,created:this.entitiesCreated,released:this.entitiesReleased,
   renderedFrames:this.renderedFrames,totalChildEdits:this.totalEdits,lastFrameChildEdits:this.frameEdits};
 }
 save(){this.stack.push(this.state);this.state={...this.state,matrix:this.state.matrix.clone()};this.parents.push(this.parent);}
 restore(){if(this.stack.length){this.state=this.stack.pop();this.parent=this.parents.pop();}}
 getTransform(){
  const {a,b,c,d,tx,ty}=this.state.matrix;
  return {a,b,c,d,e:tx,f:ty};
 }
 setTransform(a,b,c,d,x,y){this.state.matrix.set(a,b,c,d,x,y);}
 transform(...values){this.state.matrix.append(new Matrix(...values));}
 translate(x,y){const m=this.state.matrix;m.tx+=m.a*x+m.c*y;m.ty+=m.b*x+m.d*y;}
 scale(x,y){const m=this.state.matrix;m.a*=x;m.b*=x;m.c*=y;m.d*=y;}
 rotate(angle){const c=Math.cos(angle),s=Math.sin(angle);this.transform(c,s,-s,c,0,0);}
 clearRect(x,y,width,height){
  if(this.canvas instanceof RenderSurface&&x===0&&y===0&&width>=this.canvas.width&&height>=this.canvas.height&&!this.stack.length&&this.state.matrix.isIdentity()){
   this.recycleNodes();this.canvas.clearPending=true;this.dirty=false;return;
  }
  const style=this.fillStyle,alpha=this.globalAlpha;
  this.fillStyle='#fff';this.globalAlpha=1;
  this.beginPath();this.rect(x,y,width,height);
  this.graphic().fill(0xffffff).blendMode='erase';
  this.fillStyle=style;this.globalAlpha=alpha;
 }
 setLineDash(values){
  const pattern=Array.from(values);
  if(pattern.some(value=>value<=0))return;
  this.state.dash=pattern.length%2?[...pattern,...pattern]:pattern;
 }
 createLinearGradient(...points){return new SceneGradient(points);}
 createRadialGradient(...points){return new SceneGradient(points);}
 position(node,x=0,y=0,sx=1,sy=1){
  const m=this.getTransform();
  node.setFromMatrix(this.matrix.set(m.a*sx,m.b*sx,m.c*sy,m.d*sy,m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f));
  node.alpha=this.globalAlpha;
  node.blendMode=BLEND_MODES[this.globalCompositeOperation]??'normal';
  this.dirty=true;
  this.attach(node);
 }
 source(image){
  if(image instanceof RenderSurface)image.flush();
  let entry=this.sources.get(image);
  if(entry&&image instanceof RenderSurface&&entry.source!==image.texture.source)entry=null;
  if(!entry){
   const options={resource:image,resolution:1,autoGenerateMipmaps:false};
   const source=image instanceof RenderSurface?image.texture.source
    : image instanceof HTMLImageElement
     ? new TextureSource({...options,width:image.naturalWidth,height:image.naturalHeight})
     : new ImageSource(options);
   if(image instanceof HTMLImageElement)source.uploadMethodId='image';
   entry={source,full:new Texture({source}),frames:new Map()};this.sources.set(image,entry);
  }
  return entry;
 }
 prepareImage(image){
  this.gpu.texture.bind(this.source(image).full);
 }
 releaseImage(image){
  const entry=this.sources.get(image);
  if(!entry)return;
  for(const texture of entry.frames.values())texture.destroy();
  entry.full.destroy(true);
  this.sources.delete(image);
 }
 refreshImage(image){
  if(image instanceof RenderSurface){image.flush();return;}
  const entry=this.sources.get(image);
  if(!entry)return;
  if(entry.source.width!==image.width||entry.source.height!==image.height)
   entry.source.resize(image.width,image.height);
  entry.source.update();
 }
 drawImage(image,...args){
  const entry=this.source(image);
  let texture=entry.full,dx,dy,dw,dh;
  if(args.length===8){
   const [x,y,w,h]=args;
   if(w<=0||h<=0)return;
   const key=x+','+y+','+w+','+h;
   texture=entry.frames.get(key);
   if(!texture){
    texture=new Texture({source:entry.source,frame:new Rectangle(x,y,w,h)});
    entry.frames.set(key,texture);
   }
   [, , , ,dx,dy,dw,dh]=args;
  }else{
   [dx,dy,dw=texture.width,dh=texture.height]=args;
  }
  const i=this.pool.spriteCount++;
  const sprite=this.pool.sprites[i]??=new Sprite();
  sprite.texture=texture;sprite.tint=0xffffff;
  this.position(sprite,dx,dy,dw/texture.width,dh/texture.height);
 }
 drawWetFood(image,rect,x,y,size,wetness){
  if(WET_FOOD_CACHE_CONTROL)return false;
  const texture=this.source(image).full;
  this.wetFruitGeometry??=new MeshGeometry();
  const index=this.pool.wetFruitCount++;
  const mesh=this.pool.wetFruits[index]??=new WetFruitMesh(this.wetFruitGeometry,texture);
  mesh.setFrame(texture,rect,wetness);
  this.position(mesh,x,y,size,size);
  return true;
 }
 createPattern(image,repeat){
  const pattern={repeat};
  this.patterns.set(pattern,image);return pattern;
 }
 fillRect(x,y,w,h){
  const tile=this.patterns.get(this.fillStyle);
  if(tile){
   // Bark tiles are mirrored pairs. Preserve the phase at the cap splice.
   for(let top=y;top<y+h;){
    const offset=((top%tile.height)+tile.height)%tile.height;
    const band=Math.min(tile.height-offset,y+h-top);
    if(band<1e-7)break;
    // Use a per-draw frame for the continuously changing final partial band.
    this.barkBand(tile,x,top,w,band,offset);
    top+=band;
   }
   return;
  }
  this.beginPath();this.rect(x,y,w,h);this.fill();
 }
 barkBand(tile,x,y,width,height,offset){
  const entry=this.source(tile),i=this.pool.spriteCount++;
  const sprite=this.pool.sprites[i]??=new Sprite();
  let tex=sprite.barkTexture;
  if(!tex||tex.source!==entry.source){
   tex?.destroy(false);
   tex=sprite.barkTexture=new Texture({source:entry.source,frame:new Rectangle(),dynamic:true});
  }
  tex.frame.x=0;tex.frame.y=offset;tex.frame.width=tile.width;tex.frame.height=height;
  tex.updateUvs();tex.update();
  sprite.texture=tex;sprite.tint=0xffffff;
  this.position(sprite,x,y,width/tile.width,1);
 }
 fillText(value,x,y){this.paintText(value,x,y,this.fillStyle,false);}
 strokeText(value,x,y){this.paintText(value,x,y,this.strokeStyle,true);}
 measureText(value){
  let width=0;
  const scale=(Number(this.font.match(/([\d.]+)px/)?.[1])||10)/48;
  for(const character of String(value))width+=(GLYPHS[character]??GLYPHS['?'])[2]*scale;
  return {width,actualBoundingBoxLeft:width/2,actualBoundingBoxRight:width/2,
   actualBoundingBoxAscent:43*scale,actualBoundingBoxDescent:11*scale};
 }
 paintText(value,x,y,color,outline){
  const scale=(Number(this.font.match(/([\d.]+)px/)?.[1])||10)/48;
  const width=this.measureText(value).width;
  let left=x-(this.textAlign==='center'?width/2:this.textAlign==='right'||this.textAlign==='end'?width:0);
  const baseline=y+(this.textBaseline==='middle'?16*scale:0);
  const tint=new Color(color);
  for(const character of String(value)){
   const [sx,sy,advance]=GLYPHS[character]??GLYPHS['?'];
   if(character!==' '){
    this.drawImage(glyphAtlas,sx,sy+(outline?80:0),80,80,left-8*scale,baseline-53*scale,80*scale,80*scale);
    const sprite=this.pool.sprites[this.pool.spriteCount-1];
    sprite.tint=tint.toNumber();sprite.alpha*=tint.alpha;
   }
   left+=advance*scale;
  }
 }
 beginPath(){this.path=new GraphicsPath();}
 ellipse(x,y,rx,ry,rotation){
  const path=new GraphicsPath().ellipse(0,0,rx,ry);
  this.path.addPath(path,new Matrix().rotate(rotation).translate(x,y));
 }
 graphic(){
  const i=this.pool.graphicCount++;
  const node=this.pool.graphics[i]??=new Graphics();
  node.clear().path(this.path);this.position(node);return node;
 }
 clip(){
  const mask=this.graphic().fill(0xffffff);
  mask.alpha=1;
  const i=this.pool.groupCount++;
  const group=this.pool.groups[i]??=new Container();
  this.attach(group);
  if(group.mask!==mask)group.mask=mask;
  this.parent=group;
  this.retained?.visit(group);
 }
 fill(){
  const style=this.fillStyle instanceof SceneGradient?this.fillStyle.style():this.fillStyle;
  this.graphic().fill(style);
  if(style?.texture)style.texture.source.style.addressMode='clamp-to-edge';
 }
 stroke(){
  const path=this.path;
  if(this.state.dash.length)this.path=dashPath(path,this.state.dash);
  const paint=this.strokeStyle instanceof SceneGradient?this.strokeStyle.style():{color:this.strokeStyle};
  this.graphic().stroke({...paint,width:this.lineWidth,cap:this.lineCap,join:this.lineJoin});
  if(paint.texture)paint.texture.source.style.addressMode='clamp-to-edge';
  this.path=path;
 }
}

class RenderSurface {
 constructor(gpu,width,height){
  this.gpu=gpu;this.size=[width,height];this.clearPending=true;
  this.scene=new PixiScene(this,gpu);this.scene.begin();
 }
 get width(){return this.size[0];}
 set width(value){this.resize(0,value);}
 get height(){return this.size[1];}
 set height(value){this.resize(1,value);}
 resize(axis,value){
  this.size[axis]=value;
  this.texture?.destroy(true);this.texture=null;
  this.clearPending=true;
  this.scene.begin();
 }
 getContext(){return this.scene;}
 flush(){
  if(!this.width||!this.height)throw new Error('Textura gráfica sem dimensões.');
  this.texture??=RenderTexture.create({width:this.width,height:this.height});
  if(!this.scene.dirty&&!this.clearPending)return;
  this.gpu.render({container:this.scene.root,target:this.texture,clear:this.clearPending,clearColor:[0,0,0,0]});
  // Keep drawing state for subsequent incremental atlas slices.
  this.scene.recycleNodes();
  this.scene.dirty=false;this.clearPending=false;
 }
}

for(const name of ['moveTo','lineTo','rect','roundRect','arc','closePath','bezierCurveTo','quadraticCurveTo']){
 PixiScene.prototype[name]=function(...args){this.path[name](...args);};
}
for(const name of ['globalAlpha','globalCompositeOperation','font','textAlign','textBaseline','fillStyle','strokeStyle','lineWidth','lineCap','lineJoin']){
 Object.defineProperty(PixiScene.prototype,name,{
  get(){return this.state[name];},set(value){this.state[name]=value;}
 });
}
