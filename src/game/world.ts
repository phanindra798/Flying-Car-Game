import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANES, VEHICLES, type GameEvent, type Simulation, type Traffic } from './simulation';
import { flightAssist } from './flight-assist';
import type { TrafficThreat } from './traffic-warning';
import type { GhostPose } from './ghost';
import { GameEffects } from './effects';
import type { CarId } from './garage-cars';
import { createPlayerVehicle } from './player-vehicle';
import { ThrusterRig, ThrusterState, vehicleRotation } from './thrusters';
import { DEFAULT_SETTINGS, graphicsProfile, type GraphicsSettings } from './settings';

const ROAD_LENGTH = 500;
const UP = new THREE.Vector3(0, 1, 0);

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(57, 1, 0.1, 1000);
  private readonly effects = new GameEffects(this.scene);
  private graphicsSettings: GraphicsSettings = { ...DEFAULT_SETTINGS };
  private readonly car = new THREE.Group();
  private readonly carTilt = new THREE.Group();
  private readonly playerPaint = new THREE.MeshStandardMaterial({ color: 0xe5e5d9, metalness: 0.5, roughness: 0.36 });
  private readonly ghost = new THREE.Group();
  private readonly ghostFill = new THREE.MeshBasicMaterial({ color: 0x83e7f5, transparent: true, opacity: 0.12, depthWrite: false });
  private readonly shadow: THREE.Mesh;
  private readonly landingMarker = new THREE.Mesh(new THREE.RingGeometry(1, 1.07, 32), new THREE.MeshBasicMaterial({ color: 0xd6ff78, transparent: true, opacity: 0.8, depthWrite: false }));
  private readonly landingPulse = new THREE.Mesh(new THREE.RingGeometry(1, 1.09, 32), new THREE.MeshBasicMaterial({ color: 0xd6ff78, transparent: true, opacity: 0, depthWrite: false }));
  private readonly trafficHighlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffd684 }));
  private pulseAge = 1;
  private pulseDistance = 0;
  private readonly thrusters = new ThrusterState();
  private readonly jets = new ThrusterRig();
  private playerModel = createPlayerVehicle(this.playerPaint);
  private currentCar: CarId = 'vector';
  private readonly modelCache = new Map<CarId, THREE.Group>([['vector', this.playerModel]]);
  private readonly ghostModels = new Map<CarId, THREE.Group>();
  private currentGhost: CarId | null = null;
  private readonly ghostOutline = new THREE.LineBasicMaterial({ color: 0x83e7f5, transparent: true, opacity: 0.65, depthWrite: false });
  private readonly dashes: THREE.InstancedMesh;
  private readonly posts: THREE.InstancedMesh;
  private readonly palmTrunks: THREE.InstancedMesh;
  private readonly palmLeaves: THREE.InstancedMesh;
  private readonly roadsideSigns: THREE.Group[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly trafficModels = new Map<number, THREE.Group>();
  private readonly vehiclePool = new Map<string, THREE.Group[]>();
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly boxes = new Map<string, THREE.BoxGeometry>();
  private readonly wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.21, 12).rotateZ(Math.PI / 2);
  private readonly lookTarget = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private reducedMotion = false;
  private readonly touchDevice = matchMedia('(pointer: coarse)');

  constructor(host: HTMLElement, settings: GraphicsSettings = DEFAULT_SETTINGS) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', 'A coastal highway, your car, and approaching traffic');
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0xd9a58e, 100, 440);
    this.scene.add(new THREE.HemisphereLight(0xd5e6ef, 0x8a6965, 2.8));
    const sunLight = new THREE.DirectionalLight(0xffe2b3, 3.2);
    sunLight.position.set(-90, 80, -150);
    this.scene.add(sunLight);

    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { topColor: { value: new THREE.Color('#42536e') }, bottomColor: { value: new THREE.Color('#f5b784') } },
      vertexShader: 'varying vec3 vPosition; void main(){ vPosition = position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vPosition; uniform vec3 topColor; uniform vec3 bottomColor; void main(){ float h=clamp(normalize(vPosition).y*2.1,0.0,1.0); gl_FragColor=vec4(mix(bottomColor,topColor,pow(h,0.65)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }));
    this.scene.add(sky);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(19, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffe5a5, fog: false }));
    sun.position.set(-100, 47, -370);
    this.scene.add(sun);
    this.createLandscape();

    this.box(15.8, 0.3, ROAD_LENGTH, 0x424c50, 0, -0.17, -ROAD_LENGTH / 2 + 20);
    for (const side of [-1, 1]) {
      this.box(0.7, 0.35, ROAD_LENGTH, 0x9c9a88, side * 8.25, -0.12, -ROAD_LENGTH / 2 + 20);
      this.box(0.09, 0.025, ROAD_LENGTH, 0xf4d7a5, side * 7.35, 0.02, -ROAD_LENGTH / 2 + 20);
      this.box(0.12, 0.16, ROAD_LENGTH, 0x526467, side * 8.5, 0.9, -ROAD_LENGTH / 2 + 20);
      this.box(0.1, 0.1, ROAD_LENGTH, 0x718080, side * 8.5, 0.52, -ROAD_LENGTH / 2 + 20);
    }
    this.dashes = new THREE.InstancedMesh(this.geometry(0.09, 0.018, 4.2), this.material(0xd5d4c0), 126);
    this.posts = new THREE.InstancedMesh(this.geometry(0.14, 1.1, 0.14), this.material(0x697a79), 100);
    this.dashes.frustumCulled = false; this.posts.frustumCulled = false;
    this.scene.add(this.dashes, this.posts);

    const trunk = new THREE.CylinderGeometry(0.13, 0.28, 8, 7).translate(0, 4, 0);
    const leaves: THREE.BufferGeometry[] = [];
    for (let n = 0; n < 7; n++) {
      const positions: number[] = [];
      for (let s = 0; s < 8; s++) {
        const points = [s / 8, (s + 1) / 8];
        const vertices = points.flatMap(t => {
          const width = Math.sin(t * Math.PI) * 0.48;
          return [t * 4.1, 8.4 + Math.sin(t * Math.PI) * 1.1 - t * 2.0, -width,
            t * 4.1, 8.4 + Math.sin(t * Math.PI) * 1.1 - t * 2.0, width];
        });
        for (const j of [0, 1, 2, 1, 3, 2]) positions.push(...vertices.slice(j * 3, j * 3 + 3));
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.rotateY(n * Math.PI * 2 / 7); geometry.computeVertexNormals(); leaves.push(geometry);
    }
    const leafMaterial = this.material(0x304e3d); leafMaterial.side = THREE.DoubleSide;
    this.palmTrunks = new THREE.InstancedMesh(trunk, this.material(0x756557), 36);
    this.palmLeaves = new THREE.InstancedMesh(mergeGeometries(leaves), leafMaterial, 36);
    leaves.forEach(g => g.dispose());
    this.palmTrunks.frustumCulled = false; this.palmLeaves.frustumCulled = false;
    this.scene.add(this.palmTrunks, this.palmLeaves);
    for (let n = 0; n < 4; n++) this.roadsideSigns.push(this.createSign(n));

    this.carTilt.add(this.playerModel);
    this.car.add(this.carTilt);
    this.scene.add(this.car);
    this.setGhostCar('vector');
    this.ghost.visible = false; this.scene.add(this.ghost);
    this.carTilt.add(this.jets);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.2), new THREE.MeshBasicMaterial({ color: 0x1a2424, transparent: true, opacity: 0.3, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.035;
    this.scene.add(this.shadow);
    this.trafficHighlight.visible = false; this.scene.add(this.trafficHighlight);
    for (const marker of [this.landingMarker, this.landingPulse]) {
      marker.rotation.x = -Math.PI / 2; marker.visible = false; this.scene.add(marker);
    }
    this.camera.position.set(0.5, 5.0, 13.5);
    this.lookTarget.set(0, 1.5, -29);
    this.camera.lookAt(this.lookTarget);
    this.applyGraphics(settings);
    window.addEventListener('resize', this.resize);
  }

  private material(color: number, metalness = 0, roughness = 0.75) {
    const key = `${color}-${metalness}-${roughness}`;
    let material = this.materials.get(key);
    if (!material) { material = new THREE.MeshStandardMaterial({ color, metalness, roughness }); this.materials.set(key, material); }
    return material;
  }

  private geometry(w: number, h: number, d: number) {
    const key = `${w},${h},${d}`;
    let geometry = this.boxes.get(key);
    if (!geometry) { geometry = new THREE.BoxGeometry(w, h, d); this.boxes.set(key, geometry); }
    return geometry;
  }

  private box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D = this.scene) {
    const mesh = new THREE.Mesh(this.geometry(w, h, d), this.material(color));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }

  private createVehicle(kind: Traffic['kind'], paint: number) {
    const group = new THREE.Group();
    const { width, height, length } = VEHICLES[kind];
    const base = 0;
    this.box(width, 0.55, length, paint, 0, base + 0.75, 0, group);
    if (kind === 'truck') {
      this.box(width, height - 0.7, length * 0.67, 0xd8c7aa, 0, base + 0.7 + (height - 0.7) / 2, 1.0, group);
      this.box(width * 0.94, 1.5, 1.9, paint, 0, base + 1.55, -length / 2 + 1, group);
      this.box(width * 0.82, 0.62, 0.04, 0x294b54, 0, base + 1.9, -length / 2 + 0.03, group);
    } else {
      const cabin = this.box(width * 0.83, height - 0.95, length * 0.46, 0x29484e, 0, base + 0.95 + (height - 0.95) / 2, 0.1, group);
      cabin.rotation.x = -0.08;
      this.box(width * 0.87, 0.09, length * 0.5, paint, 0, base + height - 0.06, 0.1, group);
    }
    this.box(width * 0.79, 0.085, 0.055, 0xec765c, 0, base + 0.83, length / 2 + 0.03, group);
    this.box(width * 0.8, 0.08, 0.05, 0xf5edc9, 0, base + 0.8, -length / 2 - 0.03, group);
    this.box(width * 0.92, 0.14, 0.13, 0x24383a, 0, base + 0.46, length / 2, group);
    for (const side of [-1, 1]) for (const axle of [-1, 1]) {
      const wheel = new THREE.Mesh(this.wheelGeometry, this.material(0x202b30));
      wheel.position.set(side * (width / 2 - 0.02), base + 0.37, axle * length * 0.31);
      group.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.23, 8).rotateZ(Math.PI / 2), this.material(0x9ba5a3, 0.5));
      hub.position.copy(wheel.position); group.add(hub);
    }
    group.userData.poolKey = `${kind}:${paint}`;
    return group;
  }

  private createLandscape() {
    this.box(1300, 0.1, 1000, 0x658c8d, -400, -3.6, -260);
    this.box(300, 0.4, 800, 0xaf9e84, 165, -3.3, -260);
    for (let n = 0; n < 12; n++) {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(50 + n % 3 * 24, 30 + n % 4 * 16, 5), this.material(n % 2 ? 0x8a8791 : 0x9b9294));
      mountain.position.set(-440 + n * 84, 3 + n % 3 * 5, -430 - n % 3 * 20);
      mountain.rotation.y = n;
      this.scene.add(mountain);
    }
    const buildingGeometry = this.geometry(1, 1, 1);
    const buildings = new THREE.InstancedMesh(buildingGeometry, this.material(0x9c9b95), 36);
    for (let n = 0; n < 36; n++) {
      const height = 10 + (n * 13 % 43);
      this.dummy.position.set(37 + n % 5 * 23, height / 2 - 3, -90 - Math.floor(n / 5) * 42);
      this.dummy.scale.set(9 + n % 4 * 2, height, 12 + n % 3 * 4);
      this.dummy.updateMatrix(); buildings.setMatrixAt(n, this.dummy.matrix);
    }
    this.scene.add(buildings);
    this.dummy.scale.setScalar(1);
  }

  private createSign(n: number) {
    const group = new THREE.Group();
    this.box(0.16, 5, 0.16, 0x728384, 9, 2.5, 0, group);
    this.box(3.5, 1.3, 0.14, 0x38645f, 8, 4.2, 0, group);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 180;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#dce8d3'; ctx.textAlign = 'center';
    ctx.font = 'bold 44px Arial'; ctx.fillText(['PACIFIC COAST', 'TAKE THE HIGH ROAD', 'FIND YOUR LINE', 'COASTLINE 01'][n], 256, 77);
    ctx.font = '28px Arial'; ctx.fillText('NORTHBOUND  ↑', 256, 127);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 1.14), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    label.position.set(8, 4.2, 0.08); group.add(label);
    this.scene.add(group); return group;
  }

  applyGraphics(settings: GraphicsSettings) {
    this.graphicsSettings = { ...settings };
    const profile = graphicsProfile(settings, this.touchDevice.matches, matchMedia('(prefers-reduced-motion: reduce)').matches, devicePixelRatio);
    this.reducedMotion = profile.reduceMotion; this.effects.configure(profile.particleLimit);
    this.resize();
  }
  inspectEffects() { return { ...this.effects.inspect(), jets: this.jets.inspect(), reducedMotion: this.reducedMotion, fov: this.camera.fov }; }

  readonly resize = () => {
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setPixelRatio(graphicsProfile(this.graphicsSettings, this.touchDevice.matches, this.reducedMotion, devicePixelRatio).pixelRatio);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private modelFor(id: CarId) {
    if (!this.modelCache.has(id)) this.modelCache.set(id, createPlayerVehicle(this.playerPaint, id));
    return this.modelCache.get(id)!;
  }

  setCar(id: CarId) {
    if (id === this.currentCar) return;
    this.carTilt.remove(this.playerModel);
    this.playerModel = this.modelFor(id); this.carTilt.add(this.playerModel); this.currentCar = id;
  }
  get carId() { return this.currentCar; }
  get ghostCarId() { return this.currentGhost; }
  setGhostCar(id: CarId) {
    if (this.currentGhost === id) return;
    if (!this.ghostModels.has(id)) {
      // Model geometry is already in car-local coordinates; never bake the current run pose.
      const pieces = this.modelFor(id).children.map(part => (part as THREE.Mesh).geometry.clone());
      const silhouette = mergeGeometries(pieces)!; pieces.forEach(piece => piece.dispose());
      const replay = new THREE.Group();
      replay.add(new THREE.Mesh(silhouette, this.ghostFill));
      replay.add(new THREE.LineSegments(new THREE.EdgesGeometry(silhouette), this.ghostOutline));
      this.ghostModels.set(id, replay);
    }
    this.ghost.clear(); this.ghost.add(this.ghostModels.get(id)!); this.currentGhost = id;
  }

  setPaint(color: number) { this.playerPaint.color.setHex(color); }
  get paintColor() { return this.playerPaint.color.getHex(); }

  get ghostVisible() { return this.ghost.visible; }

  get highlightVisible() { return this.trafficHighlight.visible; }

  get markerVisible() { return this.landingMarker.visible; }

  resetFeedback() { this.effects.clear(); this.thrusters.clear(); this.jets.update(this.thrusters, 0, this.reducedMotion); this.ghost.visible = false; this.trafficHighlight.visible = false; this.pulseAge = 1; this.landingPulse.visible = false; this.landingMarker.visible = false; }

  onEvent(event: GameEvent, sim: Simulation) {
    this.effects.onEvent(event, sim);
    this.thrusters.onEvent(event);
    if (!event.landing) return;
    this.pulseAge = 0; this.pulseDistance = sim.distance;
    this.landingPulse.position.set(sim.x, 0.045, 3);
    const bad = event.landing.quality === 'rough' || event.landing.quality === 'unfinished';
    this.landingPulse.material.color.setHex(bad ? 0xff9b75 : event.landing.quality === 'clean' ? 0xd6ff78 : 0xe5f0e8);
  }

  // Read-only screen bounds used by development checks for camera/control overlap.
  inspectCarBounds() {
    const box = new THREE.Box3().setFromObject(this.playerModel);
    const points: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      points.push(new THREE.Vector3(x, y, z).project(this.camera));
    }
    return { left: (Math.min(...points.map(p => p.x)) + 1) / 2, right: (Math.max(...points.map(p => p.x)) + 1) / 2,
      top: (1 - Math.max(...points.map(p => p.y))) / 2, bottom: (1 - Math.min(...points.map(p => p.y))) / 2 };
  }

  render(sim: Simulation, dt: number, _time: number, slam = false, threat: TrafficThreat | null = null, ghost: GhostPose | null = null) {
    const distance = sim.distance;
    for (let i = 0; i < 126; i++) {
      this.dummy.position.set([-3.5, 0, 3.5][i % 3], 0.018, 20 - Math.floor(i / 3) * 12 + distance % 12);
      this.dummy.scale.setScalar(1); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix();
      this.dashes.setMatrixAt(i, this.dummy.matrix);
    }
    this.dashes.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 100; i++) {
      this.dummy.position.set(i % 2 ? 8.5 : -8.5, 0.46, 20 - Math.floor(i / 2) * 10 + distance % 10);
      this.dummy.updateMatrix(); this.posts.setMatrixAt(i, this.dummy.matrix);
    }
    this.posts.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 36; i++) {
      this.dummy.position.set(i % 2 ? 15.5 : -13, -3, 27 - Math.floor(i / 2) * 30 + distance % 30);
      this.dummy.rotation.set(0, i * 1.7, (i % 3 - 1) * 0.06);
      this.dummy.scale.setScalar(1 + i % 3 * 0.13); this.dummy.updateMatrix();
      this.palmTrunks.setMatrixAt(i, this.dummy.matrix); this.palmLeaves.setMatrixAt(i, this.dummy.matrix);
    }
    this.palmTrunks.instanceMatrix.needsUpdate = true; this.palmLeaves.instanceMatrix.needsUpdate = true;
    this.roadsideSigns.forEach((sign, i) => { sign.position.z = 35 - i * 130 + distance % 130; });

    this.car.position.set(sim.x, sim.height + 0.78, 3);
    vehicleRotation(sim, this.carTilt.rotation);
    const ghostGap = ghost ? ghost.distance - sim.distance : 0;
    this.ghost.visible = !!ghost && ghostGap > -10 && ghostGap < 220;
    if (ghost) {
      this.ghost.position.set(ghost.x, ghost.height + 0.78, 3 - ghostGap);
      this.ghost.rotation.set(ghost.pitch, 0, ghost.roll);
      this.ghostFill.opacity = Math.abs(ghostGap) < 3 && Math.abs(ghost.x - sim.x) < 1.5 ? 0.035 : 0.12;
    }
    this.thrusters.update(sim, dt);
    this.jets.update(this.thrusters, sim.height, this.reducedMotion);
    this.shadow.position.x = sim.x; this.shadow.position.z = 3;
    this.shadow.scale.setScalar(1 + sim.height * 0.04);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.28 / (1 + sim.height * 0.17);
    this.landingMarker.visible = sim.airborne && sim.phase !== 'ready' && sim.phase !== 'crashed';
    this.landingMarker.position.set(sim.x, 0.04, 3);
    this.landingMarker.scale.set(1.35, 2.5, 1);
    this.landingMarker.material.color.setHex(flightAssist(sim, slam).color);
    if (sim.phase === 'playing') this.pulseAge += dt;
    this.landingPulse.visible = this.pulseAge < 0.55 && (sim.phase === 'playing' || sim.phase === 'paused') && !this.reducedMotion;
    this.landingPulse.position.z = 3 + sim.distance - this.pulseDistance;
    this.landingPulse.scale.set(1.4 + this.pulseAge * 4, 2.5 + this.pulseAge * 5, 1);
    this.landingPulse.material.opacity = Math.max(0, 0.8 * (1 - this.pulseAge / 0.55));

    this.effects.update(sim, dt, this.thrusters);

    const active = new Set(sim.traffic.map(v => v.id));
    for (const [id, model] of this.trafficModels) {
      if (active.has(id)) continue;
      model.visible = false;
      const key = model.userData.poolKey as string;
      if (!this.vehiclePool.has(key)) this.vehiclePool.set(key, []);
      this.vehiclePool.get(key)!.push(model);
      this.trafficModels.delete(id);
    }
    for (const vehicle of sim.traffic) {
      let model = this.trafficModels.get(vehicle.id);
      const key = `${vehicle.kind}:${vehicle.color}`;
      if (model && model.userData.poolKey !== key) {
        model.visible = false;
        const oldKey = model.userData.poolKey as string;
        if (!this.vehiclePool.has(oldKey)) this.vehiclePool.set(oldKey, []);
        this.vehiclePool.get(oldKey)!.push(model);
        this.trafficModels.delete(vehicle.id); model = undefined;
      }
      if (!model) {
        model = this.vehiclePool.get(key)?.pop() ?? this.createVehicle(vehicle.kind, vehicle.color);
        this.scene.add(model); this.trafficModels.set(vehicle.id, model);
      }
      model.visible = true;
      model.position.set(LANES[vehicle.lane], 0, 3 - (vehicle.distance - distance));
    }
    const danger = threat && sim.phase === 'playing' ? sim.traffic.find(vehicle => vehicle.id === threat.id) : undefined;
    this.trafficHighlight.visible = !!danger;
    if (danger) {
      const size = VEHICLES[danger.kind];
      this.trafficHighlight.position.set(LANES[danger.lane], size.height / 2, 3 - (danger.distance - distance));
      this.trafficHighlight.scale.set(size.width + 0.18, size.height + 0.12, size.length + 0.18);
      this.trafficHighlight.material.color.setHex(threat!.urgent ? 0xff9b75 : 0xffd684);
    }
    const blend = 1 - Math.exp(-5 * dt);
    const ready = sim.phase === 'ready';
    const portrait = this.camera.aspect < 0.8;
    const touch = this.touchDevice.matches;
    const follow = portrait ? 0.9 : touch ? 0.6 : 0.4;
    const altitude = sim.height * (touch || portrait ? 0.9 : 0.5);
    this.camera.position.x += ((ready && !portrait ? 2.8 : sim.x * follow) - this.camera.position.x) * blend;
    this.camera.position.y += (((portrait ? 7.5 : touch ? 6.2 : ready ? 5.5 : 4.7) + altitude) - this.camera.position.y) * blend;
    this.camera.position.z += ((portrait ? 19 : touch ? 17 : ready ? 14.7 : 13) - this.camera.position.z) * blend;
    this.desiredLook.set(sim.x * (portrait ? 0.9 : touch ? 0.6 : 0.35), 1.15 + altitude, portrait ? -2 : touch ? -13 : -27);
    this.lookTarget.lerp(this.desiredLook, blend);
    this.camera.up.copy(UP); this.camera.lookAt(this.lookTarget);
    const fov = (portrait ? 65 : 57) + (sim.boostActive && !this.reducedMotion ? touch ? 3 : 6 : 0);
    this.camera.fov += (fov - this.camera.fov) * blend;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
}
