import { useState, useRef, useEffect } from "react";
import { getCategorias } from "../../../../services/categoriasInsumosService.js";
import { getInsumos } from "../../../../services/insumosService.js";
import SearchableSelect from "../../../../shared/components/SearchableSelect.jsx";
import "./FichasTecnicas.css";

  const UNIDADES = ["kg","g","l","ml","unidad","taza","cucharada","cucharadita"];
  const UNITS_FAMILIES = [
    ["mg","g","kg","t"],
    ["ml","l"],
    ["unidad","docena"],
    ["taza","cucharada","cucharadita"],
  ];

export default function EditarFicha({ ficha, mode = "edit", onClose, onSave, productoNombre = "", productoFoto = null }) {
  const [categoriasInsumosActivas, setCategoriasInsumosActivas] = useState([]);
  const [insumosPorCategoriaId,    setInsumosPorCategoriaId]    = useState({});
  const [insumosError,             setInsumosError]             = useState(null);

  useEffect(() => {
    if (mode === "view") return;
    getCategorias()
      .then(catData => {
        const cats = (catData.categorias || catData.items || [])
          .filter(c => c.Estado === 1 || c.estado === true)
          .map(c => ({ id: c.ID_Categoria || c.id, nombre: c.Nombre_Categoria || c.Nombre || c.nombre, icon: c.Icono || c.icono || "📦" }));
        setCategoriasInsumosActivas(cats);
      })
      .catch(() => {});
    getInsumos()
      .then(insData => {
        const map = {};
        (insData.insumos || insData.items || []).forEach(i => {
          if (i.Estado !== 0 && i.estado !== false) {
            const catId = String(i.ID_Categoria || i.id_categoria || "");
            if (!map[catId]) map[catId] = [];
            map[catId].push({
              id: i.ID_Insumo || i.id,
              nombre: i.Nombre || i.nombre,
              unidad: i.simbolo_unidad || i.Unidad || i.unidad || "",
            });
          }
        });
        setInsumosPorCategoriaId(map);
      })
      .catch(() => setInsumosError("No se pudieron cargar los insumos. Verifica que el rol tiene el permiso 'ver_insumos'."));
  }, [mode]);

  const normalizeInsumos = (f) => Array.isArray(f?.insumos) ? f.insumos : [];

  const [form,   setForm]   = useState({ ...ficha, producto: ficha?.producto || productoNombre || "", fotoPreview: ficha?.fotoPreview || productoFoto || null, insumos: normalizeInsumos(ficha) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tab,    setTab]    = useState("insumos");
  const fotoRef = useRef();
  const isView  = mode === "view";

  useEffect(() => { if (ficha) setForm({ ...ficha, producto: ficha?.producto || productoNombre || "", fotoPreview: ficha?.fotoPreview || productoFoto || null, insumos: normalizeInsumos(ficha) }); }, [ficha, productoNombre, productoFoto]);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    let err = "";
    if (k === "procedimiento" && !v.trim()) err = "El procedimiento es requerido";
    setErrors(p => ({ ...p, [k]: err }));
  };

  const handleFoto = e => {
    if (isView) return;
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("fotoPreview", ev.target.result);
    reader.readAsDataURL(file);
  };

  const getInsumosList = (p) => Array.isArray(p.insumos) ? p.insumos : [];

  const addInsumo = () => setForm(p => ({
    ...p,
    insumos: [...getInsumosList(p), { id: Date.now(), idCategoria: "", idInsumo: "", nombre: "", cantidad: "", unidad: "" }],
  }));

  const delInsumo = id => setForm(p => ({ ...p, insumos: getInsumosList(p).filter(i => i.id !== id) }));

  const getUnidadOptions = (insumoId, categoriaId) => {
    const insumo = (insumosPorCategoriaId[String(categoriaId)] || []).find(i => String(i.id) === String(insumoId));
    const base = insumo?.unidad ? String(insumo.unidad).toLowerCase() : null;
    if (base) {
      for (const fam of UNITS_FAMILIES) {
        if (fam.includes(base)) return fam;
      }
      return [insumo.unidad];
    }
    return UNIDADES;
  };

  const setInsumo = (id, k, v) => setForm(p => ({
    ...p,
    insumos: getInsumosList(p).map(i => {
      if (i.id !== id) return i;
      if (k === "idCategoria") return { ...i, idCategoria: v, idInsumo: "", nombre: "", unidad: "" };
      if (k === "idInsumo") {
        const found = (insumosPorCategoriaId[i.idCategoria] || []).find(x => String(x.id) === String(v));
        return {
          ...i,
          idInsumo: v ? Number(v) : "",
          nombre: found?.nombre || "",
          unidad: found?.unidad || "",
        };
      }
      return { ...i, [k]: v };
    }),
  }));

  const validate = () => {
    const e = {};
    if (!form.procedimiento?.trim()) e.procedimiento = "El procedimiento es requerido";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); if (e.procedimiento) setTab("procedimiento"); return; }
    setSaving(true);
    try {
      await onSave(form);
    } catch {
      // parent handles error
    } finally {
      setSaving(false);
    }
  };

  const pasos = (form.procedimiento || "").split("\n").filter(l => l.trim());

  const TABS = [
    { id: "insumos",       label: "🧪 Insumos" },
    { id: "procedimiento", label: "📋 Procedimiento" },
    { id: "observaciones", label: "📝 Observaciones" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ficha-modal" onClick={e => e.stopPropagation()}>

        <div className="ficha-modal__header">
          <div className="ficha-modal__header-left">
            <div className="ficha-modal__badge">Ficha Técnica</div>
            <h2 className="ficha-modal__title">{isView ? form.producto || "Detalle" : "Editar Ficha Técnica"}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="ficha-modal__top">
          <div className="ficha-info-banner">
            <span className="ficha-info-banner__icon">ℹ️</span>
            <span>Esta ficha técnica describe los insumos necesarios para producir <strong>1 unidad</strong> del producto.</span>
          </div>

          <div className="ficha-top-row">
            <div className="ficha-foto-upload" style={{ cursor: isView ? "default" : "pointer" }}
              onClick={() => !isView && fotoRef.current.click()}>
              {form.fotoPreview
                ? <img src={form.fotoPreview} alt="foto" className="ficha-foto-upload__img" />
                : <><span style={{ fontSize: 24, color: "#43a047", lineHeight: 1 }}>+</span>{!isView && <span className="ficha-foto-upload__hint">Cambiar foto</span>}</>
              }
            </div>

            <div className="ficha-top-fields">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nombre del producto</label>
                <div className="field-input field-input--disabled">{form.producto || "—"}</div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Vida útil {!isView && <span style={{ fontWeight: 400, color: "#9e9e9e" }}>(opcional)</span>}</label>
                {isView
                  ? <div className="ficha-date-display">
                      {form.vidaUtilCantidad
                        ? <><span>🕐</span>{form.vidaUtilCantidad} {form.vidaUtilUnidad || "días"}</>
                        : <span style={{ color: "#9e9e9e" }}>Sin vencimiento</span>}
                    </div>
                  : <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="number" min="1" className="field-input" style={{ width: 80 }}
                        placeholder="ej. 7"
                        value={form.vidaUtilCantidad || ""}
                        onChange={e => set("vidaUtilCantidad", e.target.value)} />
                      <select
                        className="field-input" style={{ flex: 1 }}
                        value={form.vidaUtilUnidad || "dias"}
                        onChange={e => set("vidaUtilUnidad", e.target.value)}>
                        <option value="dias">días</option>
                        <option value="semanas">semanas</option>
                        <option value="meses">meses</option>
                      </select>
                    </div>
                }
              </div>
            </div>
          </div>

          <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFoto} />
        </div>

        <div className="ficha-tabs">
          {TABS.map(t => (
            <button key={t.id}
              className={`ficha-tab${tab === t.id ? " ficha-tab--active" : ""}${t.id === "procedimiento" && errors.procedimiento ? " ficha-tab--error" : ""}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="ficha-modal__body">

          {tab === "insumos" && (
            <div>
              <div className="ficha-insumos-table-wrap">
                <table className="ficha-insumos-tbl">
                  <thead><tr><th>Categoría</th><th>Insumo</th><th>Cantidad</th><th>Unidad</th>{!isView && <th></th>}</tr></thead>
                  <tbody>
                    {(form.insumos || []).map((ins, idx) => (
                      <tr key={ins.id} className={idx % 2 === 0 ? "ficha-insumos-tbl__row" : "ficha-insumos-tbl__row ficha-insumos-tbl__row--alt"}>
                        <td>
                          {isView
                            ? <span className="ficha-cell-text">{ins.nombreCategoria || ins.idCategoria || "—"}</span>
                            : <SearchableSelect
                                className="ficha-select"
                                options={categoriasInsumosActivas}
                                value={ins.idCategoria}
                                onChange={e => setInsumo(ins.id, "idCategoria", e.target.value)}
                                getValue={c => c.id}
                                getLabel={c => `${c.icon || ""} ${c.nombre}`}
                                placeholder="— Categoría —"
                                searchPlaceholder="🔍 Categoría…"
                              />
                          }
                        </td>
                        <td>
                          {isView
                            ? <span className="ficha-cell-text ficha-cell-text--bold">{ins.nombre}</span>
                            : <SearchableSelect
                                className="ficha-select"
                                options={insumosPorCategoriaId[String(ins.idCategoria)] || []}
                                value={ins.idInsumo}
                                onChange={e => setInsumo(ins.id, "idInsumo", e.target.value)}
                                getValue={i => i.id}
                                getLabel={i => i.nombre}
                                placeholder="— Insumo —"
                                searchPlaceholder="🔍 Insumo…"
                                disabled={!ins.idCategoria}
                                style={{ opacity: ins.idCategoria ? 1 : 0.45 }}
                              />
                          }
                        </td>
                        <td>
                          {isView
                            ? <span className="ficha-cell-text ficha-cell-text--green">{ins.cantidad}</span>
                            : <input className="ficha-input-num" type="number" min="0" placeholder="0"
                                value={ins.cantidad} onChange={e => setInsumo(ins.id, "cantidad", e.target.value)} />
                          }
                        </td>
                        <td>
                          {isView
                            ? <span className="ficha-cell-text">{ins.unidad}</span>
                            : <select className="ficha-select" value={ins.unidad} onChange={e => setInsumo(ins.id, "unidad", e.target.value)}>
                                <option value="">—</option>
                                {getUnidadOptions(ins.idInsumo, ins.idCategoria).map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          }
                        </td>
                        {!isView && <td><button className="ficha-del-btn" onClick={() => delInsumo(ins.id)}>✕</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!isView && insumosError && (
                <p className="field-error" style={{ marginTop: 6 }}>{insumosError}</p>
              )}
              {!isView && <button className="ficha-add-btn" onClick={addInsumo}>+ Agregar insumo</button>}
              {isView && (form.insumos || []).length === 0 && (
                <p style={{ textAlign: "center", color: "#9e9e9e", padding: "20px 0" }}>Sin insumos registrados.</p>
              )}
            </div>
          )}

          {tab === "procedimiento" && (
            <div>
              {isView
                ? <ol className="ficha-steps-list">{pasos.length > 0 ? pasos.map((paso, i) => (
                    <li key={i} className="ficha-step-item"><span className="ficha-step-num">{i + 1}</span><span>{paso}</span></li>
                  )) : <p style={{ color: "#9e9e9e" }}>Sin procedimiento registrado.</p>}</ol>
                : <>
                    <p className="ficha-hint">Escribe un paso por línea.</p>
                    <textarea className={`field-input ficha-textarea${errors.procedimiento ? " field-input--error" : ""}`} rows={8}
                      value={form.procedimiento || ""} onChange={e => set("procedimiento", e.target.value)}
                      onFocus={e => e.target.style.borderColor = "#4caf50"}
                      onBlur={e => {
                        const empty = !e.target.value.trim();
                        if (empty) setErrors(p => ({ ...p, procedimiento: "El procedimiento es requerido" }));
                        e.target.style.borderColor = (errors.procedimiento || empty) ? "#e53935" : "#e0e0e0";
                      }} />
                    {errors.procedimiento && <p className="field-error">{errors.procedimiento}</p>}
                    {form.procedimiento && (
                      <div className="ficha-preview-steps">
                        <p className="ficha-preview-label">Vista previa</p>
                        <ol className="ficha-steps-list">
                          {form.procedimiento.split("\n").filter(l => l.trim()).map((paso, i) => (
                            <li key={i} className="ficha-step-item"><span className="ficha-step-num">{i + 1}</span><span>{paso}</span></li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </>
              }
            </div>
          )}

          {tab === "observaciones" && (
            <div>
              {isView
                ? <p style={{ fontSize: 14, color: "#424242", lineHeight: 1.7, margin: 0 }}>
                    {form.observaciones || <span style={{ color: "#9e9e9e" }}>Sin observaciones.</span>}
                  </p>
                : <>
                    <p className="ficha-hint">Notas adicionales, alérgenos o recomendaciones.</p>
                    <textarea className="field-input ficha-textarea" rows={6} value={form.observaciones || ""}
                      onChange={e => set("observaciones", e.target.value)}
                      onFocus={e => e.target.style.borderColor = "#4caf50"} onBlur={e => e.target.style.borderColor = "#e0e0e0"} />
                  </>
              }
            </div>
          )}
        </div>

        <div className="ficha-modal__footer" style={{ justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost" onClick={onClose}>{isView ? "Cerrar" : "Cancelar"}</button>
            {!isView && <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>}
          </div>
        </div>

      </div>
    </div>
  );
}
