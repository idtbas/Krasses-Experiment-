// Testszenen für die Browser-Tests
import * as THREE from 'three';

export function arm(sim, { createObject, createRobot, cam }) {
  createObject(sim, { type: 'tisch', x: 0, z: 0.25, w: 1.4, d: 1.0, h: 0.4 });
  const robot = createRobot(sim, { type: 'arm' }, { x: 0, y: 0.4, z: 0, yaw: 0 });
  const red = createObject(sim, { type: 'würfel', x: 0.15, y: 0.43, z: 0.45, color: 'rot', yaw: 0.4 });
  createObject(sim, { type: 'würfel', x: -0.2, y: 0.43, z: 0.4, color: 'blau', material: 'stahl' });
  createObject(sim, { type: 'zone', x: -0.35, z: 0.1, color: 'grün' });
  const zone = sim.entities[sim.entities.length - 1];
  zone.spec.y = 0.4;
  cam.lookAt(new THREE.Vector3(0, 0.55, 0.25), 2.1, 0.9, 0.45); cam.jump();
  return {
    robot,
    program: `beim start
  tempo 70
  nimm rot
  sage "Hab den roten Würfel"
  lege ab auf blau
  sage "gestapelt"
  grundstellung
ende
`,
    check: () => ({ red: red.body.translation() }),
  };
}

export function armjoints(sim, { createObject, createRobot, cam }) {
  const robot = createRobot(sim, { type: 'arm' }, { x: 0, y: 0, z: 0, yaw: 0 });
  createObject(sim, { type: 'würfel', x: 0.2, z: 0.5, color: 'gelb' });
  cam.lookAt(new THREE.Vector3(0, 0.45, 0.2), 2.2, 0.8, 0.35); cam.jump();
  return {
    robot,
    program: `beim start
  drehe basis auf 45
  drehe schulter auf 40
  bewege greifer zu 0, 10, 50
  bewege greifer zu 30, 30, 30
  greife
  lass los
  sage "ok"
ende
`,
  };
}

export function walk(sim, { createObject, createRobot, cam }) {
  const robot = createRobot(sim, { type: 'humanoid' }, { x: 0, y: 0, z: 0, yaw: 0 });
  cam.lookAt(new THREE.Vector3(0, 0.8, 0.5), 3.2, 0.6, 0.25); cam.jump();
  cam.follow = () => { const p = robot.frame().p; return new THREE.Vector3(p.x, 0.75, p.z); };
  return {
    robot,
    program: `beim start
  warte 1
  gehe 100 vor
  sage "Strecke 1"
  drehe dich um 90 nach links
  gehe 50 vor
  winke
  sage "fertig"
ende
`,
    check: () => { const f = robot.frame(); return { x: f.p.x, y: f.p.y, z: f.p.z, yaw: f.yaw * 57.3, status: robot.status, tilt: robot.tilt() * 57.3 }; },
  };
}

export function stand(sim, { createObject, createRobot, cam }) {
  const robot = createRobot(sim, { type: 'humanoid' }, { x: 0, y: 0, z: 0, yaw: 0 });
  cam.lookAt(new THREE.Vector3(0, 0.75, 0), 2.6, 0.5, 0.2); cam.jump();
  return {
    robot,
    program: `beim start
  warte 2
  sage "steht"
ende
`,
    check: () => { const f = robot.frame(); return { x: f.p.x, y: f.p.y, z: f.p.z, status: robot.status, tilt: robot.tilt() * 57.3 }; },
  };
}
