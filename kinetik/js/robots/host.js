// Verbindung zwischen Klartext-Laufzeit und Roboter bzw. Welt
import { friendly } from './robot.js';
import { show } from '../lang/interp.js';
import { CMD_BY_ID } from '../lang/commands.js';

const TYPE_NAMES = { arm: 'Der Roboterarm', humanoid: 'Der Humanoid', rover: 'Der Fahrroboter' };

export class RobotHost {
  constructor(robot, world) {
    this.robot = robot;
    this.world = world; // { sim, broadcast(msg), audio, log(robot, text, kind) }
  }

  command(id, args, ctx) {
    const r = this.robot;
    const sim = r.sim;
    if (this.world.onCommand) this.world.onCommand(r, id, args);
    switch (id) {
      case 'sage': {
        const text = show(args.text);
        r.say(text);
        this.world.log && this.world.log(r, text, 'say');
        return null;
      }
      case 'piepe': this.world.audio && this.world.audio.beep(880, 0.12); return null;
      case 'spiele_ton': this.world.audio && this.world.audio.beep(Math.max(40, Math.min(4000, Number(args.hoehe) || 440)), 0.25); return null;
      case 'band_an': case 'band_aus': case 'band_tempo': {
        const bands = sim.ofKind('band');
        if (!bands.length) throw friendly('In dieser Welt gibt es kein Förderband.');
        for (const b of bands) {
          if (id === 'band_an') b.on = true;
          else if (id === 'band_aus') b.on = false;
          else { b.on = true; b.speedPct = Math.max(-100, Math.min(100, Number(args.prozent) || 0)); }
        }
        return null;
      }
      case 'lampe': case 'lampe_aus': {
        const lamps = sim.ofKind('lampe');
        if (!lamps.length) throw friendly('In dieser Welt gibt es keine Lampe.');
        for (const l of lamps) l.setColor(id === 'lampe' ? String(args.farbe).toLowerCase() : null);
        return null;
      }
      case 'spende': {
        const d = sim.ofKind('spender');
        if (!d.length) throw friendly('In dieser Welt gibt es keinen Würfelspender.');
        if (!d[0].spawn()) r.warn('Der Spender ist leer.');
        return null;
      }
      default: break;
    }
    const fn = r['cmd_' + id];
    if (!fn) {
      const def = CMD_BY_ID[id];
      throw friendly(`${TYPE_NAMES[r.type] || 'Dieser Roboter'} kann „${def ? def.p.replace(/\{\w+:\w+\}/g, '…') : id}“ nicht.`);
    }
    if (r.status === 'akku leer' && !['tempo', 'leuchte', 'leuchte_aus', 'stopp', 'greifkraft'].includes(id)) {
      throw friendly('Der Akku ist leer. Setze die Welt zurück oder baue einen größeren Akku ein.');
    }
    return fn.call(r, args, show);
  }

  reporter(id, args) {
    const r = this.robot;
    const sim = r.sim;
    switch (id) {
      case 'r_schranke': {
        const s = sim.ofKind('lichtschranke');
        if (!s.length) throw friendly('In dieser Welt gibt es keine Lichtschranke.');
        return s.some((x) => x.broken);
      }
      case 'r_taster': {
        const s = sim.ofKind('taster');
        if (!s.length) throw friendly('In dieser Welt gibt es keinen Taster.');
        return s.some((x) => x.pressed);
      }
      default: break;
    }
    const key = { r_abstand: 'abstand', r_farbe: 'farbe', r_helligkeit: 'helligkeit', r_linie: 'linie', r_beruehrt: 'beruehrt', r_haelt: 'haelt', r_kraft: 'kraft', r_gewicht: 'gewicht', r_neigung: 'neigung', r_kompass: 'kompass', r_position: 'position', r_winkel: 'winkel', r_sieht: 'sieht', r_richtung_zu: 'richtung_zu', r_entfernung_zu: 'entfernung_zu', r_umgefallen: 'umgefallen', r_akku: 'akku' }[id];
    const fn = key && r['rep_' + key];
    if (!fn) throw friendly('Diesen Sensorwert kennt der Roboter nicht.');
    return fn.call(r, args);
  }

  broadcast(msg) { return this.world.broadcast ? this.world.broadcast(msg, this.robot) : []; }
  stopMotion() { this.robot.stopMotion(); }
}
