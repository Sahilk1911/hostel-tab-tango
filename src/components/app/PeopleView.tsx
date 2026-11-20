import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions } from "@/lib/store";
import type { Group, Member } from "@/lib/types";
import { isValidUpi } from "@/lib/upi";
import { cn } from "@/lib/utils";

export function PeopleView({ group }: { group: Group }) {
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");

  const used = (id: string) =>
    group.expenses.some(
      (e) =>
        e.paidBy === id ||
        e.participants.includes(id) ||
        (e.exact[id] ?? 0) > 0 ||
        (e.shares[id] ?? 0) > 0 ||
        e.items.some((it) => it.memberIds.includes(id)),
    ) || group.payments.some((p) => p.from === id || p.to === id);

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    actions.addMember(group.id, n);
    setNewName("");
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Add each person's UPI ID so others can pay them in one tap.</p>
      <ul className="space-y-3">
        {group.members.map((m) => (
          <MemberRow key={m.id} groupId={group.id} m={m} canRemove={!used(m.id)} />
        ))}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="Add a person" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add}>
          <Plus /> Add
        </Button>
      </div>

      <div className="border-t border-dashed border-ink/30 pt-6">
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            if (!window.confirm(`Delete "${group.name}" and all its expenses?`)) return;
            actions.deleteGroup(group.id);
            navigate({ to: "/" });
          }}
        >
          <Trash2 /> Delete this group
        </Button>
      </div>
    </div>
  );
}

function MemberRow({ groupId, m, canRemove }: { groupId: string; m: Member; canRemove: boolean }) {
  const [name, setName] = useState(m.name);
  const [upi, setUpi] = useState(m.upi);
  const bad = upi.trim() !== "" && !isValidUpi(upi);

  const commit = () => {
    if (!name.trim()) {
      setName(m.name);
      return;
    }
    if (bad) return;
    if (name.trim() !== m.name || upi.trim() !== m.upi) {
      actions.updateMember(groupId, { ...m, name: name.trim(), upi: upi.trim() });
      toast.success("Saved");
    }
  };

  return (
    <li className="ledger-card flex items-start gap-3 p-3">
      <Avatar name={name || m.name} />
      <div className="grid flex-1 gap-2 sm:grid-cols-2">
        <Input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} />
        <div>
          <Input
            aria-label={`${m.name}'s UPI ID`}
            placeholder="UPI ID (name@okaxis)"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            onBlur={commit}
            className={cn(bad && "border-owe")}
          />
          {bad && <p className="mt-1 text-xs text-owe">Should look like name@bank</p>}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${m.name}`}
        disabled={!canRemove}
        title={canRemove ? "Remove" : "Part of an expense — can't remove"}
        onClick={() => actions.removeMember(groupId, m.id)}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
