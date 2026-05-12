import { useState, useCallback, useMemo } from "react";
import { alertsApi } from "@/services/api";
import { useFilter } from "@/contexts/FilterContext";
import { usePolling } from "@/hooks/usePolling";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Clock, Search, Shield } from "lucide-react";
import type { AlertEvent, PaginatedResponse } from "@/types/api";

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]); const [total, setTotal] = useState(0);
  const [severityFilter, setSeverityFilter] = useState("all"); const [search, setSearch] = useState("");

  const fetchAlerts = useCallback(async () => { const p = new URLSearchParams({ page_size: "50" }); if (severityFilter !== "all") p.set("severity", severityFilter); const { data } = await alertsApi.list(p.toString()); setAlerts(data.items); setTotal(data.total); }, [severityFilter]);
  usePolling(fetchAlerts, 10000);

  const filtered = useMemo(() => {
    if (!search) return alerts;
    return alerts.filter((a) => a.message.toLowerCase().includes(search.toLowerCase()));
  }, [alerts, search]);

  return (
    <div className="max-w-[1360px]">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-[22px] font-bold text-slate-900">Alerts</h1><p className="text-[13px] text-slate-500 mt-0.5">System alerts and notifications</p></div>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all"><Search size={15} className="text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alerts..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" /></div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}><SelectTrigger className="w-40 h-10 rounded-xl border-slate-200 bg-white text-[13px] card-shadow"><span className="text-slate-600">{severityFilter === "all" ? "All Severity" : severityFilter}</span></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="all">All Severity</SelectItem><SelectItem value="CRITICAL">Critical</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="LOW">Low</SelectItem></SelectContent></Select>
        <span className="text-[12px] text-slate-400 ml-auto font-medium">{total} alerts</span>
      </div>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader><TableRow className="border-b border-slate-100"><TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-28">Severity</TableHead><TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Message</TableHead><TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-48">Time</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <TableCell><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 uppercase tracking-wide ${a.severity === "CRITICAL" ? "text-red-700 bg-red-50" : a.severity === "HIGH" ? "text-orange-700 bg-orange-50" : a.severity === "MEDIUM" ? "text-amber-700 bg-amber-50" : "text-teal-700 bg-teal-50"}`}><span className={`w-1.5 h-1.5 rounded-full ${a.severity === "CRITICAL" ? "bg-red-500 animate-pulse" : a.severity === "HIGH" ? "bg-orange-500" : a.severity === "MEDIUM" ? "bg-amber-400" : "bg-teal-400"}`} />{a.severity}</span></TableCell>
                <TableCell className="text-[13px] text-slate-600">{a.message}</TableCell>
                <TableCell className="text-[12px] text-slate-400 tabular-nums"><span className="flex items-center gap-1.5"><Clock size={11} />{new Date(a.created_at).toLocaleString()}</span></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-16"><div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3"><Shield size={22} className="text-emerald-400" /></div><p className="text-[13px] text-slate-700 font-semibold">All clear</p><p className="text-[12px] text-slate-400 mt-0.5">No active alerts</p></TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
