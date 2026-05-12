import { useFilter } from "@/contexts/FilterContext";
import SearchSelect from "@/components/SearchSelect";
import { MapPin, X, ChevronRight } from "lucide-react";

export default function GlobalFilter() {
  const {
    cityId, talukaId, villageId, areaId,
    cities, talukas, villages, areas,
    setCityId, setTalukaId, setVillageId, setAreaId,
    resetFilters, isFiltering,
  } = useFilter();

  const cityName = cities.find((c) => c.id === cityId)?.name || "";
  const talukaName = talukas.find((t) => t.id === talukaId)?.name || "";
  const talukaLabel = talukaId ? talukaName : cityName ? `${cityName} City` : "";
  const villageLabel = villageId
    ? villages.find((v) => v.id === villageId)?.name || ""
    : talukaId ? `${talukaName} Taluka` : cityName ? `${cityName} City` : "";

  return (
    <div className="bg-white border-b border-slate-100 px-6 py-2.5 flex items-center gap-3">
      <MapPin size={14} className="text-slate-400 shrink-0" />

      <div className="flex items-center gap-1 text-[12px] text-slate-400">
        <span className="font-medium text-slate-600">Gujarat</span>
        {cityId && <><ChevronRight size={12} /><span className="font-medium text-slate-600">{cityName}</span></>}
        {cityId && <><ChevronRight size={12} /><span className="font-medium text-slate-600">{talukaLabel}</span></>}
        {cityId && <><ChevronRight size={12} /><span className="font-medium text-slate-600">{villageLabel}</span></>}
        {areaId && <><ChevronRight size={12} /><span className="font-medium text-teal-600">{areas.find((a) => a.id === areaId)?.name}</span></>}
      </div>

      {isFiltering && (
        <button onClick={resetFilters} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={14} />
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <SearchSelect
          value={cityId || "_all"}
          onValueChange={(v) => setCityId(v === "_all" ? "" : v)}
          options={[{ value: "_all", label: "All Cities" }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
          placeholder="City"
          searchPlaceholder="Search city..."
          className="w-36"
        />

        {cityId && (
          <SearchSelect
            value={talukaId || "_city"}
            onValueChange={(v) => setTalukaId(v === "_city" ? "" : v)}
            options={[{ value: "_city", label: `${cityName} City` }, ...talukas.map((t) => ({ value: t.id, label: t.name }))]}
            placeholder={`${cityName} City`}
            searchPlaceholder="Search taluka..."
            className="w-40"
          />
        )}

        {cityId && (
          <SearchSelect
            value={villageId || "_parent"}
            onValueChange={(v) => setVillageId(v === "_parent" ? "" : v)}
            options={[
              { value: "_parent", label: talukaId ? `${talukaName} Taluka` : `${cityName} City` },
              ...villages.map((v) => ({ value: v.id, label: v.name })),
            ]}
            placeholder={talukaId ? `${talukaName} Taluka` : `${cityName} City`}
            searchPlaceholder="Search village..."
            className="w-40"
          />
        )}

        {cityId && (
          <SearchSelect
            value={areaId || "_all"}
            onValueChange={(v) => setAreaId(v === "_all" ? "" : v)}
            options={[{ value: "_all", label: "All Areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
            placeholder="All Areas"
            searchPlaceholder="Search area..."
            className="w-40"
          />
        )}
      </div>
    </div>
  );
}
