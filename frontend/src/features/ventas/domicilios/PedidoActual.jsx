import { useState, useEffect, useCallback } from "react";
import { getUser } from "../../../services/authService";
import { getDomicilios, getDomicilio, cambiarEstadoDomicilio, registrarPagoEfectivo } from "../../../services/domiciliosService";
import { ESTADO_DOMICILIO, cobroEfectivoPendiente, esDomicilioActivo, esPagoMixto, montoACobrar, transicionesDom } from "./estadosDomicilio";
import "./Domicilios.css";
import {
  Package, CheckCircle2, Truck, XCircle, MapPin, CreditCard,
  Clock, X, Check, Navigation, Map, Banknote,
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

// Cual es "el pedido actual" cuando hay varios: primero el que ya va en ruta.
const ESTADO_ORDEN = [
  ESTADO_DOMICILIO.EN_CAMINO,
  ESTADO_DOMICILIO.ASIGNADO,
  ESTADO_DOMICILIO.PENDIENTE,
];

const ESTADO_INFO = {
  "Pendiente":  { color: "#f9a825", bg: "#fff8e1", icon: <Clock size={14} /> },
  "Asignado":   { color: "#2e7d32", bg: "#e8f5e9", icon: <Package size={14} /> },
  "En camino":  { color: "#8e24aa", bg: "#f3e5f5", icon: <Truck size={14} /> },
  "Entregado":  { color: "#2e7d32", bg: "#e8f5e9", icon: <CheckCircle2 size={14} /> },
  "Cancelado":  { color: "#c62828", bg: "#ffebee", icon: <XCircle size={14} /> },
};

/* Los pasos que puede dar el repartidor salen de la fuente única de estados.
   Aquí había una tabla propia con un paso "Llegué al local" que mandaba el
   estado 13: ese número es "En producción" de una venta, no un estado de
   domicilio, así que era un paso de más que además no correspondía. El
   recorrido real es Asignado → En camino → Entregado (o Cancelado). */
const ESTILO_ACCION = {
  [ESTADO_DOMICILIO.EN_CAMINO]: { label: "Iniciar entrega", icon: <Truck size={18} />,        color: "#8e24aa", bg: "#f3e5f5" },
  [ESTADO_DOMICILIO.ENTREGADO]: { label: "Entregado",       icon: <CheckCircle2 size={18} />, color: "#2e7d32", bg: "#e8f5e9" },
  [ESTADO_DOMICILIO.CANCELADO]: { label: "Cancelar",        icon: <XCircle size={18} />,      color: "#c62828", bg: "#ffebee", secondary: true },
};

const accionesDe = (estadoId) =>
  transicionesDom(estadoId, true).map(tr => ({
    valor: tr.id,
    ...(ESTILO_ACCION[tr.id] || { label: tr.label, icon: <Truck size={18} />, color: "#616161", bg: "#f5f5f5" }),
  }));

const ESTADO_PAGO_INFO = {
  pendiente:             { label: "Pago pendiente",         color: "#757575", bg: "#f5f5f5" },
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
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}22`,
    }}>
      {cfg.label}
    </span>
  );
}

function CobrarEfectivoModal({ pedido, entregarDespues, onClose, onConfirm }) {
  const [recibido, setRecibido] = useState(true);
  const [monto,    setMonto]    = useState(String(montoACobrar(pedido) || ""));
  const [motivo,   setMotivo]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  const handleConfirm = async () => {
    setError(null);
    if (recibido) {
      const m = parseFloat(monto);
      if (!monto || isNaN(m) || m <= 0) { setError("Ingresa el monto recibido"); return; }
    } else {
      if (motivo.trim().length < 10) { setError("El motivo debe tener al menos 10 caracteres"); return; }
    }
    setSaving(true);
    try {
      await onConfirm({ recibido, monto: recibido ? parseFloat(monto) : null, motivo: recibido ? null : motivo.trim() });
    } catch (e) {
      setError(e.message || "Error al registrar cobro");
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "24px 28px",
        width: "min(420px, 95vw)", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Registrar cobro en efectivo</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9e9e9e", display: "flex", alignItems: "center" }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 18, padding: "10px 14px", borderRadius: 10, background: "#f8f8f8", fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{pedido.cliente?.nombre || "Cliente"}</div>
          <div style={{ color: "#2e7d32", fontWeight: 800, fontSize: 16 }}>{fmt(montoACobrar(pedido))}</div>
          {/* Pago mixto: en mano solo va una parte, el resto ya se transfirió. */}
          {esPagoMixto(pedido.metodo_pago) && (
            <div style={{ color: "#757575", fontSize: 11.5, marginTop: 2 }}>
              Parte en efectivo de un pedido de {fmt(pedido.total)}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#616161", marginBottom: 8 }}>¿Recibiste el pago?</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[{ val: true, label: "Sí, recibí el dinero", Icon: CheckCircle2 }, { val: false, label: "No recibí", Icon: XCircle }].map(op => (
              <button key={String(op.val)} onClick={() => { setRecibido(op.val); setError(null); }} style={{
                flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: recibido === op.val ? "2px solid #2e7d32" : "1.5px solid #e0e0e0",
                background: recibido === op.val ? "#e8f5e9" : "#fafafa",
                color: recibido === op.val ? "#2e7d32" : "#616161",
                fontWeight: recibido === op.val ? 700 : 400, fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}><op.Icon size={15} />{op.label}</button>
            ))}
          </div>
        </div>

        {recibido ? (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#616161", display: "block", marginBottom: 6 }}>
              Monto recibido (debe coincidir con el total)
            </label>
            <input
              type="number"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1.5px solid #e0e0e0", fontSize: 15, fontWeight: 700,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#616161", display: "block", marginBottom: 6 }}>
              Motivo (mínimo 10 caracteres)
            </label>
            <textarea
              rows={3}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: El cliente no tenía efectivo disponible..."
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1.5px solid #e0e0e0", fontSize: 13, resize: "vertical",
                fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 11, color: motivo.trim().length >= 10 ? "#9e9e9e" : "#c62828", textAlign: "right" }}>
              {motivo.trim().length}/10 mín.
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: "#c62828", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "#ffebee", borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", color: "#555", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 8, border: "none",
            background: saving ? "#a5d6a7" : "#2e7d32",
            color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
          }}>
            {saving ? "Registrando…" : entregarDespues ? "Confirmar y entregar" : "Confirmar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" style={{ background: toast.type === "error" ? "#c62828" : "#2e7d32" }}>
      <span className="toast-icon" style={{display:"flex"}}>{toast.type === "error" ? <X size={15} /> : <Check size={15} />}</span>
      {toast.message}
    </div>
  );
}

export default function PedidoActual() {
  const user = getUser();
  const [pedido, setPedido]     = useState(null);
  // La cola completa del repartidor. Antes solo se cargaba la primera entrega
  // y el resto era invisible: no había forma de saber cuántas quedaban ni de
  // mirar la siguiente sin terminar la actual.
  const [cola, setCola]         = useState([]);
  const [idActivo, setIdActivo] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null);
  const [confirmando,    setConfirmando]    = useState(null);
  const [cobrandoOpen,   setCobrandoOpen]   = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const doms = await getDomicilios({ porPagina: 100, idEmpleado: user.id });
      const activos = (doms.domicilios || []).filter(d => esDomicilioActivo(d.estadoId));
      activos.sort((a, b) => ESTADO_ORDEN.indexOf(a.estadoId) - ESTADO_ORDEN.indexOf(b.estadoId));

      setCola(activos);

      if (activos.length === 0) {
        setPedido(null);
        setIdActivo(null);
      } else {
        // Se conserva la entrega que el repartidor estaba mirando; si ya se
        // cerró, se pasa a la primera de la cola.
        const sigue = activos.some(d => String(d.id) === String(idActivo));
        const elegido = sigue ? idActivo : activos[0].id;
        setIdActivo(elegido);
        // cargar detalle completo con productos
        const detalle = await getDomicilio(elegido);
        setPedido(detalle);
      }
    } catch {
      showToast("Error al cargar el pedido", "error");
    } finally {
      setLoading(false);
    }
    // idActivo se lee para conservar la selección, pero no dispara la recarga:
    // cambiar de entrega la hace por su cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /// Cambia a otra entrega de la cola sin recargar todo.
  const verEntrega = async (id) => {
    if (String(id) === String(idActivo)) return;
    setIdActivo(id);
    setLoading(true);
    try {
      setPedido(await getDomicilio(id));
    } catch {
      showToast("No se pudo abrir esa entrega", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [cargar]);

  const handleAccion = async (accion) => {
    if (accion.secondary) { setConfirmando(accion); return; }
    // Lo único que hay que resolver antes de entregar es la plata en mano: el
    // backend no acepta la entrega sin el cobro registrado. La evidencia (OTP,
    // foto, comprobante) ya no se pide.
    if (accion.valor === ESTADO_DOMICILIO.ENTREGADO && cobroEfectivoPendiente(pedido)) {
      setCobrandoOpen("entregar");
      return;
    }
    await ejecutarCambio(accion.valor, accion.label);
  };

  /* Viniendo del botón de Entregado, el cobro cierra la entrega en el mismo
     paso. Abierto desde el botón suelto, solo registra la plata: el pedido
     sigue en curso hasta que el repartidor lo cierre. */
  const handleCobrarEfectivo = async ({ recibido, monto, motivo }) => {
    const cerrarEntrega = cobrandoOpen === "entregar";
    try {
      await registrarPagoEfectivo(pedido.id, { recibido, monto, motivo });
    } catch (e) {
      showToast(e.message || "No se pudo registrar el cobro", "error");
      return;
    }
    setCobrandoOpen(false);
    if (cerrarEntrega) {
      await ejecutarCambio(ESTADO_DOMICILIO.ENTREGADO, "Entregado");
      return;
    }
    showToast(recibido ? "Cobro registrado" : "Se registró que no se pudo cobrar");
    await cargar();
  };

  const ejecutarCambio = async (valor, label, observacion = null) => {
    setSaving(true);
    setConfirmando(null);
    try {
      await cambiarEstadoDomicilio(pedido.id, valor, observacion);
      showToast(`Estado actualizado: ${label}`);
      await cargar();
    } catch (e) {
      showToast(e.message || "Error al cambiar el estado", "error");
    } finally {
      setSaving(false);
    }
  };

  const abrirMaps = (tipo) => {
    if (!pedido) return;
    const dir = encodeURIComponent(
      [pedido.direccion_entrega, pedido.municipio_entrega].filter(Boolean).join(", ")
    );
    const url = tipo === "waze"
      ? `https://waze.com/ul?q=${dir}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${dir}`;
    window.open(url, "_blank", "noopener");
  };

  const estadoInfo = pedido ? (ESTADO_INFO[pedido.estado] || ESTADO_INFO["Asignado"]) : null;
  const acciones   = pedido ? accionesDe(pedido.estadoId) : [];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">
          Mis entregas{cola.length > 0 ? ` · ${cola.length}` : ""}
        </h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9e9e9e" }}>
            <div style={{ marginBottom: 12, color: "#d4d4d4", display: "flex", justifyContent: "center" }}><Clock size={40} strokeWidth={1} /></div>
            <p style={{ fontWeight: 600 }}>Cargando...</p>
          </div>
        ) : !pedido ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9e9e9e" }}>
            <div style={{ marginBottom: 16, color: "#d4d4d4", display: "flex", justifyContent: "center" }}><Truck size={56} strokeWidth={1} /></div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#424242", marginBottom: 8 }}>
              Sin pedido activo
            </p>
            <p style={{ fontSize: 14 }}>No tienes ninguna entrega en curso en este momento.</p>
          </div>
        ) : (
          <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Cola de entregas ──
                Con más de una asignada hay que poder ver cuáles son y saltar
                entre ellas: antes solo existía la primera y las demás eran
                invisibles hasta cerrarla. */}
            {cola.length > 1 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {cola.map((d, i) => {
                  const activo = String(d.id) === String(idActivo);
                  const faltaCobro = cobroEfectivoPendiente(d);
                  return (
                    <button
                      key={d.id}
                      onClick={() => verEntrega(d.id)}
                      aria-current={activo ? "true" : undefined}
                      style={{
                        flexShrink: 0, cursor: "pointer", textAlign: "left",
                        padding: "8px 14px", borderRadius: 12,
                        border: `2px solid ${activo ? "#2e7d32" : "#e0e0e0"}`,
                        background: activo ? "#f1f8f1" : "#fff",
                        display: "flex", flexDirection: "column", gap: 2,
                      }}
                    >
                      <span style={{
                        fontSize: 12, fontWeight: 800,
                        color: activo ? "#2e7d32" : "#666",
                      }}>
                        {i + 1}. {d.numero || `#${d.id}`}
                      </span>
                      <span style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 600 }}>
                        {d.estado}{faltaCobro ? " · cobrar" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Cabecera del pedido ── */}
            <div style={{
              background: "#fff", borderRadius: 16, padding: "20px 22px",
              border: `1.5px solid ${estadoInfo.bg}`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#9e9e9e", fontWeight: 700 }}>{pedido.numero}</span>
                <span style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: estadoInfo.bg, color: estadoInfo.color,
                }}>
                  {estadoInfo.icon} {pedido.estado}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#757575" }}>
                {new Date(pedido.fecha_pedido).toLocaleString("es-CO", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                }) || "—"}
              </div>
            </div>

            {/* ── Cliente y dirección ── */}
            <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1.5px solid #f0f0f0" }}>
              <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 12, letterSpacing: "0.05em" }}>
                CLIENTE
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#212121", marginBottom: 10 }}>
                {pedido.cliente?.nombre || "—"}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "#616161", fontSize: 14 }}>
                <MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{[pedido.direccion_entrega, pedido.municipio_entrega].filter(Boolean).join(", ") || "Sin dirección"}</span>
              </div>

              {/* Botones de mapas */}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => abrirMaps("google")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
                    border: "1.5px solid #4285f4", background: "#fff",
                    color: "#4285f4", fontWeight: 700, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <Map size={15} /> Google Maps
                </button>
                <button
                  onClick={() => abrirMaps("waze")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
                    border: "1.5px solid #33ccff", background: "#fff",
                    color: "#0099cc", fontWeight: 700, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <Navigation size={15} /> Waze
                </button>
              </div>
            </div>

            {/* ── Productos ── */}
            {pedido.productos?.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1.5px solid #f0f0f0" }}>
                <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 14, letterSpacing: "0.05em" }}>
                  PRODUCTOS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pedido.productos.map((p, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", background: "#f8f8f8", borderRadius: 10,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#212121" }}>{p.nombre_producto}</div>
                        <div style={{ fontSize: 12, color: "#9e9e9e" }}>x{p.Cantidad} · {fmt(p.precio_unitario)} c/u</div>
                      </div>
                      <div style={{ fontWeight: 700, color: "#2e7d32", fontSize: 14 }}>{fmt(p.subtotal)}</div>
                    </div>
                  ))}
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderTop: "1.5px solid #f0f0f0", marginTop: 14, paddingTop: 12,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#424242" }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: "#2e7d32" }}>{fmt(pedido.total)}</span>
                </div>
                {pedido.metodo_pago && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#757575", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><CreditCard size={12} /> Pago: {pedido.metodo_pago}</span>
                    <EstadoPagoBadge estadoPago={pedido.estado_pago} />
                  </div>
                )}
              </div>
            )}

            {/* ── Cobro en efectivo ──
                El repartidor puede registrar la plata apenas la recibe, sin
                tener que cerrar la entrega en el mismo momento. */}
            {cobroEfectivoPendiente(pedido) && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1.5px solid #ffe082" }}>
                <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 6, letterSpacing: "0.05em" }}>
                  COBRO EN EFECTIVO
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#757575" }}>
                  Este pedido se paga en mano. Registra <strong>{fmt(montoACobrar(pedido))}</strong> apenas
                  lo recibas, aunque todavía no cierres la entrega.
                </p>
                <button
                  onClick={() => setCobrandoOpen("solo-cobro")}
                  disabled={saving}
                  style={{
                    width: "100%", padding: "14px", borderRadius: 12,
                    border: "2px solid #ffe082", background: "#fff8e1",
                    color: "#f57f17", fontWeight: 800, fontSize: 15,
                    cursor: saving ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <Banknote size={17} /> Registrar cobro
                </button>
              </div>
            )}

            {/* ── Acciones de estado ── */}
            {acciones.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1.5px solid #f0f0f0" }}>
                <div style={{ fontSize: 11, color: "#9e9e9e", fontWeight: 700, marginBottom: 14, letterSpacing: "0.05em" }}>
                  ACTUALIZAR ESTADO
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {acciones.map(ac => (
                    <button
                      key={ac.valor}
                      onClick={() => handleAccion(ac)}
                      disabled={saving}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12, cursor: saving ? "not-allowed" : "pointer",
                        border: `2px solid ${ac.secondary ? "#ffcdd2" : ac.bg}`,
                        background: ac.secondary ? "#fff" : ac.bg,
                        color: ac.color, fontWeight: 800, fontSize: 15,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {ac.icon}
                      {saving ? "Actualizando…" : ac.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Observaciones ── */}
            {pedido.obs_domicilio && (
              <div style={{
                background: "#fff8e1", border: "1.5px solid #ffe082", borderRadius: 14,
                padding: "14px 18px",
              }}>
                <div style={{ fontSize: 11, color: "#f57f17", fontWeight: 700, marginBottom: 6 }}>OBSERVACIONES</div>
                <div style={{ fontSize: 13, color: "#424242" }}>{pedido.obs_domicilio}</div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Modal cobro efectivo ── */}
      {cobrandoOpen && pedido && (
        <CobrarEfectivoModal
          pedido={pedido}
          entregarDespues={cobrandoOpen === "entregar"}
          onClose={() => setCobrandoOpen(false)}
          onConfirm={handleCobrarEfectivo}
        />
      )}

      {/* ── Modal confirmación cancelar ── */}
      {confirmando && (
        <div className="modal-overlay" onClick={() => setConfirmando(null)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "28px",
            width: "min(360px, 90vw)", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, color: "#c62828" }}>¿Cancelar entrega?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#616161" }}>
              Esta acción cambiará el estado del pedido a <strong>Cancelado</strong>.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmando(null)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", color: "#555", fontSize: 13, cursor: "pointer" }}>
                Volver
              </button>
              <button onClick={() => ejecutarCambio(confirmando.valor, confirmando.label)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#c62828", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
