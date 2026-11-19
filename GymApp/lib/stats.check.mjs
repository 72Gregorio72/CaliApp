// Self-check for lib/stats.ts. Run: node lib/stats.check.mjs (Node >= 22.18 strips TS types).
import assert from 'node:assert/strict';
import { bestKg, fmtVal, lastFor, parseKg, thisWeek, volume, weekStreak, weightPoints, weightSeries } from './stats.ts';

assert.equal(parseKg('80'), 80);
assert.equal(parseKg('80,5 kg'), 80.5);
assert.equal(parseKg('2x20'), undefined);
assert.equal(parseKg(undefined), undefined);
assert.equal(parseKg(80), 80);

const log = (date, kg, sets = 3) => ({ id: date, workoutId: 'w', title: 'T', date, durationSec: 60, exercises: [{ exerciseId: 'a', name: 'Panca', setsDone: sets, reps: 10, weightKg: kg }] });
// newest first, like the app stores them
const logs = [log('2026-11-18T10:00:00', 70), log('2026-11-11T10:00:00', 80), log('2026-11-04T10:00:00', 60)];

assert.equal(lastFor(logs, 'a').weightKg, 70);
assert.equal(lastFor(logs, 'zzz'), undefined);
assert.equal(bestKg(logs, 'a'), 80);
assert.deepEqual(weightSeries(logs, 'a'), [60, 80, 70]);
assert.equal(weightPoints(logs, 'a')[0].date, '2026-11-04T10:00:00');
assert.equal(volume(logs[0]), 3 * 10 * 70);

// calisthenics units: kept apart from kg in records, volume and charts
const hold = { id: 'h', workoutId: 'w', title: 'T', date: '2026-11-19T10:00:00', durationSec: 60, exercises: [{ exerciseId: 'a', name: 'Panca', setsDone: 3, reps: 10, weightKg: 45, unit: 'sec' }] };
assert.equal(bestKg([hold, ...logs], 'a'), 80);
assert.equal(bestKg([hold, ...logs], 'a', 'sec'), 45);
assert.equal(volume(hold), 0);
assert.deepEqual(weightSeries([hold, ...logs], 'a'), [45]);
assert.equal(fmtVal(12.5, 'reps'), '12,5 rep');

const wed = new Date('2026-11-18T20:00:00'); // Wednesday
assert.equal(thisWeek(logs, wed).length, 1);
assert.equal(weekStreak(logs, wed), 3);
assert.equal(weekStreak(logs.slice(1), wed), 2); // nothing yet this week: still counts the past ones
assert.equal(weekStreak([logs[2]], wed), 0); // gap of a week breaks it

console.log('stats ok');
