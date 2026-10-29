import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getCar, type CarId } from './garage-cars';
import { DOWN, NOZZLES } from './thrusters';

type Station = readonly [z: number, halfWidth: number, shoulder: number, crown: number];
const SHAPES: Record<CarId, { axles: [number,number]; radius: number; rim: number; stations: Station[] }> = {
  vector: { axles: [-1.25,1.28], radius: .35, rim: .23, stations: [[-2,.70,-.02,.03],[-1.6,.85,.12,.18],[-.8,.88,.18,.22],[.8,.88,.18,.22],[1.8,.85,.15,.19],[2,.80,.06,.10]] },
  rally: { axles: [-1.19,1.13], radius: .34, rim: .22, stations: [[-1.88,.65,-.03,.04],[-1.5,.85,.12,.19],[-.8,.88,.18,.24],[.75,.88,.17,.23],[1.65,.83,.12,.18],[1.88,.71,.04,.08]] },
  retro: { axles: [-1.26,1.23], radius: .33, rim: .21, stations: [[-1.98,.64,-.03,.02],[-1.63,.79,.13,.18],[-.8,.86,.15,.20],[.7,.86,.14,.19],[1.65,.79,.08,.13],[1.98,.67,-.03,.02]] },
  dune: { axles: [-1.28,1.28], radius: .39, rim: .21, stations: [[-1.85,.43,-.18,-.10],[-1.35,.56,-.02,.04],[-.65,.62,.02,.08],[.65,.62,.01,.06],[1.4,.55,-.03,.03],[1.85,.43,-.16,-.10]] },
  apex: { axles: [-1.28,1.24], radius: .32, rim: .235, stations: [[-2,.54,-.20,-.14],[-1.68,.81,-.04,.02],[-1.25,.90,.06,.09],[-.45,.78,-.01,.04],[.45,.80,.00,.05],[1.25,.91,.09,.13],[1.75,.83,.04,.08],[2,.65,-.12,-.07]] },
  muscle: { axles: [-1.30,1.26], radius: .35, rim: .23, stations: [[-2,.74,-.02,.04],[-1.68,.87,.15,.19],[-.65,.89,.18,.23],[.55,.87,.16,.21],[1.35,.90,.19,.24],[1.85,.85,.10,.15],[2,.77,.04,.08]] },
  aero: { axles: [-1.33,1.30], radius: .32, rim: .24, stations: [[-2,.39,-.24,-.17],[-1.6,.77,-.08,-.02],[-1.2,.85,-.02,.04],[-.3,.64,-.10,-.04],[.5,.67,-.07,-.01],[1.2,.85,.04,.08],[1.8,.72,-.04,.02],[2,.43,-.16,-.10]] },
};

/** Original automotive shapes with open wheel wells; six material batches per model. */
export function createPlayerVehicle(paint: THREE.MeshStandardMaterial, id: CarId = 'vector') {
  const group = new THREE.Group(); group.name = getCar(id).name;
  const trim = new THREE.MeshStandardMaterial({ color: 0x10171c, roughness: .83 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x172b36, metalness: .42, roughness: .16 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0x9aa9ae, metalness: .72, roughness: .24 });
  const headlight = new THREE.MeshBasicMaterial({ color: 0xdff6ff, toneMapped: false });
  const taillight = new THREE.MeshBasicMaterial({ color: 0xff4439, toneMapped: false });
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x=0,y=0,z=0) => {
    const raw = geometry.index ? geometry.toNonIndexed() : geometry;
    if (raw !== geometry) geometry.dispose();
    raw.translate(x,y,z);
    if (!batches.has(material)) batches.set(material,[]);
    batches.get(material)!.push(raw);
  };
  const box = (w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number) => add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const panel = (points: number[][], m:THREE.Material) => {
    const vertices:number[]=[];
    for(let i=1;i<points.length-1;i++) vertices.push(...points[0],...points[i+1],...points[i]);
    const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geometry.computeVertexNormals();add(geometry,m);
  };
  const rod = (a:number[],b:number[],radius:number,m:THREE.Material) => {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const geometry=new THREE.CylinderGeometry(radius,radius,delta.length(),8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    const center=start.add(end).multiplyScalar(.5);add(geometry,m,center.x,center.y,center.z);
  };
  const roundLight=(x:number,y:number,z:number,r:number,m:THREE.Material) => {
    add(new THREE.CylinderGeometry(r*1.14,r*1.14,.045,16).rotateX(Math.PI/2),trim,x,y,z);
    add(new THREE.CylinderGeometry(r,r,.052,16).rotateX(Math.PI/2),m,x,y,z);
  };
  const shape=SHAPES[id], wheelY=-.77+shape.radius, stations=shape.stations;
  const section=(z:number):Station=>{
    const n=stations.findIndex(p=>p[0]>=z), b=stations[Math.max(1,n)],a=stations[Math.max(1,n)-1];
    const t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0])));
    return [z,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t];
  };
  const wellRadius=shape.radius+.045;
  const bottom=(z:number)=>Math.max(-.39,...shape.axles.map(axle=>Math.abs(z-axle)<wellRadius ? wheelY+Math.sqrt(wellRadius**2-(z-axle)**2) : -.39));
  const cuts=new Set(stations.map(p=>p[0]));
  for(const axle of shape.axles) for(let i=0;i<=20;i++) {
    const z=axle-wellRadius+2*wellRadius*i/20;if(z>stations[0][0]&&z<stations.at(-1)![0])cuts.add(z);
  }
  const zs=[...cuts].sort((a,b)=>a-b);
  for(let i=0;i<zs.length-1;i++) {
    const a=section(zs[i]),b=section(zs[i+1]);
    for(const side of [-1,1]) {
      const upperA=Math.max(a[2],bottom(a[0])+.025),upperB=Math.max(b[2],bottom(b[0])+.025);
      const sideFace=[[side*a[1],bottom(a[0]),a[0]],[side*b[1],bottom(b[0]),b[0]],[side*b[1],upperB,b[0]],[side*a[1],upperA,a[0]]];
      const bevel=[[side*a[1],upperA,a[0]],[side*b[1],upperB,b[0]],[side*b[1]*.82,b[3]+.035,b[0]],[side*a[1]*.82,a[3]+.035,a[0]]];
      panel(side>0?sideFace:sideFace.reverse(),paint);panel(side>0?bevel:bevel.reverse(),paint);
    }
    panel([[-a[1]*.82,a[3]+.035,a[0]],[a[1]*.82,a[3]+.035,a[0]],[b[1]*.82,b[3]+.035,b[0]],[-b[1]*.82,b[3]+.035,b[0]]],paint);
  }
  for(const [station,front] of [[stations[0],true],[stations.at(-1)!,false]] as const) {
    const [z,w,,top]=station;const face=[[-w,-.39,z],[w,-.39,z],[w,top,z],[-w,top,z]];
    panel(front?face:face.reverse(),paint);
  }
  box(1.20,.08,3.5,trim,0,-.39,0);
  const cabin=(front:number,roofFront:number,roofRear:number,rear:number,height:number,width:number) => {
    const base=.14,roofW=width*.80;
    panel([[-width,base,front],[width,base,front],[roofW,height,roofFront],[-roofW,height,roofFront]],glass);
    panel([[-roofW,height,roofRear],[roofW,height,roofRear],[width,base,rear],[-width,base,rear]],glass);
    panel([[-roofW,height,roofFront],[roofW,height,roofFront],[roofW,height,roofRear],[-roofW,height,roofRear]],paint);
    for(const side of [-1,1]) {
      const points=[[side*width,base,front],[side*width,base,rear],[side*roofW,height,roofRear],[side*roofW,height,roofFront]];
      panel(side>0?points:points.reverse(),glass);
      rod([side*width,base,front],[side*roofW,height,roofFront],.035,paint);
      rod([side*width,base,rear],[side*roofW,height,roofRear],.047,paint);
      rod([side*roofW,height,roofFront],[side*roofW,height,roofRear],.035,paint);
      const pillarZ=roofFront+(roofRear-roofFront)*.63;
      rod([side*width,base,pillarZ],[side*roofW,height,pillarZ],.022,trim);
      box(.07,.055,.20,alloy,side*(width+.07),.03,pillarZ-.20);
      // Mirrors and lower door seam stay within the common gameplay footprint.
      box(.12,.09,.18,paint,side*.92,.22,front+.15);
      rod([side*.86,-.24,front+.3],[side*.86,-.24,rear-.1],.009,trim);
    }
  };
  if(id==='vector') {
    cabin(-1.08,-.37,.10,.70,.67,.73);
    box(1.36,.035,1.18,trim,0,.17,1.35);
    for(let i=0;i<8;i++)box(1.27,.015,.022,alloy,0,.195,.86+i*.13);
    for(const side of [-1,1])box(.12,.13,1.25,paint,side*.80,.23,1.31);
    box(1.45,.045,.04,headlight,0,-.025,-2.025);box(1.50,.055,.04,taillight,0,.015,2.025);
  } else if(id==='rally') {
    cabin(-.97,-.50,.70,1.38,.64,.70);
    box(1.50,.06,.30,paint,0,.61,1.43);
    for(const side of [-1,1]) {
      box(.35,.09,.045,headlight,side*.54,-.02,-1.90);
      box(.10,.28,.05,taillight,side*.68,-.04,1.90);
      roundLight(side*.23,-.18,-1.93,.10,headlight);
      box(.13,.20,.04,trim,side*.80,-.45,1.51);
    }
    box(.74,.09,.04,trim,0,-.24,-1.90);
  } else if(id==='retro') {
    cabin(-.84,-.20,.38,1.06,.55,.68);
    for(const side of [-1,1]) {
      roundLight(side*.49,-.035,-2.00,.115,headlight);
      box(.35,.10,.04,taillight,side*.49,-.06,2.00);
      rod([side*.85,-.03,-1.64],[side*.85,-.03,1.64],.015,alloy);
    }
    box(1.45,.065,.10,alloy,0,-.27,-2.025);box(1.45,.065,.10,alloy,0,-.27,2.025);
    box(.50,.14,.04,trim,0,-.11,-2.00);
  } else if(id==='dune') {
    for(const side of [-1,1]) {
      rod([side*.55,.08,-.9],[side*.51,.65,-.40],.045,alloy);
      rod([side*.51,.65,-.40],[side*.51,.65,.50],.045,alloy);
      rod([side*.51,.65,.50],[side*.55,.06,1.02],.045,alloy);
      box(.40,.40,.22,trim,side*.28,.19,.31);box(.40,.10,.60,trim,side*.28,.03,-.03);
      roundLight(side*.37,.02,-1.44,.13,headlight);roundLight(side*.37,.05,1.62,.08,taillight);
      rod([side*.58,-.28,-1.25],[side*.85,wheelY,-1.28],.05,alloy);
      rod([side*.58,-.28,1.25],[side*.85,wheelY,1.28],.05,alloy);
    }
    rod([-.51,.65,-.40],[.51,.65,-.40],.045,alloy);rod([-.51,.65,.50],[.51,.65,.50],.045,alloy);
    rod([-.51,.65,.50],[.55,.06,1.02],.025,trim);
    add(new THREE.TorusGeometry(.22,.075,8,20).rotateX(Math.PI/2),trim,0,.13,1.22);
    rod([-.65,-.26,-1.81],[.65,-.26,-1.81],.055,alloy);
  } else if(id==='apex') {
    cabin(-.88,-.16,.28,1.06,.39,.63);
    for(const side of [-1,1]) {
      box(.40,.035,.045,headlight,side*.47,-.13,-1.99);
      box(.42,.035,.045,taillight,side*.48,-.10,2.00);
      const intake=[[side*.81,-.21,.35],[side*.86,-.15,1.0],[side*.86,.035,.78],[side*.80,.02,.30]];
      panel(side>0?intake:intake.reverse(),trim);
      rod([side*.58,.03,1.52],[side*.58,.42,1.52],.025,alloy);
    }
    box(1.74,.06,.35,trim,0,.44,1.55);
    box(1.40,.055,.18,trim,0,-.37,-1.87);
    for(let i=-2;i<=2;i++)box(.025,.13,.30,trim,i*.18,-.29,1.82);
  } else if(id==='muscle') {
    cabin(-.49,.04,.56,1.21,.52,.70);
    for(const side of [-1,1]) {
      for(const offset of [-.12,.12])roundLight(side*.48+offset,-.035,-2.025,.09,headlight);
      for(let n=0;n<3;n++)box(.055,.14,.04,taillight,side*(.40+n*.13),-.035,2.025);
      box(.15,.015,1.25,trim,side*.22,.245,-1.24);
    }
    box(.42,.10,.37,trim,0,.29,-1.10);box(.34,.045,.04,alloy,0,.31,-1.30);
    box(1.53,.07,.17,paint,0,.27,1.72);box(.52,.13,.04,trim,0,-.14,-2.025);
  } else {
    add(new THREE.SphereGeometry(1,24,12).scale(.44,.38,.84),glass,0,.17,-.23);
    for(const side of [-1,1]) {
      rod([side*.48,-.02,-1.83],[side*.73,.055,-1.27],.023,headlight);
      const fin=[[side*.59,.02,.73],[side*.62,.55,1.52],[side*.68,.38,1.82],[side*.73,.01,1.90]];
      // Thin fins remain visible from both sides without doubling every body surface.
      panel(fin,paint); panel([...fin].reverse(),paint);
      box(.43,.035,.04,taillight,side*.42,-.07,1.98);
    }
    box(.06,.045,.72,paint,0,.55,-.22);
  }
  // Rounded tyres, separate sidewalls, brake discs and five-/six-spoke wheels.
  for(const side of [-1,1]) for(const axle of shape.axles) {
    const x=side*.85, r=shape.radius, rim=shape.rim;
    add(new THREE.TorusGeometry(r-.065,.065,8,28).rotateY(Math.PI/2),trim,x,wheelY,axle);
    add(new THREE.CylinderGeometry(r-.025,r-.025,.17,28).rotateZ(Math.PI/2),trim,x,wheelY,axle);
    const outside=side*.944;
    add(new THREE.TorusGeometry(rim,.018,6,24).rotateY(Math.PI/2),alloy,outside,wheelY,axle);
    add(new THREE.CylinderGeometry(rim*.82,rim*.82,.014,20).rotateZ(Math.PI/2),alloy,side*.931,wheelY,axle);
    add(new THREE.CylinderGeometry(.065,.065,.025,12).rotateZ(Math.PI/2),alloy,outside,wheelY,axle);
    const spokes=id==='vector'?6:5;
    for(let i=0;i<spokes;i++) {
      const angle=i*Math.PI*2/spokes;
      rod([outside,wheelY+Math.cos(angle)*.05,axle+Math.sin(angle)*.05],[outside,wheelY+Math.cos(angle)*rim*.94,axle+Math.sin(angle)*rim*.94],id==='vector'?.036:.018,alloy);
    }
    if(id==='dune')for(let i=0;i<20;i++) {
      const angle=i*Math.PI/10;
      const tread=new THREE.BoxGeometry(.19,.022,.07).rotateX(-angle);
      add(tread,trim,x,wheelY+Math.cos(angle)*(r-.012),axle+Math.sin(angle)*(r-.012));
    }
    // Narrow wheel-arch lip follows the actual opening instead of covering the wheel.
    if(id!=='dune')for(let i=0;i<16;i++) {
      const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
      rod([side*section(axle+Math.cos(a)*wellRadius)[1],wheelY+Math.sin(a)*wellRadius,axle+Math.cos(a)*wellRadius],[side*section(axle+Math.cos(b)*wellRadius)[1],wheelY+Math.sin(b)*wellRadius,axle+Math.cos(b)*wellRadius],.018,id==='vector'?trim:paint);
    }
  }
  for(const nozzle of NOZZLES) {
    const rotation=new THREE.Quaternion().setFromUnitVectors(DOWN,new THREE.Vector3().fromArray(nozzle.direction));
    const [x,y,z]=nozzle.position;
    add(new THREE.CylinderGeometry(.19,.19,.10,12).applyQuaternion(rotation),alloy,x,y,z);
    add(new THREE.CylinderGeometry(.145,.145,.108,12).applyQuaternion(rotation),trim,x,y,z);
  }
  for(const [material,pieces] of batches) {
    group.add(new THREE.Mesh(mergeGeometries(pieces)!,material));pieces.forEach(piece=>piece.dispose());
  }
  return group;
}
