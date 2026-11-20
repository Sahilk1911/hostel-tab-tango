import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Minus, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scanBillFn } from "@/lib/bill-scan.functions";
import { compressImage } from "@/lib/image";
import { formatINR, fromPaise, toPaise } from "@/lib/money";
import { computeShares } from "@/lib/split";
import { actions, uid } from "@/lib/store";
import type { Expense, Group, SplitType } from "@/lib/types";
import { cn } from "@/lib/utils";

type DraftItem = { id: string; name: string; price: string; memberIds: string[] };

const MODES: { id: SplitType; label: string; hint: string }[] = [
  { id: "equal", label: "Equally", hint: "Same amount for everyone ticked" },
  { id: "exact", label: "Amounts", hint: "Type what each person owes" },
  { id: "shares", label: "Shares", hint: "e.g. 2 shares for the one with the AC" },
  { id: "items", label: "Bill items", hint: "Snap the bill, tick who had what" },
];

export function ExpenseDialog({
  group,
  open,
  onOpenChange,
  editing,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Expense | undefined;
}) {
  const ids = group.members.map((m) => m.id);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(ids[0] ?? "");
  const [mode, setMode] = useState<SplitType>("equal");
  const [participants, setParticipants] = useState<string[]>(ids);
  const [exact, setExact] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, number>>({});
  const [items, setItems] = useState<DraftItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const e = editing;
    setTitle(e?.title ?? "");
    setAmount(e ? fromPaise(e.amount) : "");
    setPaidBy(e?.paidBy ?? ids[0] ?? "");
    setMode(e?.splitType ?? "equal");
    setParticipants(e && e.splitType === "equal" ? e.participants : ids);
    setExact(Object.fromEntries(Object.entries(e?.exact ?? {}).map(([k, v]) => [k, fromPaise(v)])));
    setShares(e && e.splitType === "shares" ? e.shares : Object.fromEntries(ids.map((id) => [id, 1])));
    setItems((e?.items ?? []).map((it) => ({ id: it.id, name: it.name, price: fromPaise(it.price), memberIds: it.memberIds })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const itemsTotal = items.reduce((a, it) => a + toPaise(it.price), 0);
  const total = mode === "items" && !amount.trim() ? itemsTotal : toPaise(amount);

  const expense: Expense = useMemo(
    () => ({
      id: editing?.id ?? uid(),
      title: title.trim() || "Expense",
      amount: total,
      paidBy,
      splitType: mode,
      participants: mode === "equal" ? participants : [],
      exact: mode === "exact" ? Object.fromEntries(Object.entries(exact).map(([k, v]) => [k, toPaise(v)])) : {},
      shares: mode === "shares" ? shares : {},
      items:
        mode === "items"
          ? items.map((it) => ({ id: it.id, name: it.name.trim(), price: toPaise(it.price), memberIds: it.memberIds }))
          : [],
      createdAt: editing?.createdAt ?? Date.now(),
    }),
    [editing, title, total, paidBy, mode, participants, exact, shares, items],
  );
  const result = computeShares(expense);
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";

  const save = () => {
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (!paidBy) {
      toast.error("Pick who paid");
      return;
    }
    actions.saveExpense(group.id, expense);
    toast.success(editing ? "Expense updated" : "Expense added");
    onOpenChange(false);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    try {
      const image = await compressImage(file);
      const res = await scanBillFn({ data: { image } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setItems(res.bill.items.map((it) => ({ id: uid(), name: it.name, price: fromPaise(it.price), memberIds: [] })));
      if (res.bill.total) setAmount(fromPaise(res.bill.total));
      if (!title.trim() && res.bill.title) setTitle(res.bill.title);
      toast.success(`Found ${res.bill.items.length} items — now tick who had what`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't scan this photo");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const exactAssigned = Object.values(exact).reduce((a, v) => a + toPaise(v), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{editing ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="etitle">What for?</Label>
              <Input id="etitle" placeholder="Zomato, cab, electricity…" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eamount">{mode === "items" ? "Bill total ₹" : "Amount ₹"}</Label>
              <Input
                id="eamount"
                inputMode="decimal"
                placeholder={mode === "items" && itemsTotal ? fromPaise(itemsTotal) : "0"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-display text-lg font-bold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Paid by</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger aria-label="Paid by">
                <SelectValue placeholder="Who paid?" />
              </SelectTrigger>
              <SelectContent>
                {group.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>How to split?</Label>
            <div className="grid grid-cols-4 gap-1 rounded-xl border-2 border-ink bg-muted p-1" role="tablist">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  type="button"
                  aria-selected={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "rounded-lg px-1 py-2 text-xs font-semibold transition-colors sm:text-sm",
                    mode === m.id ? "bg-marigold text-ink shadow-ink-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{MODES.find((m) => m.id === mode)?.hint}</p>
          </div>

          {mode === "equal" && (
            <ul className="space-y-1.5">
              {group.members.map((m) => {
                const on = participants.includes(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setParticipants(on ? participants.filter((x) => x !== m.id) : [...participants, m.id])}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors",
                        on ? "border-ink bg-card" : "border-dashed border-border bg-transparent opacity-60",
                      )}
                    >
                      <Avatar name={m.name} size="sm" />
                      <span className="flex-1 font-medium">{m.name}</span>
                      <span className="amount text-sm">
                        {on && result.ok ? formatINR(result.owed[m.id] ?? 0) : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {mode === "exact" && (
            <div className="space-y-2">
              {group.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar name={m.name} size="sm" />
                  <span className="flex-1 font-medium">{m.name}</span>
                  <Input
                    aria-label={`${m.name} owes`}
                    inputMode="decimal"
                    placeholder="0"
                    className="w-28 text-right"
                    value={exact[m.id] ?? ""}
                    onChange={(e) => setExact({ ...exact, [m.id]: e.target.value })}
                  />
                </div>
              ))}
              <p className={cn("text-right text-sm font-semibold", exactAssigned === total ? "text-gain" : "text-owe")}>
                {formatINR(exactAssigned)} of {formatINR(total)} assigned
              </p>
            </div>
          )}

          {mode === "shares" && (
            <div className="space-y-2">
              {group.members.map((m) => {
                const s = shares[m.id] ?? 0;
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.name} size="sm" />
                    <span className="flex-1 font-medium">{m.name}</span>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={`Fewer shares for ${m.name}`} onClick={() => setShares({ ...shares, [m.id]: Math.max(0, s - 1) })}>
                        <Minus />
                      </Button>
                      <span className="amount w-8 text-center">{s}</span>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={`More shares for ${m.name}`} onClick={() => setShares({ ...shares, [m.id]: s + 1 })}>
                        <Plus />
                      </Button>
                    </div>
                    <span className="amount w-20 text-right text-sm">{result.ok ? formatINR(result.owed[m.id] ?? 0) : "—"}</span>
                  </div>
                );
              })}
            </div>
          )}

          {mode === "items" && (
            <div className="space-y-3">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <Button type="button" variant="outline" className="w-full border-dashed" size="lg" disabled={scanning} onClick={() => fileRef.current?.click()}>
                {scanning ? <Loader2 className="animate-spin" /> : <Camera />}
                {scanning ? "Reading your bill…" : items.length ? "Scan a different bill" : "Scan bill photo"}
              </Button>

              {items.map((it) => (
                <div key={it.id} className="rounded-xl border-2 border-ink bg-card p-3">
                  <div className="flex gap-2">
                    <Input aria-label="Item name" placeholder="Item" value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} />
                    <Input aria-label="Item price" inputMode="decimal" placeholder="₹" className="w-24 text-right" value={it.price} onChange={(e) => updateItem(it.id, { price: e.target.value })} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove item" onClick={() => setItems(items.filter((x) => x.id !== it.id))}>
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateItem(it.id, { memberIds: it.memberIds.length === ids.length ? [] : ids })}
                      className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-ink/40 px-2.5 py-0.5 text-xs font-semibold"
                    >
                      <Users className="h-3 w-3" /> All
                    </button>
                    {group.members.map((m) => {
                      const on = it.memberIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => updateItem(it.id, { memberIds: on ? it.memberIds.filter((x) => x !== m.id) : [...it.memberIds, m.id] })}
                          className={cn(
                            "rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold transition-colors",
                            on ? "border-ink bg-marigold text-ink" : "border-border text-muted-foreground",
                          )}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                  {it.memberIds.length === 0 && <p className="mt-1.5 text-xs font-medium text-owe">Tap who had this</p>}
                </div>
              ))}

              <Button type="button" variant="ghost" className="w-full" onClick={() => setItems([...items, { id: uid(), name: "", price: "", memberIds: [] }])}>
                <Plus /> Add item by hand
              </Button>

              {items.length > 0 && (
                <div className="rounded-xl bg-muted p-3 text-sm">
                  <div className="flex justify-between"><span>Items</span><span className="amount">{formatINR(itemsTotal)}</span></div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{total - itemsTotal >= 0 ? "Tax, delivery & fees" : "Discount"}</span>
                    <span className="amount">{formatINR(Math.abs(total - itemsTotal))}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Spread by how much each person ordered.</p>
                </div>
              )}
            </div>
          )}

          {mode !== "equal" && (
            <div className="rounded-xl border-2 border-dashed border-ink/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Each person's share</p>
              {result.ok ? (
                <ul className="space-y-1 text-sm">
                  {Object.entries(result.owed).filter(([, v]) => v !== 0).map(([id, v]) => (
                    <li key={id} className="flex justify-between"><span>{name(id)}</span><span className="amount">{formatINR(v)}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-medium text-owe">{result.error}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {editing && (
              <Button
                type="button"
                variant="outline"
                aria-label="Delete expense"
                onClick={() => {
                  actions.deleteExpense(group.id, editing.id);
                  toast("Expense deleted");
                  onOpenChange(false);
                }}
              >
                <Trash2 />
              </Button>
            )}
            <Button type="button" size="lg" variant="marigold" className="flex-1" onClick={save} disabled={!result.ok}>
              {editing ? "Save changes" : `Add ${total > 0 ? formatINR(total) : "expense"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
