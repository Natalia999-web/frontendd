import { useRef, useEffect, useState } from "react";
import {
  getUsuarios,
  crearCliente as crearClienteAPI,
  editarUsuario,
  toggleEstadoUsuario,
  eliminarUsuario,
} from "../../../services/usuariosService.js";
import CrearCliente from "./CrearCliente.jsx";
import { ModalVerCliente, ModalEditarCliente } from "./EditarCliente.jsx";
import ModalEliminarValidado from "../../../ModalEliminarValidado";
import DateRangeFilter from "../../../shared/components/DateRangeFilter";
import "./clientes.css";

const ITEMS_PER_PAGE = 8;

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} className="toggle-btn"
      style={{ background: value ? "#43a047" : "#c62828",
        boxShadow: value ? "0 2px 8px rgba(67,160,71,0.45)" : "0 2px 8px rgba(198,40,40,0.3)" }}>
      <span className="toggle-thumb" style={{ left: value ? 27 : 3 }}>
        <span className="toggle-label" style={{ color: "black" }}>{value ? "ON" : "OFF"}</span>
      </span>
    </button>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" style={{ background: toast.type === "success" ? "#2e7d32" : "#c62828" }}>
      <span style={{ fontSize: 15 }}>{toast.type === "success" ? "✓" : "✕"}</span>
      {toast.message}
    </div>
  );
}

export default function GestionClientes() {
  const [clientes,    setClientes]    = useState([]);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("todos");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");
  const [showFilter,  setShowFilter]  = useState(false);
  const [page,        setPage]        = useState(1);
  const [modal,       setModal]       = useState(null);
  const [toast,       setToast]       = useState(null);
  const filterRef = useRef();

  const cargarDatos = async () => {
    try {
      const lista = await getUsuarios({ porPagina: 100 });
      setClientes(lista.filter(u => u.tipo === "cliente"));
    } catch { /* silently fail */ }
  };

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    const h = e => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const showToast = (msg, type = "success") => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3000); };

  const canDeleteCliente = () => ({ ok: true });

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase();
    const matchQ = `${c.nombre} ${c.apellidos}`.toLowerCase().includes(q)
      || (c.correo || "").toLowerCase().includes(q)
      || (c.municipio || "").toLowerCase().includes(q)
      || (c.cedula || "").toLowerCase().includes(q);
    const matchE = filter === "todos" || (filter === "activo" ? c.estado : !c.estado);

    let matchFecha = true;
    if (filterDesde || filterHasta) {
      const fechaRaw = String(c.fechaCreacion || "").slice(0, 10);
      const fecha = fechaRaw ? new Date(`${fechaRaw}T00:00:00`) : null;
      if (!fecha) matchFecha = false;
      if (filterDesde && fecha && new Date(`${filterDesde}T00:00:00`) > fecha) matchFecha = false;
      if (filterHasta && fecha && new Date(`${filterHasta}T00:00:00`) < fecha) matchFecha = false;
    }

    return matchQ && matchE && matchFecha;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const hasFilter = filter !== "todos" || filterDesde || filterHasta;
  useEffect(() => setPage(1), [search, filter, filterDesde, filterHasta]);

  const handleCreate = async (data) => {
    try {
      await crearClienteAPI({
        Nombre:         data.nombre,
        Apellidos:      data.apellidos,
        Correo:         data.correo,
        Contrasena:     data.contrasena,
        Telefono:       data.telefono,
        Cedula:         data.numDoc,
        Tipo_Documento: data.tipoDoc,
        Departamento:   data.departamento,
        Municipio:      data.municipio,
        Direccion:      data.direccion || "",
      });
      await cargarDatos();
      showToast("Cliente creado");
      setModal(null);
    } catch (err) {
      showToast(err.message || "Error al crear cliente", "error");
    }
  };

  const handleEdit = async (data) => {
    try {
      await editarUsuario("cliente", data.id, {
        Nombre:         data.nombre,
        Apellidos:      data.apellidos,
        Correo:         data.correo,
        Telefono:       data.telefono,
        Cedula:         data.numDoc,
        Tipo_Documento: data.tipoDoc,
        Departamento:   data.departamento,
        Municipio:      data.municipio,
        Direccion:      data.direccion || "",
        ...(data.contrasena ? { Contrasena: data.contrasena } : {}),
      });
      await cargarDatos();
      showToast("Cambios guardados");
      setModal(null);
    } catch (err) {
      showToast(err.message || "Error al editar cliente", "error");
    }
  };

  const handleDeleteClick = (c) => setModal({ mode: "delete", cliente: c });

  const handleDelete = async () => {
    try {
      await eliminarUsuario("cliente", modal.cliente.id);
      await cargarDatos();
      showToast("Cliente eliminado", "error");
      setModal(null);
    } catch (err) {
      showToast(err.message || "Error al eliminar cliente", "error");
    }
  };

  const handleToggle = async (c) => {
    try {
      await toggleEstadoUsuario("cliente", c.id, c.estado);
      await cargarDatos();
    } catch { /* silently fail */ }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Gestión de Clientes</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input type="text" className="search-input"
              placeholder="Buscar por nombre, correo, ciudad o documento…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div ref={filterRef} style={{ position: "relative" }}>
            <button className={"filter-icon-btn" + (hasFilter ? " has-filter" : "")}
              onClick={() => setShowFilter(v => !v)}>▼</button>
            {showFilter && (
              <div className="filter-dropdown">
                {[
                  { val: "todos",    label: "Todos",    dot: "#bdbdbd" },
                  { val: "activo",   label: "Activos",  dot: "#43a047" },
                  { val: "inactivo", label: "Inactivos",dot: "#ef5350" },
                ].map(f => (
                  <button key={f.val} className={"filter-option" + (filter === f.val ? " active" : "")}
                    onClick={() => { setFilter(f.val); setShowFilter(false); }}>
                    <span className="filter-dot" style={{ background: f.dot }} />{f.label}
                  </button>
                ))}
                <div style={{ height: 1, background: "#f0f0f0", margin: "8px 0" }} />
                <DateRangeFilter
                  desde={filterDesde}
                  hasta={filterHasta}
                  label="Fecha de registro"
                  onApply={({ desde, hasta }) => {
                    setFilterDesde(desde || "");
                    setFilterHasta(hasta || "");
                  }}
                  onClear={() => {
                    setFilterDesde("");
                    setFilterHasta("");
                  }}
                />
              </div>
            )}
          </div>
          {(hasFilter || search) && (
            <button className="btn-limpiar" onClick={() => { setSearch(""); setFilter("todos"); setFilterDesde(""); setFilterHasta(""); }}>
              ✕ Limpiar
            </button>
          )}

          <button className="btn-agregar" onClick={() => setModal({ mode: "new" })}>
            Agregar <span style={{ fontSize: 18 }}>+</span>
          </button>
        </div>

        <div className="card">
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Nº</th>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Teléfono</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state__icon">👤</div>
                      <p className="empty-state__text">
                        {filter !== "todos" || search ? "Sin clientes que coincidan." : "No hay clientes registrados."}
                      </p>
                    </div>
                  </td></tr>
                ) : paginated.map((c, idx) => (
                  <tr key={c.id} className="tbl-row">
                    <td><span className="row-num">{String((safePage-1)*ITEMS_PER_PAGE+idx+1).padStart(2,"0")}</span></td>
                    <td>
                      <div className="client-cell">
                        <div className="avatar-wrap">
                          {c.fotoPreview ? <img src={c.fotoPreview} alt={c.nombre} style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : <span>👤</span>}
                        </div>
                        <div>
                          <div className="client-name">{c.nombre} {c.apellidos}</div>
                          <div className="client-email">{c.correo}</div>
                        </div>
                      </div>
                    </td>
                    <td><div className="doc-badge"><span className="doc-type">{c.tipoDocumento}</span><span className="doc-num">{c.cedula}</span></div></td>
                    <td><span className="phone-cell"><span className="phone-icon">📞</span>{c.telefono}</span></td>
                    <td><div className="location-city">{c.municipio}</div><div className="location-dept">{c.departamento}</div></td>
                    <td><Toggle value={c.estado} onChange={() => handleToggle(c)} /></td>
                    <td><span className="date-badge">{c.fechaCreacion}</span></td>
                    <td>
                      <div className="actions-cell">
                        <button className="act-btn act-btn--view"   onClick={() => setModal({ mode:"view",   cliente:c })}>👁</button>
                        <button className="act-btn act-btn--edit"   onClick={() => setModal({ mode:"edit",   cliente:c })}>✎</button>
                        <button className="act-btn act-btn--delete" onClick={() => handleDeleteClick(c)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-bar">
            <span className="pagination-count">{filtered.length} {filtered.length === 1 ? "cliente" : "clientes"} en total</span>
            <div className="pagination-btns">
              <button className="pg-btn-arrow" onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
              <button className="pg-btn-arrow" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              <span className="pg-pill">Página {safePage} de {totalPages}</span>
              <button className="pg-btn-arrow" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <button className="pg-btn-arrow" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
            </div>
          </div>
        </div>
      </div>

      {modal?.mode === "new"    && <CrearCliente onClose={() => setModal(null)} onSave={handleCreate} />}
      {modal?.mode === "edit"   && <ModalEditarCliente cliente={modal.cliente} onClose={() => setModal(null)} onSave={handleEdit} />}
      {modal?.mode === "view"   && <ModalVerCliente    cliente={modal.cliente} onClose={() => setModal(null)} />}
      {modal?.mode === "delete" && (
        <ModalEliminarValidado
          titulo="Eliminar cliente"
          descripcion={`¿Está seguro de que desea eliminar permanentemente al cliente "${modal.cliente.nombre} ${modal.cliente.apellidos}"?`}
          validacion={canDeleteCliente()}
          onClose={() => setModal(null)}
          onConfirm={handleDelete}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
