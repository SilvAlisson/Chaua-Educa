import { describe, it, expect } from "vitest";
import { FixedStep } from "../src/core/FixedStep";
import { Simulation, WORLD } from "../src/core/Simulation";
import { Store, validName } from "../src/data/storage";
import { QUESTIONS } from "../src/data/content";
const playing = () => {
  const s = new Simulation(() => 0.5);
  s.start("learn");
  s.state = "playing";
  return s;
};
function flight(hz: number) {
  const s = playing();
  const clock = new FixedStep();
  for (let i = 0; i < hz * 24; i++)
    clock.advance(1000 / hz, (dt) => {
      if (s.state === "quiz") s.answer(s.question!.answer);
      if (s.state === "feedback") s.continueQuiz();
      if (s.y > 265 && s.vy > 0) s.flap();
      s.step(dt);
    });
  return {
    state: s.state,
    ticks: s.ticks,
    y: s.y,
    score: s.score,
    obstacles: s.obstacles,
    fruits: s.fruits,
  };
}
describe("simulation and rendering cadence", () => {
  it("replays the same inputs and random values identically at 60/120/144/180/240 Hz", () => {
    const reference = flight(60);
    expect(reference.ticks).toBe(1440);
    expect(reference.score).toBeGreaterThan(0);
    for (const hz of [120, 144, 180, 240])
      expect(flight(hz)).toEqual(reference);
  });
  it("limits catch-up and clears accumulated time on state transition", () => {
    const c = new FixedStep();
    let ticks = 0;
    c.advance(10000, () => {
      ticks++;
    });
    expect(ticks).toBe(6);
    c.advance(100, () => {
      ticks++;
      return false;
    });
    expect(ticks).toBe(7);
    c.advance(0, () => {
      ticks++;
    });
    expect(ticks).toBe(7);
  });
  it("ignores invalid deltas", () => {
    const c = new FixedStep();
    expect(
      c.advance(NaN, () => {
        throw Error();
      }),
    ).toBe(0);
    expect(
      c.advance(-5, () => {
        throw Error();
      }),
    ).toBe(0);
  });
  it("pauses countdown and flight without accumulating movement", () => {
    const s = new Simulation();
    s.start("learn");
    s.pause();
    for (let i = 0; i < 120; i++) s.step(1 / 60);
    expect(s.countdown).toBe(3);
    s.resume();
    for (let i = 0; i < 180; i++) s.step(1 / 60);
    expect(s.state).toBe("playing");
    s.pause();
    const y = s.y;
    s.flap();
    s.step(1);
    expect(s.y).toBe(y);
    s.resume();
    expect(s.prevY).toBe(s.y);
  });
});
describe("scoring, collision and quiz flow", () => {
  it("scores a tree pair exactly once", () => {
    const s = playing();
    s.obstacles = [
      { id: 1, x: 150, prevX: 150, center: 260, gap: 240, scored: false },
    ];
    s.step(1 / 60);
    s.step(1 / 60);
    expect(s.score).toBe(1);
  });
  it("does not score missed fruit", () => {
    const s = playing();
    s.fruits = [{ id: 1, x: -110, prevX: -110, y: 260, kind: "Goiaba" }];
    s.step(1 / 60);
    expect(s.score).toBe(0);
    expect(s.fruits).toHaveLength(0);
  });
  it("awards 3 for collection and 2 for a correct answer, once", () => {
    const s = playing();
    s.fruits = [{ id: 1, x: 220, prevX: 220, y: 260, kind: "Goiaba" }];
    s.step(1 / 60);
    expect(s.state).toBe("quiz");
    expect(s.score).toBe(3);
    const y = s.y;
    s.step(1);
    expect(s.y).toBe(y);
    s.answer(s.question!.answer);
    s.answer(s.question!.answer);
    expect(s.score).toBe(5);
    s.continueQuiz();
    expect(s.state).toBe("playing");
  });
  it("continues after wrong answers in Learn and ends Challenge only after feedback", () => {
    for (const mode of ["learn", "challenge"] as const) {
      const s = playing();
      s.mode = mode;
      s.state = "quiz";
      s.question = QUESTIONS[0];
      s.answer(false);
      expect(s.state).toBe("feedback");
      s.continueQuiz();
      expect(s.state).toBe(mode === "learn" ? "playing" : "over");
    }
  });
  it("requires fifteen simulation seconds between quizzes", () => {
    const s = playing();
    s.fruits = [{ id: 1, x: 220, prevX: 220, y: 260, kind: "Goiaba" }];
    s.step(1 / 60);
    s.answer(true);
    s.continueQuiz();
    s.fruits = [{ id: 2, x: 220, prevX: 220, y: 260, kind: "Manga" }];
    s.step(1 / 60);
    expect(s.state).toBe("playing");
    expect(s.score).toBe(8);
  });
  it("ends on collision before collecting fruit behind the obstacle", () => {
    const s = playing();
    s.obstacles = [
      { id: 1, x: 220, prevX: 220, center: 400, gap: 100, scored: false },
    ];
    s.fruits = [{ id: 2, x: 220, prevX: 220, y: 260, kind: "Manga" }];
    s.step(1 / 60);
    expect(s.state).toBe("over");
    expect(s.score).toBe(0);
    expect(s.events.filter((e) => e.type === "end")).toHaveLength(1);
  });
  it("triggers victory directly on a collection crossing 200", () => {
    const s = playing();
    s.score = 198;
    s.fruits = [{ id: 1, x: 220, prevX: 220, y: 260, kind: "Goiaba" }];
    s.step(1 / 60);
    expect(s.state).toBe("won");
    expect(s.score).toBe(201);
  });
  it("clears all run state on restart", () => {
    const s = playing();
    s.score = 90;
    s.fruits = [{ id: 1, x: 220, prevX: 220, y: 260, kind: "Manga" }];
    s.start("challenge");
    expect(s.state).toBe("countdown");
    expect(s.score).toBe(0);
    expect(s.fruits).toEqual([]);
    expect(s.events).toEqual([]);
    expect(s.y).toBe(s.prevY);
  });
  it("keeps generated gaps inside the world and limits adjacent center changes", () => {
    const s = new Simulation(() => 0.999);
    s.start("learn");
    s.state = "playing";
    let center = 265;
    let id = 0;
    for (let i = 0; i < 2400; i++) {
      s.y = s.prevY = 265;
      s.vy = 0;
      s.obstacles = s.obstacles.filter((t) => t.x > 400);
      s.fruits = [];
      s.step(1 / 60);
      for (const t of s.obstacles) {
        if (t.id > id) {
          expect(Math.abs(t.center - center)).toBeLessThanOrEqual(55);
          expect(t.center - t.gap / 2).toBeGreaterThan(WORLD.ceiling);
          expect(t.center + t.gap / 2).toBeLessThan(WORLD.floor);
          id = t.id;
          center = t.center;
        }
      }
    }
  });
});
const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
};
describe("save compatibility and validation", () => {
  it("validates after trimming and bounds name length", () => {
    expect(validName("   ")).toBeNull();
    expect(validName(" a ")).toBeNull();
    expect(validName("  Ana   Maria ")).toBe("Ana Maria");
    expect(validName("a".repeat(25))).toBeNull();
  });
  it("preserves the legacy key and separates old scores from new modes", () => {
    const m = memory();
    const old = JSON.stringify([{ playerName: "ALISSON", score_val: 301 }]);
    m.setItem("db-chaua", old);
    const s = new Store(m);
    expect(s.data.scores[0].score).toBe(301);
    s.score("Alisson", 15, "learn");
    s.score("Alisson", 20, "challenge");
    s.score("Alisson", 10, "learn");
    expect(s.data.scores).toHaveLength(3);
    expect(m.getItem("db-chaua")).toBe(old);
    expect(new Store(m).data.scores).toHaveLength(3);
  });
  it("handles malformed and blocked storage without breaking the game", () => {
    const m = memory();
    m.setItem("chaua-educa-v2", "{");
    const s = new Store(m);
    expect(s.available).toBe(false);
    expect(s.data.scores).toEqual([]);
    const blocked = new Store(null);
    blocked.score("Ana", 3, "learn");
    expect(blocked.data.scores[0].score).toBe(3);
    expect(blocked.available).toBe(false);
  });
  it("records discoveries once and removes reviewed mistakes after a correct answer", () => {
    const s = new Store(memory());
    s.unlock("Manga");
    s.unlock("Manga");
    expect(s.data.unlocked).toEqual(["Manga"]);
    s.answer("habitat", false);
    s.answer("habitat", true);
    expect(s.data.mistakes).toEqual([]);
  });
});
