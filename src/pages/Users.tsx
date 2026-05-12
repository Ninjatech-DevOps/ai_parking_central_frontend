import { useState, useCallback, useEffect, type FormEvent } from "react";
import { showSuccess, showError } from "@/lib/toast";
import { usersApi, rolesApi, citiesApi, locationsApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SearchSelect from "@/components/SearchSelect";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import { UserPlus, Pencil, Trash2, Search, Users as UsersIcon, Shield } from "lucide-react";
import type { User, City, PaginatedResponse } from "@/types/api";

interface Role { id: string; name: string; description: string | null; }

export default function Users() {
  const [users, setUsers] = useState<User[]>([]); const [total, setTotal] = useState(0); const [search, setSearch] = useState("");
  const [page, setPage] = useState(1); const pageSize = 20;
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null); const [deleteLoading, setDeleteLoading] = useState(false);
  const [formName, setFormName] = useState(""); const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState(""); const [formPassword, setFormPassword] = useState("");
  const [formRoleId, setFormRoleId] = useState(""); const [formScopeType, setFormScopeType] = useState("");
  const [formScopeId, setFormScopeId] = useState(""); const [formSaving, setFormSaving] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    rolesApi.list().then(({ data }) => setRoles(data.items)).catch(() => {});
    citiesApi.list("page_size=100").then(({ data }) => setCities(data.items)).catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    const { data } = await usersApi.list(`page=${page}&page_size=${pageSize}`);
    setUsers(data.items); setTotal(data.total);
  }, [page]);
  usePolling(fetchUsers, 30000);

  function openCreate() {
    setEditing(null); setFormName(""); setFormEmail(""); setFormPhone(""); setFormPassword("");
    setFormRoleId(""); setFormScopeType(""); setFormScopeId("");
    setShowForm(true);
  }
  function openEdit(u: User) { setEditing(u); setFormName(u.name); setFormEmail(u.email); setFormPhone(u.phone || ""); setShowForm(true); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, { name: formName, phone: formPhone || null });
      } else {
        const payload: Record<string, unknown> = { name: formName, email: formEmail, phone: formPhone || null, password: formPassword };
        if (formRoleId) payload.role_ids = [formRoleId];
        if (formScopeType && formScopeId) payload.scopes = [{ scope_type: formScopeType, scope_id: formScopeId }];
        await usersApi.create(payload);
      }
      setShowForm(false); showSuccess(editing ? "User updated" : "User created"); fetchUsers();
    } catch (err: any) { showError(err?.response?.data?.detail || "Failed"); } finally { setFormSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setDeleteLoading(true);
    try { await usersApi.delete(deleting.id); setDeleting(null); showSuccess("User deleted"); fetchUsers(); }
    catch (err: any) { showError(err?.response?.data?.detail || "Failed"); } finally { setDeleteLoading(false); }
  }

  async function toggleActive(u: User) {
    await usersApi.update(u.id, { is_active: !u.is_active }); showSuccess(u.is_active ? "Deactivated" : "Activated"); fetchUsers();
  }

  const filtered = users.filter((u) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  const colors = ["from-teal-500 to-teal-700", "from-violet-500 to-violet-700", "from-amber-500 to-amber-700", "from-rose-500 to-rose-700", "from-sky-500 to-sky-700"];
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-[1360px]">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-[22px] font-bold text-slate-900">Admin Users</h1><p className="text-[13px] text-slate-500 mt-0.5">Manage users, roles, and access</p></div>
        <Button onClick={openCreate} className="h-10 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold gap-2 shadow-md shadow-teal-600/20"><UserPlus size={16} /> Add User</Button>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all"><Search size={15} className="text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" /></div>
        <span className="text-[12px] text-slate-400 ml-auto font-medium">{total} users</span>
      </div>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader><TableRow className="border-b border-slate-100"><TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">User</TableHead><TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone</TableHead><TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead><TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Joined</TableHead><TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((u, i) => (
              <TableRow key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <TableCell><div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[i % colors.length]} flex items-center justify-center text-white text-[11px] font-bold shadow-sm`}>{u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</div><div><p className="text-[13px] font-semibold text-slate-800">{u.name}</p><p className="text-[11px] text-slate-400">{u.email}</p></div></div></TableCell>
                <TableCell className="text-[13px] text-slate-500">{u.phone || "—"}</TableCell>
                <TableCell><button onClick={() => toggleActive(u)}><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 cursor-pointer transition-colors ${u.is_active ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "text-red-700 bg-red-50 hover:bg-red-100"}`}><span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-red-500"}`} />{u.is_active ? "Active" : "Inactive"}</span></button></TableCell>
                <TableCell className="text-[13px] text-slate-500 tabular-nums">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</TableCell>
                <TableCell className="text-right"><div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEdit(u)}><Pencil size={14} /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(u)}><Trash2 size={14} /></Button></div></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-16"><div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><UsersIcon size={22} className="text-slate-300" /></div><p className="text-[13px] text-slate-400 font-medium">No users found</p></TableCell></TableRow>}
          </TableBody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <CrudDialog open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit User" : "Add User"}>
        <form onSubmit={handleSubmit} className="space-y-5 mt-3">
          <div><Label className="text-[13px] font-semibold text-slate-700">Full Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required /></div>
          {!editing && <div><Label className="text-[13px] font-semibold text-slate-700">Email</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required /></div>}
          <div><Label className="text-[13px] font-semibold text-slate-700">Phone</Label><Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" /></div>
          {!editing && <div><Label className="text-[13px] font-semibold text-slate-700">Password</Label><Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required /></div>}

          {!editing && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-4 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Shield size={12} /> Role & Access</p>

              <div>
                <Label className="text-[12px] text-slate-600">Role</Label>
                <div className="mt-1">
                  <SearchSelect value={formRoleId || "_"} onValueChange={(v) => setFormRoleId(v === "_" ? "" : v)}
                    options={[{ value: "_", label: "Select role" }, ...roles.map((r) => ({ value: r.id, label: r.name.replace(/_/g, " ") }))]}
                    placeholder="Select role" searchPlaceholder="Search role..." className="w-full" />
                </div>
              </div>

              <div>
                <Label className="text-[12px] text-slate-600">Scope Type</Label>
                <div className="mt-1">
                  <SearchSelect value={formScopeType || "_"} onValueChange={(v) => { setFormScopeType(v === "_" ? "" : v); setFormScopeId(""); }}
                    options={[
                      { value: "_", label: "No scope (Super Admin)" },
                      { value: "STATE", label: "State" },
                      { value: "CITY", label: "City" },
                      { value: "LOCATION", label: "Location" },
                    ]}
                    placeholder="Select scope" className="w-full" />
                </div>
              </div>

              {formScopeType === "CITY" && (
                <div>
                  <Label className="text-[12px] text-slate-600">City</Label>
                  <div className="mt-1">
                    <SearchSelect value={formScopeId || "_"} onValueChange={(v) => setFormScopeId(v === "_" ? "" : v)}
                      options={[{ value: "_", label: "Select city" }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
                      placeholder="Select city" searchPlaceholder="Search city..." className="w-full" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold shadow-md shadow-teal-600/20">{formSaving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete User" description={`Remove "${deleting?.name}" permanently?`} loading={deleteLoading} />
    </div>
  );
}
