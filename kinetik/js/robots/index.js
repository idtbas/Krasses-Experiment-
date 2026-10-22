// Roboter-Fabrik
import { Arm } from './arm.js';
import { Humanoid } from './humanoid.js';
import { Rover } from './rover.js';

const CLASSES = { arm: Arm, humanoid: Humanoid, rover: Rover };

export function registerRobot(type, cls) { CLASSES[type] = cls; }

export function createRobot(sim, config, spawn) {
  const Cls = CLASSES[config.type];
  if (!Cls) throw new Error('Unbekannter Robotertyp: ' + config.type);
  const r = new Cls(sim, config, spawn);
  sim.add(r);
  return r;
}
