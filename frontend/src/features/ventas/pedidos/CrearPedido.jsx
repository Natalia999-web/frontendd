import { useState, useRef, useEffect } from "react";
import { MUNICIPIOS_VALLE_ABURRA } from "../../../utils/departamentosYCiudades.js";
import SearchableSelect from "../../../shared/components/SearchableSelect.jsx";
import { getUsuarios } from "../../../services/usuariosService.js";
import { getProductos } from "../../../services/productosService.js";
import { subirImagenCloudinary } from "../../../utils/cloudinary.js";
import { getCreditoCliente } from "../../../services/devolucionesService.js";
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
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const METODOS_PAGO = ["Efectivo 💵", "Transferencia 🏦"];

const UMBRAL_ANTICIPO = 50000;

const EMPTY_FORM = {
  idCliente:            "",
  productosItems:       [],
  metodo_pago:          "",
  comprobante:          null,
  comprobantePreview:   null,
  domicilio:            false,
  direccion_entrega:    "",
  departamento:         "",
  municipio:            "",
  notas:                "",
  descuento:            0,
  fecha_entrega:        "",
  anticipo_metodo:      "",
  anticipo_efectivo:    false,
  anticipo_comprobante: null,
  anticipo_comp_preview: null,
};


/* ─── ClienteSelect (inline — evita clipping del modal) ─────── */
function ClienteSelect({ value, clientes, onChange, error }) {
  const [query, setQuery] = useState("");
  const selected = clientes.find(c => String(c.id) === String(value));

  const filtered = clientes.filter(c =>
    `${c.nombre} ${c.apellidos} ${c.cedula}`.toLowerCase().includes(query.toLowerCase())
  );

  if (selected) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderRadius: 10,
        background: "#e8f5e9", border: `1.5px solid ${error ? "#ef5350" : "#a5d6a7"}`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1b5e20", flex: 1 }}>
          {selected.nombre} {selected.apellidos}
          <span style={{ fontSize: 12, fontWeight: 400, color: "#4caf50", marginLeft: 8 }}>{selected.cedula}</span>
        </span>
        <button type="button" onClick={() => { onChange(null); setQuery(""); }}
          style={{ border: "none", background: "none", cursor: "pointer", color: "#c62828", fontSize: 16, padding: 0, lineHeight: 1 }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: `1.5px solid ${error ? "#ef5350" : "#e0e0e0"}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#fafdf9" }}>
        <span style={{ fontSize: 13, color: "#9e9e9e" }}>🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre, apellido o cédula…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#333", fontFamily: "inherit" }}
        />
        {query && (
          <button type="button" onClick={() => setQuery("")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "#bdbdbd", fontSize: 14, padding: 0, lineHeight: 1 }}>
            ✕
          </button>
        )}
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto", borderTop: "1px solid #f0f0f0" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "14px", fontSize: 12, color: "#9e9e9e", textAlign: "center" }}>
            {query ? `Sin resultados para "${query}"` : clientes.length === 0 ? "Cargando clientes…" : "Escribe para buscar…"}
          </div>
        ) : filtered.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => { onChange(c); setQuery(""); }}
            style={{
              width: "100%", textAlign: "left", padding: "9px 14px",
              border: "none", borderBottom: "1px solid #f5f5f5",
              background: "transparent", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontFamily: "inherit", color: "#222",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#f1f8f1"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontWeight: 600 }}>{c.nombre} {c.apellidos}</span>
            <span style={{ fontSize: 12, color: "#757575", marginLeft: 8 }}>{c.cedula}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── BuscadorProducto ───────────────────────────────────── */
function BuscadorProducto({ productosSeleccionados, onAgregar, productos = [] }) {
  const [query,   setQuery]   = useState("");
  const [abierto, setAbierto] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

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
    <div ref={ref} className="product-search-wrap">
      <input
        className="field-input"
        placeholder="Buscar producto por nombre…"
        value={query}
        onChange={e => { setQuery(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
      />
      {abierto && query.length > 0 && (
        <div className="product-dropdown">
          {filtrados.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#9e9e9e" }}>
              Sin resultados
            </div>
          ) : filtrados.map(prod => {
            const sinStock  = prod.stock === 0;
            const pocoStock = prod.stock > 0 && prod.stock < prod.stockMinimo;
            return (
              <div key={prod.id} className="product-option" onClick={() => handleSelect(prod)}>
                <div>
                  <div className="product-option__name">{prod.nombre}</div>
                  <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 1 }}>
                    {prod.categoria || ""}
                  </div>
                </div>
                <div className="product-option__right">
                  <span className="product-option__price">{fmt(prod.precio)}</span>
                  <span className={
                    sinStock    ? "product-option__stock product-option__stock--none" :
                    pocoStock   ? "product-option__stock product-option__stock--low"  :
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

/* ─── ProductoItem ───────────────────────────────────────── */
function ProductoItem({ item, onChange, onRemove }) {
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

/* ─── BARRA DE PASOS ─────────────────────────────────────── */
const STEPS = ["Cliente", "Productos", "Entrega", "Pago", "Resumen"];

function StepsBar({ current }) {
  return (
    <div className="wizard-steps-bar">
      {STEPS.map((label, i) => {
        const idx    = i + 1;
        const done   = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="wizard-step-item">
            <div className={`wizard-step-circle${done ? " done" : active ? " active" : ""}`}>
              {done ? "✓" : idx}
            </div>
            <span className={`wizard-step-label${active ? " active" : done ? " done" : ""}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`wizard-step-line${done ? " done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL CREAR PEDIDO
   ═══════════════════════════════════════════════════════════ */
export default function CrearPedido({ onClose, onSave }) {
  const [clientes,  setClientes]  = useState([]);
  const [productos, setProductos] = useState([]);
  const [form, setForm]     = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [saved,          setSaved]          = useState(false);
  const [step,           setStep]           = useState(1);
  const [saveError,      setSaveError]      = useState(null);
  const [pagarTodo,      setPagarTodo]      = useState(false);
  const [creditoCliente, setCreditoCliente] = useState(0);
  const [usarCredito,    setUsarCredito]    = useState(false);

  useEffect(() => {
    getUsuarios({ porPagina: 100 }).then(u => setClientes(u.filter(x => x.tipo === "cliente"))).catch(() => {});
    getProductos({ porPagina: 100 }).then(data => {
      const lista = (data.productos || data || []).map(p => ({
        id:                p.ID_Producto || p.id,
        nombre:            p.Nombre      || p.nombre      || "",
        precio:            p.Precio_venta || p.Precio_Venta || p.precio || 0,
        stock:             p.Stock       || p.stock       || 0,
        stockMinimo:       p.Stock_Minimo|| p.stockMinimo || 0,
        categoria:         p.nombre_categoria || p.categoria || "",
        requiereProduccion: !!(p.Requiere_Produccion || 0),
      }));
      setProductos(lista);
    }).catch(() => {});
  }, []);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    let err = "";
    if (k === "idCliente"         && !v)        err = "Selecciona un cliente para continuar";
    if (k === "direccion_entrega" && !v.trim()) err = "Ingresa la dirección de entrega";
    if (k === "departamento"      && !v.trim()) err = "El departamento es obligatorio";
    if (k === "municipio"         && !v.trim()) err = "El municipio es obligatorio";
    if (k === "metodo_pago"       && !v)        err = "Selecciona un método de pago";
    if (k === "fecha_entrega") {
      if (!v) err = form.domicilio ? "Selecciona la fecha de entrega" : "Selecciona la fecha de recogida";
      else if (new Date(v + "T00:00:00") < new Date(new Date().toDateString())) err = "La fecha no puede ser en el pasado";
    }
    if (k === "descuento" && Number(v) < 0) {
      err = "El descuento no puede ser negativo";
    }
    setErrors(e => ({ ...e, [k]: err }));
  };

  /* ─── Cálculos ─── */
  const COSTO_DOMICILIO = 5000;
  const subtotal      = form.productosItems.reduce((a, p) => a + p.precio * p.cantidad, 0);
  const descuento     = Number(form.descuento) || 0;
  const costoEnvio    = form.domicilio ? COSTO_DOMICILIO : 0;
  const total         = Math.max(0, subtotal - descuento + costoEnvio);
  const creditoAplicar = usarCredito ? Math.min(creditoCliente, total) : 0;
  const totalFinal    = Math.max(0, total - creditoAplicar);
  const requiereAnticipo = totalFinal > UMBRAL_ANTICIPO;
  const montoAnticipo    = requiereAnticipo ? (pagarTodo ? totalFinal : Math.ceil(totalFinal * 0.5)) : 0;
  const hayProductosSinStock = form.productosItems.some(
    p => !p.stockOk || p.cantidad > p.stockActual
  );

  /* ─── Validación por paso ─── */
  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.idCliente) e.idCliente = "Selecciona un cliente para continuar";
    }
    if (s === 2) {
      if (form.productosItems.length === 0) {
        e.productos = "Debes agregar al menos un producto al pedido";
      }
    }
    if (s === 3) {
      if (!form.fecha_entrega)
        e.fecha_entrega = form.domicilio ? "Selecciona la fecha de entrega" : "Selecciona la fecha de recogida";
      else if (new Date(form.fecha_entrega + "T00:00:00") < new Date(new Date().toDateString()))
        e.fecha_entrega = "La fecha no puede ser en el pasado";
      if (form.domicilio) {
        if (!form.direccion_entrega.trim()) e.direccion_entrega = "Ingresa la dirección de entrega";
        if (!form.departamento.trim())       e.departamento = "El departamento es obligatorio";
        if (!form.municipio.trim())          e.municipio = "El municipio es obligatorio";
        const tel = (clienteSeleccionado?.telefono || "").replace(/\D/g, "");
        if (tel.length !== 10) e.telefono_cliente = "El cliente debe tener un teléfono de 10 dígitos válido para pedidos con domicilio";
      }
    }
    if (s === 4) {
      if (!form.metodo_pago) e.metodo_pago = "Selecciona un método de pago";
      if (form.metodo_pago === "Transferencia 🏦" && !form.comprobantePreview) {
        e.comprobante = "Es obligatorio adjuntar el comprobante de transferencia";
      }
      if (requiereAnticipo && !pagarTodo) {
        if (!form.anticipo_metodo)
          e.anticipo_metodo = "Selecciona el método de pago del anticipo";
        if (form.anticipo_metodo === "Efectivo 💵" && !form.anticipo_efectivo)
          e.anticipo_efectivo = "Debes confirmar que el anticipo fue recibido en efectivo";
        if (form.anticipo_metodo === "Transferencia 🏦" && !form.anticipo_comp_preview)
          e.anticipo_comprobante = "Debes adjuntar el comprobante del anticipo";
      }
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleSave = async () => {
    const e = validateStep(4);
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaved(true);
    setSaveError(null);

    let anticipoUrl = null;
    if (form.anticipo_comprobante) {
      try {
        anticipoUrl = await subirImagenCloudinary(form.anticipo_comprobante);
      } catch (cloudErr) {
        setSaved(false);
        setErrors(err => ({ ...err, anticipo_comprobante: cloudErr?.message || "Error al subir el comprobante del anticipo." }));
        setStep(4);
        return;
      }
    }

    let comprobanteUrl = null;
    if (form.comprobante) {
      try {
        comprobanteUrl = await subirImagenCloudinary(form.comprobante);
      } catch (cloudErr) {
        setSaved(false);
        setErrors(e => ({ ...e, comprobante: cloudErr?.message || "Error al subir el comprobante." }));
        setStep(4);
        return;
      }
    }

    const cliente = clientes.find(c => String(c.id) === String(form.idCliente));
    if (!cliente) { setSaved(false); return; }

    const payload = {
      idCliente: form.idCliente,
      cliente: {
        nombre:   `${cliente.nombre} ${cliente.apellidos}`,
        correo:   cliente.correo,
        telefono: cliente.telefono,
      },
      productosItems:    form.productosItems,
      metodo_pago:       form.metodo_pago,
      comprobante:            comprobanteUrl,
      requiere_anticipo:      requiereAnticipo,
      anticipo_monto:         montoAnticipo,
      anticipo_metodo_pago:   requiereAnticipo
        ? (pagarTodo ? form.metodo_pago : form.anticipo_metodo)
        : null,
      anticipo_comprobante_url: pagarTodo ? comprobanteUrl : anticipoUrl,
      anticipo_registrado:    requiereAnticipo && (
        pagarTodo ? true
        : form.anticipo_metodo === "Efectivo 💵" ? form.anticipo_efectivo : !!anticipoUrl
      ),
      domicilio:         form.domicilio,
      direccion_entrega: form.domicilio ? form.direccion_entrega : null,
      departamento:      form.domicilio ? form.departamento      : null,
      municipio:         form.domicilio ? form.municipio         : null,
      fecha_entrega:     form.fecha_entrega || null,
      notas:             form.notas,
      descuento,
      subtotal,
      total:             totalFinal,
      usar_credito:      usarCredito,
      estado:            "Pendiente",
      fecha_pedido:      new Date().toLocaleDateString("es-CO"),
      orden_produccion:  hayProductosSinStock,
    };

    try {
      await onSave(payload);
    } catch (err) {
      setSaved(false);
      setSaveError(err.message || "Error al guardar el pedido. Intenta de nuevo.");
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

  const handleAnticipo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, anticipo_comprobante: file, anticipo_comp_preview: ev.target.result }));
      setErrors(err => ({ ...err, anticipo_comprobante: "" }));
    };
    reader.readAsDataURL(file);
  };

  /* ─── Productos ─── */
  const agregarProducto = (item) => {
    setErrors(e => ({ ...e, productos: "" }));
    setForm(f => ({ ...f, productosItems: [...f.productosItems, item] }));
  };

  const cambiarProducto = (idx, item) => {
    setForm(f => {
      const arr = [...f.productosItems]; arr[idx] = item;
      return { ...f, productosItems: arr };
    });
  };

  const quitarProducto = (idx) => {
    setForm(f => ({ ...f, productosItems: f.productosItems.filter((_, i) => i !== idx) }));
  };

  const clienteSeleccionado = clientes.find(c => String(c.id) === String(form.idCliente));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 920, width: "95%" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-header__eyebrow">Pedidos</p>
            <h2 className="modal-header__title">Nuevo pedido</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Steps */}
        <div style={{ padding: "16px 24px 0" }}>
          <StepsBar current={step} />
        </div>

        {/* Body */}
        <div className="modal-body" style={{ overflowY: "auto", overflowX: "hidden", padding: "20px 36px" }}>

          {/* ── Paso 1: Cliente ── */}
          {step === 1 && (
            <div className="fade-in">
              <p className="section-label" style={{ textTransform: "none", marginTop: 0, fontSize: 16 }}>1. Selección de Cliente</p>
              <div className="field-wrap">
                <label className="field-label">Cliente <span className="required">*</span></label>
                <ClienteSelect
                  value={form.idCliente}
                  clientes={clientes}
                  error={errors.idCliente}
                  onChange={cli => {
                    if (!cli) {
                      setForm(f => ({ ...f, idCliente: "", departamento: "", municipio: "", direccion_entrega: "" }));
                      setCreditoCliente(0);
                      setUsarCredito(false);
                      return;
                    }
                    setForm(f => ({
                      ...f,
                      idCliente: String(cli.id),
                      departamento: cli.departamento || "",
                      municipio: cli.municipio || "",
                      direccion_entrega: cli.direccion || "",
                    }));
                    setUsarCredito(false);
                    getCreditoCliente(cli.id).then(saldo => setCreditoCliente(saldo)).catch(() => setCreditoCliente(0));
                    setErrors(err => ({ ...err, idCliente: "" }));
                  }}
                />
                {errors.idCliente && <span className="field-error">{errors.idCliente}</span>}
              </div>

              {clienteSeleccionado && (
                <div className="info-box info-box--success" style={{ marginTop: 24, padding: "16px", borderRadius: "12px" }}>
                  <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>👤</div>
                    <div className="info-box__text" style={{ flex: 1 }}>
                      <span className="info-box__label" style={{ fontSize: 16, fontWeight: 700 }}>{clienteSeleccionado.nombre} {clienteSeleccionado.apellidos}</span>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
                        <span>📞 {clienteSeleccionado.telefono}</span>
                        <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
                        <span>✉️ {clienteSeleccionado.correo}</span>
                      </div>
                    </div>
                    {creditoCliente > 0 && (
                      <div style={{ background: "#fff", borderRadius: 10, padding: "8px 14px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                        <div style={{ fontSize: 11, color: "#757575", fontWeight: 600 }}>CRÉDITO</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#2e7d32" }}>{fmt(creditoCliente)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Paso 2: Productos ── */}
          {step === 2 && (
            <div className="fade-in">
              <p className="section-label" style={{ textTransform: "none", marginTop: 0, fontSize: 16 }}>2. Lista de Productos</p>
              <div style={{ marginBottom: 20 }}>
                <BuscadorProducto
                  productosSeleccionados={form.productosItems}
                  onAgregar={agregarProducto}
                  productos={productos}
                />
                {errors.productos && (
                  <span className="field-error" style={{ marginTop: 8, display: "block" }}>{errors.productos}</span>
                )}
              </div>

              <div className="productos-tabla-header" style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px 30px", gap: 10, padding: "0 10px 8px", borderBottom: "2px solid #f0f0f0", fontSize: 12, fontWeight: 700, color: "#999", textTransform: "uppercase" }}>
                <span>Producto</span>
                <span style={{ textAlign: "center" }}>Cantidad</span>
                <span style={{ textAlign: "right" }}>Total</span>
                <span></span>
              </div>

              <div className="productos-list" style={{ marginTop: 0, maxHeight: 260, overflowY: "auto", padding: "5px 0" }}>
                {form.productosItems.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#bbb", fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🛒</div>
                    No has agregado productos todavía
                  </div>
                ) : (
                  form.productosItems.map((item, idx) => (
                    <ProductoItem
                      key={item.idProducto}
                      item={item}
                      onChange={v => cambiarProducto(idx, v)}
                      onRemove={() => quitarProducto(idx)}
                    />
                  ))
                )}
              </div>

              <div className="totales-summary" style={{ marginTop: 20, background: "#f8fdf8", padding: "16px 20px", borderRadius: 12, border: "1.5px solid #e8f5e9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#666", marginBottom: 6 }}>
                  <span>Subtotal del pedido</span>
                  <span style={{ fontWeight: 600, color: "#333" }}>{fmt(subtotal)}</span>
                </div>
                {costoEnvio > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#666", marginBottom: 6 }}>
                    <span>🛵 Costo de domicilio</span>
                    <span style={{ fontWeight: 600, color: "#333" }}>{fmt(costoEnvio)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "#2e7d32", paddingTop: 10, borderTop: "1px dashed #c8e6c9" }}>
                  <span>Total estimado</span>
                  <span>{fmt(totalFinal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 3: Entrega ── */}
          {step === 3 && (
            <div className="fade-in">
              <p className="section-label" style={{ textTransform: "none", marginTop: 0, fontSize: 16 }}>3. Datos de Entrega</p>
              
              <div className="field-wrap">
                <label className="field-label">¿Cómo se entregará el pedido?</label>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  {[
                    { val: false, label: "🏪 Recoger en Tienda", icon: "🏪" },
                    { val: true,  label: "🛵 Domicilio Local",  icon: "🛵" },
                  ].map(opt => (
                    <button
                      key={String(opt.val)}
                      onClick={() => set("domicilio", opt.val)}
                      className="btn-delivery-opt"
                      style={{
                        flex: 1, padding: "14px", borderRadius: "12px", border: "2px solid",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                        transition: "all 0.2s",
                        borderColor: form.domicilio === opt.val ? "#2e7d32" : "#eee",
                        background:  form.domicilio === opt.val ? "#f1f8f1" : "#fff",
                        color:       form.domicilio === opt.val ? "#2e7d32" : "#666",
                        fontWeight:  form.domicilio === opt.val ? 700 : 500,
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{opt.icon}</span>
                      <span style={{ fontSize: 13 }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {form.domicilio && (
                <div className="delivery-details-form fade-in" style={{ marginTop: 24, padding: "20px", background: "#f9f9f9", borderRadius: "14px", border: "1px solid #eee" }}>
                  {/* Verificación de teléfono en tiempo real */}
                  {(() => {
                    const tel = (clienteSeleccionado?.telefono || "").replace(/\D/g, "");
                    const valido = tel.length === 10;
                    const tiene = !!clienteSeleccionado?.telefono;
                    return valido ? (
                      <div style={{ padding: "10px 14px", background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 10, color: "#1b5e20", fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                        <span>✅</span>
                        <span>Teléfono del cliente: <strong>{clienteSeleccionado.telefono}</strong></span>
                      </div>
                    ) : (
                      <div style={{ padding: "10px 14px", background: "#fff3e0", border: "1px solid #ffcc80", borderRadius: 10, color: "#e65100", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                        ⚠️ {tiene
                          ? `El teléfono registrado (${clienteSeleccionado.telefono}) no tiene 10 dígitos. El cliente debe actualizarlo antes de solicitar un domicilio.`
                          : "Este cliente no tiene teléfono registrado. Es obligatorio para pedidos con domicilio."}
                      </div>
                    );
                  })()}
                  <div className="field-wrap">
                    <label className="field-label">Dirección exacta <span className="required">*</span></label>
                    <input
                      className={`field-input${errors.direccion_entrega ? " error" : ""}`}
                      placeholder="Calle, número, barrio, apto..."
                      value={form.direccion_entrega}
                      onChange={e => set("direccion_entrega", e.target.value)}
                      onBlur={e => {
                        if (!e.target.value.trim())
                          setErrors(p => ({ ...p, direccion_entrega: "Ingresa la dirección de entrega" }));
                      }}
                    />
                    {errors.direccion_entrega && <span className="field-error">{errors.direccion_entrega}</span>}
                  </div>

                  <div className="field-wrap" style={{ marginTop: 15 }}>
                      <label className="field-label">Municipio <span className="required">*</span></label>
                      <SearchableSelect
                        options={MUNICIPIOS_VALLE_ABURRA.map(m => ({ value: m, label: m }))}
                        value={form.municipio}
                        onChange={e => {
                          setForm(f => ({ ...f, municipio: e.target.value, departamento: "Antioquia" }));
                          setErrors(err => ({ ...err, municipio: e.target.value ? "" : "El municipio es obligatorio" }));
                        }}
                        getValue={o => o.value}
                        getLabel={o => o.label}
                        placeholder="— Valle de Aburrá —"
                        searchPlaceholder="🔍 Buscar municipio…"
                        className={`field-select${errors.municipio ? " error" : ""}`}
                      />
                    </div>
                </div>
              )}

              <div className="field-wrap" style={{ marginTop: 20 }}>
                <label className="field-label">
                  {form.domicilio ? "Fecha de entrega esperada" : "Fecha de recogida esperada"} <span className="required">*</span>
                </label>
                <input
                  type="date"
                  className={`field-input${errors.fecha_entrega ? " error" : ""}`}
                  value={form.fecha_entrega}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => set("fecha_entrega", e.target.value)}
                />
                {errors.fecha_entrega && <span className="field-error">{errors.fecha_entrega}</span>}
              </div>

              <div className="field-wrap" style={{ marginTop: 20 }}>
                <label className="field-label">Notas u observaciones</label>
                <textarea
                  className="field-input"
                  style={{ minHeight: 80, resize: "none" }}
                  placeholder="Ej: Tocar el timbre fuerte, dejar en portería, etc."
                  value={form.notas}
                  onChange={e => set("notas", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Paso 4: Pago ── */}
          {step === 4 && (
            <div className="fade-in">
              <p className="section-label" style={{ textTransform: "none", marginTop: 0, fontSize: 16 }}>4. Método de Pago</p>
              
              <div className="field-wrap">
                <label className="field-label">Seleccione una opción <span className="required">*</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                  {METODOS_PAGO.map(m => (
                    <button
                      key={m}
                      onClick={() => set("metodo_pago", m)}
                      className="btn-pay-opt"
                      style={{
                        padding: "16px", borderRadius: "12px", border: "2px solid",
                        transition: "all 0.2s", textAlign: "center", fontSize: 14,
                        borderColor: form.metodo_pago === m ? "#2e7d32" : "#eee",
                        background:  form.metodo_pago === m ? "#f1f8f1" : "#fff",
                        color:       form.metodo_pago === m ? "#2e7d32" : "#666",
                        fontWeight:  form.metodo_pago === m ? 700 : 500,
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {errors.metodo_pago && <span className="field-error" style={{ marginTop: 8 }}>{errors.metodo_pago}</span>}
              </div>

              {form.metodo_pago === "Transferencia 🏦" && (
                <div className="fade-in" style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Datos de la cuenta */}
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

                  {/* Comprobante */}
                <div className="comprobante-section" style={{ padding: "20px", background: "#f0f7ff", borderRadius: "14px", border: "1.5px dashed #1565c0" }}>
                  <label className="field-label" style={{ color: "#1565c0" }}>Comprobante de transferencia <span className="required">*</span></label>
                  <div className="comprobante-upload" style={{ marginTop: 10 }}>
                    {form.comprobantePreview ? (
                      <div className="comprobante-preview-container" style={{ position: "relative", width: "100%", height: 180, borderRadius: 10, overflow: "hidden", background: "#000" }}>
                        <img src={form.comprobantePreview} alt="Comprobante" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        <button className="comprobante-remove-btn" style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }} onClick={() => setForm(f => ({ ...f, comprobante: null, comprobantePreview: null }))}>✕</button>
                      </div>
                    ) : (
                      <label className={`comprobante-dropzone${errors.comprobante ? " error" : ""}`} style={{ height: 140, background: "rgba(255,255,255,0.7)" }}>
                        <input type="file" accept="image/*" onChange={handleFile} hidden />
                        <div style={{ textAlign: "center" }}>
                          <span style={{ fontSize: 32 }}>📸</span>
                          <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: "#1565c0" }}>Subir imagen del comprobante</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#7faade" }}>Presiona para abrir la cámara o galería</p>
                        </div>
                      </label>
                    )}
                  </div>
                  {errors.comprobante && <span className="field-error">{errors.comprobante}</span>}
                </div>
                </div>
              )}

              {/* ── Anticipo obligatorio ── */}
              {requiereAnticipo && (
                <div className="fade-in" style={{ marginTop: 24, background: "#fff8e1", border: "1.5px solid #f9a825", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 24 }}>💰</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, color: "#f57f17", fontSize: 15 }}>Anticipo requerido</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#795548" }}>
                        El total supera {fmt(UMBRAL_ANTICIPO)}. Registra el anticipo antes de confirmar.
                      </p>
                    </div>
                  </div>

                  {/* Toggle: anticipo 50% vs pagar total ahora */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[{ id: false, label: "Anticipo 50%" }, { id: true, label: "Pagar total ahora" }].map(opt => (
                      <button key={String(opt.id)}
                        onClick={() => { setPagarTodo(opt.id); setForm(f => ({ ...f, anticipo_metodo: "", anticipo_efectivo: false, anticipo_comprobante: null, anticipo_comp_preview: null })); setErrors(e => ({ ...e, anticipo_metodo: "", anticipo_efectivo: "", anticipo_comprobante: "" })); }}
                        style={{
                          padding: "10px", borderRadius: 10, border: "2px solid", fontSize: 13, cursor: "pointer", transition: "all 0.2s",
                          borderColor: pagarTodo === opt.id ? "#f57f17" : "#ffe082",
                          background:  pagarTodo === opt.id ? "#fff3e0" : "#fff",
                          color:       pagarTodo === opt.id ? "#e65100" : "#999",
                          fontWeight:  pagarTodo === opt.id ? 700 : 500,
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ background: "#fff", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#666" }}>{pagarTodo ? "Total a pagar ahora" : "Monto del anticipo (50%)"}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#f57f17" }}>{fmt(montoAnticipo)}</span>
                  </div>

                  {pagarTodo ? (
                    <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#2e7d32", fontWeight: 600 }}>
                      ✅ El total completo queda registrado como anticipo — usa el mismo método de pago principal.
                    </div>
                  ) : (
                  <>
                  <label className="field-label">Método de pago del anticipo <span className="required">*</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                    {["Efectivo 💵", "Transferencia 🏦"].map(m => (
                      <button
                        key={m}
                        onClick={() => { setForm(f => ({ ...f, anticipo_metodo: m, anticipo_efectivo: false, anticipo_comprobante: null, anticipo_comp_preview: null })); setErrors(e => ({ ...e, anticipo_metodo: "", anticipo_efectivo: "", anticipo_comprobante: "" })); }}
                        style={{
                          padding: "12px", borderRadius: "10px", border: "2px solid",
                          fontSize: 13, transition: "all 0.2s", cursor: "pointer",
                          borderColor: form.anticipo_metodo === m ? "#f57f17" : "#ffe082",
                          background:  form.anticipo_metodo === m ? "#fff3e0" : "#fff",
                          color:       form.anticipo_metodo === m ? "#e65100" : "#999",
                          fontWeight:  form.anticipo_metodo === m ? 700 : 500,
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {errors.anticipo_metodo && <span className="field-error">{errors.anticipo_metodo}</span>}

                  {form.anticipo_metodo === "Efectivo 💵" && (
                    <div className="fade-in" style={{ marginTop: 14 }}>
                      <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", background: "#fff", padding: "12px 16px", borderRadius: 10, border: `2px solid ${form.anticipo_efectivo ? "#2e7d32" : "#e0e0e0"}` }}>
                        <input
                          type="checkbox"
                          checked={form.anticipo_efectivo}
                          onChange={e => { setForm(f => ({ ...f, anticipo_efectivo: e.target.checked })); setErrors(err => ({ ...err, anticipo_efectivo: "" })); }}
                          style={{ width: 18, height: 18, accentColor: "#2e7d32" }}
                        />
                        <span style={{ fontSize: 13, color: form.anticipo_efectivo ? "#1b5e20" : "#555", fontWeight: form.anticipo_efectivo ? 700 : 400 }}>
                          Confirmo que recibí el anticipo de <strong>{fmt(montoAnticipo)}</strong> en efectivo
                        </span>
                      </label>
                      {errors.anticipo_efectivo && <span className="field-error">{errors.anticipo_efectivo}</span>}
                    </div>
                  )}

                  {form.anticipo_metodo === "Transferencia 🏦" && (
                    <div className="fade-in" style={{ marginTop: 14 }}>
                      <div style={{ background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#1565c0" }}>
                        📋 Transfiere <strong>{fmt(montoAnticipo)}</strong> a <strong>{CUENTA_TRANSFERENCIA.banco}</strong> — {CUENTA_TRANSFERENCIA.tipo} <strong>{CUENTA_TRANSFERENCIA.numero}</strong> a nombre de {CUENTA_TRANSFERENCIA.titular}
                      </div>
                      {form.anticipo_comp_preview ? (
                        <div style={{ position: "relative", width: "100%", height: 140, borderRadius: 10, overflow: "hidden", background: "#000" }}>
                          <img src={form.anticipo_comp_preview} alt="Comprobante anticipo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          <button style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 12 }} onClick={() => setForm(f => ({ ...f, anticipo_comprobante: null, anticipo_comp_preview: null }))}>✕</button>
                        </div>
                      ) : (
                        <label className={`comprobante-dropzone${errors.anticipo_comprobante ? " error" : ""}`} style={{ height: 110, background: "rgba(255,255,255,0.7)" }}>
                          <input type="file" accept="image/*,application/pdf" onChange={handleAnticipo} hidden />
                          <div style={{ textAlign: "center" }}>
                            <span style={{ fontSize: 26 }}>📎</span>
                            <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700, color: "#1565c0" }}>Subir comprobante del anticipo</p>
                            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7faade" }}>Imagen o PDF</p>
                          </div>
                        </label>
                      )}
                      {errors.anticipo_comprobante && <span className="field-error">{errors.anticipo_comprobante}</span>}
                    </div>
                  )}
                  </>
                  )}
                </div>
              )}

              {creditoCliente > 0 && (
                <div className="fade-in" style={{ marginTop: 24, background: "#e8f5e9", border: "1.5px solid #a5d6a7", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 24 }}>🎁</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, color: "#1b5e20", fontSize: 15 }}>Crédito disponible del cliente</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#388e3c" }}>
                        El cliente tiene <strong>{fmt(creditoCliente)}</strong> de crédito acumulado por devoluciones.
                      </p>
                    </div>
                  </div>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", background: "#fff", padding: "12px 16px", borderRadius: 10, border: `2px solid ${usarCredito ? "#2e7d32" : "#c8e6c9"}` }}>
                    <input
                      type="checkbox"
                      checked={usarCredito}
                      onChange={e => { setUsarCredito(e.target.checked); setPagarTodo(false); }}
                      style={{ width: 18, height: 18, accentColor: "#2e7d32" }}
                    />
                    <span style={{ fontSize: 13, color: usarCredito ? "#1b5e20" : "#555", fontWeight: usarCredito ? 700 : 400 }}>
                      Aplicar {fmt(Math.min(creditoCliente, total))} de crédito a este pedido
                    </span>
                  </label>
                  {usarCredito && (
                    <div style={{ marginTop: 10, background: "#fff", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#666" }}>Total a pagar después del crédito</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: totalFinal === 0 ? "#2e7d32" : "#1565c0" }}>{fmt(totalFinal)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="discount-section" style={{ marginTop: 20, padding: "16px", background: "#fff9f0", borderRadius: "12px", border: "1px solid #ffe0b2" }}>
                <label className="field-label" style={{ color: "#e65100" }}>¿Aplicar algún descuento manual?</label>
                <div style={{ position: "relative", marginTop: 8 }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#e65100", fontWeight: 700 }}>$</span>
                  <input
                    type="number" min={0} max={subtotal}
                    className="field-input"
                    style={{ paddingLeft: 28, borderColor: "#ffe0b2" }}
                    value={form.descuento}
                    onChange={e => set("descuento", e.target.value)}
                    placeholder="Valor en pesos (COP)"
                  />
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#e65100", opacity: 0.8 }}>El descuento se restará del total final.</p>
              </div>
            </div>
          )}

          {/* ── Paso 5: Resumen ── */}
          {step === 5 && (
            <div className="fade-in">
              <p className="section-label" style={{ textTransform: "none", marginTop: 0, fontSize: 16 }}>5. Resumen del Pedido</p>
              
              <div className="resumen-container" style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                  <div className="resumen-card">
                    <p className="resumen-card__title">👤 Cliente</p>
                    <p className="resumen-card__val"><strong>{clienteSeleccionado.nombre}</strong></p>
                    <p className="resumen-card__sub">{clienteSeleccionado.telefono}</p>
                  </div>
                  <div className="resumen-card">
                    <p className="resumen-card__title">📍 Entrega</p>
                    <p className="resumen-card__val"><strong>{form.domicilio ? "Domicilio" : "En Tienda"}</strong></p>
                    <p className="resumen-card__sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {form.domicilio ? form.direccion_entrega : "Recoger en local"}
                    </p>
                    {form.domicilio && form.fecha_entrega && (
                      <p className="resumen-card__sub">
                        📅 {new Date(form.fecha_entrega + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="resumen-card" style={{ padding: "0" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", background: "#fcfcfc", borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                    <p className="resumen-card__title" style={{ margin: 0 }}>🛒 Detalle de productos ({form.productosItems.length})</p>
                  </div>
                  <div style={{ maxHeight: 120, overflowY: "auto", padding: "10px 16px" }}>
                    {form.productosItems.map(p => (
                      <div key={p.idProducto} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                        <span>{p.cantidad}x {p.nombre}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(p.precio * p.cantidad)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="resumen-final-box" style={{ background: "#2e7d32", color: "#fff", padding: "20px", borderRadius: "14px", boxShadow: "0 4px 15px rgba(46,125,50,0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, opacity: 0.9 }}>
                    <span>Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  {descuento > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                      <span>Descuento aplicado</span>
                      <span>-{fmt(descuento)}</span>
                    </div>
                  )}
                  {costoEnvio > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                      <span>🛵 Domicilio</span>
                      <span>+{fmt(costoEnvio)}</span>
                    </div>
                  )}
                  {usarCredito && creditoAplicar > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                      <span>🎁 Crédito del cliente</span>
                      <span>-{fmt(creditoAplicar)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 900, marginTop: 12, paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,0.3)" }}>
                    <span>TOTAL FINAL</span>
                    <span>{fmt(totalFinal)}</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, background: "rgba(0,0,0,0.15)", padding: "6px 10px", borderRadius: "6px", textAlign: "center" }}>
                    💳 Pago vía: <strong>{form.metodo_pago}</strong>
                  </div>
                  {requiereAnticipo && (
                    <div style={{ marginTop: 10, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span>💰 {pagarTodo ? "Total pagado ahora" : "Anticipo 50% registrado"}</span>
                        <span style={{ fontWeight: 700 }}>{fmt(montoAnticipo)}</span>
                      </div>
                      {!pagarTodo && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                          <span>Saldo restante al entregar</span>
                          <span style={{ fontWeight: 700 }}>{fmt(totalFinal - montoAnticipo)}</span>
                        </div>
                      )}
                      {!pagarTodo && (
                        <div style={{ marginTop: 6, fontSize: 10, opacity: 0.85, textAlign: "center" }}>
                          Anticipo vía {form.anticipo_metodo}
                          {form.anticipo_metodo === "Efectivo 💵" && form.anticipo_efectivo ? " ✓ Confirmado" : ""}
                          {form.anticipo_metodo === "Transferencia 🏦" && form.anticipo_comp_preview ? " ✓ Comprobante adjunto" : ""}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {hayProductosSinStock && form.productosItems.some(p => p.requiereProduccion) && (
                  <div style={{ padding: "12px", background: "#e8eaf6", border: "1px solid #9fa8da", borderRadius: "10px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 20 }}>🏭</span>
                    <p style={{ margin: 0, fontSize: 12, color: "#283593", lineHeight: 1.4 }}>
                      <strong>Producción:</strong> el pedido nacerá en <strong>Confirmado</strong> y se creará la Orden de Producción automáticamente con la fecha elegida.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: "20px 30px", borderTop: "1px solid #f0f0f0", flexDirection: "column", gap: 12 }}>
          {saveError && step === 5 && (
            <div style={{ width: "100%", padding: "10px 14px", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "10px", color: "#c62828", fontSize: 13, fontWeight: 600, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span>{saveError}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            {step > 1
              ? <button className="btn-ghost" style={{ padding: "10px 20px" }} onClick={handleBack}>← Volver</button>
              : <button className="btn-ghost" style={{ padding: "10px 20px" }} onClick={onClose}>Cancelar</button>
            }
            <div style={{ display: "flex", gap: 12 }}>
              {step < 5
                ? <button
                    className="btn-save"
                    style={{ padding: "10px 30px", fontSize: 14 }}
                    onClick={handleNext}
                    disabled={step === 3 && form.domicilio && (clienteSeleccionado?.telefono || "").replace(/\D/g, "").length !== 10}
                  >Continuar →</button>
                : <button className="btn-save" style={{ padding: "10px 40px", fontSize: 15, background: "#2e7d32" }} onClick={handleSave} disabled={saved}>
                    {saved ? "Procesando…" : "Confirmar Pedido"}
                  </button>
              }
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}