import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Bell, LogOut } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <p className="text-[15px] font-bold text-slate-900">AI Parking</p>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Gujarat State</p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl hover:bg-slate-50">
          <Bell size={18} className="text-slate-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </Button>
        <div className="w-px h-8 bg-slate-100 mx-1" />
        <div className="flex items-center gap-2.5 pl-1">
          <div className="text-right">
            <p className="text-[12px] font-semibold text-slate-700">{user?.name}</p>
            <p className="text-[10px] text-slate-400">Admin</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-[11px] font-bold shadow-sm shadow-teal-600/20">
            {user?.name?.charAt(0) || "U"}
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 rounded-xl hover:bg-red-50 hover:text-red-500 text-slate-400">
            <LogOut size={15} />
          </Button>
        </div>
      </div>
    </header>
  );
}
