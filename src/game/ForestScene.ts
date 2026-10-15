import Phaser from "phaser";
import { FixedStep, lerp } from "../core/FixedStep";
import { Simulation, WORLD, type GameEvent } from "../core/Simulation";
import { FRUITS } from "../data/content";
import { BIRD_POSES, birdPose } from "./visuals";
import trunkPresets from "../../public/assets/v3/trunks.json";

export interface Bridge {
  sim: Simulation;
  reducedMotion: () => boolean;
  muted: () => boolean;
  ready: () => void;
  frame: () => void;
  event: (event: GameEvent) => void;
  failed: () => void;
}
type TreeView = [
  Phaser.GameObjects.Image,
  Phaser.GameObjects.Image,
  Phaser.GameObjects.TileSprite,
  Phaser.GameObjects.TileSprite,
];
export class ForestScene extends Phaser.Scene {
  private clock = new FixedStep();
  private bird!: Phaser.GameObjects.Image;
  private backdrop!: Phaser.GameObjects.Image;
  private trees = new Map<number, TreeView>();
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
      console.warn("Error loading asset:", file.key);
      if (file.type === "image") this.loadFailed = true;
    });
    this.load.image("forest", "assets/v3/forest.webp");
    for (let i = 0; i < 4; i++)
      this.load.image(`chaua-${i}`, `assets/v3/chaua-${i}.webp`);
    for (let i = 0; i < 3; i++) {
      this.load.image(`trunk-${i}`, `assets/v3/trunk-${i}.webp`);
      this.load.image(`bark-${i}`, `assets/v3/bark-${i}.webp`);
    }
    for (const f of FRUITS)
      this.load.image(`fruit-${f.id}`, `assets/v3/fruit-${f.id}.webp`);
    for (const name of ["die", "get-fruit", "winner"])
      this.load.audio(name, `assets/Sounds/${name}.wav`);
  }
  create() {
    if (this.loadFailed) {
      this.bridge.failed();
      return;
    }
    // Overscan prevents seams: this illustration is deliberately not a repeating tile.
    this.backdrop = this.add
      .image(480, 270, "forest")
      .setDisplaySize(1056, 594)
      .setDepth(1);
    this.add.rectangle(480, 265, 960, 490, 0xe4f5de, 0.09).setDepth(2);
    for (let i = 0; i < 20; i++)
      this.motes.push(
        this.add
          .circle(
            (i * 137) % 960,
            (i * 79) % 480,
            i % 3 === 0 ? 2.5 : 1.5,
            0xffeaa7,
            0.4,
          )
          .setDepth(4),
      );
    this.bird = this.add
      .image(WORLD.birdX, 260, "chaua-1")
      .setScale(0.16)
      .setDepth(10);
    this.add.rectangle(480, 525, 960, 34, 0x21452e).setDepth(14);
    this.add.rectangle(480, 510, 960, 4, 0x86a653).setDepth(14);
    this.input.on("pointerdown", () => this.bridge.sim.flap());
    this.events.once("shutdown", () => {
      this.clock.reset();
      this.trees.clear();
      this.fruits.clear();
      this.motes = [];
    });
    this.bridge.ready();
  }
  resetClock() {
    this.clock.reset();
  }
  update(_time: number, delta: number) {
    if (!this.bird) return;
    const sim = this.bridge.sim;
    let alpha = 1;
    if (sim.state === "playing" || sim.state === "countdown") {
      alpha = this.clock.advance(delta, (dt) => {
        sim.step(dt);
        return sim.state === "playing" || sim.state === "countdown";
      });
    } else this.clock.reset();
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
        this.sound.play(sound, { volume: 0.35 });
      this.bridge.event(e);
    }
    const d = lerp(sim.prevDistance, sim.distance, alpha);
    const rm = this.bridge.reducedMotion();
    this.backdrop.x = 480 - (rm ? 0 : Math.sin(d / 1800) * 40);
    this.bird.y = lerp(sim.prevY, sim.y, alpha);
    this.bird.setVisible(sim.state !== "menu");
    // Simulation time freezes during quiz/pause and resets on every run. No stale timers.
    const pose = birdPose(sim.ticks - sim.lastFlapTick, rm);
    this.bird
      .setTexture(`chaua-${pose}`)
      .setOrigin(BIRD_POSES[pose].x, BIRD_POSES[pose].y);
    this.bird.angle = rm
      ? 0
      : Phaser.Math.Clamp(sim.vy * (sim.vy < 0 ? 0.04 : 0.065), -14, 28);
    for (const [i, m] of this.motes.entries()) {
      m.visible = !rm;
      m.x = ((((i * 137 - d * 0.28) % 1040) + 1040) % 1040) - 40;
    }
    for (const [id, objects] of this.trees)
      if (!sim.obstacles.some((t) => t.id === id)) {
        objects.forEach((o) => o.destroy());
        this.trees.delete(id);
      }
    for (const t of sim.obstacles) {
      let objects = this.trees.get(t.id);
      if (!objects) {
        const variant = Math.floor(t.id / 2) % 3,
          preset = trunkPresets[variant];
        // A 60px visible wood core surrounds the forgiving 54px collision box.
        const scale = 60 / preset.coreWidth;
        const top = this.add
          .image(t.x, 0, `trunk-${variant}`)
          .setOrigin(preset.originX, 1)
          .setFlipY(true)
          .setScale(scale)
          .setDepth(6);
        const bottom = this.add
          .image(t.x, 540, `trunk-${variant}`)
          .setOrigin(preset.originX, 0)
          .setScale(scale)
          .setDepth(6);
        const barkTop = this.add
          .tileSprite(t.x, 0, 54, 540, `bark-${variant}`)
          .setOrigin(0.5, 1)
          .setTileScale(scale)
          .setDepth(5);
        const barkBottom = this.add
          .tileSprite(t.x, 540, 54, 540, `bark-${variant}`)
          .setOrigin(0.5, 0)
          .setTileScale(scale)
          .setDepth(5);
        objects = [top, bottom, barkTop, barkBottom];
        this.trees.set(t.id, objects);
      }
      const x = lerp(t.prevX, t.x, alpha),
        top = t.center - t.gap / 2,
        bottom = t.center + t.gap / 2;
      objects[0].setPosition(x, top);
      objects[1].setPosition(x, bottom);
      objects[2].setPosition(x, top - 30);
      objects[3].setPosition(x, bottom + 30);
    }
    for (const [id, objects] of this.fruits)
      if (!sim.fruits.some((f) => f.id === id)) {
        objects.forEach((o) => o.destroy());
        this.fruits.delete(id);
      }
    for (const f of sim.fruits) {
      let objects = this.fruits.get(f.id);
      if (!objects) {
        const item = this.add.image(f.x, f.y, `fruit-${f.kind}`).setDepth(8);
        item.setScale(42 / Math.max(item.width, item.height));
        objects = [
          this.add
            .circle(f.x, f.y, 25, 0xffeaa1, 0.23)
            .setStrokeStyle(1.5, 0xfff3c4, 0.8)
            .setDepth(7),
          item,
        ];
        this.fruits.set(f.id, objects);
      }
      const x = lerp(f.prevX, f.x, alpha);
      objects[0].setPosition(x, f.y);
      objects[1].setPosition(x, f.y);
      // Pulse only the halo; the collectible remains exactly on its collision center.
      objects[0].setScale(
        rm ? 1 : 1 + Math.sin((sim.ticks + alpha) / 18) * 0.07,
      );
    }
    this.bridge.frame();
  }
}
