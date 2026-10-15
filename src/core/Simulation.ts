import {
  QUESTIONS,
  FRUITS,
  type Question,
  type FruitId,
} from "../data/content";
export type Mode = "learn" | "challenge";
export type State =
  | "menu"
  | "countdown"
  | "playing"
  | "paused"
  | "quiz"
  | "feedback"
  | "over"
  | "won";
export const WORLD = {
  width: 960,
  height: 540,
  floor: 508,
  ceiling: 22,
  birdX: 220,
  birdHalfW: 18,
  birdHalfH: 14,
  treeWidth: 54,
  target: 200,
};
/** Tunable difficulty, expressed in virtual pixels and simulation seconds. */
export const FLIGHT = {
  learn: {
    speed: 220,
    speedGain: 45,
    gap: 190,
    gapLoss: 25,
    gravity: 850,
    impulse: -270,
    spawnTicks: 100,
  },
  challenge: {
    speed: 275,
    speedGain: 55,
    gap: 150,
    gapLoss: 20,
    gravity: 960,
    impulse: -295,
    spawnTicks: 90,
  },
} as const;
export type ObstacleKind = "trunk" | "snake" | "hollow" | "branch";
export type PowerKind = "shield" | "feather";
export type EndCause =
  | "wood"
  | "snake"
  | "hawk"
  | "ground"
  | "ceiling"
  | "quiz"
  | null;
export interface PowerItem {
  id: number;
  x: number;
  prevX: number;
  y: number;
  kind: PowerKind;
}
export interface Hawk {
  id: number;
  x: number;
  prevX: number;
  y: number;
  prevY: number;
  targetY: number;
  startY: number;
  age: number;
  dive: boolean;
}
export function obstacleHalfWidth(tree: Obstacle, bottom: boolean) {
  return bottom && tree.kind === "branch"
    ? 125
    : bottom && tree.kind === "snake"
      ? 55
      : bottom && tree.kind === "hollow"
        ? 34
        : WORLD.treeWidth / 2;
}
export interface Obstacle {
  kind?: ObstacleKind;
  id: number;
  x: number;
  prevX: number;
  center: number;
  gap: number;
  scored: boolean;
}
export interface Fruit {
  id: number;
  x: number;
  prevX: number;
  y: number;
  kind: FruitId;
}
export type GameEvent =
  | { type: "fruit"; kind: FruitId }
  | { type: "answer"; id: string; correct: boolean }
  | { type: "end"; won: boolean }
  | { type: "power"; kind: PowerKind }
  | { type: "shield-break"; x: number; y: number; animal: boolean };
export class Simulation {
  state: State = "menu";
  mode: Mode = "learn";
  score = 0;
  y = 260;
  prevY = 260;
  vy = 0;
  ticks = 0;
  distance = 0;
  prevDistance = 0;
  countdown = 3;
  resuming = false;
  collected = 0;
  correct = 0;
  obstacles: Obstacle[] = [];
  fruits: Fruit[] = [];
  events: GameEvent[] = [];
  question: Question | null = null;
  quizFruit: FruitId | null = null;
  answerCorrect: boolean | null = null;
  lastFlapTick = -100;
  held = false;
  pitch = 0;
  prevPitch = 0;
  shield = false;
  featherTicks = 0;
  protectionTicks = 0;
  quizMultiplier = 1;
  endCause: EndCause = null;
  powers: PowerItem[] = [];
  hawks: Hawk[] = [];
  private powerCount = 0;
  private previousState: State = "playing";
  private spawnTicks = 0;
  private nextId = 1;
  private center = 265;
  private pairCount = 0;
  private lastQuizTick = -900;
  private bag: Question[] = [];
  private flapQueued = false;
  constructor(private random: () => number = Math.random) {}
  start(mode: Mode) {
    this.mode = mode;
    this.state = "countdown";
    this.score = 0;
    this.y = this.prevY = 260;
    this.vy = 0;
    this.ticks =
      this.distance =
      this.prevDistance =
      this.collected =
      this.correct =
        0;
    this.countdown = 3;
    this.resuming = false;
    this.obstacles = [];
    this.fruits = [];
    this.events = [];
    this.question = null;
    this.quizFruit = null;
    this.answerCorrect = null;
    this.spawnTicks = 0;
    this.nextId = 1;
    this.center = 265;
    this.pairCount = 0;
    this.lastQuizTick = -900;
    this.bag = [];
    this.flapQueued = false;
    this.lastFlapTick = -100;
    this.release();
    this.pitch = this.prevPitch = 0;
    this.shield = false;
    this.featherTicks = this.protectionTicks = this.powerCount = 0;
    this.quizMultiplier = 1;
    this.endCause = null;
    this.powers = [];
    this.hawks = [];
  }
  flap() {
    if (this.state === "playing") {
      this.flapQueued = true;
    }
  }
  hold() {
    if (this.state === "playing") {
      this.held = true;
      this.flap();
    }
  }
  release() {
    this.held = false;
  }
  get multiplier() {
    return this.featherTicks > 0 ? 2 : 1;
  }
  private award(points: number, multiplier = this.multiplier) {
    this.score += points * multiplier;
  }
  pause() {
    if (this.state !== "playing" && this.state !== "countdown") return;
    this.release();
    this.previousState = this.state;
    this.state = "paused";
    this.flapQueued = false;
  }
  resume() {
    if (this.state === "paused") {
      if (this.previousState === "countdown") this.state = "countdown";
      else this.prepareResume();
      this.snap();
    }
  }
  home() {
    this.release();
    this.state = "menu";
    this.flapQueued = false;
  }
  private snap() {
    this.prevY = this.y;
    this.prevPitch = this.pitch;
    this.prevDistance = this.distance;
    for (const e of [
      ...this.obstacles,
      ...this.fruits,
      ...this.powers,
      ...this.hawks,
    ])
      e.prevX = e.x;
    for (const h of this.hawks) h.prevY = h.y;
  }
  step(dt: number) {
    if (this.state === "countdown") {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown < 1e-8) {
        this.state = "playing";
        if (!this.resuming) this.vy = -240;
        this.resuming = false;
      }
      return;
    }
    if (this.state !== "playing") return;
    this.ticks++;
    if (this.featherTicks > 0) this.featherTicks--;
    if (this.protectionTicks > 0) this.protectionTicks--;
    this.prevPitch = this.pitch;
    this.prevY = this.y;
    this.prevDistance = this.distance;
    if (
      this.flapQueued ||
      (this.held && this.ticks - this.lastFlapTick >= 32)
    ) {
      this.vy = FLIGHT[this.mode].impulse;
      this.flapQueued = false;
      this.lastFlapTick = this.ticks;
    }
    const profile = FLIGHT[this.mode];
    // Releasing opens the wings: softer gravity and a capped glide descent.
    const gravity = profile.gravity * (this.held ? 1 : 0.64);
    this.vy = Math.min(this.held ? 300 : 175, this.vy + gravity * dt);
    const targetPitch = Math.max(-12, Math.min(9, this.vy * 0.045));
    this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-8 * dt));
    this.y += this.vy * dt;
    const progress = Math.min(1, this.distance / 18000);
    const speed = profile.speed + progress * profile.speedGain;
    this.distance += speed * dt;
    if (++this.spawnTicks >= profile.spawnTicks) {
      this.spawnTicks = 0;
      this.spawn(progress);
    }
    for (const e of [
      ...this.obstacles,
      ...this.fruits,
      ...this.powers,
      ...this.hawks,
    ]) {
      e.prevX = e.x;
      e.x -= speed * dt;
    }
    for (const h of this.hawks) {
      h.prevY = h.y;
      h.age++;
      // Dive stops outside a 120px clear center corridor. Same speed as scenery,
      // in a dedicated obstacle-free slot: never catches up to a tree opening.
      const t = Math.min(1, Math.max(0, (h.age - 75) / 90));
      h.y = h.startY + (h.targetY - h.startY) * t * t * (3 - 2 * t);
    }
    const boundary =
      this.y - WORLD.birdHalfH < WORLD.ceiling
        ? "ceiling"
        : this.y + WORLD.birdHalfH > WORLD.floor
          ? "ground"
          : null;
    if (boundary) {
      if (!this.hit(boundary)) return;
      this.y = Math.max(
        WORLD.ceiling + WORLD.birdHalfH,
        Math.min(WORLD.floor - WORLD.birdHalfH, this.y),
      );
      this.vy = boundary === "ground" ? -150 : 80;
    }
    for (const tree of this.obstacles) {
      const bottomY = tree.center + tree.gap / 2;
      const wood =
        Math.abs(tree.x - WORLD.birdX) < 27 + WORLD.birdHalfW &&
        (this.y - WORLD.birdHalfH < tree.center - tree.gap / 2 ||
          this.y + WORLD.birdHalfH > bottomY);
      const overlaps = (
        left: number,
        right: number,
        top: number,
        bottom: number,
      ) =>
        WORLD.birdX + WORLD.birdHalfW > tree.x + left &&
        WORLD.birdX - WORLD.birdHalfW < tree.x + right &&
        this.y + WORLD.birdHalfH > bottomY + top &&
        this.y - WORLD.birdHalfH < bottomY + bottom;
      const snake = tree.kind === "snake" && overlaps(-34, 55, 25, 75);
      const branch = tree.kind === "hollow" && overlaps(-48, -23, 142, 192);
      const snakeBranch = tree.kind === "branch" && overlaps(-122, 30, 34, 76);
      if (wood || snake || branch || snakeBranch) {
        if (!this.hit(snake || snakeBranch ? "snake" : "wood", tree.id)) return;
        continue;
      }
      if (
        !tree.scored &&
        tree.x + Math.max(obstacleHalfWidth(tree, true), 27) <
          WORLD.birdX - WORLD.birdHalfW
      ) {
        tree.scored = true;
        this.award(1);
      }
    }
    for (const h of this.hawks) {
      if (Math.abs(h.x - WORLD.birdX) < 43 && Math.abs(h.y - this.y) < 31) {
        if (!this.hit("hawk", h.id)) return;
      }
    }
    for (const item of this.powers) {
      if (
        Math.abs(item.x - WORLD.birdX) < 38 &&
        Math.abs(item.y - this.y) < 34
      ) {
        if (item.kind === "shield") this.shield = true;
        else this.featherTicks = 600;
        this.events.push({ type: "power", kind: item.kind });
        this.powers = this.powers.filter((p) => p.id !== item.id);
      }
    }
    if (this.score >= WORLD.target) {
      this.end(true);
      return;
    }
    for (const fruit of this.fruits) {
      if (
        Math.abs(fruit.x - WORLD.birdX) < WORLD.birdHalfW + 17 &&
        Math.abs(fruit.y - this.y) < WORLD.birdHalfH + 17
      ) {
        this.fruits = this.fruits.filter((f) => f.id !== fruit.id);
        this.collected++;
        this.events.push({ type: "fruit", kind: fruit.kind });
        this.quizMultiplier = this.multiplier;
        this.award(3);
        if (this.score >= WORLD.target) {
          this.end(true);
          return;
        }
        if (this.ticks - this.lastQuizTick >= 900) {
          this.lastQuizTick = this.ticks;
          if (!this.bag.length) this.bag = [...QUESTIONS];
          this.question = this.bag.splice(
            Math.floor(this.random() * this.bag.length),
            1,
          )[0];
          this.quizFruit = fruit.kind;
          this.answerCorrect = null;
          this.release();
          this.flapQueued = false;
          this.state = "quiz";
          this.snap();
        }
        break;
      }
    }
    this.obstacles = this.obstacles.filter((e) => e.x > -100);
    this.fruits = this.fruits.filter((e) => e.x > -100);
    this.hawks = this.hawks.filter((e) => e.x > -100);
    this.powers = this.powers.filter((e) => e.x > -100);
  }
  answer(value: boolean) {
    if (this.state !== "quiz" || !this.question) return;
    this.answerCorrect = value === this.question.answer;
    if (this.answerCorrect) {
      this.award(2, this.quizMultiplier);
      this.correct++;
    }
    this.events.push({
      type: "answer",
      id: this.question.id,
      correct: this.answerCorrect,
    });
    this.state = "feedback";
  }
  continueQuiz() {
    if (this.state !== "feedback") return;
    if (!this.answerCorrect && this.mode === "challenge") {
      this.endCause = "quiz";
      this.end(false);
      return;
    }
    if (this.score >= WORLD.target) {
      this.end(true);
      return;
    }
    // A reading break must not resume into an immediate high-speed fall.
    this.vy = Math.min(this.vy, 100);
    this.prepareResume();
  }
  private prepareResume() {
    this.release();
    this.state = "countdown";
    this.countdown = 1.5;
    this.resuming = true;
    this.flapQueued = false;
    this.snap();
  }
  private hit(cause: Exclude<EndCause, null>, id?: number) {
    if (this.protectionTicks > 0) return true;
    if (!this.shield) {
      this.endCause = cause;
      this.end(false);
      return false;
    }
    this.shield = false;
    this.protectionTicks = 75;
    this.obstacles = this.obstacles.filter((t) => t.id !== id);
    this.hawks = this.hawks.filter((h) => h.id !== id);
    this.events.push({
      type: "shield-break",
      x: WORLD.birdX,
      y: this.y,
      animal: cause === "snake" || cause === "hawk",
    });
    return true;
  }
  private end(won: boolean) {
    this.release();
    this.state = won ? "won" : "over";
    this.snap();
    this.events.push({ type: "end", won });
  }
  private spawn(progress: number) {
    this.center = Math.min(
      330,
      Math.max(205, this.center + (this.random() * 2 - 1) * 40),
    );
    const profile = FLIGHT[this.mode];
    const gap = profile.gap - progress * profile.gapLoss;
    this.pairCount++;
    // Hawk slots replace the entire tree pair; the neighboring route stays open.
    const hawkSlot = this.pairCount >= 6 && this.pairCount % 6 === 0;
    if (hawkSlot) {
      const upper = this.pairCount % 12 === 0;
      const targetY = upper ? this.center - 110 : this.center + 110;
      const dive = this.pairCount >= 12;
      const startY = Math.max(
        60,
        Math.min(465, targetY + (dive ? (upper ? -65 : 65) : 0)),
      );
      this.hawks.push({
        id: this.nextId++,
        x: 1020,
        prevX: 1020,
        y: startY,
        prevY: startY,
        targetY,
        startY,
        age: 0,
        dive,
      });
    } else
      this.obstacles.push({
        kind:
          this.pairCount >= 10 && this.pairCount % 5 === 0
            ? "branch"
            : this.pairCount >= 3 && this.pairCount % 3 === 0
              ? "snake"
              : this.pairCount % 4 === 0
                ? "hollow"
                : "trunk",
        id: this.nextId++,
        x: 1020,
        prevX: 1020,
        center: this.center,
        gap,
        scored: false,
      });
    if (this.pairCount % 4 === 1) {
      const kind: PowerKind =
        this.powerCount++ % 2 === 0 ? "shield" : "feather";
      this.powers.push({
        id: this.nextId++,
        x: 1170,
        prevX: 1170,
        y: this.center,
        kind,
      });
    }
    if (!hawkSlot && this.pairCount % 2 === 0) {
      const kind = FRUITS[Math.floor(this.random() * FRUITS.length)].id;
      this.fruits.push({
        id: this.nextId++,
        x: 1020,
        prevX: 1020,
        y: this.center,
        kind,
      });
    }
  }
}
