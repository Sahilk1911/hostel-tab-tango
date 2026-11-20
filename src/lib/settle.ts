import { computeShares } from "./split";
import type { Group } from "./types";

/** Net balance per member in paise: positive = should get money back, negative = owes. */
export function netBalances(group: Pick<Group, "members" | "expenses" | "payments">): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const m of group.members) bal[m.id] = 0;
  for (const e of group.expenses) {
    const r = computeShares(e);
    if (!r.ok) continue;
    bal[e.paidBy] = (bal[e.paidBy] ?? 0) + e.amount;
    for (const [id, v] of Object.entries(r.owed)) bal[id] = (bal[id] ?? 0) - v;
  }
  for (const p of group.payments) {
    bal[p.from] = (bal[p.from] ?? 0) + p.amount;
    bal[p.to] = (bal[p.to] ?? 0) - p.amount;
  }
  return bal;
}

export type Transfer = { from: string; to: string; amount: number };

/** Settle a set of balances summing to zero with (size - 1) payments: biggest debtor pays biggest creditor. */
function greedy(entries: [string, number][]): Transfer[] {
  const debtors = entries.filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = entries.filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const out: Transfer[] = [];
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amt = Math.min(d.v, c.v);
    if (amt > 0) out.push({ from: d.id, to: c.id, amount: amt });
    d.v -= amt;
    c.v -= amt;
    if (d.v === 0) i++;
    if (c.v === 0) j++;
  }
  return out;
}

const EXACT_LIMIT = 18;

/**
 * Fewest possible payments to clear all debts.
 * The minimum equals (people with non-zero balance) − (max number of disjoint zero-sum subgroups).
 * For up to 18 people with a balance we find that maximum exactly with a bitmask DP, then settle each subgroup greedily.
 */
export function minimumTransfers(balances: Record<string, number>): Transfer[] {
  const entries = Object.entries(balances).filter(([, v]) => v !== 0);
  const n = entries.length;
  if (n === 0) return [];
  if (n > EXACT_LIMIT) return greedy(entries);

  const full = (1 << n) - 1;
  const sum = new Float64Array(1 << n);
  const dp = new Int8Array(1 << n);
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    const bit = 31 - Math.clz32(low);
    sum[mask] = sum[mask ^ low]! + entries[bit]![1];
    let best = 0;
    for (let b = 0; b < n; b++) {
      if (mask & (1 << b)) {
        const v = dp[mask ^ (1 << b)]!;
        if (v > best) best = v;
      }
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // Walk back to recover an ordering whose zero-sum prefixes mark the subgroups.
  const removal: number[] = [];
  let mask = full;
  while (mask) {
    const here = dp[mask]! - (sum[mask] === 0 ? 1 : 0);
    for (let b = 0; b < n; b++) {
      if (mask & (1 << b) && dp[mask ^ (1 << b)] === here) {
        removal.push(b);
        mask ^= 1 << b;
        break;
      }
    }
  }
  const order = removal.reverse();
  const out: Transfer[] = [];
  let bucket: [string, number][] = [];
  let running = 0;
  for (const b of order) {
    bucket.push(entries[b]!);
    running += entries[b]![1];
    if (running === 0) {
      out.push(...greedy(bucket));
      bucket = [];
    }
  }
  if (bucket.length) out.push(...greedy(bucket));
  return out;
}

/** How many payments it would take if everyone paid each payer back directly (before simplifying). */
export function directPaymentCount(group: Pick<Group, "expenses">): number {
  const pair: Record<string, number> = {};
  for (const e of group.expenses) {
    const r = computeShares(e);
    if (!r.ok) continue;
    for (const [id, v] of Object.entries(r.owed)) {
      if (id === e.paidBy || v === 0) continue;
      const [a, b] = id < e.paidBy ? [id, e.paidBy] : [e.paidBy, id];
      const sign = id < e.paidBy ? 1 : -1;
      pair[`${a}|${b}`] = (pair[`${a}|${b}`] ?? 0) + sign * v;
    }
  }
  return Object.values(pair).filter((v) => v !== 0).length;
}
