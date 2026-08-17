import { useState, useRef, useEffect } from 'react';
import { MUNICIPIOS_VALLE_ABURRA } from '../../../../utils/departamentosYCiudades';
import { Mail, Phone, MapPin, Camera, Save, X, CreditCard, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { apiFetch } from '../../../../utils/api';
import { soloDigitos, esUbicacionValida } from '../../../../utils/inputFilters';

const TIPO_DOC_OPTS = ['CC', 'CE', 'TI', 'NIT', 'PP'];

const inputBase = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px',
  background: 'var(--gray-100)',
  border: '1.5px solid transparent',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-body)',
  fontSize: 14, fontWeight: 500,
  color: 'var(--gray-900)', outline: 'none',
  transition: 'all .2s',
};
const disabledStyle = {
  ...inputBase,
  background: '#f5f5f5',
  color: '#9e9e9e',
  cursor: 'default',
  border: '1.5px solid #e0e0e0',
};

const focusOn  = e => { e.target.style.background = '#fff'; e.target.style.borderColor = 'var(--green-600)'; e.target.style.boxShadow = '0 0 0 4px rgba(42,157,71,.08)'; };
const focusOff = e => { e.target.style.background = 'var(--gray-100)'; e.target.style.borderColor = 'transparent'; e.target.style.boxShadow = 'none'; };

const Field = ({ label, icon: Icon, error, children, locked }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.05em', color: 'var(--gray-500)',
      fontFamily: 'var(--font-body)', marginBottom: 6,
    }}>
      {Icon && <Icon size={11} />} {label}
      {locked && <Lock size={9} style={{ marginLeft: 2, opacity: 0.5 }} />}
    </label>
    {children}
    {error && (
      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--accent-red)', fontFamily: 'var(--font-body)' }}>
        {error}
      </p>
    )}
  </div>
);

const LocationSelects = ({ municipio, onMunicipio }) => {
  const selStyle = { ...inputBase, cursor: 'pointer' };
  return (
    <Field label="Municipio (Valle de Aburrá)" icon={MapPin}>
      <select
        value={municipio || ''} onChange={e => onMunicipio(e.target.value)}
        style={selStyle} onFocus={focusOn} onBlur={focusOff}
      >
        <option value="">— Seleccionar —</option>
        {MUNICIPIOS_VALLE_ABURRA.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </Field>
  );
};

const ProfileForm = ({ user, onSave, onCancel }) => {
  const fileRef = useRef(null);
  const [errors,          setErrors]          = useState({});
  const [loadingPerfil,   setLoadingPerfil]   = useState(true);
  const [perfil,          setPerfil]          = useState(null);
  const [showPassSection, setShowPassSection] = useState(false);
  const [passForm,        setPassForm]        = useState({ nueva: '', confirmar: '', showNueva: false, showConf: false });

  const [form, setForm] = useState({
    telefono:      '',
    direccion:     '',
    municipio:     '',
    departamento:  '',
    fotoPerfil:    '',
    cedula:        '',
    tipo_documento: '',
  });

  // Cargar perfil completo desde la API al abrir el formulario
  useEffect(() => {
    setLoadingPerfil(true);
    apiFetch('/auth/perfil')
      .then(data => {
        setPerfil(data);
        setForm({
          telefono:       data.Telefono      || '',
          direccion:      data.Direccion     || '',
          municipio:      data.Municipio     || '',
          departamento:   data.Departamento  || '',
          fotoPerfil:     data.Foto_perfil   || '',
          cedula:         data.Cedula        || '',
          tipo_documento: data.Tipo_Documento || '',
        });
      })
      .catch(() => {
        // Fallback a datos del prop si la API falla
        setForm({
          telefono:      user.telefono      || user.Telefono      || '',
          direccion:     user.direccion     || user.Direccion     || '',
          municipio:     user.municipio     || user.Municipio     || '',
          departamento:  user.departamento  || user.Departamento  || '',
          fotoPerfil:    user.fotoPerfil    || user.Foto_perfil   || '',
          cedula:        user.cedula        || user.Cedula        || '',
          tipo_documento: user.tipo_documento || user.Tipo_Documento || '',
        });
      })
      .finally(() => setLoadingPerfil(false));
  }, []);

  const set = (k) => (e) => {
    let val = e.target.value;
    if (k === 'cedula') val = soloDigitos(val);
    if (k === 'telefono') val = soloDigitos(val, 10);
    const newForm = { ...form, [k]: val };
    setForm(newForm);
    setErrors(p => {
      const n = { ...p };
      if (k === 'telefono') {
        if (val.trim() && val.replace(/\D/g, '').length !== 10) n.telefono = 'El teléfono debe tener 10 dígitos';
        else delete n.telefono;
      }
      if (k === 'direccion') {
        if (val.trim() && !esUbicacionValida(val)) n.direccion = 'La dirección debe tener letras y números (mín. 5 caracteres)';
        else delete n.direccion;
      }
      if (k === 'tipo_documento') {
        if (!val && newForm.cedula.trim()) n.tipo_documento = 'Selecciona el tipo de documento';
        else delete n.tipo_documento;
      }
      if (k === 'cedula') {
        if (val.trim() && !newForm.tipo_documento) n.tipo_documento = 'Selecciona el tipo de documento';
        else delete n.tipo_documento;
      }
      return n;
    });
  };
  const setVal = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Imagen muy pesada. Máximo 5MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setForm(p => ({ ...p, fotoPerfil: reader.result }));
    reader.readAsDataURL(file);
  };

  const cedulaYaEstablecida = !!(perfil?.Cedula);

  const validate = () => {
    const e = {};
    if (form.telefono.trim() && form.telefono.replace(/\D/g, '').length !== 10)
      e.telefono = 'El teléfono debe tener 10 dígitos';

    if (form.direccion?.trim() && !esUbicacionValida(form.direccion))
      e.direccion = 'La dirección debe tener letras y números (mín. 5 caracteres)';

    if (!cedulaYaEstablecida && form.cedula.trim() && !form.tipo_documento)
      e.tipo_documento = 'Selecciona el tipo de documento';

    if (showPassSection && passForm.nueva) {
      if (passForm.nueva.length < 8)
        e.passNueva = 'La contraseña debe tener al menos 8 caracteres';
      else if (passForm.nueva !== passForm.confirmar)
        e.passNueva = 'Las contraseñas no coinciden';
    }
    if (showPassSection && !passForm.nueva && passForm.confirmar)
      e.passNueva = 'Escribe la nueva contraseña';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      Telefono:    form.telefono    || null,
      Direccion:   form.direccion   || null,
      Municipio:   form.municipio   || null,
      Departamento: form.departamento || null,
    };

    if (form.fotoPerfil?.startsWith('data:image/'))
      payload.Foto_perfil = form.fotoPerfil;

    if (showPassSection && passForm.nueva)
      payload.Contrasena = passForm.nueva;

    // Solo enviar cédula si no estaba establecida y el usuario la llenó
    if (!cedulaYaEstablecida && form.cedula.trim()) {
      payload.Cedula         = form.cedula.trim();
      payload.Tipo_Documento = form.tipo_documento || null;
    }

    onSave(payload);
  };

  const correoMostrar = perfil?.Correo || user?.Correo || user?.correo || '';
  const nombreMostrar = perfil
    ? `${perfil.Nombre || ''} ${perfil.Apellidos || ''}`.trim()
    : `${user?.nombre || user?.Nombre || ''} ${user?.apellidos || user?.Apellidos || ''}`.trim();

  if (loadingPerfil) return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)', fontFamily: 'var(--font-body)' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⌛</div>
      <p style={{ fontWeight: 600 }}>Cargando datos del perfil…</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>

      {/* Foto */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 88, height: 88, borderRadius: '50%',
              border: '3px dashed var(--green-400)',
              background: 'var(--green-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', cursor: 'pointer', fontSize: 36,
            }}
          >
            {form.fotoPerfil
              ? <img src={form.fotoPerfil} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '👤'
            }
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--green-800)', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <Camera size={13} color="white" />
          </button>
          <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
        </div>
      </div>

      {/* Nombre — solo lectura */}
      <Field label="Nombre completo" locked>
        <input value={nombreMostrar} readOnly style={disabledStyle} />
      </Field>

      {/* Correo — solo lectura, muestra el correo real */}
      <Field label="Correo electrónico" icon={Mail} locked>
        <input
          type="email"
          value={correoMostrar}
          readOnly
          style={disabledStyle}
          title="El correo no puede modificarse desde aquí"
          data-tooltip="El correo no puede modificarse desde aquí"
        />
      </Field>

      {/* Número de documento — editable solo primera vez */}
      <Field
        label={cedulaYaEstablecida ? "Número de documento" : "Número de documento (primera vez)"}
        icon={CreditCard}
        locked={cedulaYaEstablecida}
        error={errors.cedula}
      >
        {cedulaYaEstablecida ? (
          <input value={form.cedula} readOnly style={disabledStyle} title="El número de documento no puede modificarse una vez establecido" data-tooltip="El documento no puede modificarse una vez establecido" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginBottom: errors.tipo_documento ? 0 : 0 }}>
              <select
                value={form.tipo_documento}
                onChange={set('tipo_documento')}
                style={{ ...inputBase, cursor: 'pointer' }}
                onFocus={focusOn} onBlur={focusOff}
              >
                <option value="">Tipo</option>
                {TIPO_DOC_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="text"
                value={form.cedula}
                onChange={set('cedula')}
                placeholder="Ej: 1234567890"
                style={inputBase}
                onFocus={focusOn} onBlur={focusOff}
              />
            </div>
            {errors.tipo_documento && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--accent-red)' }}>{errors.tipo_documento}</p>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f57f17', fontWeight: 600 }}>
              ⚠️ Solo puedes establecerlo una vez. Verifica bien antes de guardar.
            </p>
          </>
        )}
      </Field>

      {/* Teléfono */}
      <Field label="Teléfono" icon={Phone} error={errors.telefono}>
        <input type="tel" value={form.telefono} onChange={set('telefono')}
          placeholder="300 123 4567" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
      </Field>

      {/* Dirección */}
      <Field label="Dirección" icon={MapPin} error={errors.direccion}>
        <input type="text" value={form.direccion} onChange={set('direccion')}
          placeholder="Calle 45 # 32-10" style={inputBase} onFocus={focusOn} onBlur={focusOff} />
      </Field>

      <LocationSelects
        municipio={form.municipio}
        onMunicipio={v => { setVal('municipio', v); setVal('departamento', 'Antioquia'); }}
      />

      {/* Cambio de contraseña */}
      <div style={{ marginBottom: 16, borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => { setShowPassSection(v => !v); setPassForm({ nueva: '', confirmar: '', showNueva: false, showConf: false }); setErrors(p => { const n = { ...p }; delete n.passNueva; return n; }); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 14px', border: 'none', cursor: 'pointer',
            background: showPassSection ? '#f0fdf4' : '#f8fafc',
            color: showPassSection ? 'var(--green-700)' : 'var(--gray-600)',
            fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <KeyRound size={13} /> {showPassSection ? 'Cancelar cambio de contraseña' : 'Cambiar contraseña'}
          </span>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{showPassSection ? '▲' : '▼'}</span>
        </button>

        {showPassSection && (
          <div style={{ padding: '12px 14px 4px', borderTop: '1px solid #e2e8f0', background: '#fafdf9' }}>
            <Field label="Nueva contraseña" icon={Lock} error={errors.passNueva}>
              <div style={{ position: 'relative' }}>
                <input
                  type={passForm.showNueva ? 'text' : 'password'}
                  value={passForm.nueva}
                  onChange={e => {
                    const val = e.target.value;
                    setPassForm(p => ({ ...p, nueva: val }));
                    setErrors(p => {
                      const n = { ...p };
                      if (val && val.length < 8) n.passNueva = 'La contraseña debe tener al menos 8 caracteres';
                      else if (val && passForm.confirmar && val !== passForm.confirmar) n.passNueva = 'Las contraseñas no coinciden';
                      else delete n.passNueva;
                      return n;
                    });
                  }}
                  placeholder="Mínimo 8 caracteres"
                  style={{ ...inputBase, paddingRight: 40 }}
                  onFocus={focusOn} onBlur={focusOff}
                />
                <button type="button" onClick={() => setPassForm(p => ({ ...p, showNueva: !p.showNueva }))}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', padding: 0 }}>
                  {passForm.showNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field label="Confirmar contraseña" icon={Lock}>
              <div style={{ position: 'relative' }}>
                <input
                  type={passForm.showConf ? 'text' : 'password'}
                  value={passForm.confirmar}
                  onChange={e => {
                    const val = e.target.value;
                    setPassForm(p => ({ ...p, confirmar: val }));
                    setErrors(p => {
                      const n = { ...p };
                      if (val && passForm.nueva && val !== passForm.nueva) n.passNueva = 'Las contraseñas no coinciden';
                      else if (!passForm.nueva || passForm.nueva.length >= 8) delete n.passNueva;
                      return n;
                    });
                  }}
                  placeholder="Repite la nueva contraseña"
                  style={{ ...inputBase, paddingRight: 40 }}
                  onFocus={focusOn} onBlur={focusOff}
                />
                <button type="button" onClick={() => setPassForm(p => ({ ...p, showConf: !p.showConf }))}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', padding: 0 }}>
                  {passForm.showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          </div>
        )}
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button type="button" className="btn-secondary" onClick={onCancel} style={{ flex: 1, justifyContent: 'center' }}>
          <X size={15} /> Cancelar
        </button>
        <button type="submit" className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
          <Save size={15} /> Guardar cambios
        </button>
      </div>
    </form>
  );
};

export default ProfileForm;
