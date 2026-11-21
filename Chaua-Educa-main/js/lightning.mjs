// v1.0.12.1 — single deterministic lightning schedule for visuals and audio.
// Each four-second window contains one flash, jittered within the window.
// No timers, performance.now() or game RNG: recordings remain replayable.
export const LIGHTNING_CYCLE_SECONDS=4;
export const LIGHTNING_FLASH_SECONDS=.29;
const hash=(index,salt)=> {
    const value=Math.sin((index+1)*12.9898+salt*78.233)*43758.5453;
    return value-Math.floor(value);
};
export function lightningStrikeAt(seconds) {
    const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
    const index=Math.floor(time/LIGHTNING_CYCLE_SECONDS);
    const startsAt=index*LIGHTNING_CYCLE_SECONDS+1.65+hash(index,1)*.65;
    const elapsed=time-startsAt;
    return {
        index,startsAt,active:elapsed>=0&&elapsed<LIGHTNING_FLASH_SECONDS,
        phase:elapsed/LIGHTNING_FLASH_SECONDS,
        pitch:.89+hash(index,2)*.21,
        amplitude:.72+hash(index,3)*.28
    };
}
