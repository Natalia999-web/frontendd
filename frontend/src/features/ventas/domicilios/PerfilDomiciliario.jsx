import { useState, useEffect } from "react";
import { apiFetch } from "../../../utils/api";
import "./Domicilios.css";

const DISPONIBILIDAD = {
  disponible:   { label: "Disponible",   color: "#2e7d32", bg: "#e8f5e9", icon: "🟢" },
  ocupado:      { label: "Ocupado",      color: "#e65100", bg: "#fff3e0", icon: "🟡" },
  desconectado: { label: "Desconectado", color: "#616161", bg: "#f5f5f5", icon: "⚫" },
};

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" style={{ background: toast.type === "error" ? "#c62828" : "#2e7d32" }}>
      <span className="toast-icon">{toast.type === "error" ? "✕" : "✓"}</span>
      {toast.message}
    </div>
  );
}

export default function PerfilDomiciliario() {
  const [perfil,   setPerfil]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [editando, setEditando] = useState(false);
  const [toast,    setToast]    = useState(null);
  const [status,   setStatus]   = useState(
    localStorage.getItem("domiciliario_status") || "disponible"
  );

  const [form, setForm] = useState({ Telefono: "" });

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/auth/perfil");
      setPerfil(data);
      setForm({ Telefono: data.Telefono || "" });
    } catch {
      showToast("Error al cargar perfil", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const cambiarStatus = (val) => {
    setStatus(val);
    localStorage.setItem("domiciliario_status", val);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (form.Telefono !== (perfil?.Telefono || "")) payload.Telefono = form.Telefono || null;

      if (Object.keys(payload).length > 0) {
        await apiFetch("/auth/perfil", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      await cargar();
      setEditando(false);
      showToast("Perfil actualizado");
    } catch {
      showToast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const fotoUrl = perfil?.Foto_perfil;
  const iniciales = perfil ? `${perfil.Nombre?.[0] || ""}${perfil.Apellidos?.[0] || ""}`.toUpperCase() : "?";
  const statusInfo = DISPONIBILIDAD[status] || DISPONIBILIDAD.disponible;

  if (loading) return (
    <div className="page-wrapper">
      <div className="page-header"><h1 className="page-header__title">Mi Perfil</h1><div className="page-header__line" /></div>
      <div className="page-inner" style={{ textAlign: "center", paddingTop: 60, color: "#9e9e9e" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⌛</div>
        <p style={{ fontWeight: 600 }}>Cargando perfil...</p>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Mi Perfil</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Avatar y nombre ── */}
          <div style={{
            background: "linear-gradient(135deg, #1b5e20, #388e3c)",
            borderRadius: 16, padding: "28px 24px",
            display: "flex", alignItems: "center", gap: 20, color: "#fff",
          }}>
            {fotoUrl ? (
              <img src={fotoUrl} alt="Foto" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.4)" }} />
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(255,255,255,0.2)", border: "3px solid rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 800,
              }}>
                {iniciales}
              </div>
            )}
            <div>
              <div style={{ fontSize: 19, fontWeight: 800 }}>
                {perfil?.Nombre} {perfil?.Apellidos}
              </div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Domiciliario</div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                marginTop: 10, padding: "5px 12px", borderRadius: 20,
                background: "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 700,
              }}>
                {statusInfo.icon} {statusInfo.label}
              </div>
            </div>
          </div>

          {/* ── Estado de disponibilidad ── */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1.5px solid #f0f0f0" }}>
            <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 14, letterSpacing: "0.05em" }}>
              ESTADO DE DISPONIBILIDAD
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {Object.entries(DISPONIBILIDAD).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => cambiarStatus(key)}
                  style={{
                    flex: 1, minWidth: 110, padding: "10px 12px", borderRadius: 10,
                    border: status === key ? `2px solid ${cfg.color}` : "1.5px solid #e0e0e0",
                    background: status === key ? cfg.bg : "#fafafa",
                    color: status === key ? cfg.color : "#616161",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Información de contacto ── */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1.5px solid #f0f0f0" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, letterSpacing: "0.05em" }}>
                INFORMACIÓN DE CONTACTO
              </div>
              {!editando ? (
                <button onClick={() => setEditando(true)} style={{
                  padding: "6px 14px", borderRadius: 20, border: "1.5px solid #4caf50",
                  background: "#fff", color: "#2e7d32", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  Editar
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setEditando(false); setForm({ Telefono: perfil?.Telefono || "" }); }}
                    style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #e0e0e0", background: "#fff", color: "#616161", fontSize: 12, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: saving ? "#a5d6a7" : "#4caf50", color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Teléfono */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#616161", display: "block", marginBottom: 6 }}>
                  Teléfono
                </label>
                {editando ? (
                  <input
                    type="tel"
                    value={form.Telefono}
                    onChange={e => setForm(f => ({ ...f, Telefono: e.target.value }))}
                    placeholder="Ej. 3001234567"
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8,
                      border: "1.5px solid #e0e0e0", fontSize: 14,
                      fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 14, color: perfil?.Telefono ? "#212121" : "#bdbdbd", padding: "2px 0" }}>
                    {perfil?.Telefono || "No registrado"}
                  </div>
                )}
              </div>

              {/* Correo — solo lectura, no sensible para el domiciliario mismo */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#616161", display: "block", marginBottom: 6 }}>
                  Correo
                </label>
                <div style={{ fontSize: 14, color: "#212121" }}>
                  {perfil?.Correo || "—"}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
