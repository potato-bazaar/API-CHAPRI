import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const r = doc.getRoot();
  console.log('=====', f, 'ext', r.listExtensionsUsed().map(e => e.extensionName).join(','));
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) console.log(' mesh', m.getName(), 'tris', p.getIndices() ? p.getIndices().getCount() / 3 : '-', 'attrs', p.listSemantics().join(','), 'mat', p.getMaterial() && p.getMaterial().getName(), 'targets', p.listTargets().length);
  for (const mt of r.listMaterials()) console.log(' mat', mt.getName(), 'base', mt.getBaseColorFactor().map(v => +v.toFixed(2)), 'tex', ['getBaseColorTexture', 'getNormalTexture', 'getMetallicRoughnessTexture', 'getOcclusionTexture', 'getEmissiveTexture'].map(k => { const t = mt[k](); return t ? t.getName() + ':' + t.getSize() : '-'; }).join(' '), 'metal', mt.getMetallicFactor(), 'rough', mt.getRoughnessFactor());
  for (const t of r.listTextures()) console.log(' tex', t.getName(), t.getMimeType(), t.getSize(), (t.getImage().byteLength / 1024).toFixed(0) + 'KB');
  for (const s of r.listSkins()) { const j = s.listJoints(); console.log(' skin joints', j.length, j.map(n => n.getName()).join(' ')); }
  console.log(' anims', r.listAnimations().map(a => a.getName()).join(', ') || '-');
  const meshNodes = r.listNodes().filter(n => n.getMesh()); for (const n of meshNodes) console.log(' node', n.getName(), 'T', n.getTranslation().map(v => +v.toFixed(3)), 'R', n.getRotation().map(v => +v.toFixed(3)), 'S', n.getScale().map(v => +v.toFixed(3)), 'skin', !!n.getSkin());
  const roots = (r.getDefaultScene() || r.listScenes()[0]).listChildren(); const walk = (n, d) => { if (d < 3) { console.log('  '.repeat(d + 1) + 'tree', n.getName(), n.getTranslation().map(v => +v.toFixed(3)), n.getRotation().map(v => +v.toFixed(3)), n.getScale().map(v => +v.toFixed(3))); n.listChildren().forEach(c => walk(c, d + 1)); } }; roots.forEach(n => walk(n, 0));
}
