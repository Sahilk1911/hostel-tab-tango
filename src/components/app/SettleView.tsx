import { useState } from "react";
import { ArrowRight, Check, Copy, PartyPopper, QrCode, Smartphone, Undo2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";
import { directPaymentCount, minimumTransfers, netBalances, type Transfer } from "@/lib/settle";
import { actions } from "@/lib/store";
import type { Group } from "@/lib/types";
import { buildUpiLink, isValidUpi } from "@/lib/upi";
import { cn } from "@/lib/utils";

export function SettleView({ group }: { group: Group }) {
  const balances = netBalances(group);
  const transfers = minimumTransfers(balances);
  const direct = directPaymentCount(group);
  const max = Math.max(1, ...Object.values(balances).map(Math.abs));
  const member = (id: string) => group.members.find((m) => m.id === id);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold">Balances</h2>
        <ul className="mt-3 space-y-2">
          {group.members.map((m) => {
            const v = balances[m.id] ?? 0;
            return (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} size="sm" />
                <span className="w-24 truncate font-medium">{m.name}</span>
                <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("absolute inset-y-0 left-0 rounded-full", v >= 0 ? "bg-gain" : "bg-owe")}
                    style={{ width: `${(Math.abs(v) / max) * 100}%` }}
                  />
                </div>
                <span className={cn("amount w-28 text-right text-sm", v > 0 ? "text-gain" : v < 0 ? "text-owe" : "text-muted-foreground")}>
                  {v === 0 ? "settled" : `${v > 0 ? "gets " : "owes "}${formatINR(Math.abs(v))}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-xl font-bold">Settle up</h2>
          {transfers.length > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{transfers.length} payment{transfers.length > 1 ? "s" : ""}</span>
              {direct > transfers.length ? ` instead of ${direct} — the fewest possible` : " — the fewest possible"}
            </p>
          )}
        </div>
        {transfers.length === 0 ? (
          <div className="ledger-card mt-3 flex flex-col items-center p-8 text-center">
            <PartyPopper className="h-8 w-8" />
            <p className="mt-2 font-display text-lg font-bold">Everyone is settled up</p>
            <p className="text-sm text-muted-foreground">No one owes anything right now.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {transfers.map((t) => (
              <TransferCard key={`${t.from}-${t.to}`} group={group} t={t} fromName={member(t.from)?.name ?? "?"} toMember={member(t.to)} />
            ))}
          </ul>
        )}
      </section>

      {group.payments.length > 0 && (
        <section>
          <h2 className="text-xl font-bold">Paid back</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border-2 border-ink bg-card">
            {group.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Check className="h-4 w-4 text-gain" />
                <span className="flex-1">
                  <b>{member(p.from)?.name ?? "?"}</b> paid <b>{member(p.to)?.name ?? "?"}</b>
                </span>
                <span className="amount">{formatINR(p.amount)}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Undo payment" onClick={() => actions.deletePayment(group.id, p.id)}>
                  <Undo2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TransferCard({
  group,
  t,
  fromName,
  toMember,
}: {
  group: Group;
  t: Transfer;
  fromName: string;
  toMember: Group["members"][number] | undefined;
}) {
  const [showQr, setShowQr] = useState(false);
  const [upiDraft, setUpiDraft] = useState("");
  const toName = toMember?.name ?? "?";
  const hasUpi = !!toMember?.upi && isValidUpi(toMember.upi);
  const link = hasUpi
    ? buildUpiLink({ upi: toMember!.upi, name: toName, amountPaise: t.amount, note: `SplitKaro ${group.name}` })
    : "";

  const saveUpi = () => {
    if (!toMember) return;
    if (!isValidUpi(upiDraft)) {
      toast.error("That doesn't look like a UPI ID (like name@okaxis)");
      return;
    }
    actions.updateMember(group.id, { ...toMember, upi: upiDraft.trim() });
    setUpiDraft("");
  };

  return (
    <li className="ledger-card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={fromName} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-medium">
            {fromName} <ArrowRight className="h-4 w-4 shrink-0" /> {toName}
          </p>
          <p className="text-xs text-muted-foreground">{hasUpi ? toMember!.upi : "No UPI ID yet"}</p>
        </div>
        <span className="amount text-2xl">{formatINR(t.amount)}</span>
      </div>

      {hasUpi ? (
        <>
          <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
            <Button asChild variant="marigold">
              <a href={link}>
                <Smartphone /> Pay with UPI app
              </a>
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Show QR code" onClick={() => setShowQr(!showQr)}>
              <QrCode />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              aria-label="Copy UPI link"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success("UPI link copied — paste it in WhatsApp");
              }}
            >
              <Copy />
            </Button>
          </div>
          {showQr && (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-card p-4">
              <div className="rounded-lg border-2 border-ink bg-card p-3">
                <QRCodeSVG value={link} size={168} />
              </div>
              <p className="text-xs text-muted-foreground">Scan with GPay, PhonePe or Paytm</p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 flex gap-2">
          <Input
            aria-label={`${toName}'s UPI ID`}
            placeholder={`${toName}'s UPI ID, e.g. ${toName.toLowerCase().split(" ")[0]}@okaxis`}
            value={upiDraft}
            onChange={(e) => setUpiDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveUpi()}
          />
          <Button variant="outline" onClick={saveUpi}>Save</Button>
        </div>
      )}

      <Button
        variant="ghost"
        className="mt-2 w-full text-gain"
        onClick={() => {
          actions.addPayment(group.id, { from: t.from, to: t.to, amount: t.amount });
          toast.success(`Marked ${fromName} → ${toName} as paid`);
        }}
      >
        <Check /> Mark as paid
      </Button>
    </li>
  );
}
