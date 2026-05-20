import { useState, useCallback, useMemo, useEffect } from "react";
import { alertsApi } from "@/services/api";
import { notificationsApi } from "@/services/notificationApi";
import { usePolling } from "@/hooks/usePolling";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination";
import { AlertTriangle, Clock, Search, Shield, CheckCheck, Check, CheckCircle } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";
import type { AlertEvent } from "@/types/api";

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalPages, setTotalPages] = useState(0);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchAlerts = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (severityFilter !== "all") p.set("severity", severityFilter);
    const { data } = await alertsApi.list(p.toString());
    setAlerts(data.items);
    setTotal(data.total);
    setTotalPages(data.total_pages);
  }, [severityFilter, page]);
  usePolling(fetchAlerts, 10000);

  useEffect(() => { setPage(1); }, [severityFilter]);

  const filtered = useMemo(() => {
    if (!search) return alerts;
    return alerts.filter((a) => a.message.toLowerCase().includes(search.toLowerCase()));
  }, [alerts, search]);

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      showSuccess("All notifications marked as read");
    } catch {
      showError("Failed to mark all as read");
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Alerts</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">System alerts and notifications</p>
        </div>
        <Button onClick={handleMarkAllRead} variant="ghost" className="h-9 rounded-xl text-[12px] font-semibold text-teal-600 hover:bg-teal-50 gap-1.5">
          <CheckCheck size={14} /> Mark All Read
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Alerts", value: total, color: "text-slate-600", bg: "bg-slate-50", icon: AlertTriangle },
          { label: "Critical", value: alerts.filter((a) => a.severity === "CRITICAL").length, color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
          { label: "High", value: alerts.filter((a) => a.severity === "HIGH").length, color: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
          { label: "Medium / Low", value: alerts.filter((a) => a.severity === "MEDIUM" || a.severity === "LOW").length, color: "text-amber-600", bg: "bg-amber-50", icon: Shield },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}><Icon size={18} className={color} /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className={`text-[22px] font-bold ${color} mt-0.5`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alerts..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" />
        </div>
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v ?? "all")}>
          <SelectTrigger className="w-40 h-10 rounded-xl border-slate-200 bg-white text-[13px] card-shadow">
            <span className="text-slate-600">{severityFilter === "all" ? "All Severity" : severityFilter}</span>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[12px] text-slate-400 ml-auto font-medium">{total} alerts</span>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-28 pl-6">Severity</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Message</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-32">Status</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-48">Time</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-40 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <span className={`ml-2 inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 uppercase tracking-wide ${
                    a.severity === "CRITICAL" ? "text-red-700 bg-red-50" : a.severity === "HIGH" ? "text-orange-700 bg-orange-50" : a.severity === "MEDIUM" ? "text-amber-700 bg-amber-50" : "text-teal-700 bg-teal-50"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${a.severity === "CRITICAL" ? "bg-red-500 animate-pulse" : a.severity === "HIGH" ? "bg-orange-500" : a.severity === "MEDIUM" ? "bg-amber-400" : "bg-teal-400"}`} />
                    {a.severity}
                  </span>
                </TableCell>
                <TableCell className="text-[13px] text-slate-600">{a.message}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold rounded-lg px-2 py-1 ${
                    a.status === "ACTIVE" ? "text-red-600 bg-red-50"
                    : a.status === "ACKNOWLEDGED" ? "text-amber-600 bg-amber-50"
                    : "text-emerald-600 bg-emerald-50"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === "ACTIVE" ? "bg-red-500" : a.status === "ACKNOWLEDGED" ? "bg-amber-500" : "bg-emerald-500"}`} />
                    {a.status}
                  </span>
                </TableCell>
                <TableCell className="text-[12px] text-slate-400 tabular-nums">
                  <span className="flex items-center gap-1.5"><Clock size={11} />{new Date(a.created_at).toLocaleString()}</span>
                </TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex gap-1 justify-end">
                    {a.status === "ACTIVE" && (
                      <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[10px] font-semibold text-amber-600 hover:bg-amber-50 gap-1"
                        onClick={async () => { try { await alertsApi.acknowledge(a.id); showSuccess("Alert acknowledged"); fetchAlerts(); } catch { showError("Failed"); } }}>
                        <Check size={11} /> Acknowledge
                      </Button>
                    )}
                    {(a.status === "ACTIVE" || a.status === "ACKNOWLEDGED") && (
                      <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50 gap-1"
                        onClick={async () => { try { await alertsApi.resolve(a.id); showSuccess("Alert resolved"); fetchAlerts(); } catch { showError("Failed"); } }}>
                        <CheckCircle size={11} /> Resolve
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3"><Shield size={22} className="text-emerald-400" /></div>
                  <p className="text-[13px] text-slate-700 font-semibold">All clear</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">No active alerts</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
