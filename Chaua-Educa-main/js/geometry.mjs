// Authored-image coordinates. Shared by the renderer and collision geometry.
export const SNAKE_ART = Object.freeze({
    width:634, height:1080, originX:.38, coreWidth:430, openingY:230,
    head:[130,10,185,140], branchHead:[77,0,86,56],
});
export function snakeHeadRect(wood) {
    const branch=!!wood.snake?.branch;
    const scale=branch?160/640:58/SNAKE_ART.coreWidth;
    const [sx,sy,sw,sh]=branch?SNAKE_ART.branchHead:SNAKE_ART.head;
    const x=branch?wood.x-70:wood.x+29-SNAKE_ART.width*SNAKE_ART.originX*scale;
    const y=branch?wood.bottom+8:wood.bottom-SNAKE_ART.openingY*scale;
    const inset=branch?1:2;
    return {x:x+sx*scale+inset,y:y+sy*scale+inset,w:sw*scale-inset*2,h:sh*scale-inset*2};
}
