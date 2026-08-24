import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

/* ─── DASHBOARD ─── */
import Dashboard from "../features/dashboard/Dashboard";

/* ─── CONFIGURACIÓN ─── */
import GestionUsuarios from "../features/configuracion/Usuarios/GestionUsuarios";
import Empleados from "../features/configuracion/empleados/Empleados";
import Roles from "../features/configuracion/roles/Roles";
import GestionSalidas from "../features/salidas/GestionSalidas.jsx";

/* ─── PRODUCCIÓN ─── */
import CategoriaProductos from "../features/produccion/categoria_productos/Categoriaproductos";
import Productos from "../features/produccion/Productos/Productos";
import GestionOrdenesProduccion from "../features/produccion/orden_produccion/GestionOrdenesProduccion";
import DashboardCocina from "../features/produccion/cocina/DashboardCocina";

/* ─── VENTAS ADMIN ─── */
import GestionClientes from "../features/ventas/clientes/GestionClientes";
import GestionPedidos from "../features/ventas/pedidos/GestionPedidos";
import GestionDevoluciones from "../features/ventas/devoluciones/GestionDevoluciones";
import GestionDomicilios from "../features/ventas/domicilios/Gestiondomicilios";
import GestionDomiciliosRepartidor from "../features/ventas/domicilios/GestionDomiciliosRepartidor";
import DashboardDomiciliario from "../features/ventas/domicilios/DashboardDomiciliario";
import PedidoActual from "../features/ventas/domicilios/PedidoActual";
import HistorialEntregas from "../features/ventas/domicilios/HistorialEntregas";
import PerfilDomiciliario from "../features/ventas/domicilios/PerfilDomiciliario";
import GananciasDomiciliario from "../features/ventas/domicilios/GananciasDomiciliario";
import NotificacionesDomiciliario from "../features/ventas/domicilios/NotificacionesDomiciliario";
import ChatConversacion from "../features/ventas/domicilios/ChatConversacion";
import CentroChatAdmin from "../features/chat/CentroChatAdmin";

/* ─── CLIENTE REAL ─── */
import OrdersPage from "../features/sales/orders/OrdersPage";
import PedidosClientePage from "../features/sales/orders/PedidosClientePage";
import ReturnsPage from '../features/sales/returns/ReturnsPage';
import DeliveryPage from "../features/sales/delivery/DeliveryPage";
import ProfilePage from "../features/client/profile/ProfilePage";
import InicioPage from "../features/client/inicio/InicioPage";

/* ─── COMPRAS ─── */
import CategoriaInsumos from "../features/compras/categoriainsumos/CategoriaInsumos";
import GestionInsumos from "../features/compras/insumos/GestionInsumos";
import GestionCompras from "../features/compras/gestioncompras/GestionCompras";
import Proveedores from "../features/compras/proveedores/Proveedores";

/* ─── SITIO WEB ─── */
import EditarLanding from "../features/configuracion/landing/EditarLanding";

/* ─── AUTH ─── */
import Login from "../pages/Login";
import Register from "../pages/Register";
import ForgotPassword from "../pages/Forgotpassword";
import LandingPage from "../pages/LandingPage";
import SinAcceso from "../pages/SinAcceso";
import ProtectedRoute from "../components/ProtectedRoute";
import PrivilegioRoute from "../components/PrivilegioRoute";
import { initUsers } from "../services/userService";
import { getUser } from "../services/authService";

/* ─── INIT ─── */
initUsers();

/* ─── HELPER ─── */
const PR = ({ clave, el }) => <PrivilegioRoute clave={clave}>{el}</PrivilegioRoute>;

function CocinaRoute() {
  const user = getUser();
  if (user?.rol?.toLowerCase() !== "cocinero") {
    return <Navigate to="/sin-acceso" replace />;
  }
  return <DashboardCocina />;
}

/* Redirige domiciliarios a su dashboard; el resto ve el Dashboard general */
function DashboardIndex() {
  const user = getUser();
  if (user?.rol === "Domiciliario") {
    return <Navigate to="/admin/mi-dashboard" replace />;
  }
  if (user?.rol?.toLowerCase() === "cocinero") {
    return <Navigate to="/admin/cocina" replace />;
  }
  return <PR clave="Dashboard_ver" el={<Dashboard />} />;
}

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>

        {/* ───────────── PÚBLICO ───────────── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/recuperar" element={<ForgotPassword />} />
        <Route path="/sin-acceso" element={<SinAcceso />} />

        {/* ───────────── ADMIN ───────────── */}
        <Route element={<ProtectedRoute allowedRoles={["empleado"]} />}>
          <Route path="/admin" element={<MainLayout />}>

            <Route index element={<DashboardIndex />} />

            {/* Sitio Web */}
            <Route path="landing"    element={<PR clave="LandingPage_ver"   el={<EditarLanding />} />} />

            {/* Configuración */}
            <Route path="usuarios"   element={<PR clave="Usuarios_ver"      el={<GestionUsuarios />} />} />
            <Route path="empleados"  element={<PR clave="Usuarios_ver"      el={<Empleados />} />} />
            <Route path="roles"      element={<PR clave="Roles_ver"         el={<Roles />} />} />
            <Route path="salidas"    element={<PR clave="GestionSalidas_ver" el={<GestionSalidas />} />} />

            {/* Producción */}
            <Route path="categorias_productos"  element={<PR clave="CategoriaProductos_ver" el={<CategoriaProductos />} />} />
            <Route path="products"              element={<PR clave="GestionProductos_ver"   el={<Productos />} />} />
            <Route path="ordenes-produccion"    element={<PR clave="OrdenesProduccion_ver"  el={<GestionOrdenesProduccion />} />} />
            <Route path="cocina"               element={<CocinaRoute />} />

            {/* Ventas */}
            <Route path="clientes"    element={<PR clave="Pedidos_ver"      el={<GestionClientes />} />} />
            <Route path="pedidos"     element={<PR clave="Pedidos_ver"      el={<GestionPedidos />} />} />
            <Route path="devoluciones" element={<PR clave="Devoluciones_ver" el={<GestionDevoluciones />} />} />
            <Route path="domicilios"           element={<PR clave="Domicilios_ver"            el={<GestionDomicilios />} />} />
            <Route path="mis-entregas"         element={<PR clave="Domicilios_cambiar_estado" el={<GestionDomiciliosRepartidor />} />} />
            <Route path="mi-dashboard"         element={<PR clave="Domicilios_cambiar_estado" el={<DashboardDomiciliario />} />} />
            <Route path="pedido-actual"        element={<PR clave="Domicilios_cambiar_estado" el={<PedidoActual />} />} />
            <Route path="historial-entregas"   element={<PR clave="Domicilios_cambiar_estado" el={<HistorialEntregas />} />} />
            <Route path="mis-ganancias"        element={<PR clave="Domicilios_cambiar_estado" el={<GananciasDomiciliario />} />} />
            <Route path="mis-notificaciones"   element={<PR clave="Domicilios_cambiar_estado" el={<NotificacionesDomiciliario />} />} />
            <Route path="mi-perfil-repartidor" element={<PR clave="Domicilios_cambiar_estado" el={<PerfilDomiciliario />} />} />
            <Route path="chat/:idDomicilio"    element={<PR clave="Domicilios_cambiar_estado" el={<ChatConversacion />} />} />
            <Route path="chats"               element={<PR clave="Domicilios_ver"            el={<CentroChatAdmin />} />} />

            {/* Compras */}
            <Route path="categorias_insumos" element={<PR clave="CategoriaInsumos_ver" el={<CategoriaInsumos />} />} />
            <Route path="gestion-insumos"    element={<PR clave="Insumos_ver"          el={<GestionInsumos />} />} />
            <Route path="compras"            element={<PR clave="Compras_ver"          el={<GestionCompras />} />} />
            <Route path="proveedores"        element={<PR clave="Proveedores_ver"      el={<Proveedores />} />} />

            {/* Perfil — sin restricción */}
            <Route path="perfil" element={<ProfilePage />} />

          </Route>
        </Route>

        {/* ───────────── CLIENTE ───────────── */}
        <Route element={<ProtectedRoute allowedRoles={["cliente"]} />}>
          <Route path="/cliente" element={<MainLayout />}>

            <Route index                  element={<LandingPage hideNavbar={true} />} />
            <Route path="inicio"         element={<LandingPage hideNavbar={true} />} />
            <Route path="hacer-pedidos"  element={<OrdersPage />} />
            <Route path="pedidos"        element={<PedidosClientePage />} />
            <Route path="domicilios"         element={<DeliveryPage />} />
            <Route path="chat/:idDomicilio" element={<ChatConversacion />} />
            <Route path="devoluciones"       element={<ReturnsPage />} />
            <Route path="perfil"             element={<ProfilePage />} />

          </Route>
        </Route>

        {/* ───────────── 404 ───────────── */}
        <Route path="*" element={<h1>404 - Página no encontrada</h1>} />

      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
