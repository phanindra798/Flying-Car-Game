import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPlayerVehicle } from './player-vehicle';
import { getCar, type CarId } from './garage-cars';

/** An on-demand preview: redraw only on selection, paint or size changes, never every frame. */
export class CarShowcase {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  private readonly paint = new THREE.MeshPhysicalMaterial({ color: 0xe5e5d9, metalness: .38, roughness: .28, clearcoat: .8, clearcoatRoughness: .20 });
  private readonly models = new Map<CarId, THREE.Group>();
  private active: CarId | null = null;
  private renders = 0;
  private readonly observer: ResizeObserver;
  constructor(private readonly host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('role', 'img');
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(room, .04).texture; room.dispose(); pmrem.dispose();
    this.scene.environmentIntensity = .8;
    this.scene.add(new THREE.HemisphereLight(0xc8e8ff, 0x63756f, 2.2));
    const light = new THREE.DirectionalLight(0xffefdb, 3); light.position.set(-3, 5, -4); this.scene.add(light);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, .05, 48), new THREE.MeshStandardMaterial({ color: 0x233c40, roughness: .8 }));
    stage.position.y = -.83; this.scene.add(stage);
    const rim = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.52, 48), new THREE.MeshBasicMaterial({ color: 0x63817c }));
    rim.rotation.x = -Math.PI/2; rim.position.y = -.80; this.scene.add(rim);
    this.camera.position.set(5.4, 3.1, -6.4); this.camera.lookAt(0, -.05, 0);
    this.observer = new ResizeObserver(() => this.draw()); this.observer.observe(host);
  }
  setCar(id: CarId, color: number) {
    const changed = this.active !== id || this.paint.color.getHex() !== color;
    if (this.active !== id) {
      if (this.active) this.scene.remove(this.models.get(this.active)!);
      if (!this.models.has(id)) this.models.set(id, createPlayerVehicle(this.paint, id));
      this.scene.add(this.models.get(id)!); this.active = id;
    }
    this.paint.color.setHex(color);
    this.renderer.domElement.setAttribute('aria-label', `${getCar(id).name}, front three-quarter 3D preview`);
    if (changed) this.draw();
  }
  draw() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height || this.host.closest('[hidden]')) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = this.camera.aspect < 1.5 ? 42 : 34;
    this.camera.updateProjectionMatrix(); this.renderer.render(this.scene, this.camera); this.renders++;
  }
  inspect() { return { car: this.active, models: this.models.size, renders: this.renders, calls: this.renderer.info.render.calls }; }
}
