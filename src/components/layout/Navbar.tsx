import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import { Button } from "@/components/ui/button";
import SearchSelect from "@/components/SearchSelect";
import { LogOut, MapPin, X } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function Navbar() {
  const { user, logout, roleName } = useAuth();
  const { areaId, locationId, areas, locations, setAreaId, setLocationId, resetFilters, isFiltering, cityName } = useFilter();

  return (
    <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-10">
      {/* Left: Filters */}
      <div className="flex items-center gap-3">
        <MapPin size={14} className="text-teal-500 shrink-0" />
        <span className="text-[12px] font-semibold text-slate-500">{cityName}</span>
        <span className="text-slate-200">|</span>

        <SearchSelect
          value={areaId || "_all"}
          onValueChange={(v) => setAreaId(v === "_all" ? "" : v)}
          options={[{ value: "_all", label: "All Areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
          placeholder="All Areas"
          searchPlaceholder="Search area..."
          className="w-40"
        />

        <SearchSelect
          value={locationId || "_all"}
          onValueChange={(v) => setLocationId(v === "_all" ? "" : v)}
          options={[{ value: "_all", label: "All Locations" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
          placeholder="All Locations"
          searchPlaceholder="Search location..."
          className="w-44"
        />

        {isFiltering && (
          <button onClick={resetFilters} className="text-slate-400 hover:text-red-500 transition-colors" title="Clear filters">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Right: User + Notifications */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="w-px h-8 bg-slate-100 mx-1" />
        <div className="flex items-center gap-2.5 pl-1">
          <div className="text-right">
            <p className="text-[12px] font-semibold text-slate-700">{user?.name}</p>
            <p className="text-[10px] text-slate-400">{roleName ? roleName.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "User"}</p>
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
