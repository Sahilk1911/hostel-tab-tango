import { describe, expect, it } from "vitest";

import { computeShares } from "@/lib/split";
import { directPaymentCount, minimumTransfers, netBalances } from "@/lib/settle";
import { buildUpiLink } from "@/lib/upi";
import type { Expense } from "@/lib/types";

const base = { participants: [], exact: {}, shares: {}, items: [] } as Pick<Expense, "participants" | "exact" | "shares" | "items">;

describe("splits", () => {
  it("equal split hands leftover paise out so the total is exact", () => {
    const r = computeShares({ ...base, amount: 10000, splitType: "equal", participants: ["a", "b", "c"] });
    expect(r.ok && Object.values(r.owed).sort()).toEqual([3333, 3333, 3334]);
  });

  it("exact split must add up to the total", () => {
    const r = computeShares({ ...base, amount: 10000, splitType: "exact", exact: { a: 6000, b: 3000 } });
    expect(r.ok).toBe(false);
  });

  it("shares split is proportional (2:1:1 of ₹400)", () => {
    const r = computeShares({ ...base, amount: 40000, splitType: "shares", shares: { a: 2, b: 1, c: 1 } });
    expect(r.ok && r.owed).toEqual({ a: 20000, b: 10000, c: 10000 });
  });

  it("item-wise split spreads tax by what each person ordered", () => {
    const r = computeShares({
      ...base,
      amount: 33000, // ₹300 items + ₹30 tax
      splitType: "items",
      items: [
        { id: "1", name: "Biryani", price: 20000, memberIds: ["a"] },
        { id: "2", name: "Naan", price: 10000, memberIds: ["a", "b"] },
      ],
    });
    // a ordered 250, b 50 → tax 25 / 5
    expect(r.ok && r.owed).toEqual({ a: 27500, b: 5500 });
  });
});

describe("minimum-transactions settlement", () => {
  it("clears all balances", () => {
    const bal = { a: 5000, b: -2000, c: -3000, d: 1000, e: -1000 };
    const t = minimumTransfers(bal);
    const after: Record<string, number> = { ...bal };
    for (const x of t) {
      after[x.from] = after[x.from]! + x.amount;
      after[x.to] = after[x.to]! - x.amount;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });

  it("finds independent pairs: 4 people in two matching pairs need 2 payments, not 3", () => {
    // greedy-by-size would match 700↔-600 first and need 3 payments
    const t = minimumTransfers({ a: 700, b: -700, c: 600, d: -600 });
    expect(t).toHaveLength(2);
  });

  it("finds the minimum when debts split into separate circles", () => {
    // Zero-sum groups: {a,d}, {b,c,e} → 5 − 2 = 3 payments
    const t = minimumTransfers({ a: 400, b: 300, c: 200, d: -400, e: -500 });
    expect(t).toHaveLength(3);
  });

  it("payments recorded as paid reduce what is owed", () => {
    const group = {
      members: [{ id: "a", name: "A", upi: "" }, { id: "b", name: "B", upi: "" }],
      expenses: [{ ...base, id: "x", title: "", amount: 20000, paidBy: "a", splitType: "equal" as const, participants: ["a", "b"], createdAt: 0 }],
      payments: [{ id: "p", from: "b", to: "a", amount: 10000, createdAt: 0 }],
    };
    expect(minimumTransfers(netBalances(group))).toHaveLength(0);
    expect(directPaymentCount(group)).toBe(1);
  });
});

describe("UPI link", () => {
  it("builds a upi://pay link with payee, amount in rupees and INR", () => {
    const link = buildUpiLink({ upi: "riya@ybl", name: "Riya S", amountPaise: 45050, note: "Room 204" });
    expect(link).toBe("upi://pay?pa=riya@ybl&pn=Riya%20S&am=450.50&cu=INR&tn=Room%20204");
  });
});
