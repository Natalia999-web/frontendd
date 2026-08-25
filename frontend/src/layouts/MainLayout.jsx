import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Navbar from "../shared/components/Navbar";
import Sidebar from "../shared/components/Sidebar";
import { getUser } from "../services/authService";
import { esRolRepartidor, esRutaDeRepartidor } from "../utils/roles";
import "../App.css";

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const location = useLocation();
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [location]);

  // Un solo portero para todo /admin: el repartidor solo abre su panel. Antes
  // dependía de que a su rol no le hubieran dado los privilegios de gestión;
  // con escribir la URL a mano se colaba en pedidos o domicilios ajenos.
  if (esRolRepartidor(getUser()?.rol) && !esRutaDeRepartidor(location.pathname)) {
    return <Navigate to="/admin/mi-dashboard" replace />;
  }

  return (
      <div className="app-layout">
        <Navbar onToggleSidebar={() => setSidebarOpen(v => !v)} isLanding={false} />

        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="app-body">
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />

          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
  );
};

export default MainLayout;