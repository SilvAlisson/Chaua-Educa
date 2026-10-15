/** Driven by Phaser's frame callback: never owns another requestAnimationFrame. */
export class FixedStep {
  static readonly DT = 1 / 60;
  private accumulator = 0;
  reset() {
    this.accumulator = 0;
  }
  advance(deltaMs: number, update: (dt: number) => boolean | void): number {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return 0;
    this.accumulator += Math.min(deltaMs / 1000, 0.1);
    let steps = 0;
    while (this.accumulator + 1e-10 >= FixedStep.DT && steps < 6) {
      this.accumulator = Math.max(0, this.accumulator - FixedStep.DT);
      steps++;
      if (update(FixedStep.DT) === false) {
        this.reset();
        return 1;
      }
    }
    return this.accumulator / FixedStep.DT;
  }
}
export const lerp = (a: number, b: number, alpha: number) =>
  a + (b - a) * alpha;
