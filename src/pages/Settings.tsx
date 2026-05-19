import { useState, useEffect, type FormEvent } from "react";
import { showSuccess, showError } from "@/lib/toast";
import { notifPrefsApi, usersApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Bell, Lock, Check } from "lucide-react";

interface NotifPref { id: string; alert_severity: string; channel: string; is_enabled: boolean; }
const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const channels = ["PUSH", "EMAIL", "IN_APP"];

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState("profile");
  const [prefs, setPrefs] = useState<NotifPref[]>([]);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const [currentPw, setCurrentPw] = useState(""); const [newPw, setNewPw] = useState(""); const [pwMsg, setPwMsg] = useState("");

  useEffect(() => { if (tab === "notifications") notifPrefsApi.get().then(({ data }) => setPrefs(data)); }, [tab]);
  function isOn(s: string, c: string) { return prefs.some((p) => p.alert_severity === s && p.channel === c && p.is_enabled); }
  function toggle(s: string, c: string) { const e = prefs.find((p) => p.alert_severity === s && p.channel === c); if (e) setPrefs(prefs.map((p) => p === e ? { ...p, is_enabled: !p.is_enabled } : p)); else setPrefs([...prefs, { id: "", alert_severity: s, channel: c, is_enabled: true }]); }
  async function savePrefs() { setSaving(true); const all: Record<string, unknown>[] = []; for (const s of severities) for (const c of channels) all.push({ alert_severity: s, channel: c, is_enabled: isOn(s, c) }); const { data } = await notifPrefsApi.update(all); setPrefs(data); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  async function changePw(e: FormEvent) { e.preventDefault(); setPwMsg(""); try { await usersApi.changePassword({ current_password: currentPw, new_password: newPw }); setPwMsg("success"); setCurrentPw(""); setNewPw(""); } catch { setPwMsg("error"); } }

  const tabs = [{ id: "profile", label: "Profile", icon: User }, { id: "notifications", label: "Notifications", icon: Bell }, { id: "security", label: "Security", icon: Lock }];

  return (
    <div className="w-full">
      <h1 className="text-[22px] font-bold text-slate-900 mb-6">Settings</h1>
      <div className="flex gap-6">
        <div className="w-52 shrink-0 space-y-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-left transition-all duration-200 ${tab === id ? "bg-teal-50/80 text-teal-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${tab === id ? "bg-teal-600 text-white shadow-sm shadow-teal-600/25" : "bg-slate-100 text-slate-400"}`}><Icon size={15} /></div>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {tab === "profile" && (
            <div className="bg-white rounded-2xl card-shadow p-6">
              <h2 className="text-[16px] font-bold text-slate-900 mb-6">Profile Information</h2>
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-teal-600/20">{user?.name?.charAt(0)}</div>
                <div><p className="text-[17px] font-bold text-slate-900">{user?.name}</p><p className="text-[13px] text-slate-400 mt-0.5">{user?.email}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                {[{ l: "Name", v: user?.name }, { l: "Email", v: user?.email }, { l: "Phone", v: user?.phone || "Not set" }, { l: "Status", v: "Active" }].map(({ l, v }) => (
                  <div key={l}><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{l}</p><p className="text-[13px] font-medium text-slate-700 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">{v}</p></div>
                ))}
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="bg-white rounded-2xl card-shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <div><h2 className="text-[16px] font-bold text-slate-900">Notification Preferences</h2><p className="text-[12px] text-slate-400 mt-0.5">CRITICAL alerts always send PUSH + EMAIL</p></div>
                <Button onClick={savePrefs} disabled={saving} className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-[12px] font-semibold gap-1.5 shadow-md shadow-teal-600/20">
                  {saved ? <><Check size={13} /> Saved</> : saving ? "Saving..." : "Save"}
                </Button>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-100">
                <table className="w-full">
                  <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">Severity</th>{channels.map((c) => <th key={c} className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">{c.replace("_", " ")}</th>)}</tr></thead>
                  <tbody>
                    {severities.map((s) => (
                      <tr key={s} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3"><span className={`text-[11px] font-bold rounded-lg px-2.5 py-1 uppercase tracking-wide ${s === "CRITICAL" ? "text-red-700 bg-red-50" : s === "HIGH" ? "text-orange-700 bg-orange-50" : s === "MEDIUM" ? "text-amber-700 bg-amber-50" : "text-teal-700 bg-teal-50"}`}>{s}</span></td>
                        {channels.map((c) => (<td key={c} className="text-center px-5 py-3"><button onClick={() => toggle(s, c)} className={`w-10 h-[22px] rounded-full transition-all duration-200 relative ${isOn(s, c) ? "bg-teal-600" : "bg-slate-200"}`}><span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${isOn(s, c) ? "right-[3px]" : "left-[3px]"}`} /></button></td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="bg-white rounded-2xl card-shadow p-6">
              <h2 className="text-[16px] font-bold text-slate-900 mb-6">Change Password</h2>
              <form onSubmit={changePw} className="max-w-md space-y-5">
                {pwMsg && <div className={`text-[13px] rounded-xl px-4 py-3 border font-medium ${pwMsg === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-red-700 bg-red-50 border-red-100"}`}>{pwMsg === "success" ? "Password changed successfully" : "Failed to change password"}</div>}
                <div><label className="text-[13px] font-semibold text-slate-700 mb-2 block">Current Password</label><Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="h-10 rounded-xl text-[13px] border-slate-200" required /></div>
                <div><label className="text-[13px] font-semibold text-slate-700 mb-2 block">New Password</label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-10 rounded-xl text-[13px] border-slate-200" required /></div>
                <Button type="submit" className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold shadow-md shadow-teal-600/20">Update Password</Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
