import { type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CrudDialog({ open, onClose, title, children, maxWidth }: { open: boolean; onClose: () => void; title: string; children: ReactNode; maxWidth?: string }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="bg-white rounded-2xl border-0 card-shadow-lg p-6"
        style={{ maxWidth: maxWidth || 512 }}
      >
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-slate-900">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
