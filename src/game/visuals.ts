/** Shared pose anchors keep the chest still while the wings move. */
export const BIRD_POSES = [
  { x: 370 / 627, y: 418 / 627 },
  { x: 356 / 627, y: 418 / 627 },
  { x: 370 / 627, y: 343 / 627 },
  { x: 350 / 627, y: 343 / 627 },
] as const;
export function birdPose(
  ticksSinceFlap: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || ticksSinceFlap < 0 || ticksSinceFlap >= 20) return 1;
  return [0, 2, 3, 1][Math.min(3, Math.floor(ticksSinceFlap / 5))];
}
