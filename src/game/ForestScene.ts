import Phaser from 'phaser';
import { FixedStep, lerp } from '../core/FixedStep';
import { Simulation, WORLD, type GameEvent } from '../core/Simulation';
import { FRUITS } from '../data/content';

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
  private layerFore!: Phaser.GameObjects.TileSprite;
  private lastSeenFlapTick = -100;
  private flapTimer?: Phaser.Time.TimerEvent;
  private trees = new Map<number, [Phaser.GameObjects.Image, Phaser.GameObjects.Image]>();
  private fruits = new Map<number, [Phaser.GameObjects.Arc, Phaser.GameObjects.Image]>();
  private motes: Phaser.GameObjects.Arc[] = [];
  private loadFailed = false;

  constructor(private bridge: Bridge) {
    super('forest');
  }

  preload() {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn('Error loading asset:', file.key, file.src);
      if (file.type === 'image') this.loadFailed = true;
    });

    // 3D Clay Panoramic Backdrop
    this.load.image('forest-clay-bg', 'assets/v2/forest-clay-backdrop.png');
    this.load.image('forest-04', 'assets/v2/forest-04-foreground.png');

    // 3D Clay Chauá flight poses
    this.load.image('chaua-glide', 'assets/v2/chaua-clay-glide.png');
    this.load.image('chaua-flap', 'assets/v2/chaua-clay-flap.png');

    // 3D Clay Obstacles
    this.load.image('trunk-clay', 'assets/v2/trunk-clay.png');
    this.load.image('trunk-clay-top', 'assets/v2/trunk-clay-top.png');

    // 3D Clay Native Fruits
    for (const fruit of FRUITS) {
      this.load.image(`fruit-${fruit.id}`, `assets/v2/fruit-${fruit.id}.png`);
    }

    // Audio
    for (const name of ['die', 'get-fruit', 'winner']) {
      this.load.audio(name, `assets/Sounds/${name}.wav`);
    }
  }

  create() {
    if (this.loadFailed) {
      this.bridge.failed();
      return;
    }

    // 1. Panoramic 3D Clay Forest Backdrop
    this.backdrop = this.add
      .tileSprite(480, 270, 960, 540, 'forest-clay-bg')
      .setTileScale(0.5, 0.5)
      .setDepth(1);

    // 2. Ambient Forest Light Motes / Spores
    for (let i = 0; i < 28; i++) {
      this.motes.push(
        this.add
          .circle((i * 137) % 960, (i * 79) % 480, i % 3 === 0 ? 3 : 2, 0xffeaa7, 0.45)
          .setDepth(9),
      );
    }

    // 3. 3D Clay Chauá
    this.bird = this.add
      .image(WORLD.birdX, 260, 'chaua-glide')
      .setDisplaySize(78, 68)
      .setOrigin(0.5, 0.5)
      .setDepth(10);

    // 4. Foreground canopy framing (in front of bird / obstacles for immersive depth)
    this.layerFore = this.add
      .tileSprite(480, 270, 960, 540, 'forest-04')
      .setTileScale(0.5, 0.5)
      .setDepth(12);

    // 5. Floor boundaries
    this.add.rectangle(480, 523, 960, 34, 0x143521).setDepth(14);
    this.add.rectangle(480, 509, 960, 5, 0x6e9e42).setDepth(14);

    this.input.on('pointerdown', () => this.bridge.sim.flap());
    this.bridge.ready();
  }

  resetClock() {
    this.clock.reset();
  }

  update(_time: number, delta: number) {
    if (!this.bird) return;
    const sim = this.bridge.sim;
    const active = sim.state === 'playing' || sim.state === 'countdown';
    let alpha = 1;
    if (active)
      alpha = this.clock.advance(delta, (dt) => {
        sim.step(dt);
        return sim.state === 'playing' || sim.state === 'countdown';
      });
    else this.clock.reset();

    this.sound.mute = this.bridge.muted();
    for (const e of sim.events.splice(0)) {
      const sound =
        e.type === 'fruit' ? 'get-fruit' : e.type === 'end' ? (e.won ? 'winner' : 'die') : null;
      if (sound && this.cache.audio.exists(sound)) this.sound.play(sound, { volume: 0.35 });
      this.bridge.event(e);
    }

    const d = lerp(sim.prevDistance, sim.distance, alpha);
    const rm = this.bridge.reducedMotion();

    // Parallax scroll
    this.backdrop.tilePositionX = rm ? 0 : d * 0.16;
    this.layerFore.tilePositionX = rm ? 0 : d * 0.55;

    // Bird position & animation
    this.bird.y = lerp(sim.prevY, sim.y, alpha);
    this.bird.setVisible(sim.state !== 'menu');

    if (sim.state === 'playing') {
      // Dynamic flap response: switch to flap pose, then glide
      if (sim.lastFlapTick > this.lastSeenFlapTick) {
        this.lastSeenFlapTick = sim.lastFlapTick;
        this.bird.setTexture('chaua-flap');
        this.flapTimer?.remove(false);
        this.flapTimer = this.time.delayedCall(240, () => {
          if (this.bird && sim.state === 'playing') {
            this.bird.setTexture('chaua-glide');
          }
        });
      }

      // Smooth aerodynamic pitch
      this.bird.angle = rm
        ? 0
        : sim.vy < 0
          ? Phaser.Math.Clamp(sim.vy * 0.05, -20, 0)
          : Phaser.Math.Clamp(sim.vy * 0.075, 0, 32);
    } else if (sim.state === 'countdown') {
      this.bird.setTexture('chaua-glide');
      this.bird.angle = 0;
    } else if (sim.state === 'over') {
      this.bird.setTexture('chaua-glide');
      this.bird.angle = rm ? 0 : 45;
    } else {
      this.bird.setTexture('chaua-glide');
      this.bird.angle = 0;
    }

    // Ambient floating motes
    for (const [i, m] of this.motes.entries()) {
      m.visible = !rm;
      m.x = ((((i * 137 - d * 0.25) % 1040) + 1040) % 1040) - 40;
    }

    // Obstacles cleanup
    for (const [id, objects] of this.trees) {
      if (!sim.obstacles.some((t) => t.id === id)) {
        objects.forEach((o) => o.destroy());
        this.trees.delete(id);
      }
    }

    // Obstacles rendering with 3D Clay tree trunks
    // Total sprite width is 110px, solid wood core is 54px matching WORLD.treeWidth
    const trunkW = 110;
    const trunkH = 540;

    for (const t of sim.obstacles) {
      let objects = this.trees.get(t.id);
      if (!objects) {
        objects = [
          // Top trunk: cut face at bottom of sprite (origin Y = 1), extends upwards
          this.add
            .image(t.x, 0, 'trunk-clay-top')
            .setOrigin(0.5, 1)
            .setDisplaySize(trunkW, trunkH)
            .setDepth(5),
          // Bottom trunk: cut face at top of sprite (origin Y = 0), extends downwards
          this.add
            .image(t.x, 540, 'trunk-clay')
            .setOrigin(0.5, 0)
            .setDisplaySize(trunkW, trunkH)
            .setDepth(5),
        ];
        this.trees.set(t.id, objects);
      }

      const top = t.center - t.gap / 2;
      const bottom = t.center + t.gap / 2;
      const currentX = lerp(t.prevX, t.x, alpha);

      // Top cut face sits precisely at top boundary
      objects[0].setPosition(currentX, top);
      // Bottom cut face sits precisely at bottom boundary
      objects[1].setPosition(currentX, bottom);
    }

    // Collectibles cleanup
    for (const [id, objects] of this.fruits) {
      if (!sim.fruits.some((f) => f.id === id)) {
        objects.forEach((o) => o.destroy());
        this.fruits.delete(id);
      }
    }

    // Collectibles rendering: 3D Clay Fruits with glowing halo
    for (const f of sim.fruits) {
      let objects = this.fruits.get(f.id);
      if (!objects) {
        objects = [
          this.add
            .circle(f.x, f.y, 25, 0xffeaa1, 0.26)
            .setStrokeStyle(1.5, 0xfff3c4, 0.9)
            .setDepth(7),
          this.add.image(f.x, f.y, `fruit-${f.kind}`).setDisplaySize(44, 44).setDepth(8),
        ];
        this.fruits.set(f.id, objects);
      }

      const currentX = lerp(f.prevX, f.x, alpha);
      const bob = rm ? 0 : Math.sin((sim.ticks + f.id * 10) * 0.1) * 3;

      objects[0].setPosition(currentX, f.y + bob);
      objects[1].setPosition(currentX, f.y + bob);
      objects[0].setScale(rm ? 1 : 1 + Math.sin(sim.ticks / 18) * 0.09);
    }

    this.bridge.frame();
  }
}
