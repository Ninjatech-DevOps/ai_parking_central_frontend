import { useState, useCallback, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { showSuccess, showError } from "@/lib/toast";
import { areasApi } from "@/services/api";
import { useFilter } from "@/contexts/FilterContext";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Plus, Pencil, Trash2, Globe, MapPin, Search } from "lucide-react";
import LocationManagementSkeleton from "@/components/skeletons/LocationManagementSkeleton";
import type { Area } from "@/types/api";

export default function LocationManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("locations:create");
  const canEdit = hasPermission("locations:edit");
  const canDelete = hasPermission("locations:delete");
  const { cityId, cityName } = useFilter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAreas = useCallback(async () => {
    if (!cityId) { setLoading(false); return; }
    try {
      const { data } = await areasApi.list(`city_id=${cityId}&page_size=500`);
      const cityLevel = (data.items || []).filter((a: Area) => !a.taluka_id);
      setAreas(cityLevel);
      setTotal(cityLevel.length);
    } finally {
      setLoading(false);
    }
  }, [cityId]);
  usePolling(fetchAreas, 30000);

  function openCreate() { setEditingId(null); setFormName(""); setShowForm(true); }
  function openEdit(id: string, name: string) { setEditingId(id); setFormName(name); setShowForm(true); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true);
    try {
      if (editingId) {
        await areasApi.update(editingId, { name: formName });
      } else {
        await areasApi.create({ name: formName, city_id: cityId, taluka_id: null, village_id: null });
      }
      setShowForm(false);
      showSuccess(editingId ? "Area updated" : "Area created");
      fetchAreas();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Operation failed");
    } finally { setFormSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setDeleteLoading(true);
    try {
      await areasApi.delete(deleting.id);
      setDeleting(null);
      showSuccess("Area deleted");
      fetchAreas();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Operation failed");
    } finally { setDeleteLoading(false); }
  }

  const filtered = areas.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  if (loading && areas.length === 0) return <LocationManagementSkeleton />;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Area Management</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Manage areas under <span className="font-semibold text-slate-700">{cityName}</span>
            <span className="text-slate-300 mx-1.5">·</span>
            <span className="text-[11px] text-slate-400">Gujarat</span>
          </p>
        </div>
        {canCreate && <Button onClick={openCreate} disabled={!cityId} className="h-10 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold gap-2 shadow-md shadow-teal-600/20 disabled:opacity-40">
          <Plus size={16} /> Add Area
        </Button>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center"><Globe size={18} className="text-teal-600" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Areas</p>
            <p className="text-[22px] font-bold text-teal-600 mt-0.5">{total}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center"><MapPin size={18} className="text-slate-500" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">City</p>
            <p className="text-[16px] font-bold text-slate-700 mt-0.5">{cityName}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center"><MapPin size={18} className="text-violet-500" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">State</p>
            <p className="text-[16px] font-bold text-slate-700 mt-0.5">Gujarat</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search areas..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" />
        </div>
        <span className="text-[12px] text-slate-400 ml-auto font-medium">{filtered.length} areas</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Area Name</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((area) => (
              <TableRow key={area.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center"><Globe size={14} className="text-teal-600" /></div>
                    <span className="text-[13px] font-semibold text-slate-800">{area.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                    {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEdit(area.id, area.name)}><Pencil size={13} /></Button>}
                    {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting({ id: area.id, name: area.name })}><Trash2 size={13} /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><Globe size={22} className="text-slate-300" /></div>
                  <p className="text-[13px] text-slate-400 font-medium">{search ? "No areas match your search" : "No areas yet"}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit */}
      <CrudDialog open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Area" : "Add Area"}>
        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Area Name</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Memnagar, Satellite" className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required />
          </div>
          {!editingId && (
            <div className="text-[12px] text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
              Creating under: <span className="font-semibold text-slate-700">{cityName}, Gujarat</span>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold">{formSaving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Area" description={`Remove "${deleting?.name}" permanently?`} loading={deleteLoading} />
    </div>
  );
}
