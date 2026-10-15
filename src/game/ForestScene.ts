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
  private bird!: Phaser.GameObjects.Sprite;
  private layer1!: Phaser.GameObjects.TileSprite;
  private layer2!: Phaser.GameObjects.TileSprite;
  private layer3!: Phaser.GameObjects.TileSprite;
  private layer4!: Phaser.GameObjects.TileSprite;
  private mist!: Phaser.GameObjects.Graphics;
  private lastSeenFlapTick = -100;
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

    // Parallax background layers (1920x1080)
    this.load.image('forest-01', 'assets/v2/forest-01-atmosphere.png');
    this.load.image('forest-02', 'assets/v2/forest-02-distant-trees.png');
    this.load.image('forest-03', 'assets/v2/forest-03-mid-canopy.png');
    this.load.image('forest-04', 'assets/v2/forest-04-foreground.png');

    // Chauá 8-frame flight animation atlas
    this.load.atlas(
      'chaua-v2',
      'assets/v2/chaua-flight-sheet.png',
      'assets/v2/chaua-flight-atlas.json',
    );

    // Obstacles
    this.load.image('trunk-01', 'assets/v2/trunk-01.png');
    this.load.image('trunk-02', 'assets/v2/trunk-02.png');
    this.load.image('trunk-03', 'assets/v2/trunk-03.png');
    this.load.image('vine-01', 'assets/v2/vine-01.png');
    this.load.image('vine-02', 'assets/v2/vine-02.png');
    this.load.image('bromelia', 'assets/v2/bromelia.png');
    this.load.image('fern', 'assets/v2/fern.png');

    // Native fruits
    for (const fruit of FRUITS) {
      this.load.image(`fruit-${fruit.id}`, `assets/v2/fruit-${fruit.id}.png`);
    }

    // Audio
    for (const name of ['die', 'get-fruit', 'winner'])
      this.load.audio(name, `assets/Sounds/${name}.wav`);
  }

  create() {
    if (this.loadFailed) {
      this.bridge.failed();
      return;
    }

    // Layer 1: Atmosphere
    this.layer1 = this.add
      .tileSprite(480, 270, 960, 540, 'forest-01')
      .setTileScale(0.5, 0.5)
      .setDepth(1);

    // Layer 2: Distant trees
    this.layer2 = this.add
      .tileSprite(480, 270, 960, 540, 'forest-02')
      .setTileScale(0.5, 0.5)
      .setDepth(2);

    // Layer 3: Mid canopy
    this.layer3 = this.add
      .tileSprite(480, 270, 960, 540, 'forest-03')
      .setTileScale(0.5, 0.5)
      .setDepth(3);

    // Atmospheric mist
    this.mist = this.add.graphics().setDepth(4);
    this.mist.fillStyle(0x0e281b, 0.1).fillRect(0, 0, 960, 540);

    // Ambient forest light motes / fireflies
    for (let i = 0; i < 25; i++)
      this.motes.push(
        this.add
          .circle((i * 137) % 960, (i * 79) % 480, i % 3 === 0 ? 3 : 2, 0xffeaa7, 0.4)
          .setDepth(9),
      );

    // Energetic flap burst when key pressed (plays once, then settles into glide)
    this.anims.create({
      key: 'chaua-flap',
      frames: [
        { key: 'chaua-v2', frame: 'fly-03' },
        { key: 'chaua-v2', frame: 'fly-04' },
        { key: 'chaua-v2', frame: 'fly-05' },
        { key: 'chaua-v2', frame: 'fly-06' },
        { key: 'chaua-v2', frame: 'fly-07' },
        { key: 'chaua-v2', frame: 'fly-00' },
        { key: 'chaua-v2', frame: 'fly-01' },
      ],
      frameRate: 20,
      repeat: 0,
    });

    // Gentle hover loop for countdown
    this.anims.create({
      key: 'chaua-hover',
      frames: Array.from({ length: 8 }, (_, i) => ({
        key: 'chaua-v2',
        frame: `fly-${String(i).padStart(2, '0')}`,
      })),
      frameRate: 8,
      repeat: -1,
    });

    this.bird = this.add
      .sprite(WORLD.birdX, 260, 'chaua-v2', 'fly-01')
      .setDisplaySize(72, 72)
      .setOrigin(0.55, 0.54)
      .setDepth(10);

    // Layer 4: Foreground canopy & ferns (in front of bird / obstacles for immersive parallax)
    this.layer4 = this.add
      .tileSprite(480, 270, 960, 540, 'forest-04')
      .setTileScale(0.5, 0.5)
      .setDepth(12);

    // Floor boundaries
    this.add.rectangle(480, 523, 960, 34, 0x163421).setDepth(14);
    this.add.rectangle(480, 509, 960, 5, 0x82a94f).setDepth(14);

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
      if (sound && this.cache.audio.exists(sound)) this.sound.play(sound, { volume: 0.3 });
      this.bridge.event(e);
    }

    const d = lerp(sim.prevDistance, sim.distance, alpha);
    const rm = this.bridge.reducedMotion();

    // 4-Layer Parallax scroll
    this.layer1.tilePositionX = rm ? 0 : d * 0.04;
    this.layer2.tilePositionX = rm ? 0 : d * 0.12;
    this.layer3.tilePositionX = rm ? 0 : d * 0.28;
    this.layer4.tilePositionX = rm ? 0 : d * 0.55;

    // Bird position and dynamic wing animation
    this.bird.y = lerp(sim.prevY, sim.y, alpha);
    this.bird.setVisible(sim.state !== 'menu');

    if (sim.state === 'playing') {
      // Trigger flap animation burst only when player flaps
      if (sim.lastFlapTick > this.lastSeenFlapTick) {
        this.lastSeenFlapTick = sim.lastFlapTick;
        this.bird.play('chaua-flap', true);
      } else if (!this.bird.anims.isPlaying) {
        // Hold open wings gliding pose
        this.bird.setFrame('fly-01');
      }
      this.bird.angle = rm
        ? 0
        : sim.vy < 0
          ? Phaser.Math.Clamp(sim.vy * 0.05, -20, 0)
          : Phaser.Math.Clamp(sim.vy * 0.075, 0, 32);
    } else if (sim.state === 'countdown') {
      if (!this.bird.anims.isPlaying || this.bird.anims.currentAnim?.key !== 'chaua-hover') {
        this.bird.play('chaua-hover');
      }
      this.bird.angle = 0;
    } else if (sim.state === 'over') {
      this.bird.stop();
      this.bird.setFrame('fly-04');
      this.bird.angle = rm ? 0 : 45;
    } else {
      this.bird.stop();
      this.bird.setFrame('fly-01');
      this.bird.angle = 0;
    }

    // Ambient floating motes
    for (const [i, m] of this.motes.entries()) {
      m.visible = !rm;
      m.x = ((((i * 137 - d * 0.25) % 1040) + 1040) % 1040) - 40;
    }

    // Obstacles cleanup
    for (const [id, objects] of this.trees)
      if (!sim.obstacles.some((t) => t.id === id)) {
        objects.forEach((o) => o.destroy());
        this.trees.delete(id);
      }

    // Obstacles rendering with pixel-perfect cut face alignment and core hitbox matching
    const trunkKeys = ['trunk-01', 'trunk-02', 'trunk-03'];
    const trunkW = 170; // 54px core / (76/240) = 170px total sprite width
    const trunkH = 440; // Full height ensures trunks reach past screen edge without distortion

    for (const t of sim.obstacles) {
      let objects = this.trees.get(t.id);
      if (!objects) {
        const topKey = trunkKeys[t.id % 3];
        const bottomKey = trunkKeys[(t.id + 1) % 3];
        objects = [
          // Top trunk: flipped vertically, cut tip aligned at bottom of sprite (0.48, 0.95)
          this.add
            .image(t.x, 0, topKey)
            .setOrigin(0.48, 0.95)
            .setFlipY(true)
            .setDisplaySize(trunkW, trunkH)
            .setDepth(5),
          // Bottom trunk: normal, cut tip aligned at top of sprite (0.48, 0.05)
          this.add
            .image(t.x, 540, bottomKey)
            .setOrigin(0.48, 0.05)
            .setDisplaySize(trunkW, trunkH)
            .setDepth(5),
        ];
        this.trees.set(t.id, objects);
      }
      const top = t.center - t.gap / 2;
      const bottom = t.center + t.gap / 2;
      const currentX = lerp(t.prevX, t.x, alpha);

      // Top trunk cut face is positioned precisely at top
      objects[0].setPosition(currentX, top);
      // Bottom trunk cut face is positioned precisely at bottom
      objects[1].setPosition(currentX, bottom);
    }

    // Collectibles cleanup
    for (const [id, objects] of this.fruits)
      if (!sim.fruits.some((f) => f.id === id)) {
        objects.forEach((o) => o.destroy());
        this.fruits.delete(id);
      }

    // Collectibles rendering
    for (const f of sim.fruits) {
      let objects = this.fruits.get(f.id);
      if (!objects) {
        objects = [
          this.add
            .circle(f.x, f.y, 25, 0xf6d779, 0.24)
            .setStrokeStyle(1.5, 0xffe49a, 0.85)
            .setDepth(7),
          this.add.image(f.x, f.y, `fruit-${f.kind}`).setDisplaySize(38, 38).setDepth(8),
        ];
        this.fruits.set(f.id, objects);
      }
      objects.forEach((o) => {
        o.x = lerp(f.prevX, f.x, alpha);
        o.y = f.y;
      });
      objects[0].setScale(rm ? 1 : 1 + Math.sin(sim.ticks / 18) * 0.09);
    }

    this.bridge.frame();
  }
}
