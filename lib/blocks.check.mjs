// Self-check for lib/blocks.ts. Run: node lib/blocks.check.mjs (Node >= 22.18 strips TS types).
import assert from 'node:assert/strict';
import { blockLabel, emomSets, groupAt, groupsOf, normalizeBlocks } from './blocks.ts';

const g = groupsOf([
  {},
  { supersetWithNext: true },
  { supersetWithNext: true },
  {},
  { block: { type: 'emom', minutes: 10 } },
  { block: { type: 'amrap', minutes: 12 }, supersetWithNext: true },
  {},
]);
assert.deepEqual(g.map(x => [x.start, x.end, x.type]), [[0, 1, null], [1, 4, 'superset'], [4, 5, 'emom'], [5, 7, 'amrap']]);
assert.equal(groupAt(g, 3).start, 1);
assert.equal(groupAt(g, 6).type, 'amrap');
assert.equal(groupAt(g, 9), undefined);
// a trailing link with nothing after it doesn't break the last group
assert.deepEqual(groupsOf([{ supersetWithNext: true }]).map(x => [x.start, x.end, x.type]), [[0, 1, null]]);

// 10 minutes over 3 exercises: 4 + 3 + 3
assert.deepEqual([0, 1, 2].map(j => emomSets(10, 3, j)), [4, 3, 3]);
assert.equal(emomSets(10, 1, 0), 10);
assert.equal(emomSets(1, 3, 2), 1); // never 0 sets

assert.equal(blockLabel(g[1]), 'Circuito · 3 esercizi');
assert.equal(blockLabel({ type: 'superset', start: 0, end: 2, minutes: 0 }), 'Superserie');
assert.equal(blockLabel(g[2]), 'EMOM · 10 min');
assert.equal(blockLabel(g[0]), '');
const n = normalizeBlocks([
  { sets: 9, block: { type: 'emom', minutes: 5 }, supersetWithNext: true },
  { sets: 9, block: { type: 'amrap', minutes: 3 } }, // stale: not a head, dropped
  { sets: 4 },
]);
assert.deepEqual(n.map(e => e.sets), [3, 2, 4]);
assert.equal(n[1].block, undefined);
assert.equal(n[0].block.type, 'emom');
console.log('blocks ok');
