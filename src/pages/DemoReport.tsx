import { useState, useEffect } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { areasApi, demoReportApi } from "@/services/api";
import SearchSelect from "@/components/SearchSelect";
import { FileDown, Loader2, MapPin, Building2, Clock, Calendar } from "lucide-react";
import type { Area, Location } from "@/types/api";

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

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  async function handleDownload() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (selectedArea) params.set("area_id", selectedArea);
      if (selectedLocation) params.set("location_id", selectedLocation);
      await demoReportApi.downloadPdf(params.toString());
    } catch {
      /* axios interceptor surfaces errors */
    } finally {
      setDownloading(false);
    }
  }

  const selectedAreaName = areas.find((a) => a.id === selectedArea)?.name;
  const selectedLocationName = filteredLocations.find((l: Location) => l.id === selectedLocation)?.name;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-slate-900">Demo Report</h1>
        <p className="text-[13px] text-slate-400 mt-1">Generate a comprehensive AI Parking & ANPR PDF report for today's operating hours</p>
      </div>

      {/* Info card */}
      <div className="bg-gradient-to-br from-teal-50 to-white rounded-2xl card-shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
              <Calendar size={16} className="text-teal-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Date</p>
              <p className="text-[13px] font-semibold text-slate-800">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
              <Clock size={16} className="text-teal-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Operating Hours</p>
              <p className="text-[13px] font-semibold text-slate-800">10:00 AM - 6:00 PM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl card-shadow p-6 mb-6">
        <h2 className="text-[14px] font-bold text-slate-800 mb-4 flex items-center gap-2">
          <MapPin size={15} className="text-teal-600" />
          Select Scope
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Area</label>
            <SearchSelect
              options={[{ value: "", label: "All Areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
              value={selectedArea}
              onValueChange={(v) => { setSelectedArea(v); setSelectedLocation(""); }}
              placeholder="All Areas"
              className="w-full h-10"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Location</label>
            <SearchSelect
              options={[{ value: "", label: "All Locations" }, ...filteredLocations.map((l: Location) => ({ value: l.id, label: l.name }))]}
              value={selectedLocation}
              onValueChange={setSelectedLocation}
              placeholder="All Locations"
              className="w-full h-10"
            />
          </div>
        </div>

        {/* Selection summary */}
        <div className="mt-4 flex items-center gap-2 text-[12px] text-slate-500">
          <Building2 size={13} className="text-slate-400" />
          <span>
            Report for:{" "}
            <span className="font-semibold text-slate-700">
              {selectedLocationName || selectedAreaName || "All Locations"}
            </span>
          </span>
        </div>
      </div>

      {/* Report contents preview */}
      <div className="bg-white rounded-2xl card-shadow p-6 mb-6">
        <h2 className="text-[14px] font-bold text-slate-800 mb-3">Report Includes</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            "Executive Summary & KPIs",
            "Closing Snapshot @ 6 PM",
            "Hourly Occupancy (10a-6p)",
            "Parking Duration Breakdown",
            "Per-Location AI Parking",
            "Per-Location ANPR",
            "ANPR Entry/Exit Analysis",
            "Vehicle Type Split",
            "Top Plates & Busiest Locations",
            "OCR Accuracy Stats",
            "ANPR Sessions Table",
            "Location Comparison Table",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-[12px] text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="w-full flex items-center justify-center gap-2.5 h-12 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-[14px] font-bold shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {downloading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating Report...
          </>
        ) : (
          <>
            <FileDown size={18} />
            Download PDF Report
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-slate-400 mt-3">
        Landscape PDF with charts, tables, and per-location breakdowns
      </p>
    </div>
  );
}
