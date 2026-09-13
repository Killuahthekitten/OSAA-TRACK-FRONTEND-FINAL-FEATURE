import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";
import { DashboardProvider } from "../../context/DashboardContext.jsx";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => setSidebarOpen(false), [location.pathname]);

  return (
    <DashboardProvider>
      <div className="min-h-screen bg-slate-100">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-h-screen pl-0 pt-[76px] lg:pl-[300px]">
          <div className="mx-auto max-w-[1229px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </DashboardProvider>
  );
}
