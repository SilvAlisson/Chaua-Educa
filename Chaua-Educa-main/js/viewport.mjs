// The visible world and the advertised warning distance must agree on every screen.
export function flightViewport(width,height,safe={}) {
    const left=safe.left||0,right=safe.right||0;
    const compact=height<=500,portrait=width<=700&&height>width;
    const top=(safe.top||0)+(compact?58:124);
    const bottom=(safe.bottom||0)+(compact?64:104);
    const usableWidth=Math.max(1,width-left-right),usableHeight=Math.max(1,height-top-bottom);
    const worldLeft=portrait?130:0,minimumWidth=portrait?720:960;
    const scale=Math.max(.01,Math.min(usableWidth/minimumWidth,usableHeight/640));
    const worldWidth=usableWidth/scale,w=worldWidth*scale,h=640*scale;
    return {portrait,scale,worldLeft,worldWidth,x:left,y:top+(usableHeight-h)/2,w,h};
}
export function warningPosition(view,worldY){
    return {x:view.x+view.w-112,y:Math.max(view.y+4,Math.min(view.y+view.h-40,view.y+worldY*view.scale-18))};
}
