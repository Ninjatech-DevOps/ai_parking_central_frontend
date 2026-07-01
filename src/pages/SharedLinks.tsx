import { useState, useCallback, useEffect, type FormEvent } from "react";
import { Plus, Link2, Copy, Trash2, ToggleLeft, ToggleRight, ExternalLink, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import SearchSelect from "@/components/SearchSelect";
import Pagination from "@/components/Pagination";
import { sharedLinksApi, areasApi, locationsApi, devicesApi, camerasApi } from "@/services/api";
import { showSuccess, showError } from "@/lib/toast";
import SharedLinksSkeleton from "@/components/skeletons/SharedLinksSkeleton";
import type { SharedLink, Area, Location, Camera } from "@/types/api";

const SCOPE_OPTIONS = [
  { value: "AREA", label: "Area" },
  { value: "LOCATION", label: "Location" },
  { value: "CAMERA", label: "Camera(s)" },
];

const EXPIRY_OPTIONS = [
  { value: "", label: "Never" },
  { value: "1", label: "1 Day" },
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
];

const PAGE_OPTIONS = [
  { value: "dashboard_parking", label: "Dashboard - AI Parking" },
  { value: "dashboard_anpr", label: "Dashboard - ANPR" },
  { value: "parking_history", label: "AI Parking History" },
  { value: "anpr_records", label: "ANPR Records" },
  { value: "anpr_history", label: "ANPR History" },
];

const FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  anpr_records: [
    { value: "image", label: "Image" },
    { value: "number_plate", label: "Number Plate" },
    { value: "vehicle_type", label: "Vehicle Type" },
    { value: "direction", label: "Direction" },
    { value: "date_time", label: "Date & Time" },
    { value: "gemini", label: "Gemini Result" },
    { value: "paddle", label: "Paddle Result" },
    { value: "location", label: "Location" },
  ],
  anpr_history: [
    { value: "image", label: "Image" },
    { value: "number_plate", label: "Number Plate" },
    { value: "vehicle_type", label: "Vehicle Type" },
    { value: "entry_time", label: "Entry Time" },
    { value: "exit_time", label: "Exit Time" },
    { value: "duration", label: "Duration" },
    { value: "status", label: "Status" },
    { value: "location", label: "Location" },
  ],
  parking_history: [
    { value: "date", label: "Date" },
    { value: "time", label: "Time" },
    { value: "image", label: "Image" },
    { value: "location", label: "Location" },
    { value: "device", label: "Device" },
    { value: "car_occupied", label: "Car Occupied" },
    { value: "car_available", label: "Car Available" },
    { value: "car_total", label: "Car Total" },
    { value: "2w_occupied", label: "2W Occupied" },
    { value: "2w_available", label: "2W Available" },
    { value: "2w_total", label: "2W Total" },
  ],
};

function timeUntil(dateStr: string): string {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  const diff = target - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return hrs > 0 ? `in ${days}d ${hrs}h` : `in ${days}d`;
  if (hrs > 0) return mins > 0 ? `in ${hrs}h ${mins}m` : `in ${hrs}h`;
  return `in ${mins}m`;
}

export default function SharedLinks() {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Search & filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SharedLink | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formScopeType, setFormScopeType] = useState("LOCATION");
  const [formAreaFilter, setFormAreaFilter] = useState("");
  const [formScopeId, setFormScopeId] = useState("");
  const [formCameraIds, setFormCameraIds] = useState<string[]>([]);
  const [formExpiry, setFormExpiry] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPages, setFormPages] = useState<string[]>(PAGE_OPTIONS.map((p) => p.value));
  const [formFields, setFormFields] = useState<Record<string, string[]>>({});

  // Scope dropdown data
  const [areas, setAreas] = useState<Area[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);

  // Delete
  const [deleting, setDeleting] = useState<SharedLink | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (search) p.set("search", search);
      if (statusFilter !== "all") p.set("is_active", statusFilter);
      const { data } = await sharedLinksApi.list(p.toString());
      setLinks(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  // Load areas when form opens (for all scope types that need them)
  useEffect(() => {
    if (!showForm) return;
    const load = async () => {
      try {
        const { data } = await areasApi.list("page_size=500");
        setAreas(data.items || []);
      } catch { /* ignore */ }
    };
    load();
  }, [showForm]);

  // Load locations filtered by area (for LOCATION and CAMERA scopes)
  useEffect(() => {
    if (!showForm || (formScopeType !== "LOCATION" && formScopeType !== "CAMERA")) {
      setLocations([]);
      return;
    }
    if (!formAreaFilter) { setLocations([]); return; }
    const load = async () => {
      try {
        const { data } = await locationsApi.list(`area_id=${formAreaFilter}&page_size=500`);
        setLocations(data.items || []);
      } catch { /* ignore */ }
    };
    load();
  }, [showForm, formScopeType, formAreaFilter]);

  // Load cameras for selected location (CAMERA scope)
  useEffect(() => {
    if (formScopeType !== "CAMERA" || !formScopeId) { setCameras([]); return; }
    const load = async () => {
      try {
        const { data: devData } = await devicesApi.list(`location_id=${formScopeId}&page_size=100`);
        const devices = devData.items || [];
        const allCams: Camera[] = [];
        for (const dev of devices) {
          const { data: camData } = await camerasApi.byDevice(dev.id);
          allCams.push(...(camData.items || []));
        }
        setCameras(allCams);
      } catch { /* ignore */ }
    };
    load();
  }, [formScopeType, formScopeId]);

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormScopeType("LOCATION");
    setFormAreaFilter("");
    setFormScopeId("");
    setFormCameraIds([]);
    setFormExpiry("");
    setFormIsActive(true);
    setFormPages(PAGE_OPTIONS.map((p) => p.value));
    setFormFields({});
    setShowForm(true);
  }

  function openEdit(link: SharedLink) {
    setEditing(link);
    setFormName(link.name || "");
    setFormExpiry("");
    setFormIsActive(link.is_active);
    setFormPages(link.view_config?.pages || PAGE_OPTIONS.map((p) => p.value));
    setFormFields(link.view_config?.fields || {});
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormSaving(true);
    try {
      if (editing) {
        // Edit mode — name, is_active, expires_at, view_config
        const payload: Record<string, unknown> = {
          name: formName || null,
          is_active: formIsActive,
          view_config: { pages: formPages, fields: formFields },
        };
        if (formExpiry) {
          const d = new Date();
          d.setDate(d.getDate() + parseInt(formExpiry));
          payload.expires_at = d.toISOString();
        }
        await sharedLinksApi.update(editing.id, payload);
        showSuccess("Link updated");
      } else {
        // Create mode
        let expiresAt: string | null = null;
        if (formExpiry) {
          const d = new Date();
          d.setDate(d.getDate() + parseInt(formExpiry));
          expiresAt = d.toISOString();
        }
        const payload: Record<string, unknown> = {
          name: formName || null,
          scope_type: formScopeType,
          expires_at: expiresAt,
          view_config: { pages: formPages, fields: formFields },
        };
        if (formScopeType === "CAMERA") {
          payload.camera_ids = formCameraIds;
        } else {
          payload.scope_id = formScopeId;
        }
        await sharedLinksApi.create(payload);
        showSuccess("Shared link created");
      }
      setShowForm(false);
      fetchLinks();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Operation failed");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await sharedLinksApi.delete(deleting.id);
      showSuccess("Link deleted");
      setDeleting(null);
      fetchLinks();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function toggleActive(link: SharedLink) {
    try {
      await sharedLinksApi.update(link.id, { is_active: !link.is_active });
      showSuccess(link.is_active ? "Link deactivated" : "Link activated");
      fetchLinks();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to update");
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/view/${token}`;
    navigator.clipboard.writeText(url);
    showSuccess("Link copied to clipboard");
  }

  function getScopeLabel(link: SharedLink) {
    return link.scope_type === "CAMERA" ? "Camera(s)" : link.scope_type.charAt(0) + link.scope_type.slice(1).toLowerCase();
  }

  function toggleCameraId(cameraId: string) {
    setFormCameraIds((prev) =>
      prev.includes(cameraId) ? prev.filter((id) => id !== cameraId) : [...prev, cameraId]
    );
  }

  if (loading && links.length === 0) return <SharedLinksSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-slate-900 tracking-tight">Shared Links</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Generate public parking view links</p>
        </div>
        <Button onClick={openCreate} className="h-10 rounded-xl text-[13px] font-semibold gap-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-md shadow-teal-600/20">
          <Plus size={15} /> Create Link
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <Link2 size={18} className="text-teal-600" />
          </div>
          <div>
            <p className="text-[22px] font-bold text-slate-900">{total}</p>
            <p className="text-[11px] text-slate-400 font-medium">Total Links</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ToggleRight size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[22px] font-bold text-slate-900">{links.filter((l) => l.is_active).length}</p>
            <p className="text-[11px] text-slate-400 font-medium">Active</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 h-10 card-shadow focus-within:border-teal-300 flex-1 max-w-sm">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or token..."
            className="flex-1 bg-transparent outline-none text-[13px] text-slate-700 placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden card-shadow h-10">
          {[
            { value: "all", label: "All" },
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`px-4 h-full text-[12px] font-semibold transition-colors ${
                statusFilter === opt.value
                  ? "bg-teal-50 text-teal-700"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60">
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Scope</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pages</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expires</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Created</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-[13px]">
                  No shared links yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
            {links.map((link) => (
              <TableRow key={link.id} className="hover:bg-slate-50/50">
                <TableCell>
                  <p className="text-[13px] font-semibold text-slate-800">{link.name || "Untitled"}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{link.token}</p>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 text-teal-700 bg-teal-50">
                    {getScopeLabel(link)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {link.view_config?.pages?.length || PAGE_OPTIONS.length} / {PAGE_OPTIONS.length}
                  </span>
                </TableCell>
                <TableCell>
                  {link.is_active ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 text-emerald-700 bg-emerald-50">Active</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 text-slate-500 bg-slate-100">Inactive</span>
                  )}
                </TableCell>
                <TableCell className="text-[12px] text-slate-600">
                  {link.expires_at ? (
                    <span className={new Date(link.expires_at).getTime() <= Date.now() ? "text-red-500 font-semibold" : ""}>
                      {timeUntil(link.expires_at)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-[12px] text-slate-500">
                  {new Date(link.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copyLink(link.token)} className="h-8 w-8 p-0 rounded-lg hover:bg-teal-50 hover:text-teal-600" title="Copy link">
                      <Copy size={14} />
                    </Button>
                    <a href={`/view/${link.token}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600" title="Open link">
                        <ExternalLink size={14} />
                      </Button>
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(link)} className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 hover:text-slate-600" title="Edit">
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(link)} className={`h-8 w-8 p-0 rounded-lg ${link.is_active ? "hover:bg-amber-50 hover:text-amber-600" : "hover:bg-emerald-50 hover:text-emerald-600"}`} title={link.is_active ? "Deactivate" : "Activate"}>
                      {link.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(link)} className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-600" title="Delete">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="border-t border-slate-100 px-4 py-3">
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <CrudDialog open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Link" : "Create Public Link"} maxWidth="560px">
        <form onSubmit={handleSubmit} className="space-y-5 mt-3">
          <div>
            <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Link Name (optional)</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Mall Parking - Public View" className="h-10 rounded-xl" />
          </div>

          {!editing && (
            <>
              <div>
                <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Scope Level</Label>
                <SearchSelect
                  value={formScopeType}
                  onValueChange={(v) => { setFormScopeType(v); setFormAreaFilter(""); setFormScopeId(""); setFormCameraIds([]); }}
                  options={SCOPE_OPTIONS}
                  placeholder="Select scope level"
                  className="w-full h-10"
                />
              </div>

              {formScopeType === "AREA" && (
                <div>
                  <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Select Area</Label>
                  <SearchSelect
                    value={formScopeId}
                    onValueChange={setFormScopeId}
                    options={areas.map((a) => ({ value: a.id, label: a.name }))}
                    placeholder="Search area..."
                    searchPlaceholder="Search..."
                    className="w-full h-10"
                  />
                </div>
              )}

              {formScopeType === "LOCATION" && (
                <>
                  <div>
                    <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Filter by Area</Label>
                    <SearchSelect
                      value={formAreaFilter}
                      onValueChange={(v) => { setFormAreaFilter(v); setFormScopeId(""); }}
                      options={areas.map((a) => ({ value: a.id, label: a.name }))}
                      placeholder="Select area first..."
                      searchPlaceholder="Search area..."
                      className="w-full h-10"
                    />
                  </div>
                  {formAreaFilter && (
                    <div>
                      <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Select Location</Label>
                      <SearchSelect
                        value={formScopeId}
                        onValueChange={setFormScopeId}
                        options={locations.map((l) => ({ value: l.id, label: l.name }))}
                        placeholder="Search location..."
                        searchPlaceholder="Search..."
                        className="w-full h-10"
                      />
                    </div>
                  )}
                </>
              )}

              {formScopeType === "CAMERA" && (
                <>
                  <div>
                    <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Filter by Area</Label>
                    <SearchSelect
                      value={formAreaFilter}
                      onValueChange={(v) => { setFormAreaFilter(v); setFormScopeId(""); setFormCameraIds([]); setCameras([]); }}
                      options={areas.map((a) => ({ value: a.id, label: a.name }))}
                      placeholder="Select area first..."
                      searchPlaceholder="Search area..."
                      className="w-full h-10"
                    />
                  </div>
                  {formAreaFilter && (
                    <div>
                      <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Select Location</Label>
                      <SearchSelect
                        value={formScopeId}
                        onValueChange={(v) => { setFormScopeId(v); setFormCameraIds([]); }}
                        options={locations.map((l) => ({ value: l.id, label: l.name }))}
                        placeholder="Search location..."
                        searchPlaceholder="Search..."
                        className="w-full h-10"
                      />
                    </div>
                  )}
                  {cameras.length > 0 && (
                    <div>
                      <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Select Camera(s)</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-3">
                        {cameras.map((cam) => (
                          <label key={cam.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 rounded-lg p-1.5 -m-1.5">
                            <input
                              type="checkbox"
                              checked={formCameraIds.includes(cam.id)}
                              onChange={() => toggleCameraId(cam.id)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-[13px] text-slate-700">{cam.position_label}</span>
                            <span className={`ml-auto text-[10px] font-bold uppercase rounded-lg px-2 py-0.5 ${cam.status === "ACTIVE" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>{cam.status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Pages Selection */}
          <div>
            <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Visible Pages</Label>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              {PAGE_OPTIONS.map((po) => (
                <label key={po.value} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 rounded-lg p-1.5 -m-1.5">
                  <input
                    type="checkbox"
                    checked={formPages.includes(po.value)}
                    onChange={() => {
                      setFormPages((prev) =>
                        prev.includes(po.value) ? prev.filter((v) => v !== po.value) : [...prev, po.value]
                      );
                    }}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-[13px] text-slate-700">{po.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Field Config for pages that support it */}
          {formPages.filter((p) => FIELD_OPTIONS[p]).length > 0 && (
            <div>
              <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Visible Fields per Page</Label>
              <div className="space-y-3">
                {formPages.filter((p) => FIELD_OPTIONS[p]).map((pageKey) => {
                  const pageLabel = PAGE_OPTIONS.find((po) => po.value === pageKey)?.label || pageKey;
                  const fields = FIELD_OPTIONS[pageKey];
                  const selected = formFields[pageKey] || fields.map((f) => f.value);
                  const allSelected = selected.length === fields.length;
                  return (
                    <div key={pageKey} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                        <span className="text-[12px] font-semibold text-slate-600">{pageLabel}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormFields((prev) => ({
                              ...prev,
                              [pageKey]: allSelected ? [] : fields.map((f) => f.value),
                            }));
                          }}
                          className="text-[10px] font-semibold text-teal-600 hover:text-teal-700"
                        >
                          {allSelected ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 p-2.5">
                        {fields.map((f) => {
                          const isChecked = selected.includes(f.value);
                          return (
                            <button
                              key={f.value}
                              type="button"
                              onClick={() => {
                                setFormFields((prev) => {
                                  const cur = prev[pageKey] || fields.map((ff) => ff.value);
                                  const next = isChecked ? cur.filter((v) => v !== f.value) : [...cur, f.value];
                                  return { ...prev, [pageKey]: next };
                                });
                              }}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                                isChecked
                                  ? "bg-teal-600 text-white"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                              }`}
                            >
                              {f.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {editing && (
            <div>
              <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">Status</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormIsActive(true)}
                  className={`flex-1 h-10 rounded-xl text-[13px] font-semibold border transition-all ${formIsActive ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400"}`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setFormIsActive(false)}
                  className={`flex-1 h-10 rounded-xl text-[13px] font-semibold border transition-all ${!formIsActive ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-400"}`}
                >
                  Inactive
                </button>
              </div>
            </div>
          )}

          <div>
            <Label className="text-[12px] font-semibold text-slate-600 mb-1.5">
              {editing ? "Extend Expiry" : "Expires In"}
            </Label>
            <SearchSelect
              value={formExpiry}
              onValueChange={setFormExpiry}
              options={EXPIRY_OPTIONS}
              placeholder="Never"
              className="w-full h-10"
            />
            {editing && editing.expires_at && (
              <p className="text-[11px] text-slate-400 mt-1">
                Currently expires {timeUntil(editing.expires_at)}
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button
              type="submit"
              disabled={formSaving || (!editing && !formScopeId && formScopeType !== "CAMERA") || (!editing && formScopeType === "CAMERA" && formCameraIds.length === 0)}
              className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold shadow-md shadow-teal-600/20"
            >
              {formSaving ? "Saving..." : editing ? "Save Changes" : "Generate Link"}
            </Button>
          </div>
        </form>
      </CrudDialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Shared Link"
        description={`Remove "${deleting?.name || deleting?.token}" permanently? Anyone with this link will no longer be able to view the parking data.`}
        loading={deleteLoading}
      />
    </div>
  );
}
