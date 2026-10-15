import { describe, it, expect } from "vitest";
import { Simulation, WORLD } from "../src/core/Simulation";
import { FixedStep } from "../src/core/FixedStep";
import { Store, RULESET } from "../src/data/storage";
const run = () => {
  const s = new Simulation(() => 0.5);
  s.start("learn");
  s.state = "playing";
  return s;
};
const tree = (id = 1) => ({
  id,
  x: 220,
  prevX: 220,
  center: 400,
  gap: 100,
  scored: false,
});
describe("shield, multiplier and recovery", () => {
  it("breaks a tree once, spends the shield, grants grace and awards no destruction points", () => {
    const s = run();
    s.shield = true;
    s.obstacles = [tree()];
    s.step(1 / 60);
    expect(s.state).toBe("playing");
    expect(s.shield).toBe(false);
    expect(s.obstacles).toHaveLength(0);
    expect(s.score).toBe(0);
    expect(s.protectionTicks).toBe(75);
    expect(s.events.filter((e) => e.type === "shield-break")).toHaveLength(1);
    s.obstacles = [tree(2)];
    s.step(1 / 60);
    expect(s.state).toBe("playing");
    s.protectionTicks = 0;
    s.step(1 / 60);
    expect(s.state).toBe("over");
  });
  it("blocks a hawk without awarding points and detects unshielded contact", () => {
    for (const shield of [true, false]) {
      const s = run();
      s.shield = shield;
      s.hawks = [
        {
          id: 1,
          x: 220,
          prevX: 220,
          y: 260,
          prevY: 260,
          startY: 260,
          targetY: 260,
          age: 0,
          dive: false,
        },
      ];
      s.step(1 / 60);
      expect(s.state).toBe(shield ? "playing" : "over");
      expect(s.score).toBe(0);
      if (shield) expect(s.hawks).toHaveLength(0);
      else expect(s.endCause).toBe("hawk");
    }
  });
  it("detects the snake head but not an invisible wide column below it", () => {
    const s = run();
    s.y = 350;
    s.obstacles = [
      {
        id: 1,
        kind: "snake",
        x: 170,
        prevX: 170,
        center: 260,
        gap: 100,
        scored: false,
      },
    ];
    s.step(1 / 60);
    expect(s.endCause).toBe("snake");
    const below = run();
    below.y = 430;
    below.obstacles = [
      {
        id: 1,
        kind: "snake",
        x: 170,
        prevX: 170,
        center: 260,
        gap: 100,
        scored: false,
      },
    ];
    below.step(1 / 60);
    expect(below.state).toBe("playing");
  });
  it("freezes power time in pauses, quizzes, feedback and recovery; preserves quiz bonus", () => {
    const s = run();
    s.featherTicks = 600;
    s.protectionTicks = 30;
    s.fruits = [{ id: 1, x: 220, prevX: 220, y: 260, kind: "Goiaba" }];
    s.step(1 / 60);
    expect(s.score).toBe(6);
    expect(s.quizMultiplier).toBe(2);
    const timers = [s.featherTicks, s.protectionTicks];
    for (let i = 0; i < 1200; i++) s.step(1 / 60);
    expect([s.featherTicks, s.protectionTicks]).toEqual(timers);
    s.answer(s.question!.answer);
    expect(s.score).toBe(10);
    s.answer(s.question!.answer);
    expect(s.score).toBe(10);
    s.continueQuiz();
    s.pause();
    s.step(1 / 60);
    s.resume();
    for (let i = 0; i < 90; i++) s.step(1 / 60);
    expect([s.featherTicks, s.protectionTicks]).toEqual(timers);
    s.step(1 / 60);
    expect(s.featherTicks).toBe(timers[0] - 1);
  });
  it("renews feather to 600 ticks without stacking, and expires after exactly 600 active ticks", () => {
    const s = run();
    s.featherTicks = 20;
    s.powers = [{ id: 1, x: 220, prevX: 220, y: 260, kind: "feather" }];
    s.step(1 / 60);
    expect(s.featherTicks).toBe(600);
    expect(s.multiplier).toBe(2);
    for (let i = 0; i < 600; i++) {
      s.y = 260;
      s.vy = 0;
      s.obstacles = [];
      s.fruits = [];
      s.powers = [];
      s.hawks = [];
      s.step(1 / 60);
    }
    expect(s.featherTicks).toBe(0);
    expect(s.multiplier).toBe(1);
  });
  it("clamps a shielded boundary impact back into the world", () => {
    const s = run();
    s.shield = true;
    s.y = 510;
    s.step(1 / 60);
    expect(s.state).toBe("playing");
    expect(s.y).toBe(WORLD.floor - WORLD.birdHalfH);
    expect(s.vy).toBeLessThan(0);
  });
  it("clears all powers, enemies and held input on restart", () => {
    const s = run();
    s.shield = true;
    s.featherTicks = 600;
    s.protectionTicks = 70;
    s.hold();
    s.powers = [{ id: 3, x: 300, prevX: 300, y: 260, kind: "shield" }];
    s.start("challenge");
    expect(s.shield).toBe(false);
    expect(s.held).toBe(false);
    expect(s.featherTicks).toBe(0);
    expect(s.powers).toEqual([]);
    expect(s.hawks).toEqual([]);
  });
});
describe("flight and fair encounter slots", () => {
  it("repeats held flaps at fixed cadence and releases into bounded glide and pitch", () => {
    const s = run();
    s.hold();
    s.step(1 / 60);
    const first = s.lastFlapTick;
    for (let i = 0; i < 32; i++) {
      s.y = 260;
      s.step(1 / 60);
    }
    expect(s.lastFlapTick - first).toBe(32);
    s.release();
    const last = s.lastFlapTick;
    for (let i = 0; i < 180; i++) {
      s.y = 260;
      s.obstacles = [];
      s.fruits = [];
      s.step(1 / 60);
      expect(s.pitch).toBeGreaterThanOrEqual(-12);
      expect(s.pitch).toBeLessThanOrEqual(9);
    }
    expect(s.lastFlapTick).toBe(last);
    expect(s.vy).toBeLessThanOrEqual(175);
    s.hold();
    s.pause();
    s.resume();
    expect(s.held).toBe(false);
  });
  it("keeps hawks in dedicated slots, warns well ahead, and leaves a central corridor", () => {
    for (const mode of ["learn", "challenge"] as const) {
      const s = run();
      s.mode = mode;
      const seen = new Set<number>();
      let snakes = 0,
        hollows = 0,
        hawks = 0,
        dives = 0;
      for (let i = 0; i < 1600; i++) {
        s.y = 260;
        s.vy = 0;
        s.obstacles = s.obstacles.filter((t) => t.x > 400);
        s.hawks = s.hawks.filter((h) => h.x > 400);
        s.fruits = [];
        s.powers = [];
        s.step(1 / 60);
        for (const t of s.obstacles)
          if (!seen.has(t.id)) {
            seen.add(t.id);
            if (t.kind === "snake") snakes++;
            if (t.kind === "hollow") hollows++;
          }
        for (const h of s.hawks) {
          if (!seen.has(h.id)) {
            seen.add(h.id);
            hawks++;
            if (h.dive) dives++;
            expect(h.x).toBeGreaterThan(960);
          }
          for (const t of s.obstacles)
            expect(Math.abs(h.x - t.x)).toBeGreaterThan(300);
          expect(Math.abs(h.y - 265)).toBeGreaterThanOrEqual(110);
        }
      }
      expect(snakes).toBeGreaterThan(0);
      expect(hollows).toBeGreaterThan(0);
      expect(hawks).toBeGreaterThan(0);
      expect(dives).toBeGreaterThan(0);
    }
  });
  it("replays held/released input and timers identically at 60 and 240Hz", () => {
    function replay(hz: number) {
      const s = run(),
        clock = new FixedStep();
      s.featherTicks = 600;
      for (let frame = 0; frame < hz * 8; frame++)
        clock.advance(1000 / hz, (dt) => {
          s.y = 260;
          s.obstacles = [];
          s.fruits = [];
          if (s.ticks % 70 === 0) s.hold();
          if (s.ticks % 70 === 20) s.release();
          s.step(dt);
        });
      return {
        y: s.y,
        vy: s.vy,
        pitch: s.pitch,
        ticks: s.ticks,
        feather: s.featherTicks,
        distance: s.distance,
      };
    }
    expect(replay(240)).toEqual(replay(60));
  });
});
it("preserves prior rankings and separates the new rules without losing discoveries", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  data.set(
    "chaua-educa-v2",
    JSON.stringify({
      version: 2,
      scores: [{ name: "Ana", score: 150, mode: "learn", date: "" }],
      unlocked: ["Manga"],
      mistakes: [],
    }),
  );
  const s = new Store(storage);
  s.score("Ana", 205, "learn");
  expect(s.data.scores).toHaveLength(2);
  expect(s.data.unlocked).toEqual(["Manga"]);
  const reloaded = new Store(storage);
  expect(reloaded.data.scores.find((x) => x.ruleset === RULESET)?.score).toBe(
    205,
  );
  expect(reloaded.data.scores.find((x) => !x.ruleset)?.score).toBe(150);
});

it("detects the projecting snake branch before the wood, while leaving the gap clear", () => {
  const s = run();
  s.y = 365;
  s.obstacles = [
    {
      id: 1,
      kind: "branch",
      x: 310,
      prevX: 310,
      center: 260,
      gap: 100,
      scored: false,
    },
  ];
  s.step(1 / 60);
  expect(s.endCause).toBe("snake");
  const safe = run();
  safe.obstacles = [
    {
      id: 1,
      kind: "branch",
      x: 310,
      prevX: 310,
      center: 260,
      gap: 100,
      scored: false,
    },
  ];
  safe.step(1 / 60);
  expect(safe.state).toBe("playing");
});
