import { useState, useCallback, useEffect, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { showSuccess, showError } from "@/lib/toast";
import { locationsApi, citiesApi, talukasApi, villagesApi, areasApi } from "@/services/api";
import { useNavigate } from "react-router-dom";
import SearchSelect from "@/components/SearchSelect";
import { useFilter } from "@/contexts/FilterContext";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Plus, Pencil, Trash2, Search, MapPin, Eye } from "lucide-react";
import type { Location, City, Taluka, Village, Area } from "@/types/api";

export default function Locations() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("locations:create");
  const canEdit = hasPermission("locations:edit");
  const canDelete = hasPermission("locations:delete");
  const navigate = useNavigate();
  const { filterLabel, queryParams, cityId, areas: globalAreas } = useFilter();
  const [locations, setLocations] = useState<Location[]>([]); const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null); const [deleteLoading, setDeleteLoading] = useState(false);

  // Form state — hierarchy selectors
  const [formCities, setFormCities] = useState<City[]>([]);
  const [, setFormTalukas] = useState<Taluka[]>([]);
  const [, setFormVillages] = useState<Village[]>([]);
  const [, setFormAreas] = useState<Area[]>([]);
  const [formCityId, setFormCityId] = useState("");
  const [formTalukaId, setFormTalukaId] = useState("");
  const [formVillageId, setFormVillageId] = useState("");
  const [formAreaId, setFormAreaId] = useState("");
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [formType, setFormType] = useState("OPEN");
  const [formCapacity, setFormCapacity] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Load all lookup data for name resolution + form
  const [allTalukas, setAllTalukas] = useState<Taluka[]>([]);
  const [allVillages, setAllVillages] = useState<Village[]>([]);
  const [allAreas, setAllAreas] = useState<Area[]>([]);

  useEffect(() => {
    citiesApi.list("page_size=100").then(({ data }) => setFormCities(data.items));
    talukasApi.list("page_size=500").then(({ data }) => setAllTalukas(data.items));
    villagesApi.list("page_size=500").then(({ data }) => setAllVillages(data.items));
    areasApi.list("page_size=1000").then(({ data }) => setAllAreas(data.items));
  }, []);

  // Cascade: city → talukas + areas
  useEffect(() => {
    if (!formCityId) { setFormTalukas([]); setFormAreas([]); return; }
    talukasApi.byCity(formCityId).then(({ data }) => setFormTalukas(data.items));
    areasApi.byCity(formCityId).then(({ data }) => setFormAreas(data.items));
  }, [formCityId]);

  // Cascade: taluka → villages
  useEffect(() => {
    if (!formTalukaId) { setFormVillages([]); return; }
    villagesApi.byTaluka(formTalukaId).then(({ data }) => setFormVillages(data.items));
  }, [formTalukaId]);

  const fetchLocations = useCallback(async () => {
    const params = queryParams ? `page_size=100&${queryParams}` : "page_size=100";
    const { data } = await locationsApi.list(params);
    setLocations(data.items); setTotal(data.total);
  }, [queryParams]);
  usePolling(fetchLocations, 15000);

  function openCreate() {
    setEditing(null); setFormCityId(cityId); setFormTalukaId(""); setFormVillageId(""); setFormAreaId("");
    setFormName(""); setFormAddress(""); setFormLat(""); setFormLng(""); setFormType("OPEN"); setFormCapacity("");
    setShowForm(true);
  }
  function openEdit(l: Location) {
    setEditing(l);
    setFormCityId(l.city_id || "");
    setFormTalukaId(l.taluka_id || "");
    setFormVillageId(l.village_id || "");
    setFormAreaId(l.area_id || "");
    setFormName(l.name); setFormAddress(l.address || "");
    setFormLat(l.latitude?.toString() || ""); setFormLng(l.longitude?.toString() || "");
    setFormType(l.location_type); setFormCapacity(l.total_capacity.toString());
    setShowForm(true);
  }

  const [formError, setFormError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true); setFormError("");
    try {
      const p: Record<string, unknown> = {
        name: formName, city_id: formCityId,
        taluka_id: formTalukaId || null, village_id: formVillageId || null,
        address: formAddress || null,
        latitude: formLat ? parseFloat(formLat) : null, longitude: formLng ? parseFloat(formLng) : null,
        location_type: formType, total_capacity: parseInt(formCapacity) || 0,
      };
      if (formAreaId) p.area_id = formAreaId;
      editing ? await locationsApi.update(editing.id, p) : await locationsApi.create(p);
      setShowForm(false); showSuccess(editing ? "Updated" : "Created"); fetchLocations();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || "Failed to save");
    } finally { setFormSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setDeleteLoading(true);
    try { await locationsApi.delete(deleting.id); setDeleting(null); showSuccess("Deleted"); fetchLocations(); } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setDeleteLoading(false); }
  }

  const filtered = locations.filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Locations</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage parking locations · <span className="font-medium text-slate-600">{filterLabel}</span></p>
        </div>
        {canCreate && <Button onClick={openCreate} className="h-10 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold gap-2 shadow-md shadow-teal-600/20">
          <Plus size={16} /> New Location
        </Button>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {(() => {
          const active = locations.filter((l) => l.is_active).length;
          const totalCap = locations.reduce((s, l) => s + (l.total_capacity || 0), 0);
          return [
            { label: "Total Locations", value: total, color: "text-slate-600", bg: "bg-slate-50" },
            { label: "Active", value: active, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Inactive", value: total - active, color: "text-red-600", bg: "bg-red-50" },
            { label: "Total Capacity", value: totalCap, color: "text-teal-600", bg: "bg-teal-50" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}><MapPin size={18} className={color} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className={`text-[22px] font-bold ${color} mt-0.5`}>{value}</p>
              </div>
            </div>
          ));
        })()}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search locations..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" />
        </div>
        <span className="text-[12px] text-slate-400 ml-auto font-medium">{total} locations</span>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">City</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taluka</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Village</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Area</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Capacity</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <TableCell><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center"><MapPin size={14} className="text-violet-500" /></div><span className="text-[13px] font-semibold text-slate-800">{l.name}</span></div></TableCell>
                <TableCell className="text-[13px] text-slate-600">{formCities.find((c) => c.id === l.city_id)?.name || "—"}</TableCell>
                <TableCell className="text-[13px] text-slate-500">{allTalukas.find((t) => t.id === l.taluka_id)?.name || "—"}</TableCell>
                <TableCell className="text-[13px] text-slate-500">{allVillages.find((v) => v.id === l.village_id)?.name || "—"}</TableCell>
                <TableCell className="text-[13px] text-slate-500">{allAreas.find((a) => a.id === l.area_id)?.name || "—"}</TableCell>
                <TableCell><span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1 uppercase tracking-wide">{l.location_type}</span></TableCell>
                <TableCell className="text-[13px] text-slate-600 font-semibold">{l.total_capacity}</TableCell>
                <TableCell><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${l.is_active ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}><span className={`w-1.5 h-1.5 rounded-full ${l.is_active ? "bg-emerald-500" : "bg-red-500"}`} />{l.is_active ? "Active" : "Inactive"}</span></TableCell>
                <TableCell className="text-right"><div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-teal-50 hover:text-teal-600" onClick={() => navigate(`/parking-lots/${l.id}`)}><Eye size={14} /></Button>{canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEdit(l)}><Pencil size={14} /></Button>}{canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(l)}><Trash2 size={14} /></Button>}</div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit with cascading hierarchy */}
      <CrudDialog open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Location" : "New Location"}>
        <form onSubmit={handleSubmit} className="space-y-5 mt-3">
          {formError && <div className="text-[13px] text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{formError}</div>}
          <div><Label className="text-[13px] font-semibold text-slate-700">Location Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Phoenix Mall Parking" className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required /></div>

          {/* Area selector (city locked to Ahmedabad) */}
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Area *</Label>
            <div className="mt-2">
              <SearchSelect value={formAreaId || "_"} onValueChange={(v) => setFormAreaId(v === "_" ? "" : v)}
                options={[{ value: "_", label: "Select area" }, ...globalAreas.map((a) => ({ value: a.id, label: a.name }))]}
                placeholder="Select area" searchPlaceholder="Search area..." className="w-full" />
            </div>
          </div>

          <div><Label className="text-[13px] font-semibold text-slate-700">Address</Label><Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" /></div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-[13px] font-semibold text-slate-700">Latitude</Label><Input value={formLat} onChange={(e) => setFormLat(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" /></div>
            <div><Label className="text-[13px] font-semibold text-slate-700">Longitude</Label><Input value={formLng} onChange={(e) => setFormLng(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-[13px] font-semibold text-slate-700">Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v ?? "OPEN")}><SelectTrigger className="mt-2 h-10 rounded-xl text-[13px] border-slate-200"><span>{formType}</span></SelectTrigger><SelectContent className="rounded-xl">{["MALL","STREET","OPEN","COMMERCIAL","RESIDENTIAL"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label className="text-[13px] font-semibold text-slate-700">Capacity</Label><Input type="number" value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" /></div>
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving || (!editing && !formCityId)} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold shadow-md shadow-teal-600/20">{formSaving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Location" description={`Remove "${deleting?.name}" permanently?`} loading={deleteLoading} />
    </div>
  );
}
