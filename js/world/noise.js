/* KYTHERA · MANDAT · Rauschfunktionen (deterministisch, seed-basiert) */
(function (root) {
  'use strict';
  function hash2(ix, iy, s) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(s, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  function vnoise(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s);
    const c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    const top = a + (b - a) * sx, bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  }
  function fbm(x, y, s, oct, lac, gain) {
    lac = lac || 2.03; gain = gain || 0.5;
    let v = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      v += amp * vnoise(x * f, y * f, s + i * 31);
      norm += amp; f *= lac; amp *= gain;
    }
    return v / norm;
  }
  function ridged(x, y, s, oct) {
    let v = 0, amp = 0.5, f = 1, norm = 0, w = 1;
    for (let i = 0; i < oct; i++) {
      let n = 1 - Math.abs(vnoise(x * f, y * f, s + i * 57) * 2 - 1);
      n *= n * w;
      w = Math.min(1, n * 2);
      v += n * amp; norm += amp; f *= 2.1; amp *= 0.5;
    }
    return v / norm;
  }
  const api = { hash2, vnoise, fbm, ridged };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.KY = root.KY || {}; root.KY.noise = api; }
})(typeof window !== 'undefined' ? window : globalThis);
