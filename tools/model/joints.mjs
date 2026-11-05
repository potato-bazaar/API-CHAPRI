import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]); const skin = doc.getRoot().listSkins()[0];
const ibm = skin.getInverseBindMatrices().getArray(); const J = skin.listJoints();
const inv = (m) => { // invert 4x4 affine (column-major)
  const a = m; const r = [a[0], a[1], a[2], a[4], a[5], a[6], a[8], a[9], a[10]];
  const det = r[0] * (r[4] * r[8] - r[5] * r[7]) - r[3] * (r[1] * r[8] - r[2] * r[7]) + r[6] * (r[1] * r[5] - r[2] * r[4]);
  return det; };
for (let j = 0; j < J.length; j++) { const n = J[j].getName(); if (/(index|middle|pinky|ring|thumb)_0[2-4]/.test(n)) continue; const w = J[j].getWorldMatrix(); console.log(n.padEnd(14), 'world', [w[12], w[13], w[14]].map(v => v.toFixed(3)).join(','), 'parent', J[j].getParentNode() && J[j].getParentNode().getName()); }
