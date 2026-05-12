import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ open, onClose, onConfirm, title, description, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; loading?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white rounded-2xl border-0 card-shadow-lg max-w-sm p-6">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-slate-900">{title}</DialogTitle>
              <DialogDescription className="text-[13px] text-slate-500 mt-1">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} className="rounded-xl text-[13px]">Cancel</Button>
          <Button onClick={onConfirm} disabled={loading} className="rounded-xl bg-red-600 hover:bg-red-700 text-[13px] font-semibold shadow-md shadow-red-600/20">
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
