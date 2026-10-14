import Phaser from "phaser";
import { FixedStep, lerp } from "../core/FixedStep";
import { Simulation, WORLD, type GameEvent } from "../core/Simulation";
import { FRUITS } from "../data/content";
export interface Bridge {
  sim: Simulation;
  reducedMotion: () => boolean;
  muted: () => boolean;
  ready: () => void;
  frame: () => void;
  event: (event: GameEvent) => void;
  failed: () => void;
}
export class ForestScene extends Phaser.Scene {
  private clock = new FixedStep();
  private bird!: Phaser.GameObjects.Image;
  private backdrop!: Phaser.GameObjects.TileSprite;
  private mist!: Phaser.GameObjects.Graphics;
  private trees = new Map<
    number,
    [Phaser.GameObjects.Image, Phaser.GameObjects.Image]
  >();
  private fruits = new Map<
    number,
    [Phaser.GameObjects.Arc, Phaser.GameObjects.Image]
  >();
  private motes: Phaser.GameObjects.Arc[] = [];
  private loadFailed = false;
  constructor(private bridge: Bridge) {
    super("forest");
  }
  preload() {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (file.type === "image") this.loadFailed = true;
    });
    for (const name of [
      "background-img",
      "parrot-a",
      "parrot-b",
      "tree",
      ...FRUITS.map((f) => f.id),
    ])
      this.load.image(name, `assets/images/${name}.png`);
    for (const name of ["die", "get-fruit", "winner"])
      this.load.audio(name, `assets/Sounds/${name}.wav`);
  }
  create() {
    if (this.loadFailed) {
      this.bridge.failed();
      return;
    }
    this.backdrop = this.add
      .tileSprite(480, 270, 960, 540, "background-img")
      .setTileScale(540 / 349)
      .setTint(0xc5deaf);
    this.mist = this.add.graphics();
    this.mist.fillStyle(0x102e24, 0.28).fillRect(0, 0, 960, 540);
    for (let i = 0; i < 25; i++)
      this.motes.push(
        this.add.circle(
          (i * 137) % 960,
          (i * 79) % 480,
          i % 3 === 0 ? 3 : 2,
          0xffe899,
          0.35,
        ),
      );
    this.bird = this.add
      .image(WORLD.birdX, 260, "parrot-a")
      .setDisplaySize(60, 72)
      .setDepth(10);
    this.add.rectangle(480, 523, 960, 34, 0x204831).setDepth(12);
    this.add.rectangle(480, 509, 960, 5, 0xa5be62).setDepth(12);
    this.input.on("pointerdown", () => this.bridge.sim.flap());
    this.bridge.ready();
  }
  resetClock() {
    this.clock.reset();
  }
  update(_time: number, delta: number) {
    if (!this.bird) return;
    const sim = this.bridge.sim;
    const active = sim.state === "playing" || sim.state === "countdown";
    let alpha = 1;
    if (active)
      alpha = this.clock.advance(delta, (dt) => {
        sim.step(dt);
        return sim.state === "playing" || sim.state === "countdown";
      });
    else this.clock.reset();
    this.sound.mute = this.bridge.muted();
    for (const e of sim.events.splice(0)) {
      const sound =
        e.type === "fruit"
          ? "get-fruit"
          : e.type === "end"
            ? e.won
              ? "winner"
              : "die"
            : null;
      if (sound && this.cache.audio.exists(sound))
        this.sound.play(sound, { volume: 0.3 });
      this.bridge.event(e);
    }
    const d = lerp(sim.prevDistance, sim.distance, alpha);
    this.backdrop.tilePositionX = this.bridge.reducedMotion() ? 0 : d * 0.16;
    this.bird.y = lerp(sim.prevY, sim.y, alpha);
    this.bird.setTexture(
      sim.vy < -70 && sim.ticks % 16 < 8 ? "parrot-b" : "parrot-a",
    );
    this.bird.angle = this.bridge.reducedMotion()
      ? 0
      : Phaser.Math.Clamp(sim.vy * 0.075, -22, 35);
    this.bird.setVisible(sim.state !== "menu");
    for (const [i, m] of this.motes.entries()) {
      m.visible = !this.bridge.reducedMotion();
      m.x = ((((i * 137 - d * 0.25) % 1040) + 1040) % 1040) - 40;
    }
    for (const [id, objects] of this.trees)
      if (!sim.obstacles.some((t) => t.id === id)) {
        objects.forEach((o) => o.destroy());
        this.trees.delete(id);
      }
    for (const t of sim.obstacles) {
      let objects = this.trees.get(t.id);
      if (!objects) {
        objects = [
          this.add
            .image(t.x, 0, "tree")
            .setOrigin(0.5, 0)
            .setFlipY(true)
            .setDepth(5),
          this.add.image(t.x, 540, "tree").setOrigin(0.5, 1).setDepth(5),
        ];
        this.trees.set(t.id, objects);
      }
      const top = t.center - t.gap / 2,
        bottom = t.center + t.gap / 2;
      objects[0].setDisplaySize(WORLD.treeWidth, top);
      objects[1].setDisplaySize(WORLD.treeWidth, 540 - bottom);
      objects.forEach((o) => (o.x = lerp(t.prevX, t.x, alpha)));
    }
    for (const [id, objects] of this.fruits)
      if (!sim.fruits.some((f) => f.id === id)) {
        objects.forEach((o) => o.destroy());
        this.fruits.delete(id);
      }
    for (const f of sim.fruits) {
      let objects = this.fruits.get(f.id);
      if (!objects) {
        objects = [
          this.add
            .circle(f.x, f.y, 27, 0xf6d779, 0.22)
            .setStrokeStyle(1, 0xffe49a, 0.8)
            .setDepth(7),
          this.add.image(f.x, f.y, f.kind).setDisplaySize(37, 37).setDepth(8),
        ];
        this.fruits.set(f.id, objects);
      }
      objects.forEach((o) => {
        o.x = lerp(f.prevX, f.x, alpha);
        o.y = f.y;
      });
      objects[0].setScale(
        this.bridge.reducedMotion() ? 1 : 1 + Math.sin(sim.ticks / 20) * 0.08,
      );
    }
    this.bridge.frame();
  }
}
