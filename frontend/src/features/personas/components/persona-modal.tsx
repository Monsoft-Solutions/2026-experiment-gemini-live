import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Persona } from "@/types";

interface PersonaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: Persona | null;
  onSave: (name: string) => void;
  onDelete: () => void;
}

export function PersonaModal({
  open,
  onOpenChange,
  persona,
  onSave,
  onDelete,
}: PersonaModalProps) {
  const [name, setName] = useState("");
  const isEditing = !!persona;

  useEffect(() => {
    if (open) {
      setName(persona?.name ?? "");
    }
  }, [open, persona]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Persona" : "Save as Persona"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Persona Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales Assistant"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2">
          {isEditing && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
