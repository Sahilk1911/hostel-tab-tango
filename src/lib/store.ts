import { useSyncExternalStore } from "react";
import type { Expense, Group, Member, Payment } from "./types";

const KEY = "splitkaro:v1";
type State = { groups: Group[] };
const EMPTY: State = { groups: [] };

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as State;
  } catch {
    state = EMPTY;
  }
}

function set(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  load();
  return state;
}

export function useStore(): State & { ready: boolean } {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return { ...s, ready };
}

export function useGroup(id: string) {
  const { groups, ready } = useStore();
  return { group: groups.find((g) => g.id === id), ready };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function updateGroup(id: string, fn: (g: Group) => Group) {
  load();
  set({ groups: state.groups.map((g) => (g.id === id ? fn(g) : g)) });
}

export const actions = {
  createGroup(name: string, memberNames: string[]): string {
    load();
    const g: Group = {
      id: uid(),
      name,
      members: memberNames.map((n) => ({ id: uid(), name: n, upi: "" })),
      expenses: [],
      payments: [],
      createdAt: Date.now(),
    };
    set({ groups: [g, ...state.groups] });
    return g.id;
  },
  addGroup(g: Group) {
    load();
    set({ groups: [g, ...state.groups] });
  },
  deleteGroup(id: string) {
    load();
    set({ groups: state.groups.filter((g) => g.id !== id) });
  },
  renameGroup(id: string, name: string) {
    updateGroup(id, (g) => ({ ...g, name }));
  },
  addMember(groupId: string, name: string) {
    updateGroup(groupId, (g) => ({ ...g, members: [...g.members, { id: uid(), name, upi: "" }] }));
  },
  updateMember(groupId: string, m: Member) {
    updateGroup(groupId, (g) => ({ ...g, members: g.members.map((x) => (x.id === m.id ? m : x)) }));
  },
  removeMember(groupId: string, memberId: string) {
    updateGroup(groupId, (g) => ({ ...g, members: g.members.filter((x) => x.id !== memberId) }));
  },
  saveExpense(groupId: string, e: Expense) {
    updateGroup(groupId, (g) => {
      const exists = g.expenses.some((x) => x.id === e.id);
      return { ...g, expenses: exists ? g.expenses.map((x) => (x.id === e.id ? e : x)) : [e, ...g.expenses] };
    });
  },
  deleteExpense(groupId: string, expenseId: string) {
    updateGroup(groupId, (g) => ({ ...g, expenses: g.expenses.filter((x) => x.id !== expenseId) }));
  },
  addPayment(groupId: string, p: Omit<Payment, "id" | "createdAt">) {
    updateGroup(groupId, (g) => ({ ...g, payments: [{ ...p, id: uid(), createdAt: Date.now() }, ...g.payments] }));
  },
  deletePayment(groupId: string, paymentId: string) {
    updateGroup(groupId, (g) => ({ ...g, payments: g.payments.filter((x) => x.id !== paymentId) }));
  },
};

/** A ready-made group so first-time users can see how it works. */
export function sampleGroup(): Group {
  const [a, r, k, p] = ["Aarav", "Riya", "Kabir", "Priya"].map((name) => ({ id: uid(), name, upi: "" }));
  const ids = { a: a!.id, r: r!.id, k: k!.id, p: p!.id };
  a!.upi = "aarav@okaxis";
  r!.upi = "riya@ybl";
  k!.upi = "kabir@paytm";
  p!.upi = "priya@oksbi";
  const now = Date.now();
  const base = { participants: [], exact: {}, shares: {}, items: [] };
  return {
    id: uid(),
    name: "Room 204 · Block C",
    members: [a!, r!, k!, p!],
    payments: [],
    createdAt: now,
    expenses: [
      {
        ...base,
        id: uid(),
        title: "Zomato late-night order",
        amount: 86000,
        paidBy: ids.a,
        splitType: "items",
        items: [
          { id: uid(), name: "Butter chicken", price: 32000, memberIds: [ids.a, ids.k] },
          { id: uid(), name: "Paneer tikka", price: 24000, memberIds: [ids.r, ids.p] },
          { id: uid(), name: "Garlic naan ×4", price: 16000, memberIds: [ids.a, ids.r, ids.k, ids.p] },
          { id: uid(), name: "Cold coffee", price: 9000, memberIds: [ids.p] },
        ],
        createdAt: now - 3600_000,
      },
      {
        ...base,
        id: uid(),
        title: "Electricity bill – October",
        amount: 240000,
        paidBy: ids.r,
        splitType: "shares",
        shares: { [ids.a]: 1, [ids.r]: 1, [ids.k]: 2, [ids.p]: 1 },
        createdAt: now - 86400_000,
      },
      {
        ...base,
        id: uid(),
        title: "Rishikesh trip cab",
        amount: 360000,
        paidBy: ids.k,
        splitType: "equal",
        participants: [ids.a, ids.r, ids.k, ids.p],
        createdAt: now - 3 * 86400_000,
      },
    ],
  };
}
