import { useState, useEffect, type FormEvent } from "react";
import { showSuccess, showError } from "@/lib/toast";
import { citiesApi, talukasApi, villagesApi, areasApi, statesApi } from "@/services/api";
import SearchSelect from "@/components/SearchSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Plus, Pencil, Trash2, Building, MapPin, Home, Globe } from "lucide-react";
import type { City, Taluka, Village, Area, PaginatedResponse } from "@/types/api";

type Tab = "cities" | "talukas" | "villages" | "areas";

export default function LocationManagement() {
  const [tab, setTab] = useState<Tab>("cities");
  const [stateId, setStateId] = useState("");

  const [cities, setCities] = useState<City[]>([]);
  const [talukas, setTalukas] = useState<Taluka[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [filterCityId, setFilterCityId] = useState("");
  const [filterTalukaId, setFilterTalukaId] = useState("");
  const [filterVillageId, setFilterVillageId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load state
  useEffect(() => {
    statesApi.list().then(({ data }) => {
      const gj = data.items.find((s) => s.code === "GJ");
      if (gj) setStateId(gj.id);
    });
  }, []);

  // Load cities
  useEffect(() => {
    if (stateId) citiesApi.byState(stateId).then(({ data }) => setCities(data.items));
  }, [stateId]);

  // Load talukas when city selected
  useEffect(() => {
    if (!filterCityId) { setTalukas([]); setFilterTalukaId(""); setFilterVillageId(""); return; }
    talukasApi.byCity(filterCityId).then(({ data }) => setTalukas(data.items));
  }, [filterCityId]);

  // Load villages when taluka selected
  useEffect(() => {
    if (!filterTalukaId) { setVillages([]); setFilterVillageId(""); return; }
    villagesApi.byTaluka(filterTalukaId).then(({ data }) => setVillages(data.items));
  }, [filterTalukaId]);

  // Load areas based on filters
  useEffect(() => {
    if (!filterCityId) { setAreas([]); return; }
    if (filterVillageId) {
      // Specific village → only that village's areas
      areasApi.list(`village_id=${filterVillageId}&page_size=500`).then(({ data }) => setAreas(data.items));
    } else if (filterTalukaId) {
      // Taluka selected, no village → taluka-level areas only (village_id is null)
      areasApi.list(`taluka_id=${filterTalukaId}&page_size=500`).then(({ data }) => {
        setAreas(data.items.filter((a: Area) => !a.village_id));
      });
    } else {
      // City selected, no taluka → city-level areas only (taluka_id is null)
      areasApi.list(`city_id=${filterCityId}&page_size=500`).then(({ data }) => {
        setAreas(data.items.filter((a: Area) => !a.taluka_id));
      });
    }
  }, [filterCityId, filterTalukaId, filterVillageId]);

  function refreshCurrentTab() {
    if (tab === "cities") citiesApi.byState(stateId).then(({ data }) => setCities(data.items));
    else if (tab === "talukas" && filterCityId) talukasApi.byCity(filterCityId).then(({ data }) => setTalukas(data.items));
    else if (tab === "villages" && filterTalukaId) villagesApi.byTaluka(filterTalukaId).then(({ data }) => setVillages(data.items));
    else if (tab === "areas" && filterCityId) {
      if (filterVillageId) areasApi.list(`village_id=${filterVillageId}&page_size=500`).then(({ data }) => setAreas(data.items));
      else if (filterTalukaId) areasApi.list(`taluka_id=${filterTalukaId}&page_size=500`).then(({ data }) => setAreas(data.items.filter((a: Area) => !a.village_id)));
      else areasApi.list(`city_id=${filterCityId}&page_size=500`).then(({ data }) => setAreas(data.items.filter((a: Area) => !a.taluka_id)));
    }
  }

  function openCreate() { setEditingId(null); setFormName(""); setShowForm(true); }
  function openEdit(id: string, name: string) { setEditingId(id); setFormName(name); setShowForm(true); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true);
    try {
      if (tab === "cities") {
        editingId ? await citiesApi.update(editingId, { name: formName }) : await citiesApi.create({ name: formName, state_id: stateId });
      } else if (tab === "talukas") {
        editingId ? await talukasApi.update(editingId, { name: formName }) : await talukasApi.create({ name: formName, city_id: filterCityId });
      } else if (tab === "villages") {
        editingId ? await villagesApi.update(editingId, { name: formName }) : await villagesApi.create({ name: formName, taluka_id: filterTalukaId });
      } else if (tab === "areas") {
        editingId ? await areasApi.update(editingId, { name: formName }) : await areasApi.create({
          name: formName,
          city_id: filterCityId,
          taluka_id: filterTalukaId || null,
          village_id: filterVillageId || null,
        });
      }
      setShowForm(false);
      refreshCurrentTab();
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setFormSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setDeleteLoading(true);
    try {
      if (tab === "cities") await citiesApi.delete(deleting.id);
      else if (tab === "talukas") await talukasApi.delete(deleting.id);
      else if (tab === "villages") await villagesApi.delete(deleting.id);
      else if (tab === "areas") await areasApi.delete(deleting.id);
      setDeleting(null);
      refreshCurrentTab();
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setDeleteLoading(false); }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "cities", label: "Cities", icon: Building },
    { id: "talukas", label: "Talukas", icon: MapPin },
    { id: "villages", label: "Villages", icon: Home },
    { id: "areas", label: "Areas", icon: Globe },
  ];

  const currentData: any[] = tab === "cities" ? cities : tab === "talukas" ? talukas : tab === "villages" ? villages : areas;

  const canCreate = tab === "cities" ||
    (tab === "talukas" && !!filterCityId) ||
    (tab === "villages" && !!filterTalukaId) ||
    (tab === "areas" && !!filterCityId);

  const entityName = tab === "cities" ? "City" : tab === "talukas" ? "Taluka" : tab === "villages" ? "Village" : "Area";

  return (
    <div className="max-w-[1360px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Geography Management</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage location hierarchy for Gujarat state</p>
        </div>
        <Button onClick={openCreate} disabled={!canCreate} className="h-10 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold gap-2 shadow-md shadow-teal-600/20 disabled:opacity-40">
          <Plus size={16} /> Add {entityName}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl p-1 card-shadow w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${tab === id ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab !== "cities" && (
        <div className="flex gap-3 mb-4">
          <SearchSelect
            value={filterCityId || "_"} onValueChange={(v) => { setFilterCityId(v === "_" ? "" : v); setFilterTalukaId(""); setFilterVillageId(""); }}
            options={[{ value: "_", label: "Select City" }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
            placeholder="Select City" searchPlaceholder="Search city..." className="w-48"
          />

          {(tab === "villages" || tab === "areas") && filterCityId && talukas.length > 0 && (
            <SearchSelect
              value={filterTalukaId || "_"} onValueChange={(v) => { setFilterTalukaId(v === "_" ? "" : v); setFilterVillageId(""); }}
              options={[{ value: "_", label: "All Talukas" }, ...talukas.map((t) => ({ value: t.id, label: t.name }))]}
              placeholder="All Talukas" searchPlaceholder="Search taluka..." className="w-48"
            />
          )}

          {tab === "areas" && filterTalukaId && villages.length > 0 && (
            <SearchSelect
              value={filterVillageId || "_"} onValueChange={(v) => setFilterVillageId(v === "_" ? "" : v)}
              options={[{ value: "_", label: "All Villages" }, ...villages.map((v2) => ({ value: v2.id, label: v2.name }))]}
              placeholder="All Villages" searchPlaceholder="Search village..." className="w-48"
            />
          )}

          <span className="text-[12px] text-slate-400 ml-auto font-medium self-center">{currentData.length} items</span>
        </div>
      )}
      {tab === "cities" && (
        <div className="flex mb-4"><span className="text-[12px] text-slate-400 ml-auto font-medium">{cities.length} cities</span></div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Name</TableHead>
              {tab === "areas" && <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Level</TableHead>}
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((item: any) => (
              <TableRow key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <TableCell className="text-[13px] font-semibold text-slate-800">{item.name}</TableCell>
                {tab === "areas" && (
                  <TableCell>
                    <span className={`text-[11px] font-bold rounded-lg px-2 py-0.5 ${
                      item.village_id ? "text-violet-700 bg-violet-50" :
                      item.taluka_id ? "text-amber-700 bg-amber-50" :
                      "text-teal-700 bg-teal-50"
                    }`}>
                      {item.village_id ? "Village" : item.taluka_id ? "Taluka" : "City"}
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEdit(item.id, item.name)}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting({ id: item.id, name: item.name })}><Trash2 size={13} /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {currentData.length === 0 && (
              <TableRow>
                <TableCell colSpan={tab === "areas" ? 3 : 2} className="text-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <Globe size={22} className="text-slate-300" />
                  </div>
                  <p className="text-[13px] text-slate-400 font-medium">
                    {tab === "cities" ? "No cities" :
                     !filterCityId ? "Select a city first" :
                     tab === "villages" && !filterTalukaId ? "Select a taluka first" :
                     `No ${tab}`}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit */}
      <CrudDialog open={showForm} onClose={() => setShowForm(false)} title={editingId ? `Edit ${entityName}` : `Add ${entityName}`}>
        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <div><Label className="text-[13px] font-semibold text-slate-700">Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={`Enter ${entityName.toLowerCase()} name`} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required /></div>
          {!editingId && tab !== "cities" && (
            <div className="text-[12px] text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
              Creating under: <span className="font-semibold text-slate-700">
                {tab === "talukas" && cities.find((c) => c.id === filterCityId)?.name}
                {tab === "villages" && talukas.find((t) => t.id === filterTalukaId)?.name}
                {tab === "areas" && (filterVillageId ? villages.find((v) => v.id === filterVillageId)?.name : filterTalukaId ? talukas.find((t) => t.id === filterTalukaId)?.name : cities.find((c) => c.id === filterCityId)?.name)}
              </span>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold">{formSaving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title={`Delete ${entityName}`} description={`Remove "${deleting?.name}" permanently?`} loading={deleteLoading} />
    </div>
  );
}
