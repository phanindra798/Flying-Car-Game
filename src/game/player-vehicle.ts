import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getCar, type CarId } from './garage-cars';
import { DOWN, NOZZLES } from './thrusters';

/** Seven original silhouettes, built lazily and batched by material for mobile rendering. */
export function createPlayerVehicle(paint: THREE.MeshStandardMaterial, id: CarId = 'vector') {
  const group = new THREE.Group(); group.name = getCar(id).name;
  const trim = new THREE.MeshStandardMaterial({ color: 0x18272b, roughness: 0.86 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x244451, metalness: 0.25, roughness: 0.22 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0x899d9e, metalness: 0.6, roughness: 0.36 });
  const headlight = new THREE.MeshBasicMaterial({ color: 0xd4f7ff, toneMapped: false });
  const taillight = new THREE.MeshBasicMaterial({ color: 0xff604f, toneMapped: false });
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const raw = geometry.index ? geometry.toNonIndexed() : geometry;
    if (raw !== geometry) geometry.dispose();
    raw.translate(x, y, z);
    // All procedural primitives carry position, normal and UV attributes.
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material)!.push(raw);
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const profile = (width: number, points: [number, number][], material: THREE.Material, x = 0) => {
    // These profiles are convex: flat triangles avoid a runtime modelling library.
    const vertices: number[] = [];
    const triangle = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
    const left = points.map(([y, z]) => [-width / 2, y, z]);
    const right = points.map(([y, z]) => [width / 2, y, z]);
    for (let i = 1; i < points.length - 1; i++) {
      triangle(left[0], left[i + 1], left[i]); triangle(right[0], right[i], right[i + 1]);
    }
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      triangle(left[i], left[j], right[j]); triangle(left[i], right[j], right[i]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
    geometry.computeVertexNormals(); add(geometry, material, x);
  };
  if (id === 'vector') {
  // Nose, broad shoulder, low bed and sloping cab roof define the silhouette.
  profile(1.78, [[-0.38, -2], [0.06, -2], [0.20, -1.05], [0.20, 1.75], [0.08, 2], [-0.38, 2]], paint);
  profile(1.47, [[0.20, -1.11], [0.67, -0.34], [0.62, 0.22], [0.20, 0.84]], glass);
  profile(1.58, [[0.67, -0.34], [0.72, -0.34], [0.67, 0.24], [0.62, 0.22]], paint);
  for (const side of [-1, 1]) {
    // Metal sail pillars, door seam, side sill and raised bed rails.
    profile(0.055, [[0.20, 0.33], [0.64, 0.20], [0.20, 1.13]], paint, side * 0.76);
    box(0.025, 0.40, 0.045, trim, side * 0.75, 0.40, -0.10);
    box(0.06, 0.13, 2.82, trim, side * 0.89, -0.34, 0.05);
    box(0.13, 0.13, 1.12, paint, side * 0.82, 0.24, 1.35);
    box(0.03, 0.035, 0.23, alloy, side * 0.90, 0.10, -0.18);
  }
  box(1.38, 0.025, 1.15, trim, 0, 0.216, 1.36);
  for (let i = 0; i < 6; i++) box(1.29, 0.018, 0.023, alloy, 0, 0.237, 0.88 + i * 0.18);
  } else if (id === 'rally') {
    profile(1.76, [[-0.38,-2],[0.10,-2],[0.19,-1.1],[0.19,1.9],[-0.38,2]], paint);
    profile(1.43, [[0.19,-1],[0.66,-0.50],[0.66,0.72],[0.19,1.23]], glass);
    box(1.5,0.08,1.22,paint,0,0.65,0.11);
    box(1.85,0.08,0.34,trim,0,0.52,1.64);
    for (const side of [-1,1]) {
      box(0.08,0.36,0.09,trim,side*0.66,0.34,1.60);
      box(0.045,0.42,0.08,paint,side*0.73,0.40,0.1);
      box(0.22,0.13,0.07,headlight,side*0.39,-0.12,-2.03);
      box(0.12,0.11,0.14,headlight,side*0.45,0.69,-0.46);
    }
  } else if (id === 'retro') {
    box(1.76,0.45,3.98,paint,0,-0.14,0);
    profile(1.42, [[0.09,-0.94],[0.54,-0.4],[0.54,0.48],[0.09,1.08]], glass);
    box(1.5,0.07,0.96,paint,0,0.55,0.04);
    for (const side of [-1,1]) {
      box(0.03,0.045,3.84,alloy,side*0.89,-0.03,0);
      box(0.035,0.44,0.045,paint,side*0.72,0.31,0.05);
      box(0.35,0.10,0.06,headlight,side*0.56,0.07,-2.01);
    }
    box(1.72,0.09,0.1,alloy,0,-0.26,-2);
    box(1.72,0.09,0.1,alloy,0,-0.26,2);
  } else if (id === 'dune') {
    profile(1.38,[[-0.38,-2],[-0.03,-2],[0.08,-1.1],[0.08,1.9],[-0.38,2]],paint);
    const bar = (a: [number,number,number], b: [number,number,number]) => {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
      const geometry = new THREE.CylinderGeometry(0.045,0.045,delta.length(),6);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
      const center = start.add(end).multiplyScalar(0.5); add(geometry,alloy,center.x,center.y,center.z);
    };
    for (const side of [-1,1]) {
      bar([side*0.57,0.08,-0.98],[side*0.57,0.62,-0.47]);
      bar([side*0.57,0.62,-0.47],[side*0.57,0.62,0.57]);
      bar([side*0.57,0.62,0.57],[side*0.57,0.08,1.12]);
      box(0.45,0.40,0.30,trim,side*0.31,0.20,0.35);
      box(0.44,0.12,0.65,trim,side*0.31,0.07,0.06);
      box(0.20,0.14,0.10,headlight,side*0.47,0.64,-0.43);
    }
    bar([-0.57,0.62,-0.47],[0.57,0.62,-0.47]); bar([-0.57,0.62,0.57],[0.57,0.62,0.57]);
    box(0.8,0.08,0.42,glass,0,0.14,-0.65);
    add(new THREE.CylinderGeometry(0.30,0.30,0.17,12),trim,0,0.19,1.38);
  } else if (id === 'apex') {
    profile(1.78,[[-0.38,-2],[0,-2],[0.12,-0.70],[0.10,1.8],[-0.10,2],[-0.38,2]],paint);
    profile(1.26,[[0.12,-0.84],[0.43,-0.26],[0.43,0.23],[0.10,0.98]],glass);
    box(0.10,0.04,0.64,paint,0,0.45,0.02);
    box(1.86,0.06,0.4,trim,0,0.45,1.65);
    for (const side of [-1,1]) {
      box(0.06,0.37,0.08,alloy,side*0.64,0.23,1.65);
      box(0.09,0.22,0.44,paint,side*0.89,0.46,1.65);
      box(0.12,0.08,1.10,trim,side*0.78,0.07,0.62);
      box(0.10,0.03,0.92,trim,side*0.22,0.07,-1.36);
    }
  } else if (id === 'muscle') {
    box(1.78,0.48,3.98,paint,0,-0.13,0);
    profile(1.43,[[0.11,-0.47],[0.59,0.03],[0.59,0.77],[0.11,1.19]],glass);
    box(1.52,0.07,0.82,paint,0,0.60,0.4);
    box(0.50,0.13,0.42,trim,0,0.19,-1.13);
    for (const side of [-1,1]) {
      box(0.12,0.015,1.43,trim,side*0.23,0.118,-1.23);
      box(0.12,0.015,0.80,trim,side*0.23,0.64,0.4);
      box(0.045,0.48,0.06,paint,side*0.73,0.35,0.50);
    }
    box(1.64,0.10,0.22,paint,0,0.19,1.78);
  } else {
    profile(0.96,[[-0.38,-2],[0.04,-1.86],[0.15,-0.8],[0.15,0.8],[0.04,2],[-0.38,2]],paint);
    add(new THREE.SphereGeometry(0.44,12,8).scale(1.1,1,1.8),glass,0,0.19,-0.18);
    for (const side of [-1,1]) {
      profile(0.35,[[-0.35,-2],[-0.02,-2],[0.12,-1.3],[0.13,1.4],[0.02,2],[-0.35,2]],paint,side*0.7);
      profile(0.07,[[0.09,0.78],[0.58,1.53],[0.52,1.89],[0.09,1.98]],paint,side*0.65);
      box(0.05,0.03,2.4,headlight,side*0.70,0.14,0.05);
    }
    box(1.5,0.07,0.25,alloy,0,-0.28,-0.9); box(1.5,0.07,0.25,alloy,0,-0.28,0.9);
  }
  box(1.60, 0.13, 0.12, trim, 0, -0.31, -1.99);
  box(1.62, 0.15, 0.12, trim, 0, -0.30, 1.99);
  box(1.60, 0.047, 0.035, headlight, 0, 0.035, -2.025);
  box(1.60, 0.052, 0.035, taillight, 0, 0.075, 2.025);
  box(0.38, 0.10, 0.025, alloy, 0, -0.12, 2.04);
  for (const side of [-1, 1]) for (const axle of [-1, 1]) {
    // Wide dark fenders and faceted wheel covers; same footprint as the old car.
    profile(0.09, [[-0.38, -0.49], [-0.04, -0.37], [0.06, -0.21], [0.06, 0.21], [-0.04, 0.37], [-0.38, 0.49]], trim, side * 0.90);
    const fender = batches.get(trim)!.at(-1)!; fender.translate(0, 0, axle * 1.26);
    add(new THREE.CylinderGeometry(0.36, 0.36, 0.20, 12).rotateZ(Math.PI / 2), trim, side * 0.83, -0.41, axle * 1.26);
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.21, 6).rotateZ(Math.PI / 2), alloy, side * 0.84, -0.41, axle * 1.26);
    add(new THREE.CylinderGeometry(0.10, 0.10, 0.22, 6).rotateZ(Math.PI / 2), trim, side * 0.85, -0.41, axle * 1.26);
  }
  for (const nozzle of NOZZLES) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(DOWN, new THREE.Vector3().fromArray(nozzle.direction));
    const [x, y, z] = nozzle.position;
    const collar = new THREE.CylinderGeometry(0.21, 0.21, 0.12, 8).applyQuaternion(rotation);
    add(collar, alloy, x, y, z);
    const rim = new THREE.CylinderGeometry(0.155, 0.155, 0.125, 8).applyQuaternion(rotation);
    add(rim, trim, x, y, z);
  }
  for (const [material, pieces] of batches) {
    const merged = mergeGeometries(pieces)!;
    pieces.forEach(piece => piece.dispose());
    group.add(new THREE.Mesh(merged, material));
  }
  return group;
}
