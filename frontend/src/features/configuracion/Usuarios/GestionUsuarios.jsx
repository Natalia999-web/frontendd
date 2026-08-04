import { useState, useEffect, useRef } from "react";
import {
  getUsuarios, eliminarUsuario, toggleEstadoUsuario,
} from "../../../services/usuariosService.js";
import { getRoles } from "../../../services/rolesService.js";
import { getUser } from "../../../services/authService.js";
import { Avatar, Toggle, RolBadge } from "./CrearUsuario.jsx";
import CrearUsuario from "./CrearUsuario.jsx";
import { ModalVerUsuario, ModalEliminarUsuario } from "./EditarUsuario.jsx";
import "./Usuarios.css";
import DateRangeFilter from "../../../shared/components/DateRangeFilter";
import { getRecordDate } from "../../../utils/dateUtils";

const PER_PAGE = 5;

function ToggleConTooltip({ on, onToggle, disabled, razon }) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }} className="toggle-tooltip-wrap">
      <Toggle on={on} onToggle={onToggle} disabled={disabled} />
      {disabled && razon && <div className="toggle-tooltip">{razon}</div>}
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" style={{ background: toast.type === "error" ? "#c62828" : "#2e7d32" }}>
      <span style={{ fontSize: 15 }}>{toast.type === "error" ? "✕" : "✓"}</span>
      {toast.message}
    </div>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <tr key={i}>
      {Array.from({ length: 8 }, (_, j) => (
        <td key={j}><div className="skeleton-cell" /></td>
      ))}
    </tr>
  ));
}

export default function GestionUsuarios() {
  const [usuarios,   setUsuarios]   = useState([]);
  const [roles,      setRoles]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("todos");
  const [filterRol,  setFilterRol]  = useState("todos");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [page,       setPage]       = useState(1);
  const [modal,      setModal]      = useState(null);
  const [toast,      setToast]      = useState(null);
  const filterRef = useRef();

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [users, rolesData] = await Promise.all([getUsuarios(), getRoles()]);
      setUsuarios([...users].sort((a, b) => b.id - a.id));
      setRoles(rolesData);
    } catch (e) {
      showToast(e.message || "Error al cargar usuarios", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    if (!modal) return;
    const block = e => e.stopPropagation();
    document.addEventListener("keydown", block, true);
    document.addEventListener("keyup",   block, true);
    document.addEventListener("keypress",block, true);
    return () => {
      document.removeEventListener("keydown", block, true);
      document.removeEventListener("keyup",   block, true);
      document.removeEventListener("keypress",block, true);
    };
  }, [modal]);

  useEffect(() => {
    const h = e => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = usuarios.filter(u => {
    const q      = search.toLowerCase();
    const matchQ = [u.nombre, u.apellidos, u.correo, u.rol, u.cedula, u.municipio]
      .filter(Boolean).some(v => v.toLowerCase().includes(q));
    const matchE   = filter    === "todos" || (filter === "activo" ? u.estado : !u.estado);
    const matchRol = filterRol === "todos" || u.rol === filterRol;
    // Fecha range (created/registered)
    let matchFecha = true;
    if (filterDesde || filterHasta) {
      const val = getRecordDate(u) || u.created_at || u.fecha_creacion;
      if (!val) matchFecha = false;
      else {
        const d = new Date(String(val).split('T')[0]);
        if (filterDesde && new Date(filterDesde) > d) matchFecha = false;
        if (filterHasta && new Date(filterHasta) < d) matchFecha = false;
      }
    }
    return matchQ && matchE && matchRol && matchFecha;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  useEffect(() => { setPage(1); }, [search, filter, filterRol]);

  const handleSave = async () => {
    await cargarDatos();
    // Si el admin editó al usuario de la sesión actual, refrescar el contexto de privilegios
    if (modal?.user) {
      const sesion = getUser();
      if (sesion && String(sesion.id) === String(modal.user.id)) {
        window.dispatchEvent(new CustomEvent("session-changed"));
      }
    }
    showToast(modal?.user ? "Usuario actualizado" : "Usuario creado");
    setModal(null);
  };

  const handleDeleteConfirm = async (id) => {
    const user = usuarios.find(u => u.id === id);
    try {
      await eliminarUsuario(user.tipo, id);
      showToast("Usuario eliminado", "error");
      await cargarDatos();
      setModal(null);
    } catch (e) {
      // Mostrar el error como modal bloqueante (no como toast) para que el usuario lo vea ANTES de intentar de nuevo
      setModal({ type: "delete", user, razon: e.message || "No se puede eliminar este usuario." });
    }
  };

  const handleToggleClick = async (user) => {
    // Optimistic update
    setUsuarios(prev => prev.map(u => u.id === user.id ? { ...u, estado: !u.estado } : u));
    try {
      await toggleEstadoUsuario(user.tipo, user.id, user.estado);
    } catch (e) {
      // Revert
      setUsuarios(prev => prev.map(u => u.id === user.id ? { ...u, estado: user.estado } : u));
      showToast(e.message || "Error al cambiar estado", "error");
    }
  };

  const hasFilter = filter !== "todos" || filterRol !== "todos";
  const todosLosRoles = [...new Set(usuarios.map(u => u.rol).filter(Boolean))].sort();

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-header__title">Gestión de Usuarios</h1>
        <div className="page-header__line" />
      </div>

      <div className="page-inner">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por nombre, correo, rol o documento…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div ref={filterRef} style={{ position: "relative" }}>
            <button
              className={"filter-icon-btn" + (hasFilter ? " has-filter" : "")}
              onClick={() => setShowFilter(v => !v)}
            >▼</button>
            {showFilter && (
              <div className="filter-dropdown" style={{ minWidth: 170 }}>
                <p className="filter-section-title">Estado</p>
                {[
                  { val: "todos",    label: "Todos",     dot: "#bdbdbd" },
                  { val: "activo",   label: "Activos",   dot: "#43a047" },
                  { val: "inactivo", label: "Inactivos", dot: "#ef5350" },
                ].map(f => (
                  <button key={f.val}
                    className={"filter-option" + (filter === f.val ? " active" : "")}
                    onClick={() => { setFilter(f.val); setPage(1); }}>
                    <span className="filter-dot" style={{ background: f.dot }} />{f.label}
                  </button>
                ))}
                <div style={{ height: 1, background: "#f0f0f0", margin: "4px 0" }} />
                <p className="filter-section-title">Rol</p>
                <button
                  className={"filter-option" + (filterRol === "todos" ? " active" : "")}
                  onClick={() => { setFilterRol("todos"); setPage(1); setShowFilter(false); }}>
                  <span className="filter-dot" style={{ background: "#bdbdbd" }} />Todos
                </button>
                {todosLosRoles.map(r => (
                  <button key={r}
                    className={"filter-option" + (filterRol === r ? " active" : "")}
                    onClick={() => { setFilterRol(r); setPage(1); setShowFilter(false); }}>
                    <span className="filter-dot" style={{ background: "#2e7d32" }} />{r}
                  </button>
                ))}
                <div style={{ padding: 8 }}>
                  <DateRangeFilter
                    desde={filterDesde}
                    hasta={filterHasta}
                    onApply={({desde, hasta}) => { setFilterDesde(desde || ''); setFilterHasta(hasta || ''); setShowFilter(false); }}
                    onClear={() => { setFilterDesde(''); setFilterHasta(''); setShowFilter(false); }}
                    label="Filtrar por fecha de registro"
                  />
                </div>
              </div>
            )}
          </div>

          {(hasFilter || search) && (
            <button className="btn-limpiar" onClick={() => { setSearch(""); setFilter("todos"); setFilterRol("todos"); }}>
              ✕ Limpiar
            </button>
          )}

          <button className="btn-agregar" onClick={() => setModal({ type: "form", user: null })}>
            Agregar <span style={{ fontSize: 18 }}>+</span>
          </button>
        </div>

        <div className="card">
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Nº</th>
                  <th>Usuario</th>
                  <th>Cédula</th>
                  <th>Teléfono</th>
                  <th>Ubicación</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state__icon">👤</div>
                      <p className="empty-state__text">
                        {hasFilter || search ? "Sin usuarios que coincidan." : "No hay usuarios registrados."}
                      </p>
                    </div>
                  </td></tr>
                ) : paged.map((user, idx) => (
                  <tr key={`${user.tipo}-${user.id}`} className="tbl-row">
                    <td>
                      <span className="row-num">
                        {String((safePage - 1) * PER_PAGE + idx + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td>
                      <div className="client-cell">
                        <div className="avatar-wrap">
                          <Avatar foto={user.foto} size={38} border={false} />
                        </div>
                        <div>
                          <div className="client-name">{user.nombre} {user.apellidos}</div>
                          <a href={`mailto:${user.correo}`} className="client-email" style={{ textDecoration: "none" }}>{user.correo}</a>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="doc-badge">
                        <span className="doc-type">{user.tipoDocumento || "CC"}</span>
                        <span className="doc-num">{user.cedula || "—"}</span>
                      </div>
                    </td>
                    <td>
                      {user.telefono
                        ? <a href={`https://wa.me/${user.telefono.replace(/\D/g, "")}`} className="phone-cell" style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer">
                            <span className="phone-icon">📞</span>
                            {user.telefono}
                          </a>
                        : <span className="phone-cell" style={{ color: "#bdbdbd" }}>—</span>
                      }
                    </td>
                    <td>
                      <div className="location-city">{user.municipio    || "—"}</div>
                      <div className="location-dept">{user.departamento || ""}</div>
                    </td>
                    <td><RolBadge rol={user.rol} roles={roles} /></td>
                    <td>
                      {(() => {
                        const esAdmin = user.tipo === "empleado" && user.idRol === 1;
                        const rolDesactivado = !esAdmin &&
                          user.rol && roles.some(r => r.nombre === user.rol && !r.estado);
                        return (
                          <ToggleConTooltip
                            on={esAdmin ? true : (!rolDesactivado && user.estado)}
                            onToggle={() => handleToggleClick(user)}
                            disabled={esAdmin || rolDesactivado}
                            razon={
                              esAdmin         ? "El administrador siempre está activo"
                              : rolDesactivado ? `El rol "${user.rol}" está desactivado`
                              : null
                            }
                          />
                        );
                      })()}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="act-btn act-btn--view"
                          onClick={() => setModal({ type: "ver", user })}>👁</button>
                        <button className="act-btn act-btn--edit"
                          onClick={() => setModal({ type: "form", user })}>✎</button>
                        {!(user.tipo === "empleado" && user.idRol === 1) && (
                          <button className="act-btn act-btn--delete"
                            onClick={() => {
                              const advertencias = user.tipo === "empleado"
                                ? ["Si tiene domicilios asignados, la eliminación será rechazada."]
                                : ["Si tiene ventas o pedidos registrados, la eliminación será rechazada."];
                              setModal({ type: "delete", user, advertencias, razon: null });
                            }}>🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span className="pagination-count">
              {filtered.length} {filtered.length === 1 ? "usuario" : "usuarios"} en total
            </span>
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

      {modal?.type === "ver" && (
        <ModalVerUsuario user={modal.user} roles={roles} onClose={() => setModal(null)} />
      )}
      {modal?.type === "form" && (
        <CrearUsuario
          user={modal.user}
          roles={roles}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {modal?.type === "delete" && (
        <ModalEliminarUsuario
          user={modal.user}
          razon={modal.razon ?? null}
          advertencias={modal.advertencias ?? []}
          onClose={() => setModal(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
