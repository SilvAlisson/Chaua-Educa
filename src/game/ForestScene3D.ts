import * as THREE from "three";
import { FixedStep, lerp } from "../core/FixedStep";
import { Simulation, WORLD, type GameEvent } from "../core/Simulation";
import { FRUITS, type FruitId } from "../data/content";

export interface Bridge {
  sim: Simulation;
  reducedMotion: () => boolean;
  muted: () => boolean;
  ready: () => void;
  frame: () => void;
  event: (event: GameEvent) => void;
  failed: () => void;
}

// Convert 2D Simulation coordinates (0-960 X, 0-540 Y top-down)
// into standard Three.js Orthographic coordinates (X: -480 to 480, Y: -270 to 270 Y-up).
function toThreeX(x: number): number {
  return x - 480;
}
function toThreeY(y: number): number {
  return 270 - y;
}

export class ForestScene3D {
  private clock = new FixedStep();
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private container: HTMLElement;

  // Background parallax layers (planes with scrolling textures)
  private bgLayer1!: THREE.Mesh;
  private bgLayer2!: THREE.Mesh;
  private bgLayer3!: THREE.Mesh;
  private bgLayer4!: THREE.Mesh;
  private bgTex1!: THREE.Texture;
  private bgTex2!: THREE.Texture;
  private bgTex3!: THREE.Texture;
  private bgTex4!: THREE.Texture;

  // 3D Papagaio-Chauá
  private birdGroup!: THREE.Group;
  private wingLeft!: THREE.Group;
  private wingRight!: THREE.Group;
  private birdBody!: THREE.Mesh;
  private lastSeenFlapTick = -100;
  private flapTime = 999;

  // Obstacles: map of id -> [topTrunkGroup, bottomTrunkGroup]
  private trees = new Map<number, [THREE.Group, THREE.Group]>();

  // Fruits: map of id -> fruitGroup
  private fruits = new Map<number, THREE.Group>();

  // 3D Ambient Fireflies / Motes
  private motesGroup!: THREE.Group;
  private motesData: { x: number; y: number; z: number; speed: number; phase: number }[] = [];

  // Audio elements
  private sounds = new Map<string, HTMLAudioElement>();

  private animFrameId: number | null = null;
  private lastTimestamp = 0;
  private isDestroyed = false;

  constructor(
    private bridge: Bridge,
    containerId: string = "game",
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.init();
  }

  private async init() {
    try {
      // 1. Setup Scene & Renderer
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0a1c12);

      this.camera = new THREE.OrthographicCamera(-480, 480, 270, -270, 0.1, 1500);
      this.camera.position.set(0, 0, 500);
      this.camera.lookAt(0, 0, 0);

      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = false;
      this.renderer.domElement.style.display = "block";

      // Clear any prior canvas
      this.container.innerHTML = "";
      this.container.appendChild(this.renderer.domElement);

      // Fit container keeping 16:9 aspect ratio
      this.handleResize();

      // Pointer event for flapping
      this.container.addEventListener("pointerdown", (e) => {
        if ((e.target as HTMLElement).tagName === "CANVAS" || e.target === this.container) {
          this.bridge.sim.flap();
        }
      });

      // 2. Lighting (warm sunlight + lush forest ambient)
      const ambient = new THREE.AmbientLight(0xdcf3e1, 1.4);
      this.scene.add(ambient);

      const sun = new THREE.DirectionalLight(0xfff7db, 2.2);
      sun.position.set(200, 300, 350);
      this.scene.add(sun);

      const forestRim = new THREE.DirectionalLight(0x7ac998, 0.9);
      forestRim.position.set(-250, -150, 200);
      this.scene.add(forestRim);

      // 3. Parallax Layers
      await this.initParallax();

      // 4. Create 3D Chauá
      this.initBird();

      // 5. Create 3D Motes / Fireflies
      this.initMotes();

      // 6. Audio
      this.initAudio();

      // Start render loop
      this.lastTimestamp = performance.now();
      this.loop = this.loop.bind(this);
      this.animFrameId = requestAnimationFrame(this.loop);

      this.bridge.ready();
    } catch (err) {
      console.error("ForestScene3D init failed:", err);
      this.bridge.failed();
    }
  }

  private async initParallax() {
    const loader = new THREE.TextureLoader();
    const loadTex = (url: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

    const [t1, t2, t3, t4] = await Promise.all([
      loadTex("assets/v2/forest-01-atmosphere.png"),
      loadTex("assets/v2/forest-02-distant-trees.png"),
      loadTex("assets/v2/forest-03-mid-canopy.png"),
      loadTex("assets/v2/forest-04-foreground.png"),
    ]);

    for (const t of [t1, t2, t3, t4]) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
    }
    this.bgTex1 = t1;
    this.bgTex2 = t2;
    this.bgTex3 = t3;
    this.bgTex4 = t4;

    const geo = new THREE.PlaneGeometry(960, 540);

    // Layer 1: Atmosphere (z = -350)
    const mat1 = new THREE.MeshBasicMaterial({ map: t1, depthWrite: false });
    this.bgLayer1 = new THREE.Mesh(geo, mat1);
    this.bgLayer1.position.set(0, 0, -350);
    this.scene.add(this.bgLayer1);

    // Layer 2: Distant trees (z = -220)
    const mat2 = new THREE.MeshBasicMaterial({ map: t2, transparent: true, depthWrite: false });
    this.bgLayer2 = new THREE.Mesh(geo, mat2);
    this.bgLayer2.position.set(0, 0, -220);
    this.scene.add(this.bgLayer2);

    // Layer 3: Mid canopy (z = -100)
    const mat3 = new THREE.MeshBasicMaterial({ map: t3, transparent: true, depthWrite: false });
    this.bgLayer3 = new THREE.Mesh(geo, mat3);
    this.bgLayer3.position.set(0, 0, -100);
    this.scene.add(this.bgLayer3);

    // Layer 4: Foreground canopy & ferns (z = +70, passes in front of 3D bird and obstacles)
    const mat4 = new THREE.MeshBasicMaterial({ map: t4, transparent: true, depthWrite: false });
    this.bgLayer4 = new THREE.Mesh(geo, mat4);
    this.bgLayer4.position.set(0, 0, 70);
    this.scene.add(this.bgLayer4);

    // Floor bar (z = +80)
    const floorGeo = new THREE.PlaneGeometry(960, 36);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x143321 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, toThreeY(523), 80);
    this.scene.add(floorMesh);

    const floorLineGeo = new THREE.PlaneGeometry(960, 5);
    const floorLineMat = new THREE.MeshBasicMaterial({ color: 0x82a94f });
    const floorLine = new THREE.Mesh(floorLineGeo, floorLineMat);
    floorLine.position.set(0, toThreeY(508), 81);
    this.scene.add(floorLine);
  }

  // -------------------------------------------------------------
  // 3D MODEL: PAPAGAIO-CHAUÁ (Amazona rhodocorytha)
  // -------------------------------------------------------------
  private initBird() {
    this.birdGroup = new THREE.Group();

    // Materials
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x3d9c44,
      roughness: 0.45,
      metalness: 0.05,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0x88c459,
      roughness: 0.5,
    });
    const redCrownMat = new THREE.MeshStandardMaterial({
      color: 0xe63422,
      roughness: 0.4,
    });
    const blueCheekMat = new THREE.MeshStandardMaterial({
      color: 0x2b89c7,
      roughness: 0.4,
    });
    const beakMat = new THREE.MeshStandardMaterial({
      color: 0x3d4b50,
      roughness: 0.35,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
    });
    const eyePupilMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.1,
    });

    // 1. Torso / Body (Teardrop shape)
    const bodyGeo = new THREE.SphereGeometry(15, 20, 16);
    bodyGeo.scale(1.0, 1.25, 0.85);
    this.birdBody = new THREE.Mesh(bodyGeo, greenMat);
    this.birdBody.rotation.z = -0.15;
    this.birdGroup.add(this.birdBody);

    // Belly patch
    const bellyGeo = new THREE.SphereGeometry(12, 16, 12);
    bellyGeo.scale(0.8, 1.1, 0.5);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(5, -2, 5);
    this.birdGroup.add(belly);

    // 2. Head
    const headGeo = new THREE.SphereGeometry(12, 18, 16);
    const head = new THREE.Mesh(headGeo, greenMat);
    head.position.set(10, 11, 0);
    this.birdGroup.add(head);

    // Red Crown (Crista vermelha característica do Chauá)
    const crownGeo = new THREE.ConeGeometry(7, 13, 12);
    crownGeo.scale(0.9, 1.0, 0.7);
    const crown = new THREE.Mesh(crownGeo, redCrownMat);
    crown.position.set(13, 20, 0);
    crown.rotation.z = -0.4;
    this.birdGroup.add(crown);

    // Blue Cheeks (Faces azuladas do Chauá)
    const cheekGeo = new THREE.SphereGeometry(6, 12, 12);
    cheekGeo.scale(1.2, 0.8, 0.3);
    const cheekR = new THREE.Mesh(cheekGeo, blueCheekMat);
    cheekR.position.set(12, 10, 7.5);
    this.birdGroup.add(cheekR);

    const cheekL = new THREE.Mesh(cheekGeo, blueCheekMat);
    cheekL.position.set(12, 10, -7.5);
    this.birdGroup.add(cheekL);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(2.5, 12, 10);
    const pupilGeo = new THREE.SphereGeometry(1.4, 10, 8);

    const eyeR = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eyeR.position.set(14, 13, 6);
    const pupilR = new THREE.Mesh(pupilGeo, eyePupilMat);
    pupilR.position.set(15, 13.5, 6.5);
    this.birdGroup.add(eyeR);
    this.birdGroup.add(pupilR);

    // Beak (Curved downwards)
    const beakGeo = new THREE.ConeGeometry(5, 12, 8);
    beakGeo.scale(0.8, 1.0, 0.6);
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(20, 8, 0);
    beak.rotation.z = -1.35;
    this.birdGroup.add(beak);

    // Tail (Short Amazon-parrot tail)
    const tailGeo = new THREE.BoxGeometry(16, 5, 12);
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x2e7d3a });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(-18, -10, 0);
    tail.rotation.z = 0.35;
    this.birdGroup.add(tail);

    // 3. Wings (Left and Right with shoulder pivot)
    this.wingRight = this.createWing(true);
    this.wingRight.position.set(-2, 3, 9);
    this.birdGroup.add(this.wingRight);

    this.wingLeft = this.createWing(false);
    this.wingLeft.position.set(-2, 3, -9);
    this.birdGroup.add(this.wingLeft);

    // Position bird at simulation spawn
    this.birdGroup.position.set(toThreeX(WORLD.birdX), toThreeY(260), 10);
    this.scene.add(this.birdGroup);
  }

  private createWing(isRight: boolean): THREE.Group {
    const wingGroup = new THREE.Group();

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x2f8b3c,
      roughness: 0.5,
    });
    const flightFeathersMat = new THREE.MeshStandardMaterial({
      color: 0x1d667a, // Cobalt blue wing tips
      roughness: 0.45,
    });
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: 0xd9442b, // Red covert accent
      roughness: 0.4,
    });

    // Shoulder covert
    const shoulderGeo = new THREE.SphereGeometry(5, 12, 10);
    shoulderGeo.scale(1.2, 0.8, 0.5);
    const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    wingGroup.add(shoulder);

    // Main wing blade
    const bladeGeo = new THREE.BoxGeometry(26, 3, 14);
    const blade = new THREE.Mesh(bladeGeo, wingMat);
    blade.position.set(-7, -4, isRight ? 3 : -3);
    blade.rotation.y = isRight ? 0.2 : -0.2;
    wingGroup.add(blade);

    // Flight primary feathers
    const featherGeo = new THREE.BoxGeometry(18, 2, 12);
    const feathers = new THREE.Mesh(featherGeo, flightFeathersMat);
    feathers.position.set(-16, -6, isRight ? 4 : -4);
    feathers.rotation.y = isRight ? 0.3 : -0.3;
    wingGroup.add(feathers);

    return wingGroup;
  }

  // -------------------------------------------------------------
  // 3D OBSTACLES: TREE TRUNKS (Real 3D Cylinders with Growth Rings)
  // -------------------------------------------------------------
  private createTrunkMesh(isTop: boolean): THREE.Group {
    const trunkGroup = new THREE.Group();

    const radius = 27; // 54px diameter
    const height = 450;

    // Wood Bark Material
    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x6b4f38,
      roughness: 0.9,
      metalness: 0.05,
    });

    // Cut End Cap Material (growth rings)
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xd6bf83,
      roughness: 0.65,
    });

    // Moss accent material
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x5a8c4f,
      roughness: 0.95,
    });

    // 1. Trunk Cylinder
    const cylGeo = new THREE.CylinderGeometry(radius, radius * 1.08, height, 20);
    // Position cylinder so the cut cap is at y = 0
    if (isTop) {
      // Extends up from y=0 towards +height
      cylGeo.translate(0, height / 2, 0);
    } else {
      // Extends down from y=0 towards -height
      cylGeo.translate(0, -height / 2, 0);
    }
    const cyl = new THREE.Mesh(cylGeo, barkMat);
    trunkGroup.add(cyl);

    // 2. Cut End Cap Disk (exactly at y = 0)
    const capGeo = new THREE.CircleGeometry(radius * 0.98, 20);
    capGeo.rotateX(isTop ? Math.PI / 2 : -Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = isTop ? 0.2 : -0.2;
    trunkGroup.add(cap);

    // Ring detail on cut cap
    const ringGeo = new THREE.RingGeometry(radius * 0.4, radius * 0.55, 20);
    ringGeo.rotateX(isTop ? Math.PI / 2 : -Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x9e8755, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = isTop ? 0.3 : -0.3;
    trunkGroup.add(ring);

    // 3. Moss bands on trunk
    const mossGeo = new THREE.CylinderGeometry(radius * 1.02, radius * 1.05, 35, 16);
    mossGeo.translate(0, isTop ? 55 : -55, 0);
    const moss = new THREE.Mesh(mossGeo, mossMat);
    trunkGroup.add(moss);

    // 4. 3D Bromeliad Epiphyte near cut end
    const bromeliaGroup = new THREE.Group();
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d8c54, roughness: 0.6 });
    const leafGeo = new THREE.ConeGeometry(3, 18, 5);
    leafGeo.scale(1.0, 1.0, 0.3);

    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.cos(angle) * 7, 0, Math.sin(angle) * 7);
      leaf.rotation.z = Math.cos(angle) * 0.6;
      leaf.rotation.x = Math.sin(angle) * 0.6;
      bromeliaGroup.add(leaf);
    }
    bromeliaGroup.position.set(radius * 0.85, isTop ? 28 : -28, 4);
    trunkGroup.add(bromeliaGroup);

    return trunkGroup;
  }

  // -------------------------------------------------------------
  // 3D FRUITS: SHINY ROTATING NATIVE DISCOVERIES
  // -------------------------------------------------------------
  private createFruitMesh(kind: FruitId): THREE.Group {
    const group = new THREE.Group();

    let mesh: THREE.Object3D;
    const roughness = 0.35;
    const metalness = 0.08;

    switch (kind) {
      case "Goiaba": {
        const geo = new THREE.SphereGeometry(15, 18, 14);
        geo.scale(1.0, 1.1, 1.0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x86bd56, roughness, metalness });
        mesh = new THREE.Mesh(geo, mat);

        // Crown calyx
        const calyxGeo = new THREE.ConeGeometry(4, 5, 5);
        const calyxMat = new THREE.MeshStandardMaterial({ color: 0x4a7330 });
        const calyx = new THREE.Mesh(calyxGeo, calyxMat);
        calyx.position.y = 15;
        calyx.rotation.x = Math.PI;
        group.add(calyx);
        break;
      }
      case "Manga": {
        const geo = new THREE.SphereGeometry(16, 18, 14);
        geo.scale(0.85, 1.25, 0.7);
        const mat = new THREE.MeshStandardMaterial({ color: 0xf58a36, roughness, metalness });
        mesh = new THREE.Mesh(geo, mat);
        break;
      }
      case "Banana": {
        // Curved banana tube
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-14, 8, 0),
          new THREE.Vector3(0, -6, 0),
          new THREE.Vector3(14, 8, 0),
        ]);
        const geo = new THREE.TubeGeometry(curve, 16, 4.5, 8, false);
        const mat = new THREE.MeshStandardMaterial({ color: 0xf7d239, roughness, metalness });
        mesh = new THREE.Mesh(geo, mat);
        break;
      }
      case "Mamao": {
        const geo = new THREE.SphereGeometry(15, 18, 14);
        geo.scale(0.85, 1.4, 0.85);
        const mat = new THREE.MeshStandardMaterial({ color: 0xed9c39, roughness, metalness });
        mesh = new THREE.Mesh(geo, mat);
        break;
      }
      case "Coquinho": {
        const geo = new THREE.SphereGeometry(14, 16, 14);
        const mat = new THREE.MeshStandardMaterial({ color: 0x6e5033, roughness: 0.6, metalness });
        mesh = new THREE.Mesh(geo, mat);
        break;
      }
      case "Milho": {
        const geo = new THREE.CylinderGeometry(7, 10, 24, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0xfcc638, roughness, metalness });
        mesh = new THREE.Mesh(geo, mat);
        break;
      }
      case "Semente":
      default: {
        const geo = new THREE.SphereGeometry(13, 16, 12);
        geo.scale(1.1, 0.7, 0.9);
        const mat = new THREE.MeshStandardMaterial({ color: 0x824d35, roughness: 0.25, metalness: 0.1 });
        mesh = new THREE.Mesh(geo, mat);
        break;
      }
    }
    group.add(mesh);

    // Glowing 3D halo ring
    const ringGeo = new THREE.TorusGeometry(23, 1.4, 8, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe682,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    group.add(ring);

    return group;
  }

  // -------------------------------------------------------------
  // 3D AMBIENT MOTES / FIREFLIES
  // -------------------------------------------------------------
  private initMotes() {
    this.motesGroup = new THREE.Group();
    const moteGeo = new THREE.SphereGeometry(2.5, 8, 8);
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0xffeaa1,
      transparent: true,
      opacity: 0.65,
    });

    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(moteGeo, moteMat);
      const data = {
        x: (Math.random() - 0.5) * 960,
        y: (Math.random() - 0.5) * 540,
        z: (Math.random() - 0.5) * 120,
        speed: 0.5 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
      };
      mesh.position.set(data.x, data.y, data.z);
      this.motesData.push(data);
      this.motesGroup.add(mesh);
    }
    this.scene.add(this.motesGroup);
  }

  // -------------------------------------------------------------
  // AUDIO
  // -------------------------------------------------------------
  private initAudio() {
    const loadSound = (name: string, url: string) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      this.sounds.set(name, audio);
    };
    loadSound("die", "assets/Sounds/die.wav");
    loadSound("get-fruit", "assets/Sounds/get-fruit.wav");
    loadSound("winner", "assets/Sounds/winner.wav");
  }

  private playSound(name: string) {
    if (this.bridge.muted()) return;
    const a = this.sounds.get(name);
    if (!a) return;
    a.currentTime = 0;
    a.volume = 0.35;
    a.play().catch(() => {});
  }

  resetClock() {
    this.clock.reset();
  }

  // -------------------------------------------------------------
  // MAIN ANIMATION LOOP
  // -------------------------------------------------------------
  private loop(timestamp: number) {
    if (this.isDestroyed) return;
    const delta = Math.min(100, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;

    const sim = this.bridge.sim;
    const active = sim.state === "playing" || sim.state === "countdown";
    let alpha = 1;

    if (active) {
      alpha = this.clock.advance(delta, (dt) => {
        sim.step(dt);
        return sim.state === "playing" || sim.state === "countdown";
      });
    } else {
      this.clock.reset();
    }

    // Process simulation events
    for (const e of sim.events.splice(0)) {
      if (e.type === "fruit") this.playSound("get-fruit");
      else if (e.type === "end") this.playSound(e.won ? "winner" : "die");
      this.bridge.event(e);
    }

    const d = lerp(sim.prevDistance, sim.distance, alpha);
    const rm = this.bridge.reducedMotion();

    // 1. Scroll Parallax Textures
    if (this.bgTex1 && this.bgTex2 && this.bgTex3 && this.bgTex4) {
      this.bgTex1.offset.x = rm ? 0 : (d * 0.04) / 960;
      this.bgTex2.offset.x = rm ? 0 : (d * 0.12) / 960;
      this.bgTex3.offset.x = rm ? 0 : (d * 0.28) / 960;
      this.bgTex4.offset.x = rm ? 0 : (d * 0.55) / 960;
    }

    // 2. Update 3D Chauá
    const birdX = toThreeX(WORLD.birdX);
    const birdY = toThreeY(lerp(sim.prevY, sim.y, alpha));
    this.birdGroup.position.set(birdX, birdY, 10);
    this.birdGroup.visible = sim.state !== "menu";

    // Detect new flap command
    if (sim.lastFlapTick > this.lastSeenFlapTick) {
      this.lastSeenFlapTick = sim.lastFlapTick;
      this.flapTime = 0;
    } else {
      this.flapTime += delta * 0.001;
    }

    if (sim.state === "playing") {
      // Flap animation: brisk 3D wing rotation
      if (this.flapTime < 0.28) {
        const flapProgress = (this.flapTime / 0.28) * Math.PI * 2;
        // Right wing flaps around Z and X
        const flapAngle = Math.sin(flapProgress) * 0.85;
        this.wingRight.rotation.z = flapAngle;
        this.wingRight.rotation.x = -Math.cos(flapProgress) * 0.35;

        // Left wing flaps symmetrically
        this.wingLeft.rotation.z = -flapAngle;
        this.wingLeft.rotation.x = Math.cos(flapProgress) * 0.35;
      } else {
        // Glide posture: wings outstretched with slight aerodynamic dihedral angle
        this.wingRight.rotation.z = 0.08;
        this.wingRight.rotation.x = 0;
        this.wingLeft.rotation.z = -0.08;
        this.wingLeft.rotation.x = 0;
      }

      // Pitch angle: pitch up when climbing, dive angle when falling
      const pitch = rm
        ? 0
        : sim.vy < 0
          ? THREE.MathUtils.clamp(sim.vy * 0.0016, -0.38, 0)
          : THREE.MathUtils.clamp(sim.vy * 0.0018, 0, 0.52);

      this.birdGroup.rotation.z = pitch;
      // Slight banking in Y
      this.birdGroup.rotation.y = rm ? 0 : 0.15;
    } else if (sim.state === "countdown") {
      // Gentle hover bobbing
      const hoverAngle = Math.sin(timestamp * 0.008) * 0.35;
      this.wingRight.rotation.z = hoverAngle;
      this.wingLeft.rotation.z = -hoverAngle;
      this.birdGroup.rotation.z = 0;
      this.birdGroup.rotation.y = 0;
    } else if (sim.state === "over") {
      this.birdGroup.rotation.z = -1.2;
      this.wingRight.rotation.z = -0.5;
      this.wingLeft.rotation.z = 0.5;
    }

    // 3. Update 3D Obstacles
    // Clean deleted
    for (const [id, [topT, btmT]] of this.trees) {
      if (!sim.obstacles.some((o) => o.id === id)) {
        this.scene.remove(topT);
        this.scene.remove(btmT);
        this.trees.delete(id);
      }
    }

    // Spawn / update active obstacles
    for (const t of sim.obstacles) {
      let pair = this.trees.get(t.id);
      if (!pair) {
        const topTrunk = this.createTrunkMesh(true);
        const btmTrunk = this.createTrunkMesh(false);
        this.scene.add(topTrunk);
        this.scene.add(btmTrunk);
        pair = [topTrunk, btmTrunk];
        this.trees.set(t.id, pair);
      }

      const top = t.center - t.gap / 2;
      const btm = t.center + t.gap / 2;
      const currentX = toThreeX(lerp(t.prevX, t.x, alpha));

      // Cut ends align precisely at top and bottom in 3D
      pair[0].position.set(currentX, toThreeY(top), 5);
      pair[1].position.set(currentX, toThreeY(btm), 5);
    }

    // 4. Update 3D Fruits
    for (const [id, mesh] of this.fruits) {
      if (!sim.fruits.some((f) => f.id === id)) {
        this.scene.remove(mesh);
        this.fruits.delete(id);
      }
    }

    for (const f of sim.fruits) {
      let group = this.fruits.get(f.id);
      if (!group) {
        group = this.createFruitMesh(f.kind);
        this.scene.add(group);
        this.fruits.set(f.id, group);
      }

      const currentX = toThreeX(lerp(f.prevX, f.x, alpha));
      const bob = Math.sin((sim.ticks + f.id * 10) * 0.1) * 3;
      group.position.set(currentX, toThreeY(f.y) + bob, 12);
      // Smooth 3D Y-axis rotation
      group.rotation.y += 0.035;
    }

    // 5. Update Ambient Motes
    if (!rm) {
      for (let i = 0; i < this.motesData.length; i++) {
        const m = this.motesData[i];
        m.x -= (280 * (delta * 0.001) * 0.25);
        if (m.x < -500) m.x = 500;
        const child = this.motesGroup.children[i];
        if (child) {
          child.position.x = m.x;
          child.position.y = m.y + Math.sin(timestamp * 0.002 + m.phase) * 6;
        }
      }
    }

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
    this.bridge.frame();

    this.animFrameId = requestAnimationFrame(this.loop);
  }

  handleResize() {
    if (!this.renderer || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const aspect = 16 / 9;
      let w = rect.width;
      let h = rect.width / aspect;
      if (h > rect.height) {
        h = rect.height;
        w = rect.height * aspect;
      }
      w = Math.floor(w);
      h = Math.floor(h);
      this.renderer.setSize(w, h, true);
    }
  }

  destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.renderer?.dispose();
    this.container.innerHTML = "";
  }
}
