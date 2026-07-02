import { useState, useEffect } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { areasApi, demoReportApi } from "@/services/api";
import SearchSelect from "@/components/SearchSelect";
import {
  FileDown, Loader2, MapPin, Clock, ParkingSquare, ScanLine,
  BarChart3, Car, Bike, TrendingUp, Hash, Timer,
} from "lucide-react";
import type { Area, Location } from "@/types/api";

const REPORT_SECTIONS = [
  { icon: TrendingUp, label: "Executive Dashboard", desc: "KPIs, closing occupancy, daily timeline", color: "text-teal-600 bg-teal-50" },
  { icon: ParkingSquare, label: "AI Parking Analysis", desc: "Hourly activity, duration breakdown, sessions", color: "text-blue-600 bg-blue-50" },
  { icon: ScanLine, label: "ANPR Analysis", desc: "Entries/exits, plates, OCR accuracy, sessions", color: "text-violet-600 bg-violet-50" },
  { icon: BarChart3, label: "Location Comparison", desc: "Side-by-side occupancy & activity tables", color: "text-amber-600 bg-amber-50" },
];

export default function DemoReport() {
  const { locations } = useFilter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    areasApi.list("page_size=500").then(({ data }) => setAreas(data.items || [])).catch(() => {});
  }, []);

  const filteredLocations = selectedArea
    ? locations.filter((l: Location) => l.area_id === selectedArea)
    : locations;

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  async function handleDownload() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (selectedArea) params.set("area_id", selectedArea);
      if (selectedLocation) params.set("location_id", selectedLocation);
      await demoReportApi.downloadPdf(params.toString());
    } catch { /* interceptor */ }
    finally { setDownloading(false); }
  }

  const scopeLabel = filteredLocations.find((l: Location) => l.id === selectedLocation)?.name
    || areas.find((a) => a.id === selectedArea)?.name
    || "All Locations";

  return (
    <div className="w-full max-w-[560px] mx-auto py-2">
      {/* Hero */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 shadow-lg shadow-teal-600/25 mb-4">
          <FileDown size={24} className="text-white" />
        </div>
        <h1 className="text-[22px] font-bold text-slate-900">Daily Operations Report</h1>
        <p className="text-[13px] text-slate-400 mt-1">AI Parking & ANPR — comprehensive PDF</p>
      </div>

      {/* Date & Time card */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-5 mb-5 text-white shadow-lg shadow-teal-600/15">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-teal-200 text-[10px] font-bold uppercase tracking-wider">Report Date</p>
            <p className="text-[15px] font-bold mt-0.5">{dateStr}</p>
          </div>
          <div className="text-right">
            <p className="text-teal-200 text-[10px] font-bold uppercase tracking-wider">Operating Window</p>
            <div className="flex items-center gap-1.5 mt-0.5 justify-end">
              <Clock size={14} className="text-teal-200" />
              <p className="text-[15px] font-bold">10:00 AM — 6:00 PM</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-teal-500/30">
          {[
            { icon: ParkingSquare, label: "Slot Occupancy" },
            { icon: Car, label: "Vehicle Detection" },
            { icon: ScanLine, label: "Plate Recognition" },
            { icon: Hash, label: "Session Tracking" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-teal-100 font-medium">
              <Icon size={11} className="text-teal-300" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Scope selector */}
      <div className="bg-white rounded-2xl card-shadow p-5 mb-5">
        <div className="flex items-center gap-2 mb-3.5">
          <MapPin size={14} className="text-teal-600" />
          <h2 className="text-[13px] font-bold text-slate-800">Report Scope</h2>
          <span className="ml-auto text-[11px] text-slate-400 font-medium">{scopeLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Area</label>
            <SearchSelect
              options={[{ value: "", label: "All Areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
              value={selectedArea}
              onValueChange={(v) => { setSelectedArea(v); setSelectedLocation(""); }}
              placeholder="All Areas"
              className="w-full h-9"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
            <SearchSelect
              options={[{ value: "", label: "All Locations" }, ...filteredLocations.map((l: Location) => ({ value: l.id, label: l.name }))]}
              value={selectedLocation}
              onValueChange={setSelectedLocation}
              placeholder="All Locations"
              className="w-full h-9"
            />
          </div>
        </div>
      </div>

      {/* Report preview — what's inside */}
      <div className="bg-white rounded-2xl card-shadow p-5 mb-5">
        <h2 className="text-[13px] font-bold text-slate-800 mb-3">What's Inside</h2>
        <div className="space-y-2.5">
          {REPORT_SECTIONS.map(({ icon: Icon, label, desc, color }, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-300 w-4 text-right">{i + 1}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon size={13} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800">{label}</p>
                <p className="text-[10px] text-slate-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
          {["Closing @ 6 PM snapshot", "Hourly occupancy charts", "Duration distribution",
            "Top plates & locations", "OCR accuracy stats", "Per-location comparison",
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-1 h-1 rounded-full bg-teal-400" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Download */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="w-full flex items-center justify-center gap-2.5 h-[52px] rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-[14px] font-bold shadow-xl shadow-teal-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
      >
        {downloading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating Report...
          </>
        ) : (
          <>
            <FileDown size={18} />
            Generate & Download PDF
          </>
        )}
      </button>
      <p className="text-center text-[10px] text-slate-400 mt-2.5">
        3-4 page landscape PDF with charts, tables & location breakdowns
      </p>
    </div>
  );
}
