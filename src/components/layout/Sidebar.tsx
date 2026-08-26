import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Monitor, Users, Settings,
  ChevronRight, Building2, Globe, ShieldCheck,
  ScanLine, Car, Link2, ArrowLeftRight,
} from "lucide-react";

interface NavItemConfig {
  to: string;
  label: string;
  icon: React.ElementType;
  /** Permission(s) required — user needs at least one to see this item */
  permissions?: string[];
}

interface SectionConfig {
  label: string;
  items: NavItemConfig[];
}

const sections: SectionConfig[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/parking-history", label: "Parking History", icon: Car, permissions: ["slots:view"] },
      { to: "/vehicle-movements", label: "Vehicle In / Out", icon: ArrowLeftRight, permissions: ["vehicle_movements:view"] },
      // { to: "/anpr-history", label: "Prahaladnagar MLP History", icon: ScanLine, permissions: ["anpr:view"] }, // hidden
      // { to: "/anpr-records", label: "Prahaladnagar MLP Records", icon: ScanLine, permissions: ["anpr:view"] }, // hidden
    ],
  },
  {
    label: "Parking Mgmt",
    items: [
      { to: "/parking-lots", label: "Parking Locations", icon: Building2, permissions: ["locations:view"] },
    ],
  },
  {
    label: "Device Mgmt",
    items: [
      { to: "/devices", label: "Devices", icon: Monitor, permissions: ["devices:view"] },
      // { to: "/ota-updates", label: "OTA Updates", icon: Download, permissions: ["devices:update"] }, // hidden
    ],
  },
  {
    label: "Monitoring",
    items: [
      // { to: "/alerts", label: "Alerts", icon: Bell, permissions: ["alerts:view"] }, // hidden
      // { to: "/reports", label: "Reports", icon: FileDown, permissions: ["reports:view"] }, // hidden
      // { to: "/demo-report", label: "Demo Report", icon: Download, permissions: ["reports:view"] }, // hidden
    ],
  },
  {
    label: "Location Mgmt",
    items: [
      { to: "/location-management", label: "Geography", icon: Globe, permissions: ["locations:view"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/users", label: "Users", icon: Users, permissions: ["users:view"] },
      { to: "/roles", label: "Roles", icon: ShieldCheck, permissions: ["roles:view", "roles:manage"] },
      { to: "/shared-links", label: "Shared Links", icon: Link2 },
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
  const { user, permissions, hasAnyPermission, roleName } = useAuth();

  // Format role name for display: "SUPER_ADMIN" → "Super Admin"
  const displayRole = roleName ? roleName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "User";

  // If backend hasn't returned permissions yet (old backend or loading), show all items.
  // Permission-based hiding only activates once we have actual permissions data.
  const hasPermsData = permissions.length > 0;

  return (
    <aside className="hidden lg:flex w-[240px] bg-white flex-col min-h-screen border-r border-slate-100 no-print">
      <div className="px-5 h-14 flex items-center gap-2 border-b border-slate-50">
        <img src="/AIParking.jpg" alt="AI Parking" className="h-9 w-auto max-w-[140px] object-contain" />
        <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-[0.12em]">Gujarat</span>
      </div>

      <nav className="flex-1 px-3 pt-4 overflow-auto">
        {sections.map((section) => {
          // Filter items by permission — show item if no permissions required or user has at least one
          const visibleItems = section.items.filter(
            (item) => !item.permissions || !hasPermsData || hasAnyPermission(...item.permissions),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-4">
              <p className="px-3 text-[9px] font-bold text-slate-300 uppercase tracking-[0.12em] mb-1.5">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            </div>
          );
        })}

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
            <p className="text-[10px] text-slate-400 truncate">{displayRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
