import { Construction } from "lucide-react";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="glass rounded-2xl p-16 text-center">
        <Construction size={48} className="text-slate-200 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">{title}</h1>
        <p className="text-sm text-slate-400">This page is under development</p>
      </div>
    </div>
  );
}
