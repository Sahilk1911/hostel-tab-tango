export type Member = { id: string; name: string; upi: string };

export type BillItem = { id: string; name: string; price: number; memberIds: string[] };

export type SplitType = "equal" | "exact" | "shares" | "items";

export type Expense = {
  id: string;
  title: string;
  /** total in paise */
  amount: number;
  paidBy: string;
  splitType: SplitType;
  /** equal: who is included */
  participants: string[];
  /** exact: paise per member */
  exact: Record<string, number>;
  /** shares: weight per member */
  shares: Record<string, number>;
  /** items: each item split equally among its members; leftover (tax, delivery, discount) spread proportionally */
  items: BillItem[];
  createdAt: number;
};

export type Payment = { id: string; from: string; to: string; amount: number; createdAt: number };

export type Group = {
  id: string;
  name: string;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  createdAt: number;
};
