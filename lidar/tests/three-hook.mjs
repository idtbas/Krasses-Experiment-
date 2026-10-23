// Node-Loader für Tests: der nackte Bezeichner „three“ zeigt wie im Browser (Importmap) auf die KINETIK-Kopie.
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: new URL('../../kinetik/vendor/three.min.js', import.meta.url).href, shortCircuit: true, format: 'module' };
  return next(spec, ctx);
}
