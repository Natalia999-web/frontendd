import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated, getUser } from "../services/authService";

const HOME_POR_TIPO = {
  empleado: "/admin",
  cliente:  "/cliente",
};

const ProtectedRoute = ({ allowedRoles }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const user = getUser();
    if (!user || !allowedRoles.includes(user.tipo)) {
      // Usuario autenticado pero con rol incorrecto → su propio panel, no el login
      const destino = HOME_POR_TIPO[user?.tipo] ?? "/login";
      return <Navigate to={destino} replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;