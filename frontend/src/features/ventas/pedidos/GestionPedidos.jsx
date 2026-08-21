import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fmtFecha, getRecordDate } from "../../../utils/dateUtils.js";
import DateRangeFilter from "../../../shared/components/DateRangeFilter";
import { descargarFacturaPedido } from "../../../utils/facturaGenerator.js";
import { getPedidos, getHistorialPedidos, confirmarPedido, cancelarPedido, crearPedido, editarPedido, eliminarPedido, cambiarEstadoVenta, proponerFechaProduccion, registrarPagoFinal } from "../../../services/pedidosService.js";
import { asignarRepartidor } from "../../../services/domiciliosService.js";
import { registrarSalida } from "../../../services/salidasService.js";
import { getUsuarios } from "../../../services/usuariosService.js";
import { getProductos } from "../../../services/productosService.js";
import CrearPedido from "./CrearPedido.jsx";
import EditarPedido from "./EditarPedido.jsx";
import {
  Trash2, Truck, Package,
  RotateCcw, X, AlertCircle,
  CheckCircle2, ArrowRight, MapPin, Search
} from 'lucide-react';
import "./Pedidos.css";

/* ─── Datos de transferencia ─────────────────────────────── */
const CUENTA_TRANSFERENCIA = {
  banco:   "Bancolombia",
  titular: "TostonApp S.A.S",
  tipo:    "Ahorros",
  numero:  "54213570938",
};

/* ─── Helpers ────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n ?? 0);

const PER_PAGE = 5;

const normalizeProductoId = (value) => {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
};

const esProductoConProduccion = (producto) => {
  const rawValue = producto?.Requiere_Produccion ?? producto?.requiereProduccion ?? producto?.requiere_produccion;
  return rawValue === 1 || rawValue === true || rawValue === "1" || rawValue === "true";
};

// GestionPedidos solo gestiona órdenes activas (Pendiente y En producción).
// La única acción de avance es Confirmar → Estado=4 (Confirmado), que mueve
// el pedido a GestionVentas. Los estados "Listo", "En camino", "Entregado"
// se gestionan en Domicilios / GestionVentas, no aquí.
const ESTADOS_ACTIVOS_PEDIDO = ["Pendiente", "En producción", "Fecha propuesta"];

const ESTADO_CONFIG = {
  "Pendiente":     { bg: "#fff8e1", color: "#f9a825", border: "#ffe082", dot: "#f9a825" },
  "En producción": { bg: "#e3f2fd", color: "#1565c0", border: "#90caf9", dot: "#1976d2" },
  "Confirmado":    { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7", dot: "#43a047" },
  "Listo":         { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7", dot: "#43a047" },
  "Asignado":      { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7", dot: "#43a047" },
  "En camino":     { bg: "#f3e5f5", color: "#6a1b9a", border: "#ce93d8", dot: "#8e24aa" },
  "Fecha propuesta": { bg: "#e8eaf6", color: "#283593", border: "#9fa8da", dot: "#3949ab" },
  "Cancelado":       { bg: "#ffebee", color: "#c62828", border: "#ef9a9a", dot: "#e53935" },
  "Entregado":     { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7", dot: "#43a047" },
};

/* ─── EstadoBadge ────────────────────────────────────────── */
function EstadoBadge({ estado }) {
  const c = ESTADO_CONFIG[estado] || { bg: "#f5f5f5", color: "#757575", border: "#e0e0e0", dot: "#bdbdbd" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {estado}
    </span>
  );
}

/* ─── Toast ──────────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === "error" ? "bg-red-600" : toast.type === "warn" ? "bg-orange-600" : "bg-green-600";
  return (
    <div className={`fixed bottom-8 right-8 ${bg} text-white px-6 py-3 rounded-xl shadow-2xl z-[30000] flex items-center gap-3 animate-in slide-in-from-right`}>
      {toast.type === "error" ? <X size={18} /> : toast.type === "warn" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span className="font-bold text-sm">{toast.message}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL — CAMBIAR ESTADO (Confirmación)
   ═══════════════════════════════════════════════════════════ */
function ModalConfirmarEstado({ pedido, nuevoEstado, onClose, onConfirm }) {
  if (!pedido || !nuevoEstado) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box relative bg-white shadow-2xl overflow-hidden flex flex-col border-none" style={{ borderRadius: '28px', maxWidth: '420px' }}>
        
        {/* Cabecera */}
        <div className="modal-header shrink-0" style={{ background: 'linear-gradient(135deg, var(--green-800) 0%, var(--green-700) 100%)', padding: '20px 24px' }}>
          <div>
            <h2 className="text-lg font-black text-white leading-none">Confirmar Cambio</h2>
            <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-1">Pedido #{pedido.numero}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body p-6 text-center">
          <div className="bg-amber-50 border-2 border-amber-200 p-5 rounded-3xl mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-600">
              <RotateCcw size={28} />
            </div>
            <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">¿Actualizar estado del pedido?</h3>
            <p className="text-xs text-amber-700/80 mt-2 font-medium">Estás a punto de avanzar este pedido en el flujo de ventas.</p>
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 relative overflow-hidden mb-6">
            <div className="text-center flex-1">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Actual</p>
              <EstadoBadge estado={pedido.estado} />
            </div>
            <div className="px-4 text-gray-300 animate-pulse">
              <ArrowRight size={20} strokeWidth={3} />
            </div>
            <div className="text-center flex-1">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Nuevo</p>
              <EstadoBadge estado={nuevoEstado} />
            </div>
          </div>

          <div className="space-y-2">
            <button 
              onClick={() => onConfirm(pedido.id, nuevoEstado)}
              className="btn-primary w-full py-4 text-xs font-black uppercase tracking-widest shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--green-700) 0%, var(--green-600) 100%)' }}
            >
              Confirmar y Actualizar
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL — VER DETALLE
   ═══════════════════════════════════════════════════════════ */
function ModalVerPedido({ pedido, empleados, onClose, onEdit }) {
  const navigate = useNavigate();
  const esTransferencia = pedido.metodo_pago?.includes("Transferencia");
  const [tab, setTab] = useState(esTransferencia ? "pago" : "resumen");
  const emp = empleados.find(e => e.id === pedido.idEmpleado);
  if (!pedido) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box--wide"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Pedido</p>
            <h2 className="modal-header__title">{pedido.numero}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <EstadoBadge estado={pedido.estado} />
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="ver-ped-tabs">
          <button className={`ver-ped-tab${tab === "resumen"   ? " ver-ped-tab--active" : ""}`} onClick={() => setTab("resumen")}>📋 Resumen</button>
          <button className={`ver-ped-tab${tab === "productos" ? " ver-ped-tab--active" : ""}`} onClick={() => setTab("productos")}>📦 Productos</button>
          <button className={`ver-ped-tab${tab === "pago"      ? " ver-ped-tab--active" : ""}`} onClick={() => setTab("pago")}>
            💳 Pago {esTransferencia && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, background: "#e3f2fd", color: "#1565c0", border: "1px solid #90caf9", borderRadius: 4, padding: "1px 5px" }}>Transferencia</span>}
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>

          {/* ── Tab Resumen ── */}
          {tab === "resumen" && (
            <div className="form-grid-2" style={{ gap: 24 }}>
              {/* Cliente */}
              <div>
                <p className="section-label">Información del Cliente</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="ver-ped-field">
                    <span className="ver-ped-field__label">Nombre</span>
                    <span className="ver-ped-field__value">{pedido.cliente?.nombre || "—"}</span>
                  </div>
                  <div className="ver-ped-field">
                    <span className="ver-ped-field__label">Correo</span>
                    <span className="ver-ped-field__value">
                      {pedido.cliente?.correo
                        ? <a href={`mailto:${pedido.cliente.correo}`} style={{ color: "#1565c0", textDecoration: "none", fontWeight: 600 }}>✉ {pedido.cliente.correo}</a>
                        : "—"}
                    </span>
                  </div>
                  <div className="ver-ped-field">
                    <span className="ver-ped-field__label">Teléfono</span>
                    <span className="ver-ped-field__value">
                      {pedido.cliente?.telefono
                        ? <a href={`https://wa.me/${pedido.cliente.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2e7d32", textDecoration: "none", fontWeight: 600 }}>📞 {pedido.cliente.telefono}</a>
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Entrega */}
              <div>
                <p className="section-label">Entrega</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="ver-ped-field">
                    <span className="ver-ped-field__label">Tipo</span>
                    <span className="ver-ped-field__value">{pedido.domicilio ? "🛵 Domicilio" : "🏪 Recogida en tienda"}</span>
                  </div>
                  {pedido.domicilio && (
                    <>
                      <div className="ver-ped-field">
                        <span className="ver-ped-field__label">Dirección</span>
                        <span className="ver-ped-field__value">{pedido.direccion_entrega || "—"}</span>
                      </div>
                      <div className="ver-ped-field">
                        <span className="ver-ped-field__label">Domiciliario</span>
                        <span className="ver-ped-field__value">
                          {pedido.nombre_domiciliario
                            || (emp ? `${emp.nombre} ${emp.apellidos}` : null)
                            || (pedido.estado === "Entregado" ? "Sin información" : "Sin asignar")}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="ver-ped-field">
                    <span className="ver-ped-field__label">Fecha del pedido</span>
                    <span className="ver-ped-field__value">📅 {fmtFecha(pedido.fecha_pedido)}</span>
                  </div>
                </div>
              </div>

              {/* Notas (ancho completo) */}
              {pedido.notas && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="info-box info-box--warn">
                    <span className="info-box__icon">📝</span>
                    <div>
                      <span className="info-box__label">Notas del pedido</span>
                      <span className="info-box__text" style={{ display: "block" }}>{pedido.notas}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Enlace producción (ancho completo) */}
              {pedido.orden_produccion && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <button
                    className="info-box info-box--info"
                    style={{ width: "100%", cursor: "pointer", textAlign: "left", border: "1px solid #90caf9" }}
                    onClick={() => { onClose(); navigate(`/admin/ordenes-produccion?search=${pedido.numero}`); }}
                  >
                    <span className="info-box__icon">📦</span>
                    <div>
                      <span className="info-box__label">Producción activa</span>
                      <span className="info-box__text" style={{ display: "block" }}>Ver detalles de fabricación →</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Tab Productos ── */}
          {tab === "productos" && (
            <div>
              <table className="ver-productos-table" style={{ marginBottom: 20 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: "center" }}>Cant.</th>
                    {pedido.sobre_stock && <th style={{ textAlign: "center" }}>Preorden</th>}
                    <th style={{ textAlign: "right" }}>Precio</th>
                    <th style={{ textAlign: "right" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(pedido.productosItems || []).map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>📦 {p.nombre}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ background: "#f1f8f1", border: "1px solid #c8e6c9", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700, color: "#2e7d32" }}>×{p.cantidad}</span>
                      </td>
                      {pedido.sobre_stock && (
                        <td style={{ textAlign: "center" }}>
                          {p.cantidad_preorden > 0
                            ? <span style={{ background: "#fff3e0", border: "1px solid #ffcc02", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#e65100" }}>×{p.cantidad_preorden} preorden</span>
                            : <span style={{ color: "#9e9e9e", fontSize: 11 }}>—</span>}
                        </td>
                      )}
                      <td style={{ textAlign: "right", color: "#757575" }}>{fmt(p.precio)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#2e7d32" }}>{fmt(p.precio * p.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="totales-box">
                <div className="totales-row">
                  <span>Subtotal</span>
                  <span>{fmt(pedido.subtotal)}</span>
                </div>
                {pedido.descuento > 0 && (
                  <div className="totales-row totales-row--descuento">
                    <span>Descuento</span>
                    <span>− {fmt(pedido.descuento)}</span>
                  </div>
                )}
                <div className="totales-row totales-row--total">
                  <span>Total a pagar</span>
                  <span>{fmt(pedido.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab Pago ── */}
          {tab === "pago" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Resumen estado del pago */}
              {(() => {
                const hasAnticipo = pedido.sobre_stock || pedido.requiere_anticipo || pedido.anticipo_registrado || pedido.pago_final_registrado;
                if (!hasAnticipo) return null;
                const montoPagado = pedido.pago_final_registrado
                  ? Number(pedido.total || 0)
                  : pedido.anticipo_registrado
                    ? Number(pedido.anticipo_monto ?? pedido.anticipo_requerido ?? 0)
                    : 0;
                const saldo = Math.max(0, Number(pedido.total || 0) - montoPagado);
                const esPagoCompleto = pedido.pago_final_registrado;
                const esAnticipo = !esPagoCompleto && pedido.anticipo_registrado;
                const estadoPagoLabel = esPagoCompleto ? "Pago completo" : esAnticipo ? "Anticipo" : "Pendiente";
                return (
                  <div style={{
                    background: esPagoCompleto ? "#e8f5e9" : esAnticipo ? "#fff8e1" : "#f5f5f5",
                    border: `1.5px solid ${esPagoCompleto ? "#a5d6a7" : esAnticipo ? "#ffe082" : "#e0e0e0"}`,
                    borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
                  }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: esPagoCompleto ? "#2e7d32" : esAnticipo ? "#e65100" : "#757575" }}>
                      {esPagoCompleto ? "✅" : esAnticipo ? "⚠️" : "🕐"} Estado del pago: {estadoPagoLabel}
                    </p>
                    <div className="ver-ped-field">
                      <span className="ver-ped-field__label">Monto pagado</span>
                      <span className="ver-ped-field__value" style={{ fontWeight: 800, color: "#2e7d32" }}>{fmt(montoPagado)}</span>
                    </div>
                    <div className="ver-ped-field">
                      <span className="ver-ped-field__label">Saldo pendiente</span>
                      <span className="ver-ped-field__value" style={{ fontWeight: 800, color: saldo > 0 ? "#c62828" : "#2e7d32" }}>{fmt(saldo)}</span>
                    </div>
                    {pedido.pago_final_metodo_pago && (
                      <div className="ver-ped-field">
                        <span className="ver-ped-field__label">Método pago final</span>
                        <span className="ver-ped-field__value">{pedido.pago_final_metodo_pago}</span>
                      </div>
                    )}
                    {pedido.pago_final_fecha && (
                      <div className="ver-ped-field">
                        <span className="ver-ped-field__label">Fecha pago final</span>
                        <span className="ver-ped-field__value">📅 {fmtFecha(pedido.pago_final_fecha)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="ver-ped-field">
                <span className="ver-ped-field__label">Método de pago</span>
                <span className="ver-ped-field__value" style={{ fontSize: 15 }}>
                  {esTransferencia ? "🏦 Transferencia bancaria" : "💵 Efectivo"}
                </span>
              </div>

              {pedido.sobre_stock && (
                <div style={{ background: "#fff8e1", border: "1.5px solid #ffe082", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#e65100", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    ⚠️ Pedido sobre stock — anticipo del 50%
                  </p>
                  <div className="ver-ped-field">
                    <span className="ver-ped-field__label">Anticipo requerido</span>
                    <span className="ver-ped-field__value" style={{ fontWeight: 800, color: "#bf360c" }}>
                      {fmt(pedido.anticipo_requerido)}
                    </span>
                  </div>
                  <div className="ver-ped-field">
                    <span className="ver-ped-field__label">Anticipo pagado</span>
                    <span className="ver-ped-field__value" style={{ fontWeight: 800, color: (pedido.anticipo_pagado || 0) >= (pedido.anticipo_requerido || 1) ? "#2e7d32" : "#c62828" }}>
                      {fmt(pedido.anticipo_pagado || 0)}{" "}
                      {(pedido.anticipo_pagado || 0) >= (pedido.anticipo_requerido || 1) ? "✅ Cubierto" : "⚠️ Pendiente"}
                    </span>
                  </div>
                </div>
              )}

              {esTransferencia ? (
                <>
                  <p className="section-label" style={{ marginTop: 4 }}>Datos para realizar la transferencia</p>
                  <div className="cuenta-card">
                    <div className="cuenta-card__rows">
                      {[
                        { label: "Banco",             value: CUENTA_TRANSFERENCIA.banco },
                        { label: "Titular",           value: CUENTA_TRANSFERENCIA.titular },
                        { label: "Tipo de cuenta",    value: CUENTA_TRANSFERENCIA.tipo },
                        { label: "Número",            value: CUENTA_TRANSFERENCIA.numero },
                      ].map(({ label, value }) => (
                        <div key={label} className="cuenta-card__row">
                          <span className="cuenta-card__label">{label}</span>
                          <span className="cuenta-card__value">{value}</span>
                        </div>
                      ))}
                    </div>

                  </div>

                  <div className="info-box info-box--warn" style={{ marginTop: 0 }}>
                    <span className="info-box__icon">ℹ️</span>
                    <span className="info-box__text">Recuerda adjuntar el comprobante de pago al confirmar el pedido.</span>
                  </div>

                  {pedido.comprobante ? (
                    <div>
                      <div className="info-box info-box--success" style={{ marginBottom: 10 }}>
                        <span className="info-box__icon">✅</span>
                        <span className="info-box__text">Comprobante de pago adjuntado.</span>
                        <a href={pedido.comprobante} target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#2e7d32", flexShrink: 0 }}>
                          Abrir →
                        </a>
                      </div>
                      <a href={pedido.comprobante} target="_blank" rel="noopener noreferrer">
                        <img
                          src={pedido.comprobante}
                          alt="Comprobante de pago"
                          style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, border: "1.5px solid #c8e6c9", background: "#f9fdf9", cursor: "zoom-in" }}
                        />
                      </a>
                    </div>
                  ) : (
                    <div className="info-box info-box--danger" style={{ background: "#ffebee", borderColor: "#ef9a9a", color: "#c62828" }}>
                      <span className="info-box__icon">⚠️</span>
                      <span className="info-box__text">Aún no se ha adjuntado comprobante de pago.</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="info-box info-box--success">
                  <span className="info-box__icon">💵</span>
                  <span className="info-box__text">Pago en efectivo al momento de la entrega. No se requiere comprobante.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
          <button
            className="btn-cancel"
            style={{ background: '#f1f8f1', color: '#2e7d32', border: '1.5px solid #c8e6c9' }}
            onClick={() => descargarFacturaPedido(pedido, pedido.cliente)}
          >
            📄 Ver / Imprimir factura
          </button>
          {!["Entregado", "Cancelado"].includes(pedido.estado) && (
            <button className="btn-save" onClick={() => { onClose(); onEdit(pedido); }}>✎ Editar Pedido</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL — PROPONER FECHA DE ENTREGA (producción)
   ═══════════════════════════════════════════════════════════ */
function ModalProponerFecha({ pedido, saving, onClose, onConfirm }) {
  const hoy = new Date().toISOString().split("T")[0];
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!fecha) { setError("Selecciona una fecha de entrega"); return; }
    if (fecha < hoy) { setError("La fecha no puede ser anterior a hoy"); return; }
    onConfirm(pedido.id, fecha);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box relative bg-white shadow-2xl overflow-hidden flex flex-col border-none" style={{ borderRadius: "28px", maxWidth: "440px" }}>
        <div className="modal-header shrink-0" style={{ background: "linear-gradient(135deg, #283593 0%, #3949ab 100%)", padding: "20px 24px" }}>
          <div>
            <h2 className="text-lg font-black text-white leading-none">Proponer fecha de entrega</h2>
            <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-1">Pedido #{pedido.numero}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
            <p className="text-xs font-black text-blue-800 mb-1">📅 Fecha estimada de entrega</p>
            <p className="text-[11px] text-blue-700 font-medium leading-snug">
              El cliente recibirá una notificación con esta fecha y podrá aceptarla o rechazarla.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Fecha propuesta <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              min={hoy}
              value={fecha}
              onChange={e => { setFecha(e.target.value); setError(""); }}
              className={`w-full bg-gray-50 border-2 rounded-2xl p-4 text-sm font-medium text-gray-700 outline-none transition-all ${
                error ? "border-red-400 bg-red-50" : "border-transparent focus:border-blue-400 focus:bg-white"
              }`}
            />
            {error && (
              <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                <AlertCircle size={10} /> {error}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <button
              disabled={saving}
              onClick={handleSubmit}
              className="w-full py-4 text-xs font-black uppercase tracking-widest rounded-2xl text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #283593, #3949ab)" }}
            >
              {saving ? "Enviando…" : "📅 Proponer fecha"}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL — ELIMINAR PEDIDO
   ═══════════════════════════════════════════════════════════ */
function ModalEliminarPedido({ pedido, onClose, onConfirm }) {
  const [done, setDone] = useState(false);

  if (["Entregado"].includes(pedido.estado)) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()} style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ background: "linear-gradient(135deg, #b71c1c 0%, #c62828 100%)", padding: "28px 24px 22px", textAlign: "center", position: "relative" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 30 }}>🚫</div>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>No se puede eliminar</h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>Pedido #{pedido.numero}</p>
          </div>
          <div style={{ padding: "18px 24px" }}>
            <div style={{ padding: "12px 14px", background: "#ffebee", border: "1.5px solid #ef9a9a", borderRadius: 10, color: "#c62828", fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>
              🔒 Los pedidos entregados forman parte del historial financiero y <strong>no pueden eliminarse</strong>.
            </div>
          </div>
          <div style={{ padding: "0 24px 20px" }}>
            <button onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "#c62828", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()} style={{ overflow: "hidden", padding: 0 }}>
        <div style={{ background: "linear-gradient(135deg, #e65100 0%, #f57f17 100%)", padding: "28px 24px 22px", textAlign: "center", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 30 }}>⚠️</div>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>Eliminar pedido</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>#{pedido.numero}</p>
        </div>
        <div style={{ padding: "18px 24px" }}>
          <div style={{ padding: "12px 14px", background: "#fff8e1", border: "1.5px solid #ffe082", borderRadius: 10, color: "#e65100", fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>
            ⚠️ Esta acción <strong>no se puede deshacer</strong>. El pedido será eliminado permanentemente.
          </div>
        </div>
        <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button disabled={done} onClick={() => { setDone(true); setTimeout(() => onConfirm(pedido.id), 800); }} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "#c62828", color: "#fff", fontWeight: 700, fontSize: 14, cursor: done ? "not-allowed" : "pointer", opacity: done ? 0.7 : 1, fontFamily: "inherit" }}>
            {done ? "Eliminando…" : "Eliminar"}
          </button>
          <button onClick={onClose} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1.5px solid #e0e0e0", background: "#fff", color: "#616161", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── ModalRegistrarSaldo ────────────────────────────────── */
function ModalRegistrarSaldo({ pedido, saving, onClose, onConfirm }) {
  const [metodo,    setMetodo]    = useState("");
  const [efectivo,  setEfectivo]  = useState(false);
  const [archivo,   setArchivo]   = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors,    setErrors]    = useState({});

  const anticipo    = pedido.anticipo_monto ?? (pedido.anticipo_requerido ?? 0);
  const saldo       = Math.max(0, (pedido.total ?? 0) - anticipo);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setArchivo(file); setPreview(ev.target.result); setErrors(x => ({ ...x, archivo: "" })); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const e = {};
    if (!metodo) e.metodo = "Selecciona el método de pago del saldo";
    if (metodo === "Efectivo 💵" && !efectivo) e.efectivo = "Confirma que recibiste el saldo en efectivo";
    if (metodo === "Transferencia 🏦" && !preview) e.archivo = "Adjunta el comprobante del saldo";
    if (Object.keys(e).length) { setErrors(e); return; }

    setUploading(true);
    let comprobanteUrl = null;
    if (archivo) {
      try {
        const { subirImagenCloudinary } = await import("../../../utils/cloudinary.js");
        comprobanteUrl = await subirImagenCloudinary(archivo);
      } catch {
        setErrors(x => ({ ...x, archivo: "Error al subir el comprobante. Intenta de nuevo." }));
        setUploading(false);
        return;
      }
    }
    setUploading(false);
    onConfirm(pedido.id, { metodo, comprobanteUrl, saldo });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()} style={{ overflow: "hidden", padding: 0, maxWidth: 420 }}>
        <div style={{ background: "linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)", padding: "24px 24px 18px", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 14 }}>✕</button>
          <div style={{ fontSize: 30, marginBottom: 10, textAlign: "center" }}>💳</div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", textAlign: "center" }}>Registrar pago del saldo</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.85)", textAlign: "center" }}>Pedido {pedido.numero}</p>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#f5f5f5", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#999", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Total pedido</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#333" }}>{fmt(pedido.total)}</div>
            </div>
            <div style={{ background: "#e8f5e9", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#4caf50", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Anticipo pagado</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#2e7d32" }}>{fmt(anticipo)}</div>
            </div>
          </div>

          <div style={{ background: "#fff8e1", border: "1.5px solid #f9a825", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e65100" }}>Saldo a cobrar ahora</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#e65100" }}>{fmt(saldo)}</span>
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#555" }}>Método de pago del saldo <span style={{ color: "#e53935" }}>*</span></p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {["Efectivo 💵", "Transferencia 🏦"].map(m => (
                <button key={m} onClick={() => { setMetodo(m); setEfectivo(false); setArchivo(null); setPreview(null); setErrors(x => ({ ...x, metodo: "", efectivo: "", archivo: "" })); }}
                  style={{ padding: "11px 8px", borderRadius: 10, border: `2px solid ${metodo === m ? "#2e7d32" : "#e0e0e0"}`, background: metodo === m ? "#f1f8f1" : "#fff", color: metodo === m ? "#1b5e20" : "#888", fontWeight: metodo === m ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
                  {m}
                </button>
              ))}
            </div>
            {errors.metodo && <span style={{ fontSize: 11, color: "#e53935", display: "block", marginTop: 4 }}>{errors.metodo}</span>}
          </div>

          {metodo === "Efectivo 💵" && (
            <div className="fade-in">
              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", background: efectivo ? "#f1f8f1" : "#fafafa", padding: "12px 14px", borderRadius: 10, border: `2px solid ${efectivo ? "#2e7d32" : "#e0e0e0"}` }}>
                <input type="checkbox" checked={efectivo} onChange={e => { setEfectivo(e.target.checked); setErrors(x => ({ ...x, efectivo: "" })); }} style={{ width: 18, height: 18, accentColor: "#2e7d32" }} />
                <span style={{ fontSize: 13, color: efectivo ? "#1b5e20" : "#555", fontWeight: efectivo ? 700 : 400 }}>
                  Confirmo que recibí <strong>{fmt(saldo)}</strong> en efectivo
                </span>
              </label>
              {errors.efectivo && <span style={{ fontSize: 11, color: "#e53935", display: "block", marginTop: 4 }}>{errors.efectivo}</span>}
            </div>
          )}

          {metodo === "Transferencia 🏦" && (
            <div className="fade-in">
              {preview ? (
                <div style={{ position: "relative", height: 120, borderRadius: 10, overflow: "hidden", background: "#000" }}>
                  <img src={preview} alt="Comprobante saldo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <button style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", fontSize: 12 }} onClick={() => { setArchivo(null); setPreview(null); }}>✕</button>
                </div>
              ) : (
                <label className={`comprobante-dropzone${errors.archivo ? " error" : ""}`} style={{ height: 100 }}>
                  <input type="file" accept="image/*,application/pdf" onChange={handleFile} hidden />
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 24 }}>📎</span>
                    <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700, color: "#1565c0" }}>Comprobante del saldo</p>
                  </div>
                </label>
              )}
              {errors.archivo && <span style={{ fontSize: 11, color: "#e53935", display: "block", marginTop: 4 }}>{errors.archivo}</span>}
            </div>
          )}
        </div>

        <div style={{ padding: "0 22px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving || uploading ? "not-allowed" : "pointer", opacity: saving || uploading ? 0.7 : 1, fontFamily: "inherit" }}
          >
            {uploading ? "Subiendo comprobante…" : saving ? "Procesando…" : "✅ Confirmar entrega y registrar pago"}
          </button>
          <button onClick={onClose} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1.5px solid #e0e0e0", background: "#fff", color: "#616161", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function ModalErrorEstadoPedido({ mensaje, onClose }) {
  if (!mensaje) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()} style={{ overflow: "hidden", padding: 0 }}>
        <div style={{ background: "linear-gradient(135deg, #e65100 0%, #f57f17 100%)", padding: "28px 24px 22px", textAlign: "center", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 30 }}>⚠️</div>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>No se pudo avanzar</h3>
        </div>
        <div style={{ padding: "18px 24px" }}>
          <div style={{ padding: "12px 14px", background: "#fff8e1", border: "1.5px solid #ffe082", borderRadius: 10, color: "#e65100", fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>
            ⚠️ {mensaje}
          </div>
        </div>
        <div style={{ padding: "0 24px 20px" }}>
          <button onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "#f57f17", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Entendido</button>
        </div>
      </div>
    </div>
  );
}

function ModalAsignarDomiciliario({ pedido, empleados, onClose, onConfirm }) {
  const [empId, setEmpId] = useState(pedido.idEmpleado || "");
  const [error, setError] = useState("");
  const empActual = empleados.find(e => e.id === pedido.idEmpleado);

  const handleSubmit = () => {
    if (!empId) {
      setError("Selecciona un domiciliario");
      return;
    }
    const id = parseInt(empId, 10);
    if (pedido.idEmpleado && pedido.idEmpleado === id) {
      setError("El pedido ya tiene asignado este domiciliario");
      return;
    }
    onConfirm(pedido.id, id);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box shadow-2xl overflow-hidden flex flex-col border-none" style={{ borderRadius: '32px', maxWidth: '440px' }}>

        <div className="modal-header shrink-0" style={{ background: 'linear-gradient(135deg, var(--green-900) 0%, var(--green-800) 100%)', padding: '24px' }}>
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-xl p-3 rounded-2xl border border-white/20">
              <Truck size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight leading-none mb-1 text-white">Asignar Repartidor</h2>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Pedido #{pedido.numero}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/70">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body p-6 space-y-5">
          <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm border border-indigo-100">
              <MapPin size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Lugar de Entrega</p>
              <p className="text-xs font-bold text-gray-700 leading-tight">{pedido.direccion_entrega || "Recogida en tienda"}</p>
            </div>
          </div>

          {empActual && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2">
              <div className="p-2 bg-white rounded-xl text-amber-600 shadow-sm border border-amber-100">
                <Truck size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Repartidor Actual</p>
                <p className="text-xs font-black text-amber-800">{empActual.nombre} {empActual.apellidos}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Seleccionar Nuevo Repartidor <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                className={`w-full bg-gray-50 border-2 rounded-2xl py-4 px-4 text-sm font-bold text-gray-700 outline-none transition-all appearance-none ${
                  error ? "border-red-500 bg-red-50" : "border-transparent focus:border-green-600 focus:bg-white"
                }`}
                value={empId}
                onChange={e => { setEmpId(e.target.value); setError(""); }}
              >
                <option value="">— Elegir de la lista —</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.nombre} {e.apellidos}{e.id === pedido.idEmpleado ? " (actual)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-[10px] font-bold text-red-500 px-2 flex items-center gap-1"><AlertCircle size={10} /> {error}</p>}
          </div>
        </div>

        <div className="modal-footer p-6 bg-gray-50/50 border-t border-gray-100 shrink-0 flex gap-3">
          <button className="btn-secondary flex-1 py-4 text-xs font-black uppercase" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1 py-4 text-xs font-black uppercase shadow-lg" style={{ background: 'var(--green-600)' }} onClick={handleSubmit}>Asignar Ahora</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL — CANCELAR PEDIDO (con motivo obligatorio)
   ═══════════════════════════════════════════════════════════ */
function ModalCancelarPedido({ pedido, saving, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState("");
  const [error,  setError]  = useState("");
  const desdeListo = pedido.estado === "Listo";

  const handleSubmit = () => {
    if (!motivo.trim()) {
      setError("El motivo es obligatorio para cancelar un pedido");
      return;
    }
    onConfirm(pedido.id, motivo.trim());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box relative bg-white shadow-2xl overflow-hidden flex flex-col border-none" style={{ borderRadius: "28px", maxWidth: "440px" }}>
        <div className="modal-header shrink-0" style={{ background: "linear-gradient(135deg, #b71c1c 0%, #e53935 100%)", padding: "20px 24px" }}>
          <div>
            <h2 className="text-lg font-black text-white leading-none">Cancelar Pedido</h2>
            <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-1">Pedido #{pedido.numero}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body p-6 space-y-4">
          {desdeListo && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-800">El pedido ya está Listo</p>
                <p className="text-[11px] text-amber-700 mt-1 font-medium leading-snug">
                  Al cancelar se registrará una salida de inventario por los productos de este pedido.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Motivo de cancelación <span className="text-red-500">*</span>
            </label>
            <textarea
              className={`w-full bg-gray-50 border-2 rounded-2xl p-4 text-sm font-medium text-gray-700 outline-none transition-all resize-none h-24 ${
                error ? "border-red-400 bg-red-50" : "border-transparent focus:border-red-400 focus:bg-white"
              }`}
              placeholder="Describe el motivo de cancelación…"
              value={motivo}
              onChange={e => { setMotivo(e.target.value); setError(""); }}
            />
            {error && (
              <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                <AlertCircle size={10} /> {error}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <button
              disabled={saving}
              onClick={handleSubmit}
              className="w-full py-4 text-xs font-black uppercase tracking-widest rounded-2xl text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #b71c1c, #e53935)" }}
            >
              {saving ? "Cancelando…" : "Confirmar Cancelación"}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MENÚ DE ACCIONES POR FILA
   ═══════════════════════════════════════════════════════════ */
function AccionesCell({ ped, saving, onVer, onEditar, onConfirmar, onMarcarListo, onEntregar, onAsignarDomicilio, onCancelar, onProponerFecha }) {
  const necesitaProduccion  = ped.requiereFechaPropuesta;
  const canEdit             = !["Confirmado","Listo","Asignado","En camino","Entregado","Cancelado"].includes(ped.estado);
  const canAdvance          = ped.estado === "Pendiente" && !necesitaProduccion;
  const canProponerFecha    = ped.estado === "Pendiente" && necesitaProduccion;
  const canMarcarListo      = ped.estado === "Confirmado";
  const canEntregarTienda   = ped.estado === "Listo" && !ped.domicilio;
  const canAsignarDomicilio = ped.estado === "Listo" && ped.domicilio;
  const canEntregar         = ped.estado === "En camino";
  const canCancel           = !["Entregado", "Cancelado"].includes(ped.estado);

  return (
    <div className="actions-cell">
      <button className="act-btn act-btn--view"   data-tooltip="Ver detalle"           onClick={() => onVer(ped)}>👁</button>
      {canEdit          && <button className="act-btn act-btn--edit"    data-tooltip="Editar pedido"          disabled={saving} onClick={() => onEditar(ped)}>✎</button>}
      {canAdvance       && <button className="act-btn act-btn--success" data-tooltip="Confirmar pedido"       disabled={saving} onClick={() => onConfirmar(ped)}>✔</button>}
      {canProponerFecha && <button className="act-btn act-btn--info"    data-tooltip="Proponer fecha entrega" disabled={saving} onClick={() => onProponerFecha(ped)}>📅</button>}
      {canMarcarListo   && <button className="act-btn act-btn--success" data-tooltip="Marcar como listo"      disabled={saving} onClick={() => onMarcarListo(ped)}>📦</button>}
      {canEntregarTienda   && <button className="act-btn act-btn--success" data-tooltip="Entregar en tienda"     disabled={saving} onClick={() => onEntregar(ped)}>🏪</button>}
      {canAsignarDomicilio && <button className="act-btn act-btn--info"    data-tooltip="Asignar domiciliario"   disabled={saving} onClick={() => onAsignarDomicilio(ped)}>🛵</button>}
      {canEntregar         && <button className="act-btn act-btn--success" data-tooltip="Registrar entrega"      disabled={saving} onClick={() => onEntregar(ped)}>🚚</button>}
      {canCancel           && <button className="act-btn act-btn--delete"  data-tooltip="Cancelar pedido"        disabled={saving} onClick={() => onCancelar(ped)}>✕</button>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════ */
function SkeletonRows({ cols = 8, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}><div className="skeleton-cell" /></td>
      ))}
    </tr>
  ));
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function GestionPedidos() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const empleados = (usuarios || []).filter(u =>
    u.tipo === "empleado" && u.estado && (
      u.idRol === 1 || u.idRol === 4 ||
      ["admin", "administrador", "domiciliario"].includes((u.rol || "").toLowerCase())
    )
  );

  const [pedidos,      setPedidos]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [actionSaving, setActionSaving] = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterTipo,   setFilterTipo]   = useState("todos");
  const [filterDesde,  setFilterDesde]  = useState("");
  const [filterHasta,  setFilterHasta]  = useState("");
  const [showFilter,   setShowFilter]   = useState(false);
  const [vista,            setVista]            = useState("activos");
  const [historial,        setHistorial]        = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [historialLoaded,  setHistorialLoaded]  = useState(false);
  const [page,         setPage]         = useState(1);
  const [modal,        setModal]        = useState(null);
  const [toast,        setToast]        = useState(null);
  const filterRef = useRef();

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const cargarHistorial = async () => {
    if (historialLoaded) return;
    setLoadingHistorial(true);
    try {
      const data = await getHistorialPedidos({ porPagina: 100 });
      setHistorial(data.pedidos);
      setHistorialLoaded(true);
    } catch {
      // silent
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleCambiarVista = (v) => {
    setVista(v);
    setPage(1);
    if (v === "historial") cargarHistorial();
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [data, prodData] = await Promise.all([
        getPedidos({ porPagina: 100 }),
        getProductos({ porPagina: 100 }).catch(() => ({ productos: [] })),
      ]);

      const productosCatalogo = Array.isArray(prodData?.productos)
        ? prodData.productos
        : Array.isArray(prodData)
          ? prodData
          : [];

      const produccionIds = new Set(
        productosCatalogo
          .filter(esProductoConProduccion)
          .map(producto => normalizeProductoId(producto?.ID_Producto ?? producto?.id))
          .filter(Boolean)
      );

      setPedidos(prev => {
        const newIds = new Set(data.pedidos.map(p => p.id));
        const preserved = prev.filter(p =>
          ["Entregado", "Cancelado"].includes(p.estado) && !newIds.has(p.id)
        );
        const enhanced = data.pedidos.map(p => {
          const requiereProduccion = Boolean(p.requiereProduccion) ||
            (p.productosItems || []).some(i => produccionIds.has(normalizeProductoId(i.idProducto)));

          return {
            ...p,
            requiereProduccion,
          };
        });
        return [...enhanced, ...preserved].sort((a, b) => b.id - a.id);
      });
    } catch (err) {
      showToast(err.message || "Error al cargar pedidos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    getUsuarios({ porPagina: 100 }).then(setUsuarios).catch(() => {});
  }, []);

  useEffect(() => {
    const h = e => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const listaActual = vista === "activos" ? pedidos : historial;
  const filtered = listaActual.filter(p => {
    const q      = search.toLowerCase();
    const matchQ = [p.numero, p.cliente?.nombre, p.cliente?.correo, p.metodo_pago, p.estado]
      .filter(Boolean).some(v => v.toLowerCase().includes(q));
    const matchE = filterEstado === "todos" || p.estado === filterEstado;
    const matchT =
      filterTipo === "todos"      ? true :
      filterTipo === "domicilio"  ? p.domicilio :
      filterTipo === "tienda"     ? !p.domicilio :
      filterTipo === "produccion" ? p.orden_produccion : true;
    // Fecha range
    let matchFecha = true;
    if (filterDesde || filterHasta) {
      const val = getRecordDate(p) || p.fecha_pedido || p.Fecha_pedido;
      if (!val) matchFecha = false;
      else {
        const d = new Date(String(val).split('T')[0]);
        if (filterDesde && new Date(filterDesde) > d) matchFecha = false;
        if (filterHasta && new Date(filterHasta) < d) matchFecha = false;
      }
    }
    return matchQ && matchE && matchT && matchFecha;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paged      = [...filtered]
    .sort((a, b) => (b.fecha_pedido || '').localeCompare(a.fecha_pedido || ''))
    .slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  useEffect(() => setPage(1), [search, filterEstado, filterTipo]);

  const hasFilter = filterEstado !== "todos" || filterTipo !== "todos";

  const handleCambiarEstadoDirecto = (ped) => {
    setModal({ type: "confirmarEstado", pedido: ped, nuevoEstado: "Confirmado" });
  };

  const handleMarcarListo = (ped) => {
    setModal({ type: "confirmarEstado", pedido: ped, nuevoEstado: "Listo" });
  };

  const handleEntregarPedido = (ped) => {
    // Pedidos con anticipo: mostrar modal de saldo si aún no fue registrado
    if (ped.requiere_anticipo && !ped.pago_final_registrado) {
      setModal({ type: "registrarSaldo", pedido: ped });
      return;
    }
    // Pedidos sin anticipo: comprobante obligatorio solo si fue por transferencia
    const esTransferencia = (ped.metodo_pago || "").toLowerCase().includes("transfer");
    if (!ped.requiere_anticipo && esTransferencia && !ped.comprobante) {
      setModal({ type: "errorEstado", mensaje: "No se puede entregar: el pedido no tiene comprobante de pago adjunto. Adjunta el comprobante antes de marcar como entregado." });
      return;
    }
    setModal({ type: "confirmarEstado", pedido: ped, nuevoEstado: "Entregado" });
  };

  const handleRegistrarSaldo = async (pedidoId, saldoData) => {
    const ped = pedidos.find(p => p.id === pedidoId);
    if (!ped) return;
    setActionSaving(true);
    try {
      // 1. Registrar el pago final en el backend
      const metodo_pago = saldoData.metodo.includes("Transferencia") ? "Transferencia" : "Efectivo";
      const pedidoActualizado = await registrarPagoFinal(pedidoId, {
        monto:           saldoData.saldo,
        metodo_pago,
        comprobante_url: saldoData.comprobanteUrl ?? null,
      });

      // 2. Marcar como Entregado (el backend ya validó que pago_final_registrado == 1)
      await cambiarEstadoVenta(pedidoId, 8);

      // Fusionar el pedido actualizado (con los datos de pago_final) en el estado local
      setPedidos(prev => prev.map(p =>
        p.id === pedidoId ? { ...p, ...pedidoActualizado, estado: "Entregado" } : p
      ));
      showToast(`Pedido ${ped.numero} entregado — saldo ${fmt(saldoData.saldo)} registrado`);
      setModal(null);
    } catch (err) {
      setModal({ type: "errorEstado", mensaje: err.message || "No se pudo completar la entrega." });
    } finally {
      setActionSaving(false);
    }
  };

  const handleCancelarPedido = (ped) => {
    setModal({ type: "cancelar", pedido: ped });
  };

  const handleProponerFecha = (ped) => {
    setModal({ type: "proponerFecha", pedido: ped });
  };

  const handleConfirmarFechaPropuesta = async (id, fecha) => {
    const ped = pedidos.find(p => p.id === id);
    if (!ped) return;
    setActionSaving(true);
    try {
      await proponerFechaProduccion(id, fecha);
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: "Fecha propuesta", fecha_propuesta: fecha } : p));
      showToast(`Fecha propuesta enviada al cliente para ${ped.numero}`);
      setModal(null);
    } catch (err) {
      showToast(err.message || "No se pudo proponer la fecha", "error");
    } finally {
      setActionSaving(false);
    }
  };

  const handleConfirmarCambioEstado = async (id, nuevoEstado) => {
    const ped = pedidos.find(p => p.id === id);
    if (!ped) return;
    setActionSaving(true);
    try {
      if (nuevoEstado === "Listo") {
        await cambiarEstadoVenta(id, 11);
      } else if (nuevoEstado === "Entregado") {
        await cambiarEstadoVenta(id, 8);
      } else {
        await confirmarPedido(id);
      }
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
      showToast(
        nuevoEstado === "Listo"     ? `Pedido ${ped.numero} marcado como listo` :
        nuevoEstado === "Entregado" ? `Pedido ${ped.numero} marcado como entregado` :
        `Pedido ${ped.numero} confirmado exitosamente`
      );
      setModal(null);
    } catch (err) {
      const errorMsg = err.message || "No se pudo cambiar el estado del pedido.";
      setModal({ type: "errorEstado", mensaje: errorMsg });
    } finally {
      setActionSaving(false);
    }
  };

  const handleConfirmarCancelacion = async (id, motivo) => {
    const ped = pedidos.find(p => p.id === id);
    if (!ped) return;
    setActionSaving(true);
    try {
      if (ped.estado === "Listo") {
        for (const prod of ped.productosItems) {
          await registrarSalida({
            tipo: "Producto",
            idProducto: prod.idProducto,
            cantidad: prod.cantidad,
            motivo: `Pedido ${ped.numero} cancelado: ${motivo}`,
          });
        }
      }
      await cancelarPedido(id, motivo);
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: "Cancelado" } : p));
      showToast(`Pedido ${ped.numero} cancelado`);
      setModal(null);
    } catch (err) {
      const errorMsg = err.message || "No se pudo cancelar el pedido.";
      setModal({ type: "errorEstado", mensaje: errorMsg });
    } finally {
      setActionSaving(false);
    }
  };

  const handleAsignarDomiciliario = async (pedidoId, empId) => {
    const ped = pedidos.find(p => p.id === pedidoId);
    if (!ped) return;
    setActionSaving(true);
    try {
      if (!ped.id_domicilio) throw new Error("Este pedido no tiene domicilio asociado.");
      await asignarRepartidor(ped.id_domicilio, empId);
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: "Asignado", idEmpleado: empId } : p));
      showToast(`Domiciliario asignado para ${ped.numero}`);
      setModal(null);
    } catch (err) {
      const errorMsg = err.message || "No se pudo asignar el domiciliario.";
      setModal({ type: "errorEstado", mensaje: errorMsg });
    } finally {
      setActionSaving(false);
    }
  };

  const handleCrearPedido = async (formData) => {
    try {
      const metodoPago = (formData.metodo_pago || "").split(" ")[0]; // strip emoji
      const payload = {
        ID_Usuario: Number(formData.idCliente),
        Metodo_Pago: metodoPago,
        comprobante_pago: formData.comprobante || null,
        productos: (formData.productosItems || []).map(p => ({
          ID_Producto: Number(p.idProducto),
          Cantidad:    Number(p.cantidad),
        })),
        Fecha_entrega_esperada: formData.fecha_entrega || null,
        creado_por_admin: true,
        requiere_anticipo:      formData.requiere_anticipo      || false,
        anticipo_monto:         formData.anticipo_monto         || null,
        anticipo_metodo_pago:   formData.anticipo_metodo_pago   || null,
        anticipo_comprobante_url: formData.anticipo_comprobante_url || null,
        anticipo_registrado:    formData.anticipo_registrado    || false,
        domicilio: formData.domicilio
          ? {
              Direccion_entrega:    formData.direccion_entrega || "",
              Municipio_entrega:    formData.municipio         || "",
              Departamento_entrega: formData.departamento      || "",
              Observaciones:        formData.notas             || null,
            }
          : null,
      };
      await crearPedido(payload);
      setModal(null);
      cargarDatos().catch(() => {});
      showToast("Pedido creado correctamente");
    } catch (err) {
      showToast(err.message || "Error al crear pedido", "error");
      throw err;
    }
  };

  const handleEditarPedido = async (formData) => {
    if (formData?._pagoFinal) {
      setModal(null);
      cargarDatos().catch(() => {});
      showToast("Pago final registrado");
      return;
    }
    try {
      const payload = {
        Metodo_Pago:          (formData.metodo_pago || "").split(" ")[0] || null,
        Domicilio:            formData.domicilio,
        Direccion_Entrega:    formData.direccion_entrega    || null,
        Municipio_entrega:    formData.municipio            || null,
        Departamento_entrega: formData.departamento         || null,
        Subtotal:             formData.subtotal,
        Descuento:            formData.descuento,
        Total:                formData.total,
        Notas:                formData.notas || null,
        Comprobante_Pago:     formData.comprobante || null,
      };
      await editarPedido(formData.id, payload);
      setModal(null);
      cargarDatos().catch(() => {});
      showToast("Pedido actualizado");
    } catch (err) {
      showToast(err.message || "Error al actualizar pedido", "error");
      throw err;
    }
  };

  const handleEliminarPedido = async (id) => {
    try {
      await eliminarPedido(id);
      await cargarDatos();
      showToast("Pedido eliminado", "warn");
    } catch (err) {
      showToast(err.message || "Error al eliminar", "error");
    }
    setModal(null);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Gestión de Pedidos</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        <div className="toolbar">
          <div className="search-wrap">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar pedido, cliente, estado…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div ref={filterRef} style={{ position: "relative" }}>
            <button className={`filter-icon-btn${hasFilter ? " has-filter" : ""}`} onClick={() => setShowFilter(v => !v)} data-tooltip="Filtrar pedidos">▼</button>
            {showFilter && (
              <div className="filter-dropdown filter-dropdown--wide" style={{ minWidth: 340 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <p className="filter-section-title">Estado</p>
                    <div style={{ display: "grid", gap: 2 }}>
                      {[
                        { val: "todos",            label: "Todos",            dot: "#bdbdbd" },
                        { val: "Pendiente",        label: "Pendiente",        dot: ESTADO_CONFIG["Pendiente"]?.dot },
                        { val: "En producción",    label: "En producción",    dot: ESTADO_CONFIG["En producción"]?.dot },
                        { val: "Fecha propuesta",  label: "Fecha propuesta",  dot: ESTADO_CONFIG["Fecha propuesta"]?.dot },
                        { val: "Confirmado",       label: "Confirmado",       dot: ESTADO_CONFIG["Confirmado"]?.dot },
                        { val: "Listo",         label: "Listo",          dot: ESTADO_CONFIG["Listo"]?.dot },
                        { val: "Asignado",      label: "Asignado",       dot: ESTADO_CONFIG["Asignado"]?.dot },
                        { val: "En camino",     label: "En camino",      dot: ESTADO_CONFIG["En camino"]?.dot },
                        { val: "Entregado",     label: "Entregado",      dot: ESTADO_CONFIG["Entregado"]?.dot },
                        { val: "Cancelado",     label: "Cancelado",      dot: ESTADO_CONFIG["Cancelado"]?.dot },
                      ].map(f => (
                        <button key={f.val} className={`filter-option${filterEstado === f.val ? " active" : ""}`} onClick={() => setFilterEstado(f.val)}>
                          <span className="filter-dot" style={{ background: f.dot }} />{f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderLeft: "1px solid #f0f0f0", paddingLeft: 12 }}>
                    <p className="filter-section-title">Tipo</p>
                    <div style={{ display: "grid", gap: 2 }}>
                      {[
                        { val: "todos",      label: "Todos",           dot: "#bdbdbd" },
                        { val: "domicilio",  label: "Con domicilio",   dot: "#8e24aa" },
                        { val: "tienda",     label: "Retiro en tienda",dot: "#1976d2" },
                        { val: "produccion", label: "En producción",   dot: "#1565c0" },
                      ].map(f => (
                        <button key={f.val} className={`filter-option${filterTipo === f.val ? " active" : ""}`} onClick={() => { setFilterTipo(f.val); setShowFilter(false); }}>
                          <span className="filter-dot" style={{ background: f.dot }} />{f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <DateRangeFilter
                    desde={filterDesde}
                    hasta={filterHasta}
                    onApply={({desde, hasta}) => { setFilterDesde(desde || ''); setFilterHasta(hasta || ''); setShowFilter(false); }}
                    onClear={() => { setFilterDesde(''); setFilterHasta(''); setShowFilter(false); }}
                    label="Filtrar por fecha del pedido"
                  />
                </div>
                {hasFilter && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0f0f0", textAlign: "center" }}>
                    <button onClick={() => { setFilterEstado("todos"); setFilterTipo("todos"); setShowFilter(false); }} style={{ fontSize: 11, fontWeight: 700, color: "#c62828", background: "none", border: "none", cursor: "pointer" }}>Limpiar filtros</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {(hasFilter || search) && (
            <button className="btn-limpiar" onClick={() => { setSearch(""); setFilterEstado("todos"); setFilterTipo("todos"); }}>
              ✕ Limpiar
            </button>
          )}

          {vista === "activos" && (
            <button className="btn-agregar" onClick={() => setModal({ type: "crear" })} data-tooltip="Crear nuevo pedido">
              Nuevo pedido <span style={{ fontSize: 18 }}>+</span>
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #f0f0f0" }}>
          {[
            { val: "activos",   label: "Pedidos activos",  count: pedidos.length },
            { val: "historial", label: "Historial",         count: historialLoaded ? historial.length : null },
          ].map(t => (
            <button
              key={t.val}
              onClick={() => handleCambiarVista(t.val)}
              style={{
                padding: "9px 22px", fontWeight: 700, fontSize: 13, border: "none", background: "none", cursor: "pointer",
                borderBottom: vista === t.val ? "2px solid #2e7d32" : "2px solid transparent",
                color: vista === t.val ? "#2e7d32" : "#888",
                marginBottom: -2, transition: "color 0.15s",
              }}
            >
              {t.label}
              {t.count !== null && (
                <span style={{ marginLeft: 6, background: vista === t.val ? "#e8f5e9" : "#f5f5f5", color: vista === t.val ? "#2e7d32" : "#888", fontWeight: 800, fontSize: 10, borderRadius: 20, padding: "2px 7px", border: `1px solid ${vista === t.val ? "#a5d6a7" : "#e0e0e0"}` }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>Nº</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Entrega</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(vista === "activos" ? loading : loadingHistorial) ? (
                  <SkeletonRows cols={8} rows={5} />
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-state__icon">📦</div><p className="empty-state__text">Sin pedidos.</p></div></td></tr>
                ) : paged.map((ped, idx) => {
                  const emp = empleados.find(e => e.id === ped.idEmpleado);
                  return (
                    <tr key={ped.id} className="tbl-row group hover:bg-green-50/30 transition-colors">
                      <td><span className="row-num">{String((safePage - 1) * PER_PAGE + idx + 1).padStart(2, "0")}</span></td>
                      <td>
                        <div className="pedido-num font-black text-green-800">{ped.numero}</div>
                        {ped.sobre_stock && (
                          <div className="text-[9px] font-black text-orange-600 uppercase flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> Preorden
                          </div>
                        )}
                        {ped.anticipo_registrado && (
                          <div className="text-[9px] font-black text-yellow-700 uppercase flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> Anticipo pagado
                          </div>
                        )}
                        {(ped.anticipo_monto > 0) && !ped.anticipo_registrado && (
                          <div className="text-[9px] font-black text-red-600 uppercase flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> Anticipo pendiente
                          </div>
                        )}
                        {ped.comprobante && (
                          <div className="text-[9px] font-black text-green-600 uppercase flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Pago Adjunto
                          </div>
                        )}
                        {ped.fecha_rechazada && (
                          <div className="text-[9px] font-black text-red-700 uppercase flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" /> Fecha rechazada
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="client-name font-bold text-gray-800">{ped.cliente?.nombre || "—"}</div>
                        <div className="client-email text-[11px] text-gray-400 font-medium">{ped.cliente?.correo || ""}</div>
                      </td>
                      <td><div className="date-badge inline-block px-2 py-1 bg-gray-100 rounded-lg text-[11px] font-bold text-gray-600 border border-gray-200">{fmtFecha(ped.fecha_pedido)}</div></td>
                      <td>
                        <div className="total-amount font-black text-gray-900">{fmt(ped.total)}</div>
                        <div className="total-method text-[10px] font-black uppercase text-green-600/70">{ped.metodo_pago}</div>
                      </td>
                      <td>
                        {ped.domicilio ? (
                          <div className="flex flex-col">
                            <div className="tipo-domicilio text-[11px] font-black text-purple-600 flex items-center gap-1">🛵 Domicilio</div>
                            <div className="tipo-sub text-[10px] font-bold text-gray-400 italic">
                              {(() => {
                                const nombre = ped.nombre_domiciliario
                                  || (emp ? `${emp.nombre} ${emp.apellidos}` : null);
                                if (nombre) return nombre.split(" ").slice(0, 2).join(" ");
                                return ped.estado === "Entregado" ? "—" : "Sin asignar";
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="tipo-tienda text-[11px] font-black text-blue-600 flex items-center gap-1">🏪 Tienda</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                          <EstadoBadge estado={ped.estado} />
                          {ped.estado === "En producción" && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#1976d2", letterSpacing: 0.3 }}>
                              ⏳ Esperando producción
                            </span>
                          )}
                          {ped.fecha_rechazada && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#c62828", letterSpacing: 0.3, display: "flex", alignItems: "center", gap: 3 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e53935", display: "inline-block", flexShrink: 0 }} />
                              Cliente rechazó fecha
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {vista === "historial" ? (
                          <button
                            style={{ padding: "5px 14px", fontSize: 12, border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", background: "#fafafa", fontWeight: 600, color: "#555" }}
                            onClick={() => setModal({ type: "ver", pedido: ped })}
                          >Ver detalles</button>
                        ) : (
                          <AccionesCell
                            ped={ped}
                            saving={actionSaving}
                            onVer={ped => setModal({ type: "ver", pedido: ped })}
                            onEditar={ped => setModal({ type: "editar", pedido: ped })}
                            onConfirmar={handleCambiarEstadoDirecto}
                            onMarcarListo={handleMarcarListo}
                            onEntregar={handleEntregarPedido}
                            onAsignarDomicilio={ped => setModal({ type: "asignarDomiciliario", pedido: ped })}
                            onCancelar={handleCancelarPedido}
                            onProponerFecha={handleProponerFecha}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span className="pagination-count">{filtered.length} pedidos</span>
            <div className="pagination-btns">
              <button className="pg-btn-arrow" onClick={() => setPage(1)} disabled={safePage === 1}>‹‹</button>
              <button className="pg-btn-arrow" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              <span className="pg-pill">Página {safePage} de {totalPages}</span>
              <button className="pg-btn-arrow" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <button className="pg-btn-arrow" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>››</button>
            </div>
          </div>
        </div>
      </div>

      {modal?.type === "ver" && <ModalVerPedido pedido={modal.pedido} empleados={empleados} onClose={() => setModal(null)} onEdit={(ped) => setModal({ type: "editar", pedido: ped })} />}
      {modal?.type === "confirmarEstado" && <ModalConfirmarEstado pedido={modal.pedido} nuevoEstado={modal.nuevoEstado} onClose={() => setModal(null)} onConfirm={handleConfirmarCambioEstado} />}
      {modal?.type === "cancelar" && <ModalCancelarPedido pedido={modal.pedido} saving={actionSaving} onClose={() => setModal(null)} onConfirm={handleConfirmarCancelacion} />}
      {modal?.type === "asignarDomiciliario" && <ModalAsignarDomiciliario pedido={modal.pedido} empleados={empleados} onClose={() => setModal(null)} onConfirm={handleAsignarDomiciliario} />}
      {modal?.type === "crear" && <CrearPedido onClose={() => setModal(null)} onSave={handleCrearPedido} />}
      {modal?.type === "editar" && <EditarPedido pedido={modal.pedido} onClose={() => setModal(null)} onSave={handleEditarPedido} />}
      {modal?.type === "eliminar" && <ModalEliminarPedido pedido={modal.pedido} onClose={() => setModal(null)} onConfirm={handleEliminarPedido} />}
      {modal?.type === "proponerFecha" && <ModalProponerFecha pedido={modal.pedido} saving={actionSaving} onClose={() => setModal(null)} onConfirm={handleConfirmarFechaPropuesta} />}
      {modal?.type === "registrarSaldo" && <ModalRegistrarSaldo pedido={modal.pedido} saving={actionSaving} onClose={() => setModal(null)} onConfirm={handleRegistrarSaldo} />}
      {modal?.type === "errorEstado" && <ModalErrorEstadoPedido mensaje={modal.mensaje} onClose={() => setModal(null)} />}

      <Toast toast={toast} />
    </div>
  );
}