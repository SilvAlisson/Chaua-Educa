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
    impulse: -300,
    spawnTicks: 100,
  },
  challenge: {
    speed: 275,
    speedGain: 55,
    gap: 150,
    gapLoss: 20,
    gravity: 960,
    impulse: -330,
    spawnTicks: 90,
  },
} as const;
export interface Obstacle {
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
  | { type: "end"; won: boolean };
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
  }
  flap() {
    if (this.state === "playing") {
      this.flapQueued = true;
    }
  }
  pause() {
    if (this.state !== "playing" && this.state !== "countdown") return;
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
    this.state = "menu";
    this.flapQueued = false;
  }
  private snap() {
    this.prevY = this.y;
    this.prevDistance = this.distance;
    for (const e of [...this.obstacles, ...this.fruits]) e.prevX = e.x;
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
    this.prevY = this.y;
    this.prevDistance = this.distance;
    if (this.flapQueued) {
      this.vy = FLIGHT[this.mode].impulse;
      this.flapQueued = false;
      this.lastFlapTick = this.ticks;
    }
    const profile = FLIGHT[this.mode];
    this.vy = Math.min(460, this.vy + profile.gravity * dt);
    this.y += this.vy * dt;
    const progress = Math.min(1, this.distance / 18000);
    const speed = profile.speed + progress * profile.speedGain;
    this.distance += speed * dt;
    if (++this.spawnTicks >= profile.spawnTicks) {
      this.spawnTicks = 0;
      this.spawn(progress);
    }
    for (const e of [...this.obstacles, ...this.fruits]) {
      e.prevX = e.x;
      e.x -= speed * dt;
    }
    if (
      this.y - WORLD.birdHalfH < WORLD.ceiling ||
      this.y + WORLD.birdHalfH > WORLD.floor
    ) {
      this.end(false);
      return;
    }
    for (const tree of this.obstacles) {
      const horizontal =
        tree.x - WORLD.treeWidth / 2 < WORLD.birdX + WORLD.birdHalfW &&
        tree.x + WORLD.treeWidth / 2 > WORLD.birdX - WORLD.birdHalfW;
      if (
        horizontal &&
        (this.y - WORLD.birdHalfH < tree.center - tree.gap / 2 ||
          this.y + WORLD.birdHalfH > tree.center + tree.gap / 2)
      ) {
        this.end(false);
        return;
      }
      if (
        !tree.scored &&
        tree.x + WORLD.treeWidth / 2 < WORLD.birdX - WORLD.birdHalfW
      ) {
        tree.scored = true;
        this.score++;
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
        this.score += 3;
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
          this.state = "quiz";
          this.snap();
        }
        break;
      }
    }
    this.obstacles = this.obstacles.filter((e) => e.x > -100);
    this.fruits = this.fruits.filter((e) => e.x > -100);
  }
  answer(value: boolean) {
    if (this.state !== "quiz" || !this.question) return;
    this.answerCorrect = value === this.question.answer;
    if (this.answerCorrect) {
      this.score += 2;
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
    this.state = "countdown";
    this.countdown = 1.5;
    this.resuming = true;
    this.flapQueued = false;
    this.snap();
  }
  private end(won: boolean) {
    this.state = won ? "won" : "over";
    this.snap();
    this.events.push({ type: "end", won });
  }
  private spawn(progress: number) {
    this.center = Math.min(
      330,
      Math.max(205, this.center + (this.random() * 2 - 1) * 55),
    );
    const profile = FLIGHT[this.mode];
    const gap = profile.gap - progress * profile.gapLoss;
    this.obstacles.push({
      id: this.nextId++,
      x: 1020,
      prevX: 1020,
      center: this.center,
      gap,
      scored: false,
    });
    if (++this.pairCount % 2 === 0) {
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
