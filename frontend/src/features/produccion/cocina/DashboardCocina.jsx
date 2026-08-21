import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUser } from "../../../services/authService.js";
import { useNotificaciones } from "../../notificaciones/context/NotificacionesContext.jsx";
import { fmtFecha } from "../../../utils/dateUtils.js";
import { getPedidos, cambiarEstadoVenta, cancelarPedido } from "../../../services/pedidosService.js";
import { getOrdenes, cambiarEstadoOrden } from "../../../services/ordenesProduccionService.js";
import { getInsumos } from "../../../services/insumosService.js";
import "./DashboardCocina.css";

// Pendiente aparece en la lista (el cocinero ve que viene) pero sin botón de acción;
// el botón "Iniciar preparación" solo se activa desde Confirmado (la transición 1→13
// está bloqueada por la máquina de estados del backend).
const ESTADOS_ACTIVOS_COCINA  = ["Pendiente", "Confirmado", "En producción", "Listo"];
const ESTADOS_ORDENES_ACTIVAS = ["Pendiente", "En proceso"];

// Mapa explícito para evitar problemas con tildes y espacios en class names
const ESTADO_BADGE_CLASS = {
  "Pendiente":     "state--pendiente",
  "Confirmado":    "state--confirmado",
  "En producción": "state--en-produccion",
  "Listo":         "state--listo",
  "Cancelado":     "state--cancelado",
  "En proceso":    "state--en-proceso",
};

const ESTADO_CARD_CLASS = {
  "Pendiente":     "pedido-card--pendiente",
  "Confirmado":    "pedido-card--confirmado",
  "En producción": "pedido-card--en-produccion",
  "Listo":         "pedido-card--listo",
  "Cancelado":     "pedido-card--cancelado",
};

const adaptInsumo = (raw) => ({
  id:          raw.ID_Insumo,
  nombre:      raw.Nombre,
  stockActual: raw.Stock_Actual,
  stockMinimo: raw.Stock_Minimo,
});

const formatDuration = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  const hrs  = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

const buildPriority = (pedido) => {
  const urgency = pedido.fecha_pedido
    ? Math.round((new Date() - new Date(`${pedido.fecha_pedido}T00:00:00`)) / 86_400_000)
    : 0;
  if (pedido.domicilio) return "Alta";
  if (urgency >= 2)     return "Urgente";
  return "Normal";
};

const getTimeMinutes = (start, end) => {
  if (!start || !end) return null;
  const diff = new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`);
  return diff >= 0 ? diff / 60000 : null;
};

export default function DashboardCocina() {
  const user = getUser();
  const { notificaciones } = useNotificaciones();
  const detalleRef = useRef(null);

  const [pedidos,       setPedidos]       = useState([]);
  const [ordenes,       setOrdenes]       = useState([]);
  const [insumos,       setInsumos]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [errorCarga,    setErrorCarga]    = useState(null);
  const [errorAccion,   setErrorAccion]   = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterEstado,  setFilterEstado]  = useState("todos");

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setErrorCarga(null);
    try {
      const [pedidosRes, ordenesRes, insumosRes] = await Promise.all([
        getPedidos({ porPagina: 100 }),
        getOrdenes({ porPagina: 100 }),
        getInsumos({ porPagina: 100 }),
      ]);
      setPedidos(pedidosRes.pedidos || []);
      setOrdenes(ordenesRes || []);
      setInsumos((insumosRes.insumos || []).map(adaptInsumo));
    } catch (err) {
      setErrorCarga(err.message || "No se pudieron cargar los datos. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const cocinaPedidos        = pedidos.filter(p => ESTADOS_ACTIVOS_COCINA.includes(p.estado));

  const q = search.trim().toLowerCase();
  const pedidosFiltrados = cocinaPedidos.filter(p => {
    const matchEstado  = filterEstado === "todos" || p.estado === filterEstado;
    const matchSearch  = !q
      || String(p.numero || "").toLowerCase().includes(q)
      || (p.cliente?.nombre || "").toLowerCase().includes(q);
    return matchEstado && matchSearch;
  });
  const pedidosPendientes    = cocinaPedidos.filter(p => p.estado === "Pendiente");
  const pedidosConfirmados   = cocinaPedidos.filter(p => p.estado === "Confirmado");
  const pedidosEnPreparacion = cocinaPedidos.filter(p => p.estado === "En producción");
  const pedidosListos        = cocinaPedidos.filter(p => p.estado === "Listo");
  const ordenesActivas       = ordenes.filter(o => ESTADOS_ORDENES_ACTIVAS.includes(o.estado));
  const historial            = pedidos.filter(p => ["Listo", "Cancelado"].includes(p.estado));

  const tiempoPromedio = useMemo(() => {
    const tiempos = historial
      .map(p => getTimeMinutes(p.fecha_pedido, p.fecha_actualizacion))
      .filter(t => t != null);
    if (!tiempos.length) return null;
    return Math.round(tiempos.reduce((s, t) => s + t, 0) / tiempos.length);
  }, [historial]);

  const alertasInventario = insumos
    .filter(i => i.stockActual <= (i.stockMinimo ?? 0))
    .sort((a, b) => a.stockActual - b.stockActual)
    .slice(0, 5);

  const cocinaNotificaciones = notificaciones.filter(n => n.idDestinatario === "produccion");
  const selectedPedidoData   = cocinaPedidos.find(p => p.id === selectedPedido) || null;

  const handleVerPedido = (id) => {
    setSelectedPedido(id);
    detalleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Solo Confirmado→13 y En producción→11 son transiciones válidas en el backend
  const handleAvanzarPedido = async (pedido) => {
    const siguienteId = pedido.estado === "Confirmado"     ? 13
      : pedido.estado === "En producción" ? 11
      : null;
    if (!siguienteId) return;
    setErrorAccion(null);
    try {
      await cambiarEstadoVenta(pedido.id, siguienteId);
      await cargarDatos();
    } catch (err) {
      setErrorAccion(err.message || "No se pudo actualizar el pedido. Intenta de nuevo.");
    }
  };

  const handleCancelarPedido = async (pedido) => {
    setErrorAccion(null);
    try {
      await cancelarPedido(pedido.id);
      if (selectedPedido === pedido.id) setSelectedPedido(null);
      await cargarDatos();
    } catch (err) {
      setErrorAccion(err.message || "No se pudo cancelar el pedido. Intenta de nuevo.");
    }
  };

  const handleCompletarOrden = async (orden) => {
    setErrorAccion(null);
    try {
      await cambiarEstadoOrden(orden.id, 11);
      await cargarDatos();
    } catch (err) {
      setErrorAccion(err.message || "No se pudo completar la orden. Intenta de nuevo.");
    }
  };

  if (loading) {
    return (
      <div className="cocina-wrapper">
        <div className="cocina-empty-state">Cargando panel de cocina…</div>
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="cocina-wrapper">
        <div className="cocina-empty-state">
          <p>{errorCarga}</p>
          <button className="ck-btn ck-btn--primary" style={{ marginTop: 12 }} onClick={cargarDatos}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cocina-wrapper">
      <header className="cocina-header">
        <div>
          <p className="cocina-eyebrow">Panel de cocina</p>
          <h1 className="cocina-title">Bienvenido, {user?.nombre || "Cocinero"}</h1>
        </div>
        <div className="cocina-top-badge">
          <span className="cocina-top-badge__label">Pedidos activos</span>
          <strong className="cocina-top-badge__num">{cocinaPedidos.length}</strong>
        </div>
      </header>

      {/* ── Banner de error de acción (visible, persistente hasta que se cierre) ── */}
      {errorAccion && (
        <div className="cocina-error-banner" role="alert">
          <span>{errorAccion}</span>
          <button className="cocina-error-close" onClick={() => setErrorAccion(null)} aria-label="Cerrar">✕</button>
        </div>
      )}

      {/* ── Estadísticas rápidas ── */}
      <section className="cocina-stats-grid">
        <article className="ck-stat ck-stat--pending">
          <div className="ck-stat__icon">⏳</div>
          <div className="ck-stat__body">
            <strong className="ck-stat__num">{pedidosPendientes.length}</strong>
            <span className="ck-stat__label">Pendientes</span>
          </div>
        </article>
        <article className="ck-stat ck-stat--confirmed">
          <div className="ck-stat__icon">✓</div>
          <div className="ck-stat__body">
            <strong className="ck-stat__num">{pedidosConfirmados.length}</strong>
            <span className="ck-stat__label">Confirmados</span>
          </div>
        </article>
        <article className="ck-stat ck-stat--progress">
          <div className="ck-stat__icon">🔥</div>
          <div className="ck-stat__body">
            <strong className="ck-stat__num">{pedidosEnPreparacion.length}</strong>
            <span className="ck-stat__label">En preparación</span>
          </div>
        </article>
        <article className="ck-stat ck-stat--ready">
          <div className="ck-stat__icon">📦</div>
          <div className="ck-stat__body">
            <strong className="ck-stat__num">{pedidosListos.length}</strong>
            <span className="ck-stat__label">Listos</span>
          </div>
        </article>
        <article className="ck-stat ck-stat--avg-time">
          <div className="ck-stat__icon">⏱</div>
          <div className="ck-stat__body">
            <strong className={`ck-stat__num${tiempoPromedio == null ? " ck-stat__num--empty" : ""}`}>
              {tiempoPromedio != null ? formatDuration(tiempoPromedio) : "—"}
            </strong>
            <span className="ck-stat__label">Tiempo prom.</span>
          </div>
        </article>
      </section>

      {/* ── Pedidos de cocina ── */}
      <section className="ck-section">
        <div className="ck-section__header">
          <div>
            <h2 className="ck-section__title">Pedidos de cocina</h2>
            <p className="ck-section__sub">Revisa pedidos listos para comenzar o continuar la preparación.</p>
          </div>
          <span className="ck-tag">Total {cocinaPedidos.length}</span>
        </div>

        {/* Barra de búsqueda y filtro de estado */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#9e9e9e", pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar pedido o cliente…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px 8px 30px",
                border: "1.5px solid #e0e0e0", borderRadius: 8,
                fontSize: 13, fontFamily: "inherit", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          {["todos", "Pendiente", "Confirmado", "En producción", "Listo"].map(est => (
            <button
              key={est}
              onClick={() => setFilterEstado(est)}
              style={{
                padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: filterEstado === est ? "1.5px solid #4caf50" : "1.5px solid #e0e0e0",
                background: filterEstado === est ? "#e8f5e9" : "#fafafa",
                color: filterEstado === est ? "#2e7d32" : "#616161",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {est === "todos" ? "Todos" : est}
            </button>
          ))}
        </div>

        <div className="pedido-cards-grid">
          {pedidosFiltrados.length === 0 ? (
            <div className="cocina-empty-state">
              {cocinaPedidos.length === 0 ? "No hay pedidos activos en cocina." : "Sin resultados para esa búsqueda."}
            </div>
          ) : pedidosFiltrados.map(pedido => (
            <article
              key={pedido.id}
              className={`pedido-card ${ESTADO_CARD_CLASS[pedido.estado] || ""}`}
            >
              <div className="pedido-card__header">
                <div>
                  <span className="pedido-number">#{pedido.numero}</span>
                  <span className={`estado-badge ${ESTADO_BADGE_CLASS[pedido.estado] || ""}`}>
                    {pedido.estado}
                  </span>
                </div>
                <button className="ck-btn ck-btn--link" onClick={() => handleVerPedido(pedido.id)}>Ver</button>
              </div>
              <div className="pedido-card__body">
                <p><strong>Cliente:</strong> {pedido.cliente?.nombre || "Cliente anónimo"}</p>
                <p><strong>Hora:</strong> {fmtFecha(pedido.fecha_pedido)}</p>
                <p><strong>Prioridad:</strong> {buildPriority(pedido)}</p>
                <p><strong>Productos:</strong> {pedido.productosItems?.length || 0}</p>
              </div>
              <div className="pedido-card__actions">
                {pedido.estado === "Confirmado" && (
                  <button className="ck-btn ck-btn--primary" onClick={() => handleAvanzarPedido(pedido)}>
                    Iniciar preparación
                  </button>
                )}
                {pedido.estado === "En producción" && (
                  <button className="ck-btn ck-btn--primary" onClick={() => handleAvanzarPedido(pedido)}>
                    Marcar como listo
                  </button>
                )}
                {pedido.estado === "Pendiente" && (
                  <span className="ck-await-label">Esperando confirmación</span>
                )}
                {pedido.estado !== "Cancelado" && (
                  <button className="ck-btn ck-btn--danger" onClick={() => handleCancelarPedido(pedido)}>
                    Cancelar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Órdenes de producción + Alertas de inventario ── */}
      <div className="cocina-two-col">
        <section className="ck-section">
          <div className="ck-section__header">
            <div>
              <h2 className="ck-section__title">Órdenes de producción</h2>
              <p className="ck-section__sub">Controla insumos y completa las órdenes activas.</p>
            </div>
            <span className="ck-tag">{ordenesActivas.length} activas</span>
          </div>
          {ordenesActivas.length === 0 ? (
            <div className="cocina-empty-state">No hay órdenes de producción activas.</div>
          ) : (
            <div className="ordenes-grid">
              {ordenesActivas.map(orden => (
                <article key={orden.id} className="orden-card">
                  <div className="orden-card__header">
                    <div>
                      <span className="orden-id">Orden #{orden.id}</span>
                      <span className={`estado-badge ${ESTADO_BADGE_CLASS[orden.estado] || ""}`}>
                        {orden.estado}
                      </span>
                    </div>
                    <button className="ck-btn ck-btn--link" onClick={() => handleCompletarOrden(orden)}>
                      Marcar completada
                    </button>
                  </div>
                  <p><strong>Producto:</strong> {orden.nombreProducto || "—"} x{orden.cantidad}</p>
                  <p><strong>Insumo:</strong> {orden.nombreInsumo || "—"}</p>
                  <div className="orden-card__footer">
                    <span>Entrega: {orden.fechaEntrega || "—"}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ck-section">
          <div className="ck-section__header">
            <div>
              <h2 className="ck-section__title">Alertas de inventario</h2>
              <p className="ck-section__sub">Insumos próximos a mínimo o agotados.</p>
            </div>
            <span className="ck-tag">{alertasInventario.length}</span>
          </div>
          {alertasInventario.length === 0 ? (
            <div className="cocina-empty-state">No hay alertas de inventario.</div>
          ) : (
            <ul className="alerts-list">
              {alertasInventario.map(insumo => (
                <li key={insumo.id}>
                  <strong>{insumo.nombre}</strong>
                  <span>
                    {insumo.stockActual === 0
                      ? `${insumo.stockActual} (agotado)`
                      : `${insumo.stockActual} (mín. ${insumo.stockMinimo})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Detalle del pedido ── */}
      <section ref={detalleRef} className="ck-section">
        <div className="ck-section__header">
          <div>
            <h2 className="ck-section__title">Detalle del pedido</h2>
            <p className="ck-section__sub">Ver los productos, cantidades y notas de preparación.</p>
          </div>
        </div>
        {selectedPedidoData ? (
          <div className="detalle-pedido-card">
            <div className="detalle-pedido-row">
              <div>
                <p className="detalle-label">Pedido</p>
                <h3 className="detalle-pedido-num">#{selectedPedidoData.numero}</h3>
              </div>
              <div>
                <p className="detalle-label">Estado</p>
                <span className={`estado-badge ${ESTADO_BADGE_CLASS[selectedPedidoData.estado] || ""}`}>
                  {selectedPedidoData.estado}
                </span>
              </div>
            </div>
            <div className="detalle-pedido-grid">
              <div className="detalle-block">
                <p className="detalle-label">Cliente</p>
                <p>{selectedPedidoData.cliente?.nombre || "—"}</p>
                <p className="detalle-small">{selectedPedidoData.cliente?.telefono || ""}</p>
              </div>
              <div className="detalle-block">
                <p className="detalle-label">Código</p>
                <p>{selectedPedidoData.numero}</p>
              </div>
              <div className="detalle-block">
                <p className="detalle-label">Observaciones</p>
                <p>{selectedPedidoData.notas || "Sin observaciones"}</p>
              </div>
            </div>
            <div className="detalle-pedido-table-wrap">
              <table className="detalle-pedido-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPedidoData.productosItems?.map((item, idx) => (
                    <tr key={item.idProducto ?? idx}>
                      <td>{item.nombre}</td>
                      <td>{item.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="detalle-pedido-actions">
              {selectedPedidoData.estado === "Confirmado" && (
                <button className="ck-btn ck-btn--primary" onClick={() => handleAvanzarPedido(selectedPedidoData)}>
                  Iniciar preparación
                </button>
              )}
              {selectedPedidoData.estado === "En producción" && (
                <button className="ck-btn ck-btn--primary" onClick={() => handleAvanzarPedido(selectedPedidoData)}>
                  Marcar como listo
                </button>
              )}
              {selectedPedidoData.estado === "Pendiente" && (
                <span className="ck-await-label">Esperando confirmación del administrador</span>
              )}
              {selectedPedidoData.estado !== "Cancelado" && (
                <button className="ck-btn ck-btn--danger" onClick={() => handleCancelarPedido(selectedPedidoData)}>
                  Cancelar pedido
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="cocina-empty-state">Selecciona un pedido para ver sus detalles.</div>
        )}
      </section>

      {/* ── Historial + Notificaciones ── */}
      <div className="cocina-two-col">
        <section className="ck-section">
          <div className="ck-section__header">
            <div>
              <h2 className="ck-section__title">Historial de preparación</h2>
              <p className="ck-section__sub">Pedidos preparados, cancelados y tiempos registrados.</p>
            </div>
          </div>
          <div className="history-list">
            {historial.length === 0 ? (
              <div className="cocina-empty-state">Aún no hay historial de cocina.</div>
            ) : historial.slice(0, 6).map(p => (
              <div key={p.id} className="history-item">
                <div>
                  <strong>#{p.numero}</strong>
                  <span className={`estado-badge ${ESTADO_BADGE_CLASS[p.estado] || ""}`}>
                    {p.estado}
                  </span>
                </div>
                <div>
                  <span>{fmtFecha(p.fecha_pedido)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ck-section">
          <div className="ck-section__header">
            <div>
              <h2 className="ck-section__title">Notificaciones de cocina</h2>
              <p className="ck-section__sub">Pedidos nuevos, cambios de estado y cancelaciones.</p>
            </div>
          </div>
          {cocinaNotificaciones.length === 0 ? (
            <div className="cocina-empty-state">No hay notificaciones nuevas.</div>
          ) : (
            <ul className="notifications-list">
              {cocinaNotificaciones.slice(0, 8).map(n => (
                <li key={n.id}>
                  <p className="notif-title">{n.titulo}</p>
                  <p className="notif-message">{n.mensaje}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
