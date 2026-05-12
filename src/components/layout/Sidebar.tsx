import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Monitor, MapPin, Bell, Users, Settings, ParkingSquare,
  ChevronRight, Building2, Camera, Globe, FileDown,
} from "lucide-react";

const sections = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Location Mgmt",
    items: [
      { to: "/location-management", label: "Geography", icon: Globe },
    ],
  },
  {
    label: "Parking Mgmt",
    items: [
      { to: "/parking-lots", label: "Parking Lots", icon: Building2 },
    ],
  },
  {
    label: "Device Mgmt",
    items: [
      { to: "/devices", label: "Devices", icon: Monitor },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { to: "/alerts", label: "Alerts", icon: Bell },
      { to: "/reports", label: "Reports", icon: FileDown },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/users", label: "Users", icon: Users },
    ],
  },
];

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
          isActive
            ? "bg-teal-50/80 text-teal-700"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
            isActive ? "bg-teal-600 text-white shadow-sm shadow-teal-600/25" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"
          }`}>
            <Icon size={14} strokeWidth={2} />
          </div>
          <span className="flex-1">{label}</span>
          {isActive && <ChevronRight size={14} className="text-teal-400" />}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="hidden lg:flex w-[240px] bg-white flex-col min-h-screen border-r border-slate-100">
      <div className="px-5 h-14 flex items-center gap-2.5 border-b border-slate-50">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-md shadow-teal-600/20">
          <ParkingSquare size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-[14px] font-bold text-slate-900 tracking-tight leading-none">AI Parking</h1>
          <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-[0.12em] mt-0.5">Gujarat</p>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-4 overflow-auto">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-3 text-[9px] font-bold text-slate-300 uppercase tracking-[0.12em] mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}

        <div className="mb-4">
          <NavItem to="/settings" label="Settings" icon={Settings} />
        </div>
      </nav>

      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-[11px] font-bold shadow-sm shadow-teal-600/20">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">Super Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
