import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Plus, Sparkles, Users, Zap } from "lucide-react";

import { Avatar } from "@/components/app/Avatar";
import { Logo } from "@/components/app/Logo";
import { NewGroupDialog } from "@/components/app/NewGroupDialog";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { minimumTransfers, netBalances } from "@/lib/settle";
import { actions, sampleGroup, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SplitKaro — split hostel expenses, settle in fewest payments" },
      {
        name: "description",
        content: "Split Zomato orders, trips and electricity bills with your hostel group and settle up with UPI in the fewest payments.",
      },
      { property: "og:title", content: "SplitKaro — hostel expense splitter" },
      { property: "og:description", content: "Split bills item-wise from a photo and settle up in the fewest UPI payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { groups, ready } = useStore();
  const [open, setOpen] = useState(false);

  const trySample = () => actions.addGroup(sampleGroup());

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-24 pt-6">
      <header className="flex items-center justify-between">
        <Logo />
        {groups.length > 0 && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> New group
          </Button>
        )}
      </header>

      {ready && groups.length === 0 && (
        <section className="mt-12">
          <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Who owes whom? <br />
            <span className="highlight">Sorted.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Add your hostel group's Zomato orders, trips and bills. SplitKaro tells everyone exactly what to pay — in the fewest UPI payments.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="marigold" onClick={() => setOpen(true)}>
              <Plus /> Create a group
            </Button>
            <Button size="lg" variant="outline" onClick={trySample}>
              <Sparkles /> Try a sample group
            </Button>
          </div>

          <ol className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Users, t: "Add your people", d: "Roommates, trip gang, flatmates." },
              { icon: Camera, t: "Log expenses", d: "Split equally, by amounts, shares or snap the bill." },
              { icon: Zap, t: "Settle up", d: "Fewest payments, each with a UPI link." },
            ].map((s, i) => (
              <li key={s.t} className="ledger-card p-4">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-muted-foreground">0{i + 1}</span>
                  <s.icon className="h-4 w-4" />
                </div>
                <p className="mt-2 font-display font-bold">{s.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {groups.length > 0 && (
        <section className="mt-8">
          <h1 className="text-3xl font-extrabold">Your groups</h1>
          <ul className="mt-5 space-y-4">
            {groups.map((g) => {
              const total = g.expenses.reduce((a, e) => a + e.amount, 0);
              const pending = minimumTransfers(netBalances(g)).length;
              return (
                <li key={g.id}>
                  <Link
                    to="/group/$groupId"
                    params={{ groupId: g.id }}
                    className="ledger-card group flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-bold">{g.name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {g.members.slice(0, 5).map((m) => (
                            <Avatar key={m.id} name={m.name} size="sm" />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {g.members.length} people · {formatINR(total)} spent
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {pending === 0 ? (
                        <span className="rounded-full bg-gain-soft px-3 py-1 text-xs font-semibold text-gain">All settled</span>
                      ) : (
                        <span className="rounded-full bg-owe-soft px-3 py-1 text-xs font-semibold text-owe">
                          {pending} payment{pending > 1 ? "s" : ""} due
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-8 text-center text-xs text-muted-foreground">Groups are saved on this device.</p>
        </section>
      )}

      <NewGroupDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
