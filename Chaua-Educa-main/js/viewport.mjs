// Responsive world camera. Canvas pixel resolution stays independent from
// gameplay scale, and all game physics continue in the original 960x640 world.
const WORLD_HEIGHT=640;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function flightViewport(width,height,safe={}) {
    const left=safe.left||0,right=safe.right||0;
    const compact=height<=500;
    const portrait=width<=850&&height>width;
    const notebook=!portrait&&!compact&&height<=850;
    // HUD occupies separate screen-space bands rather than being zoomed.
    const top=(safe.top||0)+(compact?58:notebook?96:124);
    const bottom=(safe.bottom||0)+(compact?64:notebook?64:104);
    const usableWidth=Math.max(1,width-left-right),usableHeight=Math.max(1,height-top-bottom);
    // On short windows show a vertically tracked slice of the world instead
    // of shrinking all sprites to fit 640 logical pixels at once.
    // Portrait needs at least 1.65s of visible predator approach at max speed.
    // Preserve its safe sightline rather than enlarging sprites at the cost of reaction time.
    const referenceWidth=portrait?720:960;
    // A slightly tighter notebook camera enlarges actors without touching
    // collision coordinates, and retains 500 world units of vertical sightline.
    const referenceHeight=portrait?640:compact?500:notebook?500:640;
    const scale=Math.max(.01,Math.min(usableWidth/referenceWidth,usableHeight/referenceHeight));
    const worldLeft=portrait?130:0;
    const worldWidth=usableWidth/scale;
    const h=Math.min(usableHeight,WORLD_HEIGHT*scale);
    const worldHeight=h/scale;
    const w=worldWidth*scale;
    return {portrait,scale,worldLeft,worldWidth,worldHeight,worldTop:0,
        x:left,y:top+(usableHeight-h)/2,w,h};
}

// The camera is a presentation-only vertical offset: it never changes
// collision coordinates, spawn locations, speeds or flight controls.
export function flightCameraTop(view,playerY){
    if(view.worldHeight>=WORLD_HEIGHT)return 0;
    const target=playerY-view.worldHeight*.5;
    return clamp(target,0,WORLD_HEIGHT-view.worldHeight);
}
// Keep the existing framing across resize. In reduced motion, move only when
// needed to retain the player inside the safe band, without decorative chasing.
export function advanceFlightCamera(view,playerY,previous,dt,reduced=false){
    const maximum=Math.max(0,WORLD_HEIGHT-view.worldHeight);
    const target=flightCameraTop(view,playerY);
    if(!Number.isFinite(previous))return target;
    let top=clamp(previous,0,maximum);
    if(!reduced)top+=(target-top)*(1-Math.exp(-10*clamp(dt,0,.08)));
    const margin=Math.min(80,view.worldHeight*.18);
    return clamp(Math.max(playerY-view.worldHeight+margin,
        Math.min(top,playerY-margin)),0,maximum);
}
export function warningPosition(view,worldY){
    const yy=(worldY-(view.worldTop||0))*view.scale;
    return {x:view.x+view.w-112,
        y:clamp(view.y+yy-18,view.y+4,view.y+view.h-40)};
}

// A2 is the only snake. Warning clearance follows its official silhouette.
export function snakeWarningPosition(view,wood){
    const clearance=245;
    return {x:view.x+(wood.x-view.worldLeft)*view.scale-30,
        y:view.y+(wood.bottom-clearance-(view.worldTop||0))*view.scale};
}
