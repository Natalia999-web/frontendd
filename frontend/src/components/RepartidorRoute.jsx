import { Navigate, useLocation } from "react-router-dom";
import { usePrivilegios } from "../context/PrivilegiosContext";
import { getUser } from "../services/authService";
import { esRolRepartidor } from "../utils/roles";

/**
 * Protege el panel propio del repartidor.
 *
 * Antes estas rutas colgaban del privilegio Domicilios_cambiar_estado, que vive
 * en la base de datos: si a nadie se le ocurrió asignárselo al rol, el
 * repartidor entraba a SU pantalla y le salía "sin acceso". Ver lo suyo no es
 * un privilegio que haya que otorgar, va por rol — igual que la cocina.
 *
 * El privilegio se sigue respetando para cualquier otro rol al que se lo hayan
 * dado, y el admin entra por su bypass de siempre.
 */
export default function RepartidorRoute({ children }) {
  const { hasPrivilegio, loading } = usePrivilegios();
  const location = useLocation();

  if (esRolRepartidor(getUser()?.rol)) return children;

  if (loading) return null; // espera silenciosa mientras cargan los privilegios

  if (!hasPrivilegio("Domicilios_cambiar_estado")) {
    return <Navigate to="/sin-acceso" state={{ from: location }} replace />;
  }

  return children;
}
