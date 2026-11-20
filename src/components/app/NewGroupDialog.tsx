import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions } from "@/lib/store";

export function NewGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const addPerson = () => {
    const n = draft.trim();
    if (!n || people.some((p) => p.toLowerCase() === n.toLowerCase())) return;
    setPeople([...people, n]);
    setDraft("");
  };

  const all = draft.trim() ? [...people, draft.trim()] : people;
  const canCreate = name.trim() && all.length >= 2;

  const create = () => {
    if (!canCreate) return;
    const id = actions.createGroup(name.trim(), all);
    onOpenChange(false);
    setName("");
    setPeople([]);
    setDraft("");
    navigate({ to: "/group/$groupId", params: { groupId: id } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New group</DialogTitle>
          <DialogDescription>A room, a trip, a flat — anyone you share costs with.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gname">Group name</Label>
            <Input id="gname" placeholder="e.g. Room 112, Goa trip" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pname">People (at least 2)</Label>
            <div className="flex gap-2">
              <Input
                id="pname"
                placeholder="Type a name and press Enter"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPerson();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addPerson} aria-label="Add person">
                <Plus />
              </Button>
            </div>
            {people.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {people.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-marigold-soft px-3 py-1 text-sm font-medium">
                    {p}
                    <button type="button" onClick={() => setPeople(people.filter((x) => x !== p))} aria-label={`Remove ${p}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button className="w-full" size="lg" variant="marigold" disabled={!canCreate} onClick={create}>
            Create group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
