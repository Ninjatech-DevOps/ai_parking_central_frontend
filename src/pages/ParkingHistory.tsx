import { useState, useCallback, useEffect } from "react";
import { slotEventsApi, locationsApi, areasApi } from "@/services/api";
import { useFilter } from "@/contexts/FilterContext";
import { usePolling } from "@/hooks/usePolling";
import Pagination from "@/components/Pagination";
import SearchSelect from "@/components/SearchSelect";
import { ParkingSquare, Car, Timer, Image as ImageIcon, X } from "lucide-react";
import { FilterToolbar, FilterPanel, LiveBadge } from "@/components/FilterPanel";
import type { ParkingSession, Location, Area } from "@/types/api";
import { SkeletonShell, SkeletonHeader, SkeletonFilterBar, SkeletonTable } from "@/components/Skeleton";

function ParkingHistorySkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader action={false} />
      {/* Filters: area, location, camera, status, type, duration, from, to */}
      <SkeletonFilterBar selects={7} />
      {/* Sessions table: Slot, Image, Type, Vehicle, Area, Location, Camera, Entry, Exit, Duration, Status */}
      <SkeletonTable rows={8} cols={11} />
    </SkeletonShell>
  );
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "\u2014";
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function ParkingHistory() {
  const { queryParams } = useFilter();
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [areas, setAreas] = useState<Area[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cameraOptions, setCameraOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const [durationUnit, setDurationUnit] = useState<"min" | "hr">("min");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Draft filter values (edited in the panel, committed on Apply)
  const [draftArea, setDraftArea] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftCamera, setDraftCamera] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftEventType, setDraftEventType] = useState("");
  const [draftMinDuration, setDraftMinDuration] = useState("");
  const [draftMaxDuration, setDraftMaxDuration] = useState("");
  const [draftDurationUnit, setDraftDurationUnit] = useState<"min" | "hr">("min");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");

  // Fetch filter options
  useEffect(() => {
    areasApi.list("page_size=500").then(({ data }) => setAreas(data.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const locParams = draftArea
      ? `area_id=${draftArea}&page_size=200`
      : `${queryParams}&page_size=200`;
    locationsApi.list(locParams).then(({ data }) => setLocations(data.items || [])).catch(() => {});
  }, [queryParams, draftArea]);

  // Build camera options with location context
  useEffect(() => {
    if (draftLocation) {
      locationsApi.canvas(draftLocation).then(({ data }) => {
        const cams = (data.cameras || []).map((c: { id: string; position_label: string }) => ({
          value: c.id,
          label: c.position_label,
        }));
        setCameraOptions(cams);
      }).catch(() => setCameraOptions([]));
    } else if (locations.length > 0) {
      // Fetch cameras from all locations with location name context
      Promise.all(
        locations.map((loc) =>
          locationsApi.canvas(loc.id)
            .then(({ data }) =>
              (data.cameras || []).map((c: { id: string; position_label: string }) => ({
                value: c.id,
                label: `${c.position_label} (${loc.name})`,
              }))
            )
            .catch(() => [] as { value: string; label: string }[])
        )
      ).then((results) => setCameraOptions(results.flat()));
    } else {
      setCameraOptions([]);
    }
  }, [draftLocation, locations]);

  // Convert duration inputs to minutes for API
  const durationMultiplier = durationUnit === "hr" ? 60 : 1;

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (selectedArea) params.set("area_id", selectedArea);
      if (selectedLocation) params.set("location_id", selectedLocation);
      if (selectedCamera) params.set("camera_id", selectedCamera);

      // Map combined status values
      if (selectedStatus === "blocked") {
        params.set("status", "parked");
        params.set("event_type", "OBSTRUCTED");
      } else if (selectedStatus === "cleared") {
        params.set("status", "completed");
        params.set("event_type", "OBSTRUCTED");
      } else {
        if (selectedStatus) params.set("status", selectedStatus);
        if (selectedEventType) params.set("event_type", selectedEventType);
      }

      if (minDuration) params.set("min_duration", String(Number(minDuration) * durationMultiplier));
      if (maxDuration) params.set("max_duration", String(Number(maxDuration) * durationMultiplier));
      if (startDate) params.set("start_date", new Date(startDate).toISOString());
      if (endDate) params.set("end_date", new Date(endDate).toISOString());

      const { data } = await slotEventsApi.history(params.toString());
      setSessions(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch {
      setSessions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedArea, selectedLocation, selectedCamera, selectedStatus, selectedEventType, minDuration, maxDuration, durationMultiplier, startDate, endDate]);

  usePolling(fetchSessions, 15000);

  const activeSessions = sessions.filter((s) => s.is_active).length;

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Close image preview on Escape key
  useEffect(() => {
    if (!previewImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewImage(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImage]);

  const activeFilterCount = [selectedArea, selectedLocation, selectedCamera, selectedStatus, selectedEventType, minDuration || maxDuration, startDate, endDate].filter(Boolean).length;
  const isLive = !startDate && !endDate;

  function openFilters() {
    setDraftArea(selectedArea); setDraftLocation(selectedLocation); setDraftCamera(selectedCamera);
    setDraftStatus(selectedStatus); setDraftEventType(selectedEventType);
    setDraftMinDuration(minDuration); setDraftMaxDuration(maxDuration); setDraftDurationUnit(durationUnit);
    setDraftStartDate(startDate); setDraftEndDate(endDate);
    setFiltersOpen(true);
  }
  function applyFilters() {
    setSelectedArea(draftArea); setSelectedLocation(draftLocation); setSelectedCamera(draftCamera);
    setSelectedStatus(draftStatus); setSelectedEventType(draftEventType);
    setMinDuration(draftMinDuration); setMaxDuration(draftMaxDuration); setDurationUnit(draftDurationUnit);
    setStartDate(draftStartDate); setEndDate(draftEndDate);
    setPage(1); setFiltersOpen(false);
  }
  function clearFilters() {
    setDraftArea(""); setDraftLocation(""); setDraftCamera(""); setDraftStatus(""); setDraftEventType("");
    setDraftMinDuration(""); setDraftMaxDuration(""); setDraftDurationUnit("min"); setDraftStartDate(""); setDraftEndDate("");
    setSelectedArea(""); setSelectedLocation(""); setSelectedCamera(""); setSelectedStatus(""); setSelectedEventType("");
    setMinDuration(""); setMaxDuration(""); setDurationUnit("min"); setStartDate(""); setEndDate(""); setPage(1);
  }

  // When blocked/cleared is selected, disable the type filter (it's implied)
  const typeFilterDisabled = draftStatus === "blocked" || draftStatus === "cleared";

  if (loading && sessions.length === 0) return <ParkingHistorySkeleton />;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] font-bold text-slate-900">Parking History</h1>
            {isLive && <LiveBadge />}
          </div>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {total} sessions{activeSessions > 0 && <> &middot; {activeSessions} currently parked</>}
          </p>
        </div>
      </div>

      {/* Filters button */}
      <FilterToolbar filterCount={activeFilterCount} onOpen={openFilters} />

      {/* Inline Filter panel (draft → Apply) */}
      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} onApply={applyFilters} onClear={clearFilters}>
        <FilterField label="Area">
          <SearchSelect
            options={[{ value: "", label: "All Areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
            value={draftArea}
            onValueChange={(v) => { setDraftArea(v); setDraftLocation(""); setDraftCamera(""); }}
            placeholder="All Areas"
            className="w-full"
          />
        </FilterField>

        <FilterField label="Location">
          <SearchSelect
            options={[{ value: "", label: "All Locations" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
            value={draftLocation}
            onValueChange={(v) => { setDraftLocation(v); setDraftCamera(""); }}
            placeholder="All Locations"
            className="w-full"
          />
        </FilterField>

        <FilterField label="Camera">
          <SearchSelect
            options={[{ value: "", label: "All Cameras" }, ...cameraOptions]}
            value={draftCamera}
            onValueChange={(v) => setDraftCamera(v)}
            placeholder="All Cameras"
            className="w-full"
          />
        </FilterField>

        <FilterField label="Status">
          <SearchSelect
            options={[
              { value: "", label: "All Statuses" },
              { value: "parked", label: "Parked" },
              { value: "completed", label: "Completed" },
              { value: "blocked", label: "Blocked" },
              { value: "cleared", label: "Cleared" },
            ]}
            value={draftStatus}
            onValueChange={(v) => setDraftStatus(v)}
            placeholder="All Statuses"
            className="w-full"
          />
        </FilterField>

        <FilterField label="Type">
          <SearchSelect
            options={[
              { value: "", label: "All Types" },
              { value: "VEHICLE", label: "Vehicle" },
              { value: "OBSTRUCTED", label: "Obstructed" },
            ]}
            value={typeFilterDisabled ? "" : draftEventType}
            onValueChange={(v) => setDraftEventType(v)}
            placeholder={typeFilterDisabled ? "Set by status" : "All Types"}
            className={`w-full ${typeFilterDisabled ? "opacity-40 pointer-events-none" : ""}`}
          />
        </FilterField>

        <FilterField label="Duration">
          <div className="flex items-center h-10 rounded-lg border border-slate-200 bg-white overflow-hidden">
            <input
              type="number" min="0" value={draftMinDuration}
              onChange={(e) => setDraftMinDuration(e.target.value)}
              placeholder="Min"
              className="flex-1 min-w-0 h-full px-2 text-[12px] text-slate-700 text-center focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] text-slate-300 shrink-0">to</span>
            <input
              type="number" min="0" value={draftMaxDuration}
              onChange={(e) => setDraftMaxDuration(e.target.value)}
              placeholder="Max"
              className="flex-1 min-w-0 h-full px-2 text-[12px] text-slate-700 text-center focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <select
              value={draftDurationUnit}
              onChange={(e) => setDraftDurationUnit(e.target.value as "min" | "hr")}
              className="h-full border-l border-slate-200 px-1.5 text-[11px] text-slate-500 bg-slate-50 focus:outline-none cursor-pointer"
            >
              <option value="min">min</option>
              <option value="hr">hrs</option>
            </select>
          </div>
        </FilterField>

        <FilterField label="From">
          <input
            type="datetime-local" value={draftStartDate}
            onChange={(e) => setDraftStartDate(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
          />
        </FilterField>

        <FilterField label="To">
          <input
            type="datetime-local" value={draftEndDate}
            onChange={(e) => setDraftEndDate(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
          />
        </FilterField>
      </FilterPanel>

      {/* Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden relative">
        {loading && sessions.length > 0 && (
          <div className="absolute inset-0 z-10">
            <SkeletonTable rows={sessions.length} cols={11} />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Slot", "Image", "Type", "Vehicle", "Area", "Location", "Camera", "Entry Time", "Exit Time", "Duration", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-16">
                  <Car size={28} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-[13px] text-slate-400">No parking sessions found</p>
                  <p className="text-[11px] text-slate-300 mt-1">Adjust your filters or date range</p>
                </td></tr>
              ) : sessions.map((s) => (
                <tr key={s.entry_event_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  {/* Slot */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                        <ParkingSquare size={13} className="text-teal-600" />
                      </div>
                      <span className="text-[13px] font-bold text-slate-800 font-mono">{s.slot_label}</span>
                    </div>
                  </td>
                  {/* Image */}
                  <td className="px-4 py-3">
                    {s.image_url ? (
                      <button
                        onClick={() => setPreviewImage(s.image_url)}
                        className="group relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors"
                      >
                        <img src={s.image_url} alt={s.slot_label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ImageIcon size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                        <ImageIcon size={12} className="text-slate-300" />
                      </div>
                    )}
                  </td>
                  {/* Type */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[10px] font-bold rounded-lg px-2 py-0.5 ${
                      s.event_type === "OBSTRUCTED" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                    }`}>
                      {s.event_type === "OBSTRUCTED" ? "Obstructed" : "Vehicle"}
                    </span>
                  </td>
                  {/* Vehicle Type */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-slate-600">
                      {s.detected_vehicle_type === "TWO_WHEELER" ? "2-Wheeler" : s.detected_vehicle_type === "CAR" ? "Car" : "\u2014"}
                    </span>
                  </td>
                  {/* Area */}
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-[12px] text-slate-600">{s.area_name || "\u2014"}</span>
                      {s.city_name && <span className="text-[10px] text-slate-400 block">{s.city_name}</span>}
                    </div>
                  </td>
                  {/* Location */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-slate-600">{s.location_name || "\u2014"}</span>
                  </td>
                  {/* Camera */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-slate-500 font-mono">{s.camera_label || "\u2014"}</span>
                  </td>
                  {/* Entry */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-slate-700">{formatTime(s.entry_time)}</span>
                  </td>
                  {/* Exit */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-slate-700">{s.exit_time ? formatTime(s.exit_time) : "\u2014"}</span>
                  </td>
                  {/* Duration */}
                  <td className="px-4 py-3">
                    {s.duration_minutes !== null ? (
                      <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
                        s.duration_minutes > 120 ? "text-amber-600" : "text-slate-600"
                      }`}>
                        <Timer size={11} />
                        {formatDuration(s.duration_minutes)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-slate-300">{"\u2014"}</span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    {(() => {
                      const isObs = s.event_type === "OBSTRUCTED";
                      const label = s.is_active ? (isObs ? "Blocked" : "Parked") : (isObs ? "Cleared" : "Completed");
                      const cls = s.is_active
                        ? (isObs ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600")
                        : "bg-emerald-50 text-emerald-600";
                      const dot = s.is_active
                        ? (isObs ? "bg-amber-500 animate-pulse" : "bg-red-500 animate-pulse")
                        : "bg-emerald-500";
                      return (
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold rounded-lg px-2.5 py-1 ${cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          {label}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full card-shadow flex items-center justify-center hover:bg-slate-50 transition-colors z-10"
            >
              <X size={14} className="text-slate-600" />
            </button>
            <img
              src={previewImage}
              alt="Slot detection"
              className="w-full rounded-2xl card-shadow"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-semibold text-slate-600 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
