import {
  createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { citiesApi, areasApi, statesApi, locationsApi } from "@/services/api";
import type { State, City, Area, Location } from "@/types/api";

interface FilterState {
  // Locked values (auto-set, not user-selectable)
  stateId: string;
  cityId: string;
  cityName: string;

  // User-selectable filters
  areaId: string;
  locationId: string;

  areas: Area[];
  locations: Location[];

  setAreaId: (id: string) => void;
  setLocationId: (id: string) => void;
  resetFilters: () => void;

  // Query params for API calls
  queryParams: string;          // most specific: location_id > area_id > city_id
  locationQueryParams: string;  // alias for queryParams (backward compat)
  deviceQueryParams: string;    // devices filter by city_id
  alertQueryParams: string;
  filterLabel: string;
  isFiltering: boolean;
}

const FilterContext = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState("Ahmedabad");
  const [areaId, setAreaIdRaw] = useState("");
  const [locationId, setLocationIdRaw] = useState("");

  const [areas, setAreas] = useState<Area[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Auto-lock to Gujarat → Ahmedabad on login
  useEffect(() => {
    if (!user) return;
    statesApi.list().then(({ data }) => {
      const gj = (data.items || []).find((s) => s.code === "GJ");
      if (gj) {
        setStateId(gj.id);
        citiesApi.byState(gj.id).then(({ data: cd }) => {
          const cities = cd.items || [];
          const ahm = cities.find((c) => c.name.toLowerCase().includes("ahmedabad"));
          if (ahm) { setCityId(ahm.id); setCityName(ahm.name); }
          else if (cities.length > 0) { setCityId(cities[0].id); setCityName(cities[0].name); }
        });
      }
    }).catch(() => {});
  }, [user]);

  // Load areas for Ahmedabad (city-level only, taluka_id is null)
  useEffect(() => {
    if (!cityId) return;
    areasApi.list(`city_id=${cityId}&page_size=500`).then(({ data }) => {
      setAreas((data.items || []).filter((a: Area) => !a.taluka_id));
    }).catch(() => {});
  }, [cityId]);

  // Load locations — filtered by area if selected, otherwise all in city
  useEffect(() => {
    if (!cityId) return;
    const params = areaId
      ? `area_id=${areaId}&page_size=200`
      : `city_id=${cityId}&page_size=200`;
    locationsApi.list(params).then(({ data }) => setLocations(data.items || [])).catch(() => {});
  }, [cityId, areaId]);

  const setAreaId = useCallback((id: string) => {
    setAreaIdRaw(id);
    setLocationIdRaw(""); // reset location when area changes
  }, []);
  const setLocationId = useCallback((id: string) => { setLocationIdRaw(id); }, []);
  const resetFilters = useCallback(() => { setAreaIdRaw(""); setLocationIdRaw(""); }, []);

  // Build query params — most specific wins
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    else if (cityId) p.set("city_id", cityId);
    return p.toString();
  }, [cityId, areaId, locationId]);

  // Devices: most specific filter wins
  const deviceQueryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    else if (cityId) p.set("city_id", cityId);
    return p.toString();
  }, [cityId, areaId, locationId]);

  // Alerts: most specific filter wins
  const alertQueryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    else if (cityId) p.set("city_id", cityId);
    return p.toString();
  }, [cityId, areaId, locationId]);

  const isFiltering = areaId !== "" || locationId !== "";

  const filterLabel = useMemo(() => {
    const parts: string[] = [cityName];
    if (areaId) { const a = areas.find((x) => x.id === areaId); if (a) parts.push(a.name); }
    if (locationId) { const l = locations.find((x) => x.id === locationId); if (l) parts.push(l.name); }
    return parts.join(" → ");
  }, [cityName, areaId, locationId, areas, locations]);

  return (
    <FilterContext.Provider value={{
      stateId, cityId, cityName,
      areaId, locationId,
      areas, locations,
      setAreaId, setLocationId, resetFilters,
      queryParams, locationQueryParams: queryParams, deviceQueryParams, alertQueryParams,
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
