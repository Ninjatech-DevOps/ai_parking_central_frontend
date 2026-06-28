import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FilterProvider } from "@/contexts/FilterContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import LocationManagement from "@/pages/LocationManagement";
import ParkingLots from "@/pages/ParkingLots";
import ParkingLotDetail from "@/pages/ParkingLotDetail";
import Devices from "@/pages/Devices";
import DeviceDetail from "@/pages/DeviceDetail";
import Alerts from "@/pages/Alerts";
import Users from "@/pages/Users";
import Roles from "@/pages/Roles";
import Settings from "@/pages/Settings";
import Reports from "@/pages/Reports";
import ParkingHistory from "@/pages/ParkingScanHistory";
import AnprHistory from "@/pages/AnprHistory";
import SharedLinks from "@/pages/SharedLinks";
import OTAUpdates from "@/pages/OTAUpdates";
import PublicView from "@/pages/PublicView";
import { Toaster } from "sonner";
import "./index.css";

function AppRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/view/:token" element={<PublicView />} />
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/location-management" element={<LocationManagement />} />
        <Route path="/parking-lots" element={<ParkingLots />} />
        <Route path="/parking-lots/:id" element={<ParkingLotDetail />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="/ota-updates" element={<OTAUpdates />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/parking-history" element={<ParkingHistory />} />
        <Route path="/anpr-history" element={<AnprHistory />} />
        <Route path="/users" element={<Users />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/shared-links" element={<SharedLinks />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FilterProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors closeButton duration={3000} />
        </FilterProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
