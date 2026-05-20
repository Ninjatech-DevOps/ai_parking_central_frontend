import { useState, useCallback, useEffect, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { showSuccess, showError } from "@/lib/toast";
import { rolesApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ShieldCheck, Plus, Pencil, Trash2, Copy, Users, Lock } from "lucide-react";
import type { Role, PermissionItem } from "@/types/api";

// ─── Group permissions by resource for the matrix ───
function groupByResource(perms: PermissionItem[]): Record<string, PermissionItem[]> {
  const groups: Record<string, PermissionItem[]> = {};
  for (const p of perms) {
    if (!groups[p.resource]) groups[p.resource] = [];
    groups[p.resource].push(p);
  }
  // Sort actions within each resource
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.action.localeCompare(b.action));
  }
  return groups;
}

// Display-friendly resource name
function fmtResource(r: string) {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

// Display-friendly role name
function fmtRole(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Roles() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("roles:create");
  const canEdit = hasPermission("roles:edit");
  const canDelete = hasPermission("roles:delete");
  // ─── List ───
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);

  // ─── Modal ───
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Form ───
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPermIds, setFormPermIds] = useState<Set<string>>(new Set());
  const [formSaving, setFormSaving] = useState(false);

  // ─── Detail view ───
  const [viewing, setViewing] = useState<Role | null>(null);

  // ─── Load permissions on mount ───
  useEffect(() => {
    rolesApi.permissions().then(({ data }) => setAllPermissions(data)).catch(() => {});
  }, []);

  // ─── Fetch roles ───
  const fetchRoles = useCallback(async () => {
    const { data } = await rolesApi.list("page_size=50");
    setRoles(data.items || []);
  }, []);
  usePolling(fetchRoles, 30000);

  const permGroups = groupByResource(allPermissions);
  const resources = Object.keys(permGroups).sort();

  // ─── Toggle permission in the matrix ───
  function togglePerm(permId: string) {
    setFormPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }

  // ─── Toggle all permissions for a resource ───
  function toggleResource(resource: string) {
    const resourcePerms = permGroups[resource] || [];
    const allSelected = resourcePerms.every((p) => formPermIds.has(p.id));
    setFormPermIds((prev) => {
      const next = new Set(prev);
      for (const p of resourcePerms) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  // ─── Open modals ───
  function openCreate() {
    setEditing(null);
    setFormName(""); setFormDesc("");
    setFormPermIds(new Set());
    setShowForm(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setFormName(role.name);
    setFormDesc(role.description || "");
    setFormPermIds(new Set(role.permissions.map((p) => p.id)));
    setShowForm(true);
  }

  function openClone(role: Role) {
    setEditing(null);
    setFormName(`${role.name}_COPY`);
    setFormDesc(role.description || "");
    setFormPermIds(new Set(role.permissions.map((p) => p.id)));
    setShowForm(true);
  }

  // ─── Submit ───
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormSaving(true);
    try {
      const payload = {
        name: formName.toUpperCase().replace(/\s+/g, "_"),
        description: formDesc || null,
        permission_ids: Array.from(formPermIds),
      };
      if (editing) {
        await rolesApi.update(editing.id, payload);
      } else {
        await rolesApi.create(payload);
      }
      setShowForm(false);
      showSuccess(editing ? "Role updated" : "Role created");
      fetchRoles();
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
      await rolesApi.delete(deleting.id);
      setDeleting(null);
      showSuccess("Role deleted");
      fetchRoles();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Roles & Permissions</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage roles and their permission assignments</p>
        </div>
        {canCreate && <Button onClick={openCreate} className="h-10 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold gap-2 shadow-md shadow-teal-600/20">
          <Plus size={16} /> Create Role
        </Button>}
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Permissions</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Users</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${role.is_system_role ? "bg-teal-50" : "bg-violet-50"}`}>
                      {role.is_system_role ? <Lock size={14} className="text-teal-600" /> : <ShieldCheck size={14} className="text-violet-600" />}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-800">{fmtRole(role.name)}</p>
                      {role.description && <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px] truncate">{role.description}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-[10px] font-bold rounded-lg px-2 py-1 ${role.is_system_role ? "text-teal-700 bg-teal-50" : "text-violet-700 bg-violet-50"}`}>
                    {role.is_system_role ? "System" : "Custom"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[300px]">
                    {role.permissions.slice(0, 4).map((p) => (
                      <span key={p.id} className="text-[9px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{p.resource}:{p.action}</span>
                    ))}
                    {role.permissions.length > 4 && (
                      <button onClick={() => setViewing(role)} className="text-[9px] font-medium text-teal-600 bg-teal-50 rounded px-1.5 py-0.5 hover:bg-teal-100">+{role.permissions.length - 4} more</button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-[13px] font-semibold text-slate-600 flex items-center gap-1"><Users size={12} className="text-slate-400" /> {role.user_count}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                    {canCreate && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100" onClick={() => openClone(role)} title="Clone"><Copy size={12} /></Button>}
                    {!role.is_system_role && (
                      <>
                        {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEdit(role)} title="Edit"><Pencil size={12} /></Button>}
                        {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(role)} title="Delete"><Trash2 size={12} /></Button>}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><ShieldCheck size={22} className="text-slate-300" /></div>
                  <p className="text-[13px] text-slate-400 font-medium">No roles found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Create / Edit Modal with Permission Matrix ─── */}
      <CrudDialog open={showForm} onClose={() => setShowForm(false)} title={editing ? `Edit Role: ${fmtRole(editing.name)}` : "Create Role"} maxWidth="680px">
        <form onSubmit={handleSubmit} className="space-y-5 mt-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[13px] font-semibold text-slate-700">Role Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. PARKING_MANAGER" className="mt-2 h-10 rounded-xl text-[13px] border-slate-200 uppercase" required />
            </div>
            <div>
              <Label className="text-[13px] font-semibold text-slate-700">Description</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description" className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" />
            </div>
          </div>

          {/* Permission Matrix */}
          <div>
            <Label className="text-[13px] font-semibold text-slate-700 mb-3 block">
              Permissions ({formPermIds.size} selected)
            </Label>
            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-36">Resource</TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((resource) => {
                    const perms = permGroups[resource];
                    const allChecked = perms.every((p) => formPermIds.has(p.id));
                    const someChecked = perms.some((p) => formPermIds.has(p.id));

                    return (
                      <TableRow key={resource} className="border-b border-slate-100 hover:bg-white/50">
                        <TableCell className="py-2.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                              onChange={() => toggleResource(resource)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-[12px] font-semibold text-slate-700">{fmtResource(resource)}</span>
                          </label>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-wrap gap-2">
                            {perms.map((p) => (
                              <label key={p.id} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formPermIds.has(p.id)}
                                  onChange={() => togglePerm(p.id)}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                />
                                <span className={`text-[11px] ${formPermIds.has(p.id) ? "text-teal-700 font-semibold" : "text-slate-500"}`}>{p.action}</span>
                              </label>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold shadow-md shadow-teal-600/20">
              {formSaving ? "Saving..." : editing ? "Update Role" : "Create Role"}
            </Button>
          </div>
        </form>
      </CrudDialog>

      {/* ─── View Role Permissions Detail ─── */}
      <CrudDialog open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${fmtRole(viewing.name)} — Permissions` : ""} maxWidth="480px">
        {viewing && (
          <div className="mt-3 space-y-3">
            <p className="text-[12px] text-slate-500">{viewing.description}</p>
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
              {Object.entries(groupByResource(viewing.permissions)).map(([resource, perms]) => (
                <div key={resource} className="mb-3 last:mb-0">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{fmtResource(resource)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {perms.map((p) => (
                      <span key={p.id} className="text-[11px] font-medium text-teal-700 bg-teal-50 rounded-lg px-2 py-0.5">{p.action}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setViewing(null)} className="rounded-xl text-[13px]">Close</Button>
            </div>
          </div>
        )}
      </CrudDialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Role" description={`Delete "${deleting ? fmtRole(deleting.name) : ""}" role? This cannot be undone.`} loading={deleteLoading} />
    </div>
  );
}
