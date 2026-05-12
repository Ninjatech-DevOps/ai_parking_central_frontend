import {
  createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { citiesApi, talukasApi, villagesApi, areasApi, statesApi } from "@/services/api";
import type { State, City, Taluka, Village, Area } from "@/types/api";

interface FilterState {
  stateId: string;
  cityId: string;
  talukaId: string;
  villageId: string;
  areaId: string;

  states: State[];
  cities: City[];
  talukas: Taluka[];
  villages: Village[];
  areas: Area[];

  setCityId: (id: string) => void;
  setTalukaId: (id: string) => void;
  setVillageId: (id: string) => void;
  setAreaId: (id: string) => void;
  resetFilters: () => void;

  // Query params string for API calls — pass directly to backend
  locationQueryParams: string;
  deviceQueryParams: string;
  alertQueryParams: string;
  filterLabel: string;
  isFiltering: boolean;
}

const FilterContext = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [stateId, setStateId] = useState("");
  const [cityId, setCityIdRaw] = useState("");
  const [talukaId, setTalukaIdRaw] = useState("");
  const [villageId, setVillageIdRaw] = useState("");
  const [areaId, setAreaIdRaw] = useState("");

  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [talukas, setTalukas] = useState<Taluka[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // Load states (only when logged in)
  useEffect(() => {
    if (!user) return;
    statesApi.list().then(({ data }) => {
      setStates(data.items);
      const gj = data.items.find((s) => s.code === "GJ");
      if (gj) setStateId(gj.id);
    }).catch(() => {});
  }, [user]);

  // Load cities when state set
  useEffect(() => {
    if (!stateId || !user) return;
    citiesApi.byState(stateId).then(({ data }) => setCities(data.items)).catch(() => {});
  }, [stateId, user]);

  // Load talukas when city changes
  useEffect(() => {
    if (!cityId) { setTalukas([]); return; }
    talukasApi.byCity(cityId).then(({ data }) => setTalukas(data.items)).catch(() => {});
  }, [cityId]);

  // Load villages when taluka changes
  useEffect(() => {
    if (!talukaId) { setVillages([]); return; }
    villagesApi.byTaluka(talukaId).then(({ data }) => setVillages(data.items)).catch(() => {});
  }, [talukaId]);

  // Load areas — filter by most specific selection
  // When "City" default selected: show areas where taluka_id IS NULL (city-level only)
  // When taluka selected but village is default: show areas where taluka_id=X AND village_id IS NULL
  // When specific village selected: show areas where village_id=Y
  useEffect(() => {
    if (!cityId) { setAreas([]); return; }

    if (villageId) {
      // Specific village → show only that village's areas
      areasApi.list(`village_id=${villageId}&page_size=500`).then(({ data }) => setAreas(data.items)).catch(() => {});
    } else if (talukaId) {
      // Taluka selected, no village → show taluka-level areas only (village_id is null)
      areasApi.list(`taluka_id=${talukaId}&page_size=500`).then(({ data }) => {
        setAreas(data.items.filter((a: Area) => !a.village_id));
      }).catch(() => {});
    } else {
      // City selected, no taluka → show city-level areas only (taluka_id is null)
      areasApi.list(`city_id=${cityId}&page_size=500`).then(({ data }) => {
        setAreas(data.items.filter((a: Area) => !a.taluka_id));
      }).catch(() => {});
    }
  }, [cityId, talukaId, villageId]);

  // Cascade resets
  const setCityId = useCallback((id: string) => {
    setCityIdRaw(id); setTalukaIdRaw(""); setVillageIdRaw(""); setAreaIdRaw("");
  }, []);
  const setTalukaId = useCallback((id: string) => {
    setTalukaIdRaw(id); setVillageIdRaw(""); setAreaIdRaw("");
  }, []);
  const setVillageId = useCallback((id: string) => {
    setVillageIdRaw(id); setAreaIdRaw("");
  }, []);
  const setAreaId = useCallback((id: string) => { setAreaIdRaw(id); }, []);
  const resetFilters = useCallback(() => {
    setCityIdRaw(""); setTalukaIdRaw(""); setVillageIdRaw(""); setAreaIdRaw("");
  }, []);

  // Build backend query params — use the most specific filter available
  const locationQueryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (areaId) p.set("area_id", areaId);
    else if (villageId) p.set("village_id", villageId);
    else if (talukaId) p.set("taluka_id", talukaId);
    else if (cityId) p.set("city_id", cityId);
    return p.toString();
  }, [cityId, talukaId, villageId, areaId]);

  const deviceQueryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (cityId) p.set("city_id", cityId);
    return p.toString();
  }, [cityId]);

  const alertQueryParams = useMemo(() => {
    // Alerts filter by location_id — for now just return empty (backend scope handles it)
    return "";
  }, []);

  const isFiltering = cityId !== "";

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (cityId) { const c = cities.find((x) => x.id === cityId); if (c) parts.push(c.name); }
    if (talukaId) { const t = talukas.find((x) => x.id === talukaId); if (t) parts.push(t.name); }
    if (villageId) { const v = villages.find((x) => x.id === villageId); if (v) parts.push(v.name); }
    if (areaId) { const a = areas.find((x) => x.id === areaId); if (a) parts.push(a.name); }
    return parts.length > 0 ? parts.join(" → ") : "All Gujarat";
  }, [cityId, talukaId, villageId, areaId, cities, talukas, villages, areas]);

  return (
    <FilterContext.Provider value={{
      stateId, cityId, talukaId, villageId, areaId,
      states, cities, talukas, villages, areas,
      setCityId, setTalukaId, setVillageId, setAreaId, resetFilters,
      locationQueryParams, deviceQueryParams, alertQueryParams,
      filterLabel, isFiltering,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
