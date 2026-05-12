import { useState, useEffect } from "react";
import { locationsApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchSelect from "@/components/SearchSelect";
import { showSuccess, showError } from "@/lib/toast";
import { Download, FileSpreadsheet, Calendar } from "lucide-react";
import type { Location } from "@/types/api";

export default function Reports() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    locationsApi.list("page_size=200").then(({ data }) => setLocations(data.items));
  }, []);

  async function handleDownload() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.set("location_id", locationId);
      if (startDate) params.set("start_date", new Date(startDate).toISOString());
      if (endDate) params.set("end_date", new Date(endDate).toISOString());

      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/v1/reports/slot-events?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `slot_events_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("Report downloaded");
    } catch {
      showError("Failed to download report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-[800px]">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-slate-900">Reports</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Download parking slot data as CSV</p>
      </div>

      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <FileSpreadsheet size={20} className="text-teal-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Slot Events Report</h2>
            <p className="text-[12px] text-slate-400">All slot state changes (Vehicle/Empty/Obstructed) with timestamps</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Parking Location</Label>
            <div className="mt-2">
              <SearchSelect
                value={locationId || "_all"}
                onValueChange={(v) => setLocationId(v === "_all" ? "" : v)}
                options={[{ value: "_all", label: "All Locations" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
                placeholder="All Locations"
                searchPlaceholder="Search location..."
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><Calendar size={12} /> Start Date</Label>
              <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" />
            </div>
            <div>
              <Label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><Calendar size={12} /> End Date</Label>
              <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" />
            </div>
          </div>

          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[14px] font-semibold gap-2 shadow-md shadow-teal-600/20"
          >
            <Download size={16} />
            {downloading ? "Downloading..." : "Download CSV"}
          </Button>
        </div>
      </div>
    </div>
  );
}
