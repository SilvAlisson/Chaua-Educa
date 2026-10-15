import Phaser from "phaser";
import { FixedStep, lerp } from "../core/FixedStep";
import { Simulation, WORLD, type GameEvent } from "../core/Simulation";
import { FRUITS } from "../data/content";
import { BIRD_POSES, birdPose } from "./visuals";
import expansion from "./assets/expansion.json";
import trunkPresets from "./assets/trunks.json";

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
  Phaser.GameObjects.Image,
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
  private aura!: Phaser.GameObjects.Arc;
  private leaves: Phaser.GameObjects.Ellipse[] = [];
  private trails: Phaser.GameObjects.Image[] = [];
  private lighting!: Phaser.GameObjects.Rectangle;
  private ambient = 0;
  private powerViews = new Map<
    number,
    [Phaser.GameObjects.Arc, Phaser.GameObjects.Image]
  >();
  private hawkViews = new Map<
    number,
    [Phaser.GameObjects.Image, Phaser.GameObjects.Text]
  >();
  private particles: {
    object: Phaser.GameObjects.Arc;
    born: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
  }[] = [];
  constructor(private bridge: Bridge) {
    super("forest");
  }
  preload() {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.warn("Error loading asset:", file.key);
      if (file.type === "image") this.loadFailed = true;
    });
    for (const key of [
      "snake",
      "hollow",
      "hawk-0",
      "hawk-1",
      "feather",
      "shield",
      "branch",
    ])
      this.load.image(key, `assets/v4/${key}.webp`);
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
    this.lighting = this.add
      .rectangle(480, 265, 960, 490, 0xffd98a, 0.05)
      .setDepth(2);
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
    this.aura = this.add
      .circle(WORLD.birdX, 260, 42, 0x98e6b0, 0.15)
      .setStrokeStyle(2, 0xc0ffcf, 0.9)
      .setDepth(11)
      .setVisible(false);
    for (let i = 0; i < 3; i++)
      this.leaves.push(
        this.add.ellipse(0, 0, 10, 5, 0x9de399).setDepth(12).setVisible(false),
      );
    for (let i = 0; i < 4; i++)
      this.trails.push(
        this.add
          .image(0, 0, "feather")
          .setDisplaySize(9, 9)
          .setDepth(9)
          .setVisible(false),
      );
    this.input.on("pointerdown", () => this.bridge.sim.hold());
    this.input.on("pointerup", () => this.bridge.sim.release());
    this.input.on("pointerupoutside", () => this.bridge.sim.release());
    this.input.on("gameout", () => this.bridge.sim.release());
    this.events.once("shutdown", () => {
      this.clock.reset();
      this.trees.clear();
      this.fruits.clear();
      this.motes = [];
      this.hawkViews.clear();
      this.powerViews.clear();
      this.particles = [];
      this.leaves = [];
      this.trails = [];
    });
    this.bridge.ready();
  }
  private powerFeedback(
    event: Extract<GameEvent, { type: "power" | "shield-break" }>,
  ) {
    const sim = this.bridge.sim;
    if (event.type === "shield-break") {
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        this.particles.push({
          object: this.add
            .circle(
              event.x,
              event.y,
              (i % 3) + 2,
              event.animal ? 0xb8df83 : 0xc5a06a,
            )
            .setDepth(13),
          born: sim.ticks,
          x: event.x,
          y: event.y,
          vx: Math.cos(angle) * 90,
          vy: Math.sin(angle) * 80,
        });
      }
    }
    if (
      this.bridge.muted() ||
      !(this.sound instanceof Phaser.Sound.WebAudioSoundManager)
    )
      return;
    const context = this.sound.context;
    if (context.state !== "running") return;
    const osc = context.createOscillator(),
      gain = context.createGain(),
      now = context.currentTime;
    osc.type = event.type === "shield-break" ? "triangle" : "sine";
    const frequency =
      event.type === "shield-break" ? 240 : event.kind === "shield" ? 520 : 780;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(
      event.type === "shield-break" ? 70 : frequency * 1.5,
      now + 0.18,
    );
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.26);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
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
      if (e.type === "power" || e.type === "shield-break")
        this.powerFeedback(e);
      this.bridge.event(e);
    }
    if (sim.state === "menu") this.ambient += Math.min(delta, 50) / 1000;
    if (sim.state === "countdown" && !sim.resuming) {
      for (const p of this.particles) p.object.destroy();
      this.particles = [];
    }
    const d = lerp(sim.prevDistance, sim.distance, alpha);
    const rm = this.bridge.reducedMotion();
    this.backdrop.x =
      480 -
      (rm
        ? 0
        : Math.sin(d / 1800 + (sim.state === "menu" ? this.ambient / 12 : 0)) *
          40);
    this.lighting.setFillStyle(
      d < 4500 ? 0xffd98a : d < 10000 ? 0xb5e3bc : 0x91c7dc,
      0.07,
    );
    const visualTick = sim.ticks + (sim.state === "playing" ? alpha : 0);
    this.bird.y = lerp(sim.prevY, sim.y, alpha);
    this.bird.setVisible(sim.state !== "menu");
    // Simulation time freezes during quiz/pause and resets on every run. No stale timers.
    const pose = birdPose(sim.ticks - sim.lastFlapTick, rm);
    this.bird
      .setTexture(`chaua-${pose}`)
      .setOrigin(BIRD_POSES[pose].x, BIRD_POSES[pose].y);
    this.bird.angle = rm ? 0 : lerp(sim.prevPitch, sim.pitch, alpha);
    this.aura
      .setPosition(WORLD.birdX, this.bird.y)
      .setVisible(
        sim.state !== "menu" && (sim.shield || sim.protectionTicks > 0),
      );
    this.aura.setAlpha(sim.shield ? 1 : 0.55);
    for (const [i, leaf] of this.leaves.entries()) {
      const angle = (i * Math.PI * 2) / 3 + (rm ? 0 : visualTick / 45);
      leaf
        .setVisible(this.aura.visible)
        .setPosition(
          WORLD.birdX + Math.cos(angle) * 42,
          this.bird.y + Math.sin(angle) * 42,
        )
        .setRotation(angle);
    }
    for (const [i, trail] of this.trails.entries())
      trail
        .setVisible(!rm && sim.featherTicks > 0 && sim.state !== "menu")
        .setPosition(
          WORLD.birdX - 35 - i * 13,
          this.bird.y + Math.sin(visualTick / 12 + i) * 6,
        )
        .setAlpha(0.7 - i * 0.14);
    for (const p of this.particles) {
      const age = (visualTick - p.born) / 60;
      p.object
        .setVisible(!rm && sim.state !== "menu")
        .setPosition(p.x + p.vx * age, p.y + p.vy * age + 45 * age * age)
        .setAlpha(Math.max(0, 1 - age));
    }
    this.particles = this.particles.filter((p) => {
      if (visualTick - p.born > 60) {
        p.object.destroy();
        return false;
      }
      return true;
    });
    for (const [i, m] of this.motes.entries()) {
      m.visible = !rm;
      m.x =
        ((((i * 137 -
          d * 0.28 -
          (sim.state === "menu" ? this.ambient * 9 : 0)) %
          1040) +
          1040) %
          1040) -
        40;
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
        const special =
          t.kind === "snake" || t.kind === "hollow" ? expansion[t.kind] : null;
        const bottom = this.add
          .image(t.x, 540, special ? t.kind! : `trunk-${variant}`)
          .setOrigin(special?.originX ?? preset.originX, 0)
          .setScale(special ? 60 / special.coreWidth : scale)
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
        const branch = this.add
          .image(t.x, 540, "branch")
          .setDepth(7)
          .setVisible(t.kind === "branch");
        branch.setScale(160 / branch.width);
        objects = [top, bottom, barkTop, barkBottom, branch];
        this.trees.set(t.id, objects);
      }
      const x = lerp(t.prevX, t.x, alpha),
        top = t.center - t.gap / 2,
        bottom = t.center + t.gap / 2;
      objects[0].setPosition(x, top);
      objects[1].setPosition(x, bottom);
      objects[2].setPosition(x, top - 30);
      objects[3].setPosition(x, bottom + 30);
      objects[4].setPosition(x - 45, bottom + 55);
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
    for (const [id, view] of this.hawkViews)
      if (!sim.hawks.some((h) => h.id === id)) {
        view.forEach((o) => o.destroy());
        this.hawkViews.delete(id);
      }
    for (const h of sim.hawks) {
      let view = this.hawkViews.get(h.id);
      if (!view) {
        const bird = this.add
          .image(h.x, h.y, "hawk-0")
          .setScale(0.17)
          .setOrigin(0.43, 0.66)
          .setDepth(8);
        const warning = this.add
          .text(930, h.targetY, "Gavião ←", {
            fontFamily: '"Nunito Variable", sans-serif',
            fontSize: "15px",
            color: "#fff5d4",
            backgroundColor: "#6c4125",
            padding: { x: 9, y: 6 },
          })
          .setOrigin(1, 0.5)
          .setDepth(15);
        view = [bird, warning];
        this.hawkViews.set(h.id, view);
      }
      view[0]
        .setPosition(lerp(h.prevX, h.x, alpha), lerp(h.prevY, h.y, alpha))
        .setTexture(`hawk-${rm ? 1 : Math.floor(visualTick / 10) % 2}`);
      view[0].angle = rm
        ? 0
        : h.dive
          ? Math.max(-10, Math.min(10, (h.y - h.prevY) * 4))
          : 0;
      view[1].setVisible(h.x > 840).setY(h.targetY);
    }
    for (const [id, view] of this.powerViews)
      if (!sim.powers.some((p) => p.id === id)) {
        view.forEach((o) => o.destroy());
        this.powerViews.delete(id);
      }
    for (const p of sim.powers) {
      let view = this.powerViews.get(p.id);
      if (!view) {
        const item = this.add.image(p.x, p.y, p.kind).setDepth(9);
        item.setScale(39 / Math.max(item.width, item.height));
        view = [
          this.add
            .circle(
              p.x,
              p.y,
              25,
              p.kind === "shield" ? 0x99e8af : 0xffd76a,
              0.3,
            )
            .setStrokeStyle(2, 0xffedb5, 0.85)
            .setDepth(8),
          item,
        ];
        this.powerViews.set(p.id, view);
      }
      const x = lerp(p.prevX, p.x, alpha);
      view[0].setPosition(x, p.y);
      view[1].setPosition(x, p.y);
      view[0].setScale(rm ? 1 : 1 + Math.sin(visualTick / 20) * 0.06);
    }
    this.bridge.frame();
  }
}
