import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getUser, logout } from "../../services/authService";
import { esRolRepartidor } from "../../utils/roles";
import { usePrivilegios } from "../../context/PrivilegiosContext";
import LogoutModal from "./LogoutModal";
import "./Sidebar.css";
import {
  Globe, LayoutDashboard, Settings, ShoppingCart, Layers, TrendingUp, User,
  Home, Pencil, Monitor, Shield, Users, Upload, FolderOpen, Package, Receipt,
  Building2, Tag, Box, ClipboardList, Utensils, ShoppingBag, Truck,
  Navigation, History, Banknote, Bell, UserCircle, RotateCcw, BarChart2,
  Search, ChevronLeft, ChevronRight, ChevronDown, LogOut,
} from "lucide-react";

/* =========================
   MENÚS
========================= */

const adminMenuItems = [
  {
    section: "Sitio Web",
    Icon: Globe,
    items: [
      { label: "Ver Landing Page",    Icon: Home,    link: "/",              privilegioKey: "LandingPage" },
      { label: "Editar Landing Page", Icon: Pencil,  link: "/admin/landing", privilegioKey: "LandingPage" },
    ],
  },
  {
    section: "Dashboard",
    Icon: LayoutDashboard,
    items: [
      { label: "Vista General", Icon: Monitor,   link: "/admin",          privilegioKey: "Dashboard" },
      { label: "Reportes",      Icon: BarChart2, link: "/admin/reportes", privilegioKey: "Dashboard" },
    ],
  },
  {
    section: "Configuración",
    Icon: Settings,
    items: [
      { label: "Roles y Privilegios", Icon: Shield,  link: "/admin/roles",     privilegioKey: "Roles" },
      { label: "Gestión de Usuario",  Icon: Users,   link: "/admin/usuarios",   privilegioKey: "Usuarios" },
      { label: "Gestión de Salidas",  Icon: Upload,  link: "/admin/salidas",    privilegioKey: "GestionSalidas" },
    ],
  },
  {
    section: "Compras",
    Icon: ShoppingCart,
    items: [
      { label: "Categorías de Insumos", Icon: FolderOpen, link: "/admin/categorias_insumos",  privilegioKey: "CategoriaInsumos" },
      { label: "Gestión de Insumos",    Icon: Package,    link: "/admin/gestion-insumos",      privilegioKey: "Insumos" },
      { label: "Compras",               Icon: Receipt,    link: "/admin/compras",              privilegioKey: "Compras" },
      { label: "Proveedores",           Icon: Building2,  link: "/admin/proveedores",          privilegioKey: "Proveedores" },
    ],
  },
  {
    section: "Producción",
    Icon: Layers,
    items: [
      { label: "Categoría de Productos", Icon: Tag,           link: "/admin/categorias_productos", privilegioKey: "CategoriaProductos" },
      { label: "Gestión de Productos",   Icon: Box,           link: "/admin/products",             privilegioKey: "GestionProductos" },
      { label: "Órdenes de Producción",  Icon: ClipboardList, link: "/admin/ordenes-produccion",   privilegioKey: "OrdenesProduccion" },
      { label: "Cocina",                 Icon: Utensils,      link: "/admin/cocina",               roleRequired: "Cocinero" },
    ],
  },
  {
    section: "Ventas",
    Icon: TrendingUp,
    items: [
      { label: "Pedidos",        Icon: ShoppingBag,    link: "/admin/pedidos",              privilegioKey: "Pedidos" },
      { label: "Domicilios",     Icon: Truck,          link: "/admin/domicilios",           privilegioKey: "Domicilios", soloNoRepartidor: true },
      { label: "Mi Dashboard",   Icon: LayoutDashboard,link: "/admin/mi-dashboard",         clave: "Domicilios_cambiar_estado", hideFromAdmin: true },
      { label: "Mis Entregas",   Icon: Navigation,     link: "/admin/mis-entregas",         clave: "Domicilios_cambiar_estado", hideFromAdmin: true },
      { label: "Pedido Actual",  Icon: Package,        link: "/admin/pedido-actual",        clave: "Domicilios_cambiar_estado", hideFromAdmin: true },
      { label: "Historial",      Icon: History,        link: "/admin/historial-entregas",   clave: "Domicilios_cambiar_estado", hideFromAdmin: true },
      { label: "Mis Ganancias",  Icon: Banknote,       link: "/admin/mis-ganancias",        clave: "Domicilios_cambiar_estado", hideFromAdmin: true },
      { label: "Notificaciones", Icon: Bell,           link: "/admin/mis-notificaciones",   clave: "Domicilios_cambiar_estado", hideFromAdmin: true },
      { label: "Mi Perfil",      Icon: UserCircle,     link: "/admin/mi-perfil-repartidor", clave: "Domicilios_cambiar_estado", hideFromAdmin: true },
      { label: "Liquidaciones",  Icon: Banknote,       link: "/admin/liquidaciones",        privilegioKey: "Domicilios" },
      { label: "Devoluciones",   Icon: RotateCcw,      link: "/admin/devoluciones",         privilegioKey: "Devoluciones" },
    ],
  },
];

/* El repartidor ve su panel y nada más: sin pedidos ajenos, sin los
   domicilios de sus compañeros, sin liquidaciones. Las mismas rutas están en
   adminMenuItems para cualquier otro rol que tenga el privilegio. */
const repartidorMenuItems = [
  {
    section: "Mi Trabajo",
    Icon: Truck,
    items: [
      { label: "Mis Entregas",   Icon: Navigation,      link: "/admin/mis-entregas" },
      { label: "Pedido Actual",  Icon: Package,         link: "/admin/pedido-actual" },
      { label: "Mi Dashboard",   Icon: LayoutDashboard, link: "/admin/mi-dashboard" },
      { label: "Historial",      Icon: History,         link: "/admin/historial-entregas" },
      { label: "Mis Ganancias",  Icon: Banknote,        link: "/admin/mis-ganancias" },
      { label: "Notificaciones", Icon: Bell,            link: "/admin/mis-notificaciones" },
      { label: "Mi Perfil",      Icon: UserCircle,      link: "/admin/mi-perfil-repartidor" },
    ],
  },
];

const clienteMenuItems = [
  {
    section: "Mi Cuenta",
    Icon: User,
    items: [
      { label: "Inicio",       Icon: Home,        link: "/cliente/inicio" },
      { label: "Mis Pedidos",  Icon: ShoppingBag, link: "/cliente/pedidos" },
      { label: "Devoluciones", Icon: RotateCcw,   link: "/cliente/devoluciones" },
      { label: "Mi Perfil",    Icon: UserCircle,  link: "/cliente/perfil" },
    ],
  },
];

/* =========================
   COMPONENTE
========================= */

export default function Sidebar({ isOpen, onToggle }) {
  const [openSections, setOpenSections] = useState({
    Dashboard: true,
    Ventas: true,
    "Mi Trabajo": true,
    "Mi Cuenta": true,
  });

  const [search,          setSearch]          = useState("");
  const [user,            setUser]            = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();
  const { hasPrivilegio, isAdmin, loading } = usePrivilegios();

  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    window.addEventListener("session-changed", sync);
    window.addEventListener("profileUpdated", sync);
    return () => {
      window.removeEventListener("session-changed", sync);
      window.removeEventListener("profileUpdated", sync);
    };
  }, []);

  const canSeeItem = (item) => {
    if (item.roleRequired) {
      const expected = Array.isArray(item.roleRequired) ? item.roleRequired : [item.roleRequired];
      const rol = user?.rol?.toLowerCase();
      const matches = expected.some(r => r.toLowerCase() === rol);
      if (!matches) return false;
    }
    if (item.soloNoRepartidor && esRolRepartidor(user?.rol)) return false;
    if (item.soloAdmin && !isAdmin) return false;
    if (!item.privilegioKey && !item.clave) return true;
    if (loading) return false;
    if (item.hideFromAdmin && isAdmin) return false;
    if (isAdmin) return true;
    if (item.clave) return hasPrivilegio(item.clave);
    return hasPrivilegio(`${item.privilegioKey}_ver`);
  };

  const menuItems =
    user?.tipo !== "empleado"        ? clienteMenuItems
    : esRolRepartidor(user?.rol)     ? repartidorMenuItems
    : adminMenuItems;

  const toggle = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleLogout = () => setShowLogoutModal(true);
  const confirmLogout = () => { logout(); navigate("/login"); };
  if (!user) return null;

  return (
    <aside className={`sidebar ${isOpen ? "is-open" : "is-closed"}`}>
      <button
        className="sidebar-toggle-btn"
        onClick={onToggle}
        title={isOpen ? "Contraer menú" : "Expandir menú"}
      >
        {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      <div className="sidebar-content">
        <div className="sidebar-inner">

          <div className="sidebar-search">
            <span className="search-icon"><Search size={14} /></span>
            <input
              className="search-input"
              placeholder="Buscar módulo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="nav-group-label">Módulos</div>

          <nav className="sidebar-nav">
            {menuItems.map(({ section, Icon: SectionIcon, items }) => {
              const filtered = search
                ? items.filter(it => it.label.toLowerCase().includes(search.toLowerCase()))
                : items;

              const visible = filtered.filter(canSeeItem);
              if (visible.length === 0) return null;

              const isSectionOpen = openSections[section] || !!search;

              return (
                <div key={section}>
                  <button
                    className={`section-btn ${isSectionOpen ? "open" : ""}`}
                    onClick={() => toggle(section)}
                  >
                    <span className="section-icon-wrap">
                      <SectionIcon size={15} />
                    </span>
                    <span className="section-label">{section}</span>
                    <span className={`chevron ${isSectionOpen ? "rotated" : ""}`}>
                      <ChevronDown size={13} />
                    </span>
                  </button>

                  <div className={`submenu ${isSectionOpen ? "open" : ""}`}>
                    <div className="submenu-inner">
                      {visible.map(({ label, Icon: SubIcon, link }) => (
                          <Link
                            key={label}
                            to={link}
                            title={!isOpen ? label : undefined}
                            className={`sub-item ${location.pathname === link ? "active" : ""}`}
                          >
                            <span className="sub-icon"><SubIcon size={14} /></span>
                            <span className="sub-label">{label}</span>
                          </Link>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div
              className="avatar"
              onClick={() => navigate(user.tipo === "cliente" ? "/cliente/perfil" : "/admin/perfil")}
              title="Ver mi perfil"
            >
              {(user?.fotoPerfil || user?.Foto_perfil)
                ? <img src={user.fotoPerfil || user.Foto_perfil} alt={user.nombre} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 9 }} />
                : (user?.nombre?.charAt(0) || "U")
              }
            </div>
            <div className="footer-info">
              <div className="user-name">{user?.nombre}</div>
              <div className="user-role">{user?.tipo}</div>
            </div>
            <button className="logout-btn-sidebar" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {showLogoutModal && (
        <LogoutModal onConfirm={confirmLogout} onCancel={() => setShowLogoutModal(false)} />
      )}
    </aside>
  );
}
