// Dünne Schicht um Rapier: Welt, Kollisionsgruppen, Strahlen, Kontakte.
// Einheiten: Meter, Kilogramm, Sekunden. Simuliert wird in festen Schritten (120 Hz).

export const BIT = { ENV: 0x0001, OBJ: 0x0002 };
export const robotBit = (k) => 1 << (2 + (k % 14));
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);

export class Physics {
  constructor(R) {
    this.R = R;
    this.dt = 1 / 120;
    this.world = null;
    this.info = new Map(); // Collider-Handle → { entity, part, color, kind }
    this.reset();
  }

  reset() {
    if (this.world) this.world.free();
    const R = this.R;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = this.dt;
    this.world.integrationParameters.numSolverIterations = 8;
    this.world.integrationParameters.numInternalPgsIterations = 3;
    this.info.clear();
    // Boden
    const ground = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    const c = this.world.createCollider(
      R.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.85)
        .setCollisionGroups(groups(BIT.ENV, 0xffff & ~BIT.ENV)), ground,
    );
    this.ground = ground;
    this.info.set(c.handle, { kind: 'floor', color: 'weiß' });
    // Hallenwände und Stützen (für LiDAR, Radar und Funk sichtbar)
    const env = groups(BIT.ENV, 0xffff & ~BIT.ENV);
    const box = (hx, hy, hz, x, y, z, kind) => {
      const cc = this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setCollisionGroups(env), ground);
      this.info.set(cc.handle, { kind, color: 'grau' });
    };
    const X = 16, Z = 16, H = 9;
    box(X, H / 2, 0.1, 0, H / 2, -Z - 0.1, 'halle'); box(X, H / 2, 0.1, 0, H / 2, Z + 0.1, 'halle');
    box(0.1, H / 2, Z, -X - 0.1, H / 2, 0, 'halle'); box(0.1, H / 2, Z, X + 0.1, H / 2, 0, 'halle');
    for (const cx of [-12, -4, 4, 12]) for (const cz of [-12, 12]) box(0.25, H / 2, 0.25, cx, H / 2, cz, 'halle');
  }

  get groupsEnv() { return groups(BIT.ENV, 0xffff & ~BIT.ENV); }
  // Strahlabfrage, die nur feste Umgebung trifft (Wände, Halle, Boden, Anlagenteile)
  get rayEnvOnly() { return groups(BIT.OBJ, BIT.ENV); }
  get groupsObj() { return groups(BIT.OBJ, 0xffff); }
  groupsRobot(k) { const b = robotBit(k); return groups(b, 0xffff & ~b); }
  rayGroupsFor(k) { return groups(robotBit(k), 0xffff); }

  tag(collider, data) { this.info.set(collider.handle, data); return collider; }
  infoOf(collider) { return collider ? this.info.get(collider.handle) : null; }

  removeBody(body) {
    if (!body || !this.world.getRigidBody(body.handle)) return;
    const n = body.numColliders();
    for (let i = 0; i < n; i++) this.info.delete(body.collider(i).handle);
    this.world.removeRigidBody(body);
  }

  // Strahl: liefert { dist, collider, info, point, normal } oder null
  ray(origin, dir, maxDist, queryGroups, excludeBody, solid = true) {
    const R = this.R;
    const ray = new R.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxDist, solid, R.QueryFilterFlags.EXCLUDE_SENSORS, queryGroups, undefined, excludeBody);
    if (!hit) return null;
    const t = hit.timeOfImpact ?? hit.toi;
    return {
      dist: t,
      collider: hit.collider,
      info: this.infoOf(hit.collider),
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      normal: hit.normal,
    };
  }

  touching(c1, c2) {
    let hit = false;
    this.world.contactPair(c1, c2, (m) => { if (m.numContacts() > 0) hit = true; });
    return hit;
  }

  // Alle Collider, die diesen Collider gerade berühren
  contacts(c, fn) {
    this.world.contactPairsWith(c, (other) => {
      let real = false;
      this.world.contactPair(c, other, (m) => { if (m.numContacts() > 0) real = true; });
      if (real) fn(other);
    });
  }

  step() { this.world.step(); }
}
