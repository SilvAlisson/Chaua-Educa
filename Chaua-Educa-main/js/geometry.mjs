// Authored-image coordinates. Shared by the renderer and collision geometry.
export const SNAKE_ART = Object.freeze({
    width:634, height:1080, originX:.38, coreWidth:430, openingY:230,
    head:[130,10,185,140], branchHead:[77,0,86,56],
});
export {spriteHeadRect as snakeHeadRect} from './animation.mjs';
