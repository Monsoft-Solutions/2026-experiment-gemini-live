import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Persona } from "@/types";
import { PhoneNumbersPanel } from "./phone-numbers-panel";
import { TwilioConfigForm } from "./twilio-config-form";

interface AdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personas: Persona[];
}

export function AdminModal({ open, onOpenChange, personas }: AdminModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            ⚙️ Admin Settings
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-80px)]">
          <div className="space-y-6 px-6 pb-6">
            {/* Twilio Config */}
            <TwilioConfigForm />

            <Separator />

            {/* Phone Numbers */}
            <PhoneNumbersPanel personas={personas} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
