import { describe, it, expect } from "vitest";
import { birdPose, BIRD_POSES } from "../src/game/visuals";
import { Simulation } from "../src/core/Simulation";
import sharp from "sharp";
import { FRUITS } from "../src/data/content";

describe("sprite contracts", () => {
  it("animates the first flap after restarting a long run without a timer", () => {
    const s = new Simulation();
    s.ticks = 10000;
    s.lastFlapTick = 9999;
    s.start("learn");
    s.state = "playing";
    s.flap();
    s.step(1 / 60);
    expect(birdPose(s.ticks - s.lastFlapTick, false)).toBe(0);
    const ticks = s.ticks;
    s.pause();
    s.step(1 / 60);
    expect(s.ticks).toBe(ticks);
    expect(birdPose(21, false)).toBe(1);
    expect(birdPose(0, true)).toBe(1);
  });
  it("ships equal-sized transparent poses with valid chest anchors", async () => {
    for (const [i, p] of BIRD_POSES.entries()) {
      const m = await sharp(`public/assets/v3/chaua-${i}.webp`).metadata();
      expect(m.width).toBe(627);
      expect(m.height).toBe(627);
      expect(m.hasAlpha).toBe(true);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(1);
    }
  });
  it("ships all seven collectibles with transparent corners", async () => {
    for (const f of FRUITS) {
      const { data, info } = await sharp(`public/assets/v3/fruit-${f.id}.webp`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(Math.max(info.width, info.height)).toBe(192);
      expect(data[3]).toBe(0);
    }
  });
});
