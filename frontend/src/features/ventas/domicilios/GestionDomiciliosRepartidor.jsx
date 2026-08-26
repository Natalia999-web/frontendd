import { useState, useEffect } from "react";
import { getDomicilios, cambiarEstadoDomicilio, registrarPagoEfectivo } from "../../../services/domiciliosService.js";
import { getUser } from "../../../services/authService.js";
import { fmtFechaHora as fmtFecha } from "../../../utils/dateUtils.js";
import { ESTADO_DOMICILIO, ESTADO_DOM_CONFIG, cobroEfectivoPendiente, esDomicilioActivo, transicionesDom } from "./estadosDomicilio";
import "./Domicilios.css";
import {
  Search, RefreshCw, Truck, Package, CheckCircle2, XCircle, Clock,
  MapPin, MessageSquare, X, Phone, Banknote,
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

// Los colores salen de la fuente única de estados; aquí solo el icono.
const ICONO_ESTADO = {
  3:  <Clock size={12} />,
  10: <Package size={12} />,
  9:  <Truck size={12} />,
  8:  <CheckCircle2 size={12} />,
  5:  <XCircle size={12} />,
};

const ESTADO_PAGO_INFO = {
  pendiente_validacion:  { label: "Comprobante en revisión", color: "#e65100", bg: "#fff3e0" },
  pagado_completo:       { label: "Pago completo",           color: "#2e7d32", bg: "#e8f5e9" },
  anticipo_pagado:       { label: "Anticipo pagado",         color: "#f57f17", bg: "#fff8e1" },
  efectivo_recibido:     { label: "Efectivo recibido",       color: "#1565c0", bg: "#e3f2fd" },
  no_recibido:           { label: "Efectivo no recibido",    color: "#c62828", bg: "#ffebee" },
  comprobante_rechazado: { label: "Comprobante rechazado",   color: "#c62828", bg: "#ffebee" },
};

function EstadoPagoBadge({ estadoPago }) {
  if (!estadoPago || estadoPago === "pendiente") return null;
  const cfg = ESTADO_PAGO_INFO[estadoPago] || { label: estadoPago, color: "#757575", bg: "#f5f5f5" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.label}
    </span>
  );
}

// Flujo real del domicilio: Asignado → En camino → Entregado (o Cancelado).
// Antes había un paso "Llegué al local" que enviaba el estado 13, que es "En
// producción" del PEDIDO, no un estado de domicilio: el backend lo rechaza.
const ICONO_TRANSICION = { 9: <Truck size={14} />, 8: <CheckCircle2 size={14} />, 5: <XCircle size={14} /> };
const LABEL_TRANSICION = { 9: "Iniciar entrega", 8: "Entregado", 5: "Cancelado" };

const proximosEstados = (estadoId) =>
  transicionesDom(estadoId, true).map(t => ({
    valor: t.id,
    label: LABEL_TRANSICION[t.id] || t.label,
    icon:  ICONO_TRANSICION[t.id] || "•",
  }));

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" style={{ background: toast.type === "error" ? "#c62828" : "#2e7d32" }}>
      <span className="toast-icon">{toast.type === "error" ? "✕" : "✓"}</span>
      {toast.message}
    </div>
  );
}

function EstadoBadge({ estadoId }) {
  const cfg = ESTADO_DOM_CONFIG[estadoId] ||
    { dot: "#757575", bg: "#f5f5f5", border: "#e0e0e0", label: "—" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 700,
      color: cfg.dot, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <span>{ICONO_ESTADO[estadoId] || "•"}</span> {cfg.label}
    </span>
  );
}

/* Cobro en efectivo. El repartidor es quien recibe el dinero, así que registra
   aquí si lo cobró. El backend exige el monto exacto del pedido cuando se
   cobró, o un motivo de 10+ caracteres cuando no.

   Se abre en dos momentos: al marcar Entregado un pedido en efectivo (y ahí
   cierra la entrega en el mismo paso) o suelto desde la tarjeta, para cuando
   el repartidor cobra antes de dar por terminada la entrega. */
function CobroEfectivoModal({ domicilio, saving, entregarDespues, onClose, onConfirm }) {
  const [recibido, setRecibido] = useState(null);
  const [motivo,   setMotivo]   = useState("");
  const [error,    setError]    = useState(null);

  const confirmar = () => {
    if (recibido === null) return setError("Indica si recibiste el efectivo.");
    if (!recibido && motivo.trim().length < 10) {
      return setError("Explica por qué no se cobró (mínimo 10 caracteres).");
    }
    setError(null);
    onConfirm({ recibido, motivo: motivo.trim() });
  };

  const opcion = (valor, icono, titulo, color) => (
    <button
      type="button"
      onClick={() => { setRecibido(valor); setError(null); }}
      style={{
        flex: 1, minWidth: 130, padding: "12px 14px", borderRadius: 10,
        cursor: "pointer", fontWeight: 700, fontSize: 13,
        border: `${recibido === valor ? 2 : 1.5}px solid ${recibido === valor ? color : "#e0e0e0"}`,
        background: recibido === valor ? `${color}14` : "#fafafa",
        color: recibido === valor ? color : "#616161",
      }}
    >
      <span style={{ marginRight: 6 }}>{icono}</span>{titulo}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        style={{
          background: "#fff", borderRadius: 16, padding: "24px 28px",
          width: "min(420px, 95vw)", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>
          Cobro en efectivo
        </h2>

        <div style={{
          background: "#e8f5e9", borderRadius: 10, padding: "12px 14px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#66806a" }}>Total a cobrar</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#2e7d32" }}>{fmt(domicilio.total)}</div>
        </div>

        <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#616161" }}>
          ¿Recibiste el pago completo del cliente?
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {opcion(true,  <CheckCircle2 size={20} />, "Sí, recibido", "#2e7d32")}
          {opcion(false, <XCircle size={20} />, "No lo recibí", "#c62828")}
        </div>

        {recibido === false && (
          <textarea
            rows={3}
            value={motivo}
            onChange={e => { setMotivo(e.target.value); setError(null); }}
            placeholder="Ej: el cliente no tenía el efectivo completo"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1.5px solid #e0e0e0", fontSize: 13, resize: "vertical",
              fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              marginBottom: 6,
            }}
          />
        )}
        {recibido === false && (
          <div style={{
            fontSize: 11, marginBottom: 12,
            color: motivo.trim().length < 10 ? "#c62828" : "#9e9e9e",
          }}>
            {motivo.trim().length}/10 caracteres mínimos
          </div>
        )}

        {error && (
          <div style={{
            background: "#ffebee", color: "#c62828", borderRadius: 8,
            padding: "9px 12px", fontSize: 12.5, marginBottom: 12,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", color: "#555", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={confirmar} disabled={saving}
            style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#2e7d32", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Registrando…" : entregarDespues ? "Registrar y entregar" : "Registrar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CambiarEstadoModal({ domicilio, onClose, onSave }) {
  const posibles = proximosEstados(domicilio.estadoId);
  const [nuevoEstado, setNuevoEstado] = useState(posibles[0]?.valor || "");
  const [obs, setObs] = useState(domicilio.obs_domicilio || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nuevoEstado) return;
    setSaving(true);
    try {
      await onSave(domicilio.id, nuevoEstado, obs.trim() || null);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "24px 28px",
        width: "min(420px, 95vw)", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#212121" }}>Actualizar entrega</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9e9e9e", display: "flex", alignItems: "center" }}><X size={18} /></button>
        </div>

        <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "12px 14px", marginBottom: 18, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#212121", marginBottom: 4 }}>{domicilio.numero}</div>
          <div style={{ color: "#616161" }}>{domicilio.cliente?.nombre || "—"}</div>
          <div style={{ color: "#757575", marginTop: 2 }}>{domicilio.direccion_entrega}</div>
        </div>

        {posibles.length === 0 ? (
          <p style={{ color: "#757575", fontSize: 14, textAlign: "center" }}>
            No hay cambios de estado disponibles para este domicilio.
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#616161", display: "block", marginBottom: 8 }}>
                Nuevo estado
              </label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {posibles.map(op => (
                  <button
                    key={op.valor}
                    onClick={() => setNuevoEstado(op.valor)}
                    style={{
                      flex: 1, minWidth: 120, padding: "10px 14px",
                      borderRadius: 10, border: nuevoEstado === op.valor ? "2px solid #4caf50" : "1.5px solid #e0e0e0",
                      background: nuevoEstado === op.valor ? "#e8f5e9" : "#fafafa",
                      color: nuevoEstado === op.valor ? "#2e7d32" : "#616161",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    <span>{op.icon}</span> {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#616161", display: "block", marginBottom: 8 }}>
                Observaciones (opcional)
              </label>
              <textarea
                rows={3}
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Comentario o novedad del domicilio..."
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  border: "1.5px solid #e0e0e0", fontSize: 13, resize: "vertical",
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", color: "#555", fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !nuevoEstado}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: saving ? "#a5d6a7" : "#4caf50", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetallesModal({ domicilio, onClose, onCambiarEstado, onCobrar }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "24px 28px",
        width: "min(480px, 95vw)", maxHeight: "85vh", overflow: "auto",
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.08em" }}>Domicilio</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 700 }}>{domicilio.numero}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9e9e9e", display: "flex", alignItems: "center" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <EstadoBadge estadoId={domicilio.estadoId} />
          <span style={{ fontSize: 12, color: "#9e9e9e", alignSelf: "center" }}>
            {fmtFecha(domicilio.fecha_pedido)}
          </span>
        </div>

        <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 4 }}>CLIENTE</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{domicilio.cliente?.nombre || "—"}</div>
            {domicilio.cliente?.telefono && (
              <a
                href={`https://wa.me/${domicilio.cliente.telefono.replace(/\D/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "#25d366", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}
              >
                <Phone size={13} /> {domicilio.cliente.telefono}
              </a>
            )}
          </div>
          <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 4 }}>DIRECCIÓN</div>
            <div style={{ fontSize: 14 }}>{domicilio.direccion_entrega || "—"}</div>
          </div>
          <div style={{ background: "#f8f8f8", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 4 }}>TOTAL</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#2e7d32" }}>{fmt(domicilio.total || 0)}</div>
          </div>
        </div>

        {domicilio.obs_domicilio && (
          <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#f57f17", fontWeight: 700, marginBottom: 4 }}>OBSERVACIONES</div>
            <div style={{ fontSize: 13, color: "#424242" }}>{domicilio.obs_domicilio}</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cobroEfectivoPendiente(domicilio) && esDomicilioActivo(domicilio.estadoId) && (
            <button
              onClick={() => { onClose(); onCobrar(domicilio); }}
              style={{
                width: "100%", padding: "12px", borderRadius: 10,
                background: "#fff8e1", color: "#f57f17", border: "1.5px solid #ffe082",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Banknote size={16} /> Registrar cobro en efectivo
            </button>
          )}
          {proximosEstados(domicilio.estadoId).length > 0 && (
            <button
              onClick={() => { onClose(); onCambiarEstado(domicilio); }}
              style={{
                width: "100%", padding: "12px", borderRadius: 10,
                background: "#4caf50", color: "#fff", border: "none",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Truck size={16} /> Actualizar estado de entrega
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GestionDomiciliosRepartidor() {
  const user = getUser();
  const idEmpleado = user?.id;

  const [domicilios, setDomicilios] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filtro,  setFiltro]        = useState("activos");
  const [search,  setSearch]        = useState("");
  const [modal,   setModal]         = useState(null);
  const [toast,   setToast]         = useState(null);
  // Entrega en efectivo pendiente de registrar el cobro.
  const [cobrando, setCobrando]     = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const cargar = async () => {
    if (!idEmpleado) return;
    setLoading(true);
    try {
      const data = await getDomicilios({ porPagina: 100, idEmpleado });
      setDomicilios(data.domicilios || []);
    } catch (e) {
      showToast(e.message || "Error al cargar entregas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const esActivo = (d) => esDomicilioActivo(d.estadoId);

  const q = search.trim().toLowerCase();
  const filtrados = domicilios.filter(d => {
    const matchFiltro = filtro === "activos" ? esActivo(d)
      : filtro === "entregados" ? d.estadoId === ESTADO_DOMICILIO.ENTREGADO
      : true;
    const matchSearch = !q
      || String(d.numero || "").toLowerCase().includes(q)
      || (d.cliente?.nombre || "").toLowerCase().includes(q)
      || (d.direccion_entrega || "").toLowerCase().includes(q);
    return matchFiltro && matchSearch;
  });

  const handleCambiarEstado = async (id, nuevoEstado, observaciones) => {
    // Al entregar un pedido en efectivo hay que registrar el cobro primero: el
    // repartidor es quien recibe el dinero y el backend no acepta la entrega
    // sin ese registro. Se pide aquí en vez de dejar que falle la llamada.
    if (nuevoEstado === ESTADO_DOMICILIO.ENTREGADO) {
      const dom = domicilios.find(d => d.id === id);
      if (cobroEfectivoPendiente(dom)) {
        setCobrando({ dom, observaciones, entregarDespues: true });
        return;
      }
    }
    try {
      await cambiarEstadoDomicilio(id, nuevoEstado, observaciones);
      showToast("Estado actualizado");
      await cargar();
    } catch (e) {
      showToast(e.message || "Error al cambiar el estado", "error");
    }
  };

  /* Registrar el cobro. Viniendo de marcar Entregado, cierra la entrega en el
     mismo paso; abierto desde el botón de la tarjeta, solo registra la plata y
     el domicilio sigue su curso. */
  const handleCobrar = async ({ recibido, motivo }) => {
    const { dom, observaciones, entregarDespues } = cobrando;
    try {
      await registrarPagoEfectivo(dom.id, {
        recibido,
        monto: recibido ? dom.total : null,
        motivo: recibido ? null : motivo,
      });
      if (entregarDespues) {
        await cambiarEstadoDomicilio(dom.id, ESTADO_DOMICILIO.ENTREGADO, observaciones);
      }
      setCobrando(null);
      showToast(
        !recibido               ? "Se registró que no se pudo cobrar"
        : entregarDespues       ? `Cobro de ${fmt(dom.total)} registrado y entrega cerrada`
        :                         `Cobro de ${fmt(dom.total)} registrado`
      );
      await cargar();
    } catch (e) {
      showToast(e.message || "No se pudo registrar el cobro", "error");
    }
  };

  const FILTROS = [
    { val: "activos",    label: "Activos",    count: domicilios.filter(esActivo).length },
    { val: "entregados", label: "Entregados", count: domicilios.filter(d => d.estadoId === ESTADO_DOMICILIO.ENTREGADO).length },
    { val: "todos",      label: "Todos",      count: domicilios.length },
  ];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Mis Entregas</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        {/* Buscador */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9e9e9e", pointerEvents: "none", display: "flex" }}><Search size={14} /></span>
          <input
            type="text"
            placeholder="Buscar por número, cliente o dirección…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px 9px 32px",
              border: "1.5px solid #e0e0e0", borderRadius: 10,
              fontSize: 13, fontFamily: "inherit", outline: "none",
              boxSizing: "border-box", background: "#fafafa",
            }}
          />
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {FILTROS.map(f => (
            <button
              key={f.val}
              onClick={() => setFiltro(f.val)}
              style={{
                padding: "8px 16px", borderRadius: 20,
                border: filtro === f.val ? "1.5px solid #4caf50" : "1.5px solid #e0e0e0",
                background: filtro === f.val ? "#e8f5e9" : "#fafafa",
                color: filtro === f.val ? "#2e7d32" : "#616161",
                fontWeight: filtro === f.val ? 700 : 400,
                fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {f.label}
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: filtro === f.val ? "#c8e6c9" : "#eeeeee",
                color: filtro === f.val ? "#2e7d32" : "#9e9e9e",
                borderRadius: 10, padding: "1px 7px",
              }}>{f.count}</span>
            </button>
          ))}
          <button
            onClick={cargar}
            style={{
              marginLeft: "auto", padding: "8px 14px", borderRadius: 20,
              border: "1.5px solid #e0e0e0", background: "#fff",
              color: "#616161", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>

        {/* Cards */}
        {loading ? (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1.5px solid #f0f0f0" }}>
                {[70, 50, 90, 40].map((w, j) => (
                  <div key={j} className="skeleton-cell" style={{ width: `${w}%`, height: 14, marginBottom: 10, borderRadius: 7 }} />
                ))}
              </div>
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9e9e9e" }}>
            <div style={{ marginBottom: 12, color: "#d4d4d4", display: "flex", justifyContent: "center" }}><Truck size={48} strokeWidth={1} /></div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>
              {q ? "Sin resultados para esa búsqueda" : filtro === "activos" ? "No tienes entregas pendientes" : "Sin resultados"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {filtrados.map(dom => {
              const info = ESTADO_DOM_CONFIG[dom.estadoId] || ESTADO_DOM_CONFIG[3];
              const puedeCambiar = proximosEstados(dom.estadoId).length > 0;
              return (
                <div
                  key={dom.id}
                  style={{
                    background: "#fff", borderRadius: 14, padding: 20,
                    border: `1.5px solid ${info.border}`,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s",
                  }}
                  onClick={() => setModal({ type: "detalles", dom })}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#9e9e9e", fontWeight: 600 }}>{dom.numero}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#212121", marginTop: 2 }}>
                        {dom.cliente?.nombre || "Cliente"}
                      </div>
                    </div>
                    <EstadoBadge estadoId={dom.estadoId} />
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 10, color: "#616161", fontSize: 13 }}>
                    <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ lineHeight: 1.4 }}>{dom.direccion_entrega || "Sin dirección"}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#2e7d32" }}>{fmt(dom.total || 0)}</span>
                      {dom.estado_pago && dom.estado_pago !== "pendiente" && (
                        <div style={{ marginTop: 4 }}>
                          <EstadoPagoBadge estadoPago={dom.estado_pago} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {/* Cobrar sin cerrar la entrega: a veces el cliente paga
                          y el repartidor todavía tiene algo que resolver. */}
                      {cobroEfectivoPendiente(dom) && esDomicilioActivo(dom.estadoId) && (
                        <button
                          onClick={e => { e.stopPropagation(); setCobrando({ dom, entregarDespues: false }); }}
                          title="Registrar el cobro en efectivo"
                          style={{
                            padding: "7px 12px", borderRadius: 8,
                            background: "#fff8e1", color: "#f57f17",
                            border: "1.5px solid #ffe082", fontWeight: 700, fontSize: 12,
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                          }}
                        >
                          <Banknote size={13} /> Cobrar
                        </button>
                      )}
                      {puedeCambiar && (
                        <button
                          onClick={e => { e.stopPropagation(); setModal({ type: "cambiarEstado", dom }); }}
                          style={{
                            padding: "7px 14px", borderRadius: 8,
                            background: "#4caf50", color: "#fff",
                            border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer",
                          }}
                        >
                          Actualizar →
                        </button>
                      )}
                    </div>
                  </div>

                  {dom.obs_domicilio && (
                    <div style={{ marginTop: 10, padding: "7px 10px", background: "#fff8e1", borderRadius: 7, fontSize: 12, color: "#616161", borderLeft: "3px solid #f9a825", display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <MessageSquare size={12} style={{ flexShrink: 0, marginTop: 1 }} />{dom.obs_domicilio}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal?.type === "detalles" && (
        <DetallesModal
          domicilio={modal.dom}
          onClose={() => setModal(null)}
          onCambiarEstado={(dom) => setModal({ type: "cambiarEstado", dom })}
          onCobrar={(dom) => setCobrando({ dom, entregarDespues: false })}
        />
      )}

      {modal?.type === "cambiarEstado" && (
        <CambiarEstadoModal
          domicilio={modal.dom}
          onClose={() => setModal(null)}
          onSave={handleCambiarEstado}
        />
      )}

      {cobrando && (
        <CobroEfectivoModal
          domicilio={cobrando.dom}
          saving={false}
          entregarDespues={cobrando.entregarDespues}
          onClose={() => setCobrando(null)}
          onConfirm={handleCobrar}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
