import { useState, useCallback, useEffect, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { showSuccess, showError } from "@/lib/toast";
import { usersApi, rolesApi, areasApi, locationsApi } from "@/services/api";
import { useFilter } from "@/contexts/FilterContext";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SearchSelect from "@/components/SearchSelect";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import { UserPlus, Pencil, Trash2, Search, Users as UsersIcon, Shield, X, MapPin } from "lucide-react";
import UsersSkeleton from "@/components/skeletons/UsersSkeleton";
import type { User, Area, Location, Role } from "@/types/api";

interface AccessArea {
  scope_type: string;
  scope_id: string;
  label: string; // Readable path like "Gujarat › Ahmedabad › Alpha Mall"
}

export default function Users() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("users:create");
  const canEdit = hasPermission("users:edit");
  const canDelete = hasPermission("users:delete");
  // ─── List state ───
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ─── Modal state ───
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Form fields ───
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRoleId, setFormRoleId] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // ─── Location picker (locked to Ahmedabad) ───
  const [pickAreaId, setPickAreaId] = useState("");
  const [pickLocationId, setPickLocationId] = useState("");

  // ─── Assigned access areas ───
  const [accessAreas, setAccessAreas] = useState<AccessArea[]>([]);

  // ─── Lookup data (locked to Ahmedabad) ───
  const [roles, setRoles] = useState<Role[]>([]);
  const [scopeAreas, setScopeAreas] = useState<Area[]>([]);
  const [scopeLocations, setScopeLocations] = useState<Location[]>([]);
  const { cityId: lockedCityId, cityName: lockedCityName } = useFilter();

  useEffect(() => {
    rolesApi.list().then(({ data }) => setRoles(data.items || [])).catch(() => {});
  }, []);

  // Load areas for Ahmedabad (city-level only)
  useEffect(() => {
    if (lockedCityId) {
      areasApi.byCity(lockedCityId).then(({ data }) => setScopeAreas((data.items || []).filter((a: Area) => !a.taluka_id))).catch(() => {});
    }
  }, [lockedCityId]);

  // Load locations when area selected
  useEffect(() => {
    if (pickAreaId) {
      locationsApi.list(`area_id=${pickAreaId}&page_size=200`).then(({ data }) => setScopeLocations(data.items || [])).catch(() => {});
    } else {
      setScopeLocations([]);
    }
    setPickLocationId("");
  }, [pickAreaId]);

  // ─── Fetch users ───
  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await usersApi.list(`page=${page}&page_size=${pageSize}`);
      setUsers(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page]);
  usePolling(fetchUsers, 30000);

  // ─── Add access area at a specific level ───
  function addAccessAreaAt(type: string, id: string, label: string) {
    if (accessAreas.some((a) => a.scope_type === type && a.scope_id === id)) return;
    setAccessAreas((prev) => [...prev, { scope_type: type, scope_id: id, label }]);
    // Reset picker
    setPickAreaId("");
    setPickAreaId("");
    setPickAreaId("");
    setPickLocationId("");
  }

  function removeAccessArea(index: number) {
    setAccessAreas((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Open modals ───
  function openCreate() {
    setEditing(null);
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormPassword("");
    setFormRoleId(""); setAccessAreas([]);
    setPickAreaId(""); setPickAreaId(""); setPickAreaId(""); setPickLocationId("");
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPhone(u.phone || "");
    setFormPassword("");
    setFormRoleId(u.roles?.[0]?.id || "");
    setAccessAreas(
      (u.scopes || []).map((s) => ({
        scope_type: s.scope_type,
        scope_id: s.scope_id,
        label: s.scope_name || `${s.scope_type.charAt(0)}${s.scope_type.slice(1).toLowerCase()}: ${s.scope_id.slice(0, 8)}…`,
      })),
    );
    setPickAreaId(""); setPickAreaId(""); setPickAreaId(""); setPickLocationId("");
    setShowForm(true);
  }

  // ─── Submit ───
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormSaving(true);
    try {
      const scopes = accessAreas.map((a) => ({ scope_type: a.scope_type, scope_id: a.scope_id }));

      if (editing) {
        await usersApi.update(editing.id, {
          name: formName,
          phone: formPhone || null,
          role_ids: formRoleId ? [formRoleId] : [],
          scopes,
        });
      } else {
        await usersApi.create({
          name: formName,
          email: formEmail,
          phone: formPhone || null,
          password: formPassword,
          role_ids: formRoleId ? [formRoleId] : [],
          scopes,
        });
      }
      setShowForm(false);
      showSuccess(editing ? "User updated" : "User created");
      fetchUsers();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await usersApi.delete(deleting.id);
      setDeleting(null);
      showSuccess("User deleted");
      fetchUsers();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function toggleActive(u: User) {
    await usersApi.update(u.id, { is_active: !u.is_active });
    showSuccess(u.is_active ? "Deactivated" : "Activated");
    fetchUsers();
  }

  const filtered = users.filter(
    (u) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
  );
  const colors = ["from-teal-500 to-teal-700", "from-violet-500 to-violet-700", "from-amber-500 to-amber-700", "from-rose-500 to-rose-700", "from-sky-500 to-sky-700"];
  const totalPages = Math.ceil(total / pageSize);

  function fmtRole(name: string) {
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Human-readable scope level
  function scopeLevel(type: string) {
    const map: Record<string, string> = { STATE: "State", CITY: "City", AREA: "Area", LOCATION: "Location", ZONE: "Zone" };
    return map[type] || type;
  }

  if (loading && users.length === 0) return <UsersSkeleton />;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Admin Users</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage users, roles, and data access</p>
        </div>
        {canCreate && <Button onClick={openCreate} className="h-10 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold gap-2 shadow-md shadow-teal-600/20">
          <UserPlus size={16} /> Add User
        </Button>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Users", value: total, color: "text-slate-600", bg: "bg-slate-50", icon: UsersIcon },
          { label: "Active", value: users.filter((u) => u.is_active).length, color: "text-emerald-600", bg: "bg-emerald-50", icon: UsersIcon },
          { label: "Inactive", value: users.filter((u) => !u.is_active).length, color: "text-red-600", bg: "bg-red-50", icon: UsersIcon },
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

      {/* Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" />
        </div>
        <span className="text-[12px] text-slate-400 ml-auto font-medium">{total} users</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">User</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data Access</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u, i) => (
              <TableRow key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[i % colors.length]} flex items-center justify-center text-white text-[11px] font-bold shadow-sm`}>
                      {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800">{u.name}</p>
                      <p className="text-[11px] text-slate-400">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {u.roles?.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 rounded-lg px-2 py-0.5">
                      <Shield size={10} /> {fmtRole(u.roles[0].name)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-300">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {u.scopes?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {u.scopes.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">
                          <MapPin size={8} className="text-slate-400" />
                          {s.scope_name ? `${s.scope_name}` : scopeLevel(s.scope_type)}
                          <span className="text-slate-400">{s.scope_name ? `(${scopeLevel(s.scope_type)})` : ""}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 font-medium">All Locations</span>
                  )}
                </TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(u)}>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 cursor-pointer transition-colors ${u.is_active ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "text-red-700 bg-red-50 hover:bg-red-100"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                    {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEdit(u)}><Pencil size={14} /></Button>}
                    {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(u)}><Trash2 size={14} /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><UsersIcon size={22} className="text-slate-300" /></div>
                  <p className="text-[13px] text-slate-400 font-medium">No users found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {/* ─── Create / Edit Modal ─── */}
      <CrudDialog open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit User" : "Add User"} maxWidth="560px">
        <form onSubmit={handleSubmit} className="space-y-5 mt-3">
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Full Name</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required />
          </div>

          {!editing && (
            <div>
              <Label className="text-[13px] font-semibold text-slate-700">Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required />
            </div>
          )}

          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Phone</Label>
            <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" />
          </div>

          {!editing && (
            <div>
              <Label className="text-[13px] font-semibold text-slate-700">Password</Label>
              <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required />
            </div>
          )}

          {/* ─── Role & Data Access ─── */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-4 border border-slate-100">

            {/* Role — what they can do */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Shield size={11} /> What can this user do?</p>
              <SearchSelect
                value={formRoleId || "_"}
                onValueChange={(v) => setFormRoleId(v === "_" ? "" : v)}
                options={[{ value: "_", label: "Select a role…" }, ...roles.map((r) => ({ value: r.id, label: fmtRole(r.name) }))]}
                placeholder="Select a role…" searchPlaceholder="Search roles…" className="w-full"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200" />

            {/* Data access — where they can see data */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1"><MapPin size={11} /> Where can this user see data?</p>
              <p className="text-[10px] text-slate-400 mb-3">Pick a location level. Stop at any step — that becomes their access boundary. Leave empty for all locations.</p>

              {/* Assigned access areas as tags */}
              {accessAreas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {accessAreas.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1">
                      <MapPin size={9} className="text-teal-500 shrink-0" />
                      {a.label}
                      <button type="button" onClick={() => removeAccessArea(i)} className="text-teal-400 hover:text-red-500 transition-colors ml-0.5"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}

              {accessAreas.length === 0 && !pickAreaId && (
                <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                  No access areas set — this user will see <strong>all locations</strong>.
                </div>
              )}

              {/* Locked: Gujarat → Ahmedabad. User picks Area → Location */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1">
                  <span className="bg-slate-100 rounded px-2 py-0.5 font-medium text-slate-500">Gujarat</span>
                  <span>›</span>
                  <span className="bg-slate-100 rounded px-2 py-0.5 font-medium text-slate-500">{lockedCityName}</span>
                  <span>›</span>
                </div>

                {/* Area */}
                <div className="flex items-center gap-2">
                  <SearchSelect
                    value={pickAreaId || "_"}
                    onValueChange={(v) => { setPickAreaId(v === "_" ? "" : v); setPickLocationId(""); }}
                    options={[{ value: "_", label: "Select area…" }, ...scopeAreas.map((a) => ({ value: a.id, label: a.name }))]}
                    placeholder="Select area…" searchPlaceholder="Search area…" className="flex-1"
                  />
                  {pickAreaId && !pickLocationId && (
                    <Button type="button" variant="outline" size="sm" onClick={() => { addAccessAreaAt("AREA", pickAreaId, `${lockedCityName} › ${scopeAreas.find((a) => a.id === pickAreaId)?.name}`); }} className="rounded-lg text-[10px] border-teal-200 text-teal-700 hover:bg-teal-50 whitespace-nowrap h-9 px-2.5">
                      + {scopeAreas.find((a) => a.id === pickAreaId)?.name} area
                    </Button>
                  )}
                </div>

                {/* Location */}
                {pickAreaId && scopeLocations.length > 0 && (
                  <div className="flex items-center gap-2 pl-4 border-l-2 border-slate-200">
                    <SearchSelect
                      value={pickLocationId || "_"}
                      onValueChange={(v) => setPickLocationId(v === "_" ? "" : v)}
                      options={[{ value: "_", label: "Select location…" }, ...scopeLocations.map((l) => ({ value: l.id, label: l.name }))]}
                      placeholder="Select location…" searchPlaceholder="Search location…" className="flex-1"
                    />
                    {pickLocationId && (
                      <Button type="button" variant="outline" size="sm" onClick={() => { addAccessAreaAt("LOCATION", pickLocationId, `${lockedCityName} › ${scopeLocations.find((l) => l.id === pickLocationId)?.name}`); }} className="rounded-lg text-[10px] border-teal-200 text-teal-700 hover:bg-teal-50 whitespace-nowrap h-9 px-2.5">
                        + {scopeLocations.find((l) => l.id === pickLocationId)?.name} only
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold shadow-md shadow-teal-600/20">
              {formSaving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </CrudDialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete User" description={`Remove "${deleting?.name}" permanently?`} loading={deleteLoading} />
    </div>
  );
}
