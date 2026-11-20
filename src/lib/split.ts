import { allocate } from "./money";
import type { Expense } from "./types";

export type ShareResult = { ok: true; owed: Record<string, number> } | { ok: false; error: string };

/** How much each member consumed (owes) for one expense, in paise. Always sums to expense.amount when ok. */
export function computeShares(e: Pick<Expense, "amount" | "splitType" | "participants" | "exact" | "shares" | "items">): ShareResult {
  const owed: Record<string, number> = {};
  const add = (id: string, v: number) => (owed[id] = (owed[id] ?? 0) + v);

  if (e.amount <= 0) return { ok: false, error: "Enter an amount above zero" };

  switch (e.splitType) {
    case "equal": {
      if (e.participants.length === 0) return { ok: false, error: "Pick at least one person" };
      const parts = allocate(e.amount, e.participants.map(() => 1));
      e.participants.forEach((id, i) => add(id, parts[i]!));
      return { ok: true, owed };
    }
    case "exact": {
      const entries = Object.entries(e.exact).filter(([, v]) => v > 0);
      const sum = entries.reduce((a, [, v]) => a + v, 0);
      if (sum !== e.amount) {
        const diff = e.amount - sum;
        return { ok: false, error: diff > 0 ? `₹${(diff / 100).toFixed(2)} still to assign` : `₹${(-diff / 100).toFixed(2)} over the total` };
      }
      entries.forEach(([id, v]) => add(id, v));
      return { ok: true, owed };
    }
    case "shares": {
      const entries = Object.entries(e.shares).filter(([, v]) => v > 0);
      if (entries.length === 0) return { ok: false, error: "Give at least one person a share" };
      const parts = allocate(e.amount, entries.map(([, v]) => v));
      entries.forEach(([id], i) => add(id, parts[i]!));
      return { ok: true, owed };
    }
    case "items": {
      const items = e.items.filter((it) => it.price > 0);
      if (items.length === 0) return { ok: false, error: "Add at least one item" };
      const unassigned = items.find((it) => it.memberIds.length === 0);
      if (unassigned) return { ok: false, error: `Pick who had "${unassigned.name || "an item"}"` };
      const itemOwed: Record<string, number> = {};
      for (const it of items) {
        const parts = allocate(it.price, it.memberIds.map(() => 1));
        it.memberIds.forEach((id, i) => (itemOwed[id] = (itemOwed[id] ?? 0) + parts[i]!));
      }
      const ids = Object.keys(itemOwed);
      const itemsTotal = ids.reduce((a, id) => a + itemOwed[id]!, 0);
      // Leftover = tax, delivery, packing (positive) or discount (negative), spread by what each person ordered.
      const extra = e.amount - itemsTotal;
      if (e.amount < itemsTotal * 0.2) return { ok: false, error: "Total looks too low for these items" };
      const extraParts = extra >= 0
        ? allocate(extra, ids.map((id) => itemOwed[id]!))
        : allocate(-extra, ids.map((id) => itemOwed[id]!)).map((v) => -v);
      ids.forEach((id, i) => add(id, itemOwed[id]! + extraParts[i]!));
      return { ok: true, owed };
    }
  }
}
