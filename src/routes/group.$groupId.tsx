import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Divide, Hash, Plus, Receipt, Scale } from "lucide-react";

import { Avatar } from "@/components/app/Avatar";
import { ExpenseDialog } from "@/components/app/ExpenseDialog";
import { PeopleView } from "@/components/app/PeopleView";
import { SettleView } from "@/components/app/SettleView";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { minimumTransfers, netBalances } from "@/lib/settle";
import { useGroup } from "@/lib/store";
import type { Expense, SplitType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/group/$groupId")({
  head: () => ({
    meta: [
      { title: "Group expenses — SplitKaro" },
      { name: "description", content: "See who owes whom in your group and settle up in the fewest UPI payments." },
      { property: "og:title", content: "Group expenses — SplitKaro" },
      { property: "og:description", content: "Balances, expenses and UPI settle-up links for your group." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupPage,
});

const splitLabel: Record<SplitType, { label: string; icon: typeof Divide }> = {
  equal: { label: "split equally", icon: Divide },
  exact: { label: "by amounts", icon: Hash },
  shares: { label: "by shares", icon: Scale },
  items: { label: "item-wise", icon: Camera },
};

type Tab = "expenses" | "settle" | "people";

function GroupPage() {
  const { groupId } = Route.useParams();
  const { group, ready } = useGroup(groupId);
  const [tab, setTab] = useState<Tab>("expenses");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();

  if (!ready) return <div className="min-h-screen" />;
  if (!group) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Group not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been deleted on this device.</p>
        <Button asChild className="mt-6">
          <Link to="/">Back to groups</Link>
        </Button>
      </div>
    );
  }

  const total = group.expenses.reduce((a, e) => a + e.amount, 0);
  const pending = minimumTransfers(netBalances(group));
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-5">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All groups
      </Link>

      <header className="ledger-card mt-3 p-5">
        <h1 className="text-3xl font-extrabold">{group.name}</h1>
        <div className="mt-2 flex -space-x-2">
          {group.members.map((m) => (
            <Avatar key={m.id} name={m.name} size="sm" />
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total spent</dt>
            <dd className="amount text-2xl">{formatINR(total)}</dd>
          </div>
          <button type="button" onClick={() => setTab("settle")} className="rounded-xl bg-marigold-soft p-3 text-left">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To settle</dt>
            <dd className="amount text-2xl">
              {pending.length} payment{pending.length === 1 ? "" : "s"}
            </dd>
          </button>
        </dl>
      </header>

      <nav className="mt-5 grid grid-cols-3 gap-1 rounded-xl border-2 border-ink bg-card p-1" role="tablist">
        {(
          [
            ["expenses", "Expenses"],
            ["settle", "Settle up"],
            ["people", "People"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg py-2 text-sm font-semibold transition-colors",
              tab === id ? "bg-ink text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="mt-6">
        {tab === "expenses" &&
          (group.expenses.length === 0 ? (
            <div className="ledger-card flex flex-col items-center p-10 text-center">
              <Receipt className="h-8 w-8" />
              <p className="mt-2 font-display text-lg font-bold">No expenses yet</p>
              <p className="text-sm text-muted-foreground">Add the first Zomato order, cab or bill.</p>
              <Button variant="marigold" className="mt-4" onClick={openNew}>
                <Plus /> Add expense
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {group.expenses.map((e) => {
                const s = splitLabel[e.splitType];
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(e);
                        setDialogOpen(true);
                      }}
                      className="ledger-card flex w-full items-center gap-3 p-4 text-left transition-transform hover:-translate-y-0.5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-marigold-soft">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {name(e.paidBy)} paid · {s.label}
                        </p>
                      </div>
                      <span className="amount text-lg">{formatINR(e.amount)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
        {tab === "settle" && <SettleView group={group} />}
        {tab === "people" && <PeopleView group={group} />}
      </main>

      {tab !== "people" && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <Button size="lg" variant="marigold" className="shadow-ink-lg" onClick={openNew}>
            <Plus /> Add expense
          </Button>
        </div>
      )}

      <ExpenseDialog group={group} open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}
