import { useState, useEffect } from "react";
import { getUsuarios, editarUsuario } from "../../../services/usuariosService.js";
import { soloLetras, soloDigitos } from "../../../utils/inputFilters";
import { getProductos } from "../../../services/productosService.js";
import { MUNICIPIOS_VALLE_ABURRA } from "../../../utils/departamentosYCiudades.js";
import { subirImagenCloudinary } from "../../../utils/cloudinary.js";
import "./Pedidos.css";

/* ─── Helpers ────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const METODOS_PAGO = ["Efectivo 💵", "Transferencia 🏦"];

/* ─── Qué campos permite editar cada estado ─────────────── */
const PERMISOS_POR_ESTADO = {
  "Pendiente": {
    cliente:           true,
    productos:         true,
    metodo_pago:       true,
    domicilio:         true,
    direccion_entrega: true,
    notas:             true,
    descuento:         true,
  },
  "En producción": {
    cliente:           false,
    productos:         false,
    metodo_pago:       true,
    domicilio:         false,
    direccion_entrega: true,
    notas:             true,
    descuento:         true,
  },
  "Listo": {
    cliente:           false,
    productos:         false,
    metodo_pago:       false,
    domicilio:         false,
    direccion_entrega: true,
    notas:             true,
    descuento:         false,
  },
  "En camino": {
    cliente:           false,
    productos:         false,
    metodo_pago:       false,
    domicilio:         false,
    direccion_entrega: true,
    notas:             true,
    descuento:         false,
  },
};

/* ─── SelectArrow ────────────────────────────────────────── */
function SelectArrow() {
  return (
    <div className="select-arrow">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

/* ─── Campo solo lectura ─────────────────────────────────── */
function FieldReadOnly({ label, value }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <div className="field-input--disabled">{value || "—"}</div>
    </div>
  );
}

/* ─── ProductoItemEditable ───────────────────────────────── */
function ProductoItemEditable({ item, onChange, onRemove }) {
  const sinStock  = item.stockActual === 0;
  const pocoStock = item.stockActual > 0 && item.cantidad > item.stockActual;

  const setQty = (val) => {
    const n = Math.max(1, Math.min(999, Number(val) || 1));
    onChange({ ...item, cantidad: n, stockOk: item.stockActual >= n });
  };

  return (
    <div className="producto-item">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="producto-item__name">{item.nombre}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
          <span className="producto-item__price">{fmt(item.precio)} c/u</span>
          {sinStock && (
            <span className="producto-item__stock-warn producto-item__stock-warn--none">Sin stock</span>
          )}
          {!sinStock && pocoStock && (
            <span className="producto-item__stock-warn producto-item__stock-warn--low">
              Stock insuf. ({item.stockActual} disp.)
            </span>
          )}
        </div>
      </div>
      <div className="producto-item__qty-wrap">
        <button className="qty-btn" onClick={() => setQty(item.cantidad - 1)}>−</button>
        <input
          type="number" min={1} className="qty-input"
          value={item.cantidad}
          onChange={e => setQty(e.target.value)}
        />
        <button className="qty-btn" onClick={() => setQty(item.cantidad + 1)}>+</button>
      </div>
      <div className="producto-item__total">{fmt(item.precio * item.cantidad)}</div>
      <button className="producto-item__remove" onClick={onRemove}>✕</button>
    </div>
  );
}

/* ─── ProductoItemFijo (solo lectura) ────────────────────── */
function ProductoItemFijo({ item }) {
  return (
    <div className="producto-item" style={{ opacity: 0.75, cursor: "default" }}>
      <div style={{ flex: 1 }}>
        <div className="producto-item__name">{item.nombre}</div>
        <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 2 }}>{fmt(item.precio)} c/u</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#757575", padding: "0 10px" }}>
        × {item.cantidad}
      </div>
      <div className="producto-item__total">{fmt(item.precio * item.cantidad)}</div>
    </div>
  );
}

/* ─── BuscadorProducto ───────────────────────────────────── */
function BuscadorProducto({ productosSeleccionados, onAgregar, productos = [] }) {
  const [query,   setQuery]   = useState("");
  const [abierto, setAbierto] = useState(false);

  const idsSeleccionados = productosSeleccionados.map(p => p.idProducto);

  const filtrados = productos
    .filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()))
    .filter(p => !idsSeleccionados.includes(p.id));

  const handleSelect = (prod) => {
    onAgregar({
      idProducto:  prod.id,
      nombre:      prod.nombre,
      precio:      prod.precio,
      cantidad:    1,
      stockActual: prod.stock,
      stockOk:     prod.stock > 0,
    });
    setQuery("");
    setAbierto(false);
  };

  return (
    <div className="product-search-wrap">
      <input
        className="field-input"
        placeholder="Agregar producto…"
        value={query}
        onChange={e => { setQuery(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
      />
      {abierto && query.length > 0 && (
        <div className="product-dropdown">
          {filtrados.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#9e9e9e" }}>Sin resultados</div>
          ) : filtrados.map(prod => {
            const sinStock  = prod.stock === 0;
            const pocoStock = prod.stock > 0 && prod.stock < prod.stockMinimo;
            return (
              <div key={prod.id} className="product-option" onClick={() => handleSelect(prod)}>
                <div>
                  <div className="product-option__name">{prod.nombre}</div>
                  <div style={{ fontSize: 11, color: "#9e9e9e" }}>
                    {prod.categoria || ""}
                  </div>
                </div>
                <div className="product-option__right">
                  <span className="product-option__price">{fmt(prod.precio)}</span>
                  <span className={
                    sinStock  ? "product-option__stock product-option__stock--none" :
                    pocoStock ? "product-option__stock product-option__stock--low"  :
                                "product-option__stock"
                  }>
                    {sinStock ? "Sin stock" : `Stock: ${prod.stock}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL EDITAR PEDIDO
═══════════════════════════════════════════════════════════ */
export default function EditarPedido({ pedido, onClose, onSave }) {
  const [clientes,  setClientes]  = useState([]);
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    getUsuarios({ porPagina: 100 }).then(u => setClientes(u.filter(x => x.tipo === "cliente"))).catch(() => {});
    getProductos({ porPagina: 100 }).then(data => {
      const lista = (data.productos || data || []).map(p => ({
        id:          p.ID_Producto || p.id,
        nombre:      p.Nombre      || p.nombre      || "",
        precio:      p.Precio_Venta|| p.precio      || 0,
        stock:       p.Stock       || p.stock       || 0,
        stockMinimo: p.Stock_Minimo|| p.stockMinimo || 0,
        categoria:   p.nombre_categoria || p.categoria || "",
      }));
      setProductos(lista);
    }).catch(() => {});
  }, []);

  const ESTADOS_FLUJO = ["Pendiente", "En producción", "Listo", "En camino", "Entregado", "Cancelado"];
  const ESTADO_CFG = {
    "Pendiente":      { bg: "#fff8e1", color: "#f9a825", border: "#ffe082", dot: "#f9a825" },
    "En producción":  { bg: "#e3f2fd", color: "#1565c0", border: "#90caf9", dot: "#1976d2" },
    "Listo":          { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7", dot: "#43a047" },
    "En camino":      { bg: "#f3e5f5", color: "#6a1b9a", border: "#ce93d8", dot: "#8e24aa" },
    "Entregado":      { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7", dot: "#43a047" },
    "Cancelado":      { bg: "#ffebee", color: "#c62828", border: "#ef9a9a", dot: "#e53935" },
  };

  const permisos   = PERMISOS_POR_ESTADO[pedido.estado] || {};
  const esEditable = Object.values(permisos).some(Boolean);

  if (!esEditable) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
          <div style={{ padding: "28px 24px", textAlign: "center" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "#ffebee", border: "1px solid #ef9a9a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, margin: "0 auto 14px",
            }}>🚫</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, fontFamily: "var(--font-head)" }}>
              No editable
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#616161" }}>
              Los pedidos en estado <strong>"{pedido.estado}"</strong> no se pueden editar.
            </p>
            <button className="btn-ghost" onClick={onClose}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  const [form, setForm] = useState({
    idCliente:         pedido.idCliente,
    productosItems:    pedido.productosItems || [],
    metodo_pago:       pedido.metodo_pago,
    comprobante:       pedido.comprobante || null,
    comprobantePreview: pedido.comprobante || null,
    domicilio:         pedido.domicilio,
    direccion_entrega: pedido.direccion_entrega || "",
    departamento:      pedido.departamento || "",
    municipio:         pedido.municipio || "",
    notas:             pedido.notas || "",
    descuento:         pedido.descuento || 0,
    estadoPedido:      pedido.estado,
  });
  const [errors,          setErrors]          = useState({});
  const [saved,           setSaved]           = useState(false);
  const [editandoCliente, setEditandoCliente] = useState(false);

  const clienteActual = clientes.find(c => c.id === form.idCliente);
  const [datosCliente, setDatosCliente] = useState(null);

  const abrirEditorCliente = () => {
    if (!clienteActual) return;
    setDatosCliente({
      id:           clienteActual.id,
      nombre:       clienteActual.nombre,
      apellidos:    clienteActual.apellidos,
      correo:       clienteActual.correo,
      telefono:     clienteActual.telefono,
      direccion:    clienteActual.direccion,
      departamento: clienteActual.departamento,
      municipio:    clienteActual.municipio,
    });
    setEditandoCliente(true);
  };

  const guardarDatosCliente = async () => {
    if (!datosCliente) return;
    try {
      await editarUsuario("cliente", clienteActual.id, {
        Nombre: datosCliente.nombre, Apellidos: datosCliente.apellidos,
        Correo: datosCliente.correo, Telefono: datosCliente.telefono,
        Direccion: datosCliente.direccion, Departamento: datosCliente.departamento,
        Municipio: datosCliente.municipio,
      });
    } catch { /* silencioso — el cambio local ya se aplica */ }
    if (form.domicilio) {
      setForm(f => ({
        ...f,
        direccion_entrega: datosCliente.direccion || f.direccion_entrega,
        departamento:      datosCliente.departamento || f.departamento,
        municipio:         datosCliente.municipio || f.municipio,
      }));
    }
    setEditandoCliente(false);
    setDatosCliente(null);
  };

  const setDato = (k, v) => setDatosCliente(p => ({ ...p, [k]: v }));

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    let err = "";
    if (k === "idCliente"         && !v)        err = "Selecciona un cliente";
    if (k === "metodo_pago"       && !v)        err = "Selecciona método de pago";
    if (k === "direccion_entrega" && !v.trim()) err = "Ingresa la dirección";
    setErrors(e => ({ ...e, [k]: err }));
  };

  const subtotal  = form.productosItems.reduce((a, p) => a + p.precio * p.cantidad, 0);
  const descuento = Number(form.descuento) || 0;
  const total     = Math.max(0, subtotal - descuento);
  const hayProductosSinStock = form.productosItems.some(p => !p.stockOk || p.cantidad > p.stockActual);

  const validate = () => {
    const e = {};
    if (permisos.cliente && !form.idCliente)                      e.idCliente         = "Selecciona un cliente";
    if (permisos.productos && form.productosItems.length === 0)   e.productos         = "Agrega al menos un producto";
    if (permisos.metodo_pago && !form.metodo_pago)                e.metodo_pago       = "Selecciona método de pago";
    
    if (form.metodo_pago?.includes("Transferencia") && !form.comprobantePreview) {
      e.comprobante = "El comprobante es obligatorio para transferencias";
    }

    if (form.domicilio) {
      if (!form.direccion_entrega.trim()) e.direccion_entrega = "Ingresa la dirección";
      if (!form.departamento.trim())       e.departamento = "Selecciona el departamento";
      if (!form.municipio.trim())          e.municipio = "Selecciona el municipio";
      const clienteTel = (clienteActual?.telefono || pedido.cliente?.telefono || "").replace(/\D/g, "");
      if (clienteTel.length !== 10) e.telefono_cliente = "El cliente debe tener un teléfono de 10 dígitos válido para pedidos con domicilio";
    }
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    let comprobanteUrl = typeof form.comprobante === "string" ? form.comprobante : null;
    if (form.comprobante instanceof File) {
      try {
        comprobanteUrl = await subirImagenCloudinary(form.comprobante);
      } catch (cloudErr) {
        setErrors(e => ({ ...e, comprobante: cloudErr?.message || "Error al subir el comprobante." }));
        return;
      }
    }

    setSaved(true);
    const clienteObj = clientes.find(c => c.id === form.idCliente);
    const payload = {
      id:     pedido.id,
      numero: pedido.numero,
      idCliente: form.idCliente,
      cliente: permisos.cliente && clienteObj
        ? { nombre: `${clienteObj.nombre} ${clienteObj.apellidos}`, correo: clienteObj.correo, telefono: clienteObj.telefono }
        : pedido.cliente,
      productosItems:    permisos.productos ? form.productosItems : pedido.productosItems,
      metodo_pago:       permisos.metodo_pago ? form.metodo_pago : pedido.metodo_pago,
      comprobante:       comprobanteUrl,
      domicilio:         permisos.domicilio  ? form.domicilio    : pedido.domicilio,
      direccion_entrega: form.direccion_entrega,
      departamento:      form.departamento,
      municipio:         form.municipio,
      notas:             form.notas,
      descuento:         permisos.descuento ? descuento : pedido.descuento,
      subtotal:          permisos.productos ? subtotal  : pedido.subtotal,
      total:             permisos.productos ? total     : pedido.total,
      orden_produccion:  permisos.productos ? hayProductosSinStock : pedido.orden_produccion,
      estadoPedido:      form.estadoPedido,
    };
    try {
      await onSave(payload);
    } catch {
      setSaved(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, comprobante: file, comprobantePreview: ev.target.result }));
      setErrors(err => ({ ...err, comprobante: "" }));
    };
    reader.readAsDataURL(file);
  };

  const agregarProducto = (item) =>
    setForm(f => ({ ...f, productosItems: [...f.productosItems, item] }));
  const cambiarProducto = (idx, item) =>
    setForm(f => { const arr = [...f.productosItems]; arr[idx] = item; return { ...f, productosItems: arr }; });
  const quitarProducto  = (idx) =>
    setForm(f => ({ ...f, productosItems: f.productosItems.filter((_, i) => i !== idx) }));

  const ec = ESTADO_CFG[pedido.estado] || {};
  const restriccionesMsg = {
    "En producción": "Productos y cantidades no editables — ya están en fabricación.",
    "Listo":         "Solo se pueden modificar la dirección de entrega y las notas.",
    "En camino":     "Solo se pueden modificar la dirección de entrega y las notas.",
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 580,
          /* ── Clave: flex column + altura máxima ── */
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        {/* ── Header (fijo) ── */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <p className="modal-header__eyebrow">Editar pedido</p>
            <h2 className="modal-header__title">{pedido.numero}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: ec.bg, color: ec.color, border: `1px solid ${ec.border}`,
              borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700,
            }}>
              {pedido.estado}
            </span>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Body (scroll interno aquí) ── */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "20px 24px",
          }}
        >
          {restriccionesMsg[pedido.estado] && (
            <div className="info-box info-box--warn">
              <span className="info-box__icon">⚠️</span>
              <span className="info-box__text">{restriccionesMsg[pedido.estado]}</span>
            </div>
          )}

          {/* ── Cliente ── */}
          <p className="section-label" style={{ textTransform: "none" }}>Cliente</p>
          {permisos.cliente ? (
            <>
              {!editandoCliente && (
                <>
                  <div className="select-wrap">
                    <select
                      className={`field-select${errors.idCliente ? " error" : ""}`}
                      value={form.idCliente || ""}
                      onChange={e => {
                        const id  = e.target.value;
                        const cli = clientes.find(c => c.id === id);
                        set("idCliente", id);
                        if (cli && form.domicilio) set("direccion_entrega", cli.direccion || "");
                      }}
                    >
                      <option value="">Seleccione un cliente…</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} {c.apellidos} — {c.correo}
                        </option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                  {errors.idCliente && <span className="field-error">{errors.idCliente}</span>}

                  {clienteActual && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 10, marginTop: 8,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#f9f9f9",
                      border: "1px solid #ebebeb",
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#212121", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {clienteActual.nombre} {clienteActual.apellidos}
                        </span>
                        <span style={{ fontSize: 11, color: "#9e9e9e" }}>
                          {clienteActual.telefono || "Sin teléfono"} · {clienteActual.municipio || "Sin ciudad"}
                        </span>
                        {clienteActual.direccion && form.domicilio && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 11, color: "#757575", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {clienteActual.direccion}
                            </span>
                            <button
                              onClick={() => set("direccion_entrega", clienteActual.direccion)}
                              style={{
                                flexShrink: 0, fontSize: 10, fontWeight: 700,
                                padding: "1px 7px", borderRadius: 5,
                                border: "1px solid #c8e6c9", background: "#f1f8e9",
                                color: "#388e3c", cursor: "pointer", fontFamily: "inherit",
                              }}
                            >Usar ↓</button>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={abrirEditorCliente}
                        style={{
                          flexShrink: 0, padding: "6px 12px", borderRadius: 8,
                          border: "1px solid #e0e0e0", background: "#fff",
                          color: "#616161", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </>
              )}

              {editandoCliente && datosCliente && (
                <div style={{
                  border: "1.5px solid #ffe082", borderRadius: 12,
                  background: "#fffdf0", padding: "16px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f9a825", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                      ✎ Editando datos de {clienteActual?.nombre}
                    </div>
                    <button
                      onClick={() => { setEditandoCliente(false); setDatosCliente(null); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9e9e9e", fontSize: 14 }}
                    >✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { k: "nombre",    label: "Nombre",    ph: "Ej. Ana"          },
                      { k: "apellidos", label: "Apellidos", ph: "Ej. García López" },
                    ].map(({ k, label, ph }) => (
                      <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label className="form-label">{label}</label>
                        <input className="field-input" value={datosCliente[k] || ""} onChange={e => setDato(k, soloLetras(e.target.value))} placeholder={ph} />
                      </div>
                    ))}
                    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
                      <label className="form-label">Correo</label>
                      <input className="field-input" type="email" value={datosCliente.correo || ""} onChange={e => setDato("correo", e.target.value)} placeholder="correo@ejemplo.com" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label className="form-label">Teléfono</label>
                      <input className="field-input" value={datosCliente.telefono || ""} onChange={e => setDato("telefono", soloDigitos(e.target.value, 10))} placeholder="300 000 0000" inputMode="numeric" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label className="form-label">Municipio</label>
                      <div className="select-wrap">
                        <select
                          className="field-select"
                          value={datosCliente.municipio || ""}
                          onChange={e => { setDato("municipio", e.target.value); setDato("departamento", "Antioquia"); }}
                        >
                          <option value="">— Valle de Aburrá —</option>
                          {MUNICIPIOS_VALLE_ABURRA.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <SelectArrow />
                      </div>
                    </div>
                    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 4 }}>
                      <label className="form-label">
                        Dirección
                        {form.domicilio && (
                          <span style={{ color: "#9e9e9e", fontWeight: 400, marginLeft: 6, fontSize: 10 }}>
                            — al guardar se actualiza la dirección de entrega
                          </span>
                        )}
                      </label>
                      <input className="field-input" value={datosCliente.direccion || ""} onChange={e => setDato("direccion", e.target.value)} placeholder="Ej. Cra 5 #12-34, Apto 201" />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                    <button className="btn-ghost" onClick={() => { setEditandoCliente(false); setDatosCliente(null); }}>Cancelar</button>
                    <button className="btn-save" onClick={guardarDatosCliente}>✓ Guardar datos</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <FieldReadOnly label="Cliente" value={pedido.cliente?.nombre} />
          )}

          {/* ── Productos ── */}
          <p className="section-label" style={{ textTransform: "none" }}>Productos</p>
          {permisos.productos ? (
            <>
              <BuscadorProducto productosSeleccionados={form.productosItems} onAgregar={agregarProducto} productos={productos} />
              {errors.productos && <span className="field-error" style={{ marginTop: -4 }}>{errors.productos}</span>}
              {form.productosItems.length > 0 && (
                <div className="productos-list">
                  {form.productosItems.map((item, idx) => (
                    <ProductoItemEditable key={item.idProducto} item={item} onChange={v => cambiarProducto(idx, v)} onRemove={() => quitarProducto(idx)} />
                  ))}
                </div>
              )}
              {hayProductosSinStock && (
                <div className="info-box info-box--warn">
                  <span className="info-box__icon">⚠️</span>
                  <div className="info-box__text">
                    <span className="info-box__label">Hay productos sin stock suficiente</span>
                    Se generará una orden de producción al guardar.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="productos-list">
              {pedido.productosItems.map((item) => (
                <ProductoItemFijo key={item.idProducto} item={item} />
              ))}
            </div>
          )}

          {/* ── Descuento y totales ── */}
          {(permisos.productos || permisos.descuento) && (
            <div className="form-grid-2" style={{ alignItems: "end" }}>
              <div className="field-wrap">
                <label className="field-label">
                  Descuento (COP)
                  {!permisos.descuento && <span style={{ marginLeft: 6, fontSize: 10, color: "#9e9e9e", fontWeight: 400 }}>— bloqueado</span>}
                </label>
                <input
                  type="number" min={0}
                  className="field-input"
                  value={permisos.descuento ? form.descuento : pedido.descuento}
                  onChange={e => permisos.descuento && set("descuento", e.target.value)}
                  readOnly={!permisos.descuento}
                  style={!permisos.descuento ? { background: "#fafafa", color: "#9e9e9e" } : {}}
                />
              </div>
              <div className="totales-box">
                <div className="totales-row"><span>Subtotal</span><span>{fmt(permisos.productos ? subtotal : pedido.subtotal)}</span></div>
                {(permisos.descuento ? descuento : pedido.descuento) > 0 && (
                  <div className="totales-row totales-row--descuento">
                    <span>Descuento</span>
                    <span>− {fmt(permisos.descuento ? descuento : pedido.descuento)}</span>
                  </div>
                )}
                <div className="totales-row totales-row--total"><span>Total</span><span>{fmt(permisos.productos ? total : pedido.total)}</span></div>
              </div>
            </div>
          )}

          {/* ── Método de pago y entrega ── */}
          <p className="section-label" style={{ textTransform: "none" }}>Pago y entrega</p>
          <div className="form-grid-2">
            {permisos.metodo_pago ? (
              <div className="field-wrap">
                <label className="field-label">Método de pago <span className="required">*</span></label>
                <div className="select-wrap">
                  <select className={`field-select${errors.metodo_pago ? " error" : ""}`} value={form.metodo_pago} onChange={e => set("metodo_pago", e.target.value)}>
                    <option value="">Seleccione…</option>
                    {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <SelectArrow />
                </div>
                {errors.metodo_pago && <span className="field-error">{errors.metodo_pago}</span>}
              </div>
            ) : (
              <FieldReadOnly label="Método de pago" value={pedido.metodo_pago} />
            )}

            {permisos.domicilio ? (
              <div className="field-wrap">
                <label className="field-label">Tipo de entrega</label>
                <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                  {[
                    { val: false, label: "🏪 Tienda"   },
                    { val: true,  label: "🛵 Domicilio" },
                  ].map(opt => (
                    <button
                      key={String(opt.val)}
                      onClick={() => set("domicilio", opt.val)}
                      style={{
                        flex: 1, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                        fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                        border: form.domicilio === opt.val ? "2px solid #2e7d32" : "1.5px solid #e0e0e0",
                        background: form.domicilio === opt.val ? "#e8f5e9" : "#fff",
                        color:      form.domicilio === opt.val ? "#2e7d32"  : "#616161",
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <FieldReadOnly label="Tipo de entrega" value={pedido.domicilio ? "🛵 Domicilio" : "🏪 Tienda"} />
            )}
          </div>

          {form.metodo_pago?.includes("Transferencia") && permisos.metodo_pago && (
            <div className="field-wrap" style={{ marginTop: 12 }}>
              <label className="field-label">Comprobante de pago <span className="required">*</span></label>
              <div className="comprobante-upload">
                {form.comprobantePreview ? (
                  <div className="comprobante-preview-wrap">
                    <img src={form.comprobantePreview} alt="Comprobante" className="comprobante-preview-img" />
                    <button className="comprobante-remove-btn" onClick={() => setForm(f => ({ ...f, comprobante: null, comprobantePreview: null }))}>✕</button>
                  </div>
                ) : (
                  <label className={`comprobante-dropzone${errors.comprobante ? " error" : ""}`}>
                    <input type="file" accept="image/*" onChange={handleFile} hidden />
                    <span style={{ fontSize: 24 }}>📤</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Subir comprobante</span>
                    <span style={{ fontSize: 10, color: "#9e9e9e" }}>JPG, PNG o WEBP</span>
                  </label>
                )}
              </div>
              {errors.comprobante && <span className="field-error">{errors.comprobante}</span>}
            </div>
          )}

          {/* ── Dirección ── */}
          {(pedido.domicilio || form.domicilio) && (
            permisos.direccion_entrega ? (
              <>
                {errors.telefono_cliente && (
                  <div style={{ padding: "10px 14px", background: "#ffebee", borderRadius: 10, border: "1px solid #ef9a9a", color: "#c62828", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                    ⚠️ {errors.telefono_cliente}
                  </div>
                )}
                <div className="field-wrap">
                  <label className="field-label">
                    Dirección de entrega {form.domicilio && <span className="required">*</span>}
                  </label>
                  <input
                    className={`field-input${errors.direccion_entrega ? " error" : ""}`}
                    placeholder="Ej: Cra 5 #12-34, Apto 201"
                    value={form.direccion_entrega}
                    onChange={e => set("direccion_entrega", e.target.value)}
                    onBlur={e => {
                      if (!e.target.value.trim())
                        setErrors(p => ({ ...p, direccion_entrega: "Ingresa la dirección" }));
                    }}
                  />
                  {errors.direccion_entrega && <span className="field-error">{errors.direccion_entrega}</span>}
                </div>

                <div className="form-grid-2" style={{ marginTop: 12 }}>
                  <div className="field-wrap">
                    <label className="field-label">Municipio <span className="required">*</span></label>
                    <div className="select-wrap">
                      <select
                        className={`field-select${errors.municipio ? " error" : ""}`}
                        value={form.municipio}
                        onChange={e => {
                          setForm(f => ({ ...f, municipio: e.target.value, departamento: "Antioquia" }));
                          setErrors(err => ({ ...err, municipio: e.target.value ? "" : "Selecciona el municipio" }));
                        }}
                      >
                        <option value="">— Valle de Aburrá —</option>
                        {MUNICIPIOS_VALLE_ABURRA.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <SelectArrow />
                    </div>
                    {errors.municipio && <span className="field-error">{errors.municipio}</span>}
                  </div>
                </div>
              </>
            ) : (
              <FieldReadOnly label="Dirección de entrega" value={`${pedido.direccion_entrega}, ${pedido.municipio}, ${pedido.departamento}`} />
            )
          )}

          {/* ── Notas ── */}
          {permisos.notas ? (
            <div className="field-wrap">
              <label className="field-label">Notas del pedido</label>
              <textarea
                className="field-textarea"
                rows={2}
                placeholder="Indicaciones especiales, alergias, personalización…"
                value={form.notas}
                onChange={e => set("notas", e.target.value)}
              />
            </div>
          ) : pedido.notas ? (
            <FieldReadOnly label="Notas" value={pedido.notas} />
          ) : null}

          {/* ── Estado del pedido ── */}
          <p className="section-label" style={{ textTransform: "none" }}>Estado del pedido</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(() => {
              const actualIdx = ESTADOS_FLUJO.indexOf(pedido.estado);
              const validos   = ESTADOS_FLUJO.filter((e, i) => {
                if (e === "Cancelado") return !["Entregado", "Cancelado"].includes(pedido.estado);
                return i >= actualIdx;
              });
              return validos.map(e => {
                const c   = ESTADO_CFG[e] || {};
                const sel = form.estadoPedido === e;
                return (
                  <button key={e} onClick={() => set("estadoPedido", e)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                    fontFamily: "inherit", width: "100%", textAlign: "left",
                    border: sel ? `2px solid ${c.border}` : "1.5px solid #e0e0e0",
                    background: sel ? c.bg : "#fff", transition: "all 0.15s",
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? c.color : "#424242", flex: 1 }}>
                      {e}
                    </span>
                    {e === pedido.estado && (
                      <span style={{ fontSize: 10, color: "#9e9e9e", fontWeight: 600 }}>actual</span>
                    )}
                  </button>
                );
              });
            })()}
          </div>
          {form.estadoPedido === "Cancelado" && pedido.estado !== "Cancelado" && (
            <div className="info-box info-box--danger">
              <span className="info-box__icon">⚠️</span>
              <span className="info-box__text">Esta acción restaurará el stock de los productos.</span>
            </div>
          )}
        </div>{/* /modal-body */}

        {/* ── Footer (fijo) ── */}
        <div
          className="modal-footer"
          style={{ flexShrink: 0, borderTop: "1px solid #f5f5f5" }}
        >
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={handleSave} disabled={saved}>
            {saved ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>

        {saved && (
          <div className="modal-success-toast">
            <span>✓</span>
            <span>Pedido actualizado con éxito</span>
          </div>
        )}
      </div>
    </div>
  );
}