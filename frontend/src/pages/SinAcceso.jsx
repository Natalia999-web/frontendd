import { useNavigate } from "react-router-dom";
import { getUser } from "../services/authService";
import { Lock } from "lucide-react";

export default function SinAcceso() {
  const navigate = useNavigate();
  const user = getUser();
  const inicio = user?.tipo === "empleado" ? "/admin" : "/cliente";

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "60vh", gap: 20, padding: 32,
      textAlign: "center",
    }}>
      <div style={{ lineHeight: 1 }}><Lock size={72} strokeWidth={1} style={{color:"#bdbdbd"}} /></div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#212121" }}>
        Sin acceso
      </h1>
      <p style={{ margin: 0, fontSize: 15, color: "#757575", maxWidth: 380 }}>
        No tienes permiso para ver esta sección. Si crees que es un error, contacta al administrador.
      </p>
      <button
        onClick={() => navigate(inicio)}
        style={{
          marginTop: 8, padding: "11px 28px", borderRadius: 10,
          background: "#2e7d32", color: "#fff", border: "none",
          fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}
      >
        Volver al inicio
      </button>
    </div>
  );
}
