// Exercise blocks: consecutive exercises chained by supersetWithNext form one group.
// The head's `block` turns the group (even a single exercise) into an EMOM or AMRAP; a plain chain is a superset.

export type Block = { type: 'emom' | 'amrap'; minutes: number };
export type BlockType = 'superset' | Block['type'];
/** Exercises [start, end) of the list; type null = a lone, normal exercise. */
export type Group = { start: number; end: number; type: BlockType | null; minutes: number };

export function groupsOf(exs: { supersetWithNext?: boolean; block?: Block }[]): Group[] {
  const out: Group[] = [];
  for (let i = 0; i < exs.length; ) {
    let end = i + 1;
    while (end < exs.length && exs[end - 1].supersetWithNext) end++;
    const b = exs[i].block;
    out.push({ start: i, end, type: b ? b.type : end - i > 1 ? 'superset' : null, minutes: b?.minutes ?? 0 });
    i = end;
  }
  return out;
}

export const groupAt = (gs: Group[], i: number) => gs.find(g => i >= g.start && i < g.end);

/** EMOM: minute k goes to member k % n, so member j gets every n-th minute. */
export const emomSets = (minutes: number, n: number, j: number) => Math.max(1, Math.floor(minutes / n) + (j < minutes % n ? 1 : 0));

export const blockLabel = (g: Pick<Group, 'type' | 'minutes' | 'start' | 'end'>) =>
  g.type === 'emom' ? `EMOM · ${g.minutes} min`
  : g.type === 'amrap' ? `AMRAP · ${g.minutes} min`
  : g.type === 'superset' ? (g.end - g.start > 2 ? `Circuito · ${g.end - g.start} esercizi` : 'Superserie')
  : '';

/** Saved/shown shape of a list: `block` only on a block's first exercise, EMOM sets follow the minutes. */
export function normalizeBlocks<T extends { supersetWithNext?: boolean; block?: Block; sets: number }>(exs: T[]): T[] {
  const gs = groupsOf(exs);
  return exs.map((e, i) => {
    const g = groupAt(gs, i)!;
    const { block, ...rest } = e;
    return {
      ...rest,
      ...(i === g.start && block ? { block } : {}),
      ...(g.type === 'emom' ? { sets: emomSets(g.minutes, g.end - g.start, i - g.start) } : {}),
    } as T;
  });
}
