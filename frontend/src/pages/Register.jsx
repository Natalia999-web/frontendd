import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { soloLetras } from '../utils/inputFilters';
import { User, Mail, Lock, Eye, EyeOff, Check, Leaf, ChevronRight, FileText } from 'lucide-react';
import { validatePassword } from '../features/configuracion/Usuarios/usuariosUtils.js';
import './Auth.css';

const TIPOS_DOC = ['CC', 'TI', 'CE', 'Pasaporte', 'NIT', 'PPT'];

const PASS_RULES = [
  { test: p => p.length >= 8,          label: 'Mínimo 8 caracteres' },
  { test: p => /[A-Z]/.test(p),        label: 'Al menos una mayúscula' },
  { test: p => /[a-z]/.test(p),        label: 'Al menos una minúscula' },
  { test: p => /\d/.test(p),           label: 'Al menos un número' },
  { test: p => /[^A-Za-z0-9]/.test(p), label: 'Al menos un carácter especial (!@#...)' },
];

function PasswordChecklist({ password }) {
  if (!password) return null;
  return (
    <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {PASS_RULES.map(({ test, label }) => {
        const ok = test(password);
        return (
          <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
            color: ok ? '#166534' : '#991b1b' }}>
            {ok ? '✓' : '✗'} {label}
          </li>
        );
      })}
    </ul>
  );
}

const Register = () => {
  const navigate = useNavigate();
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState({});
  const [showPass,     setShowPass]     = useState(false);
  const [showConf,     setShowConf]     = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [successEmail, setSuccessEmail] = useState('');

  const [form, setForm] = useState({
    Nombre:               '',
    Apellidos:            '',
    Tipo_documento:       'CC',
    Numero_documento:     '',
    Correo:               '',
    Contrasena:           '',
    Confirmar_contrasena: '',
  });

  const set = (k) => (e) => {
    let val = e.target.value;
    if (k === 'Nombre' || k === 'Apellidos') val = soloLetras(val);
    if (k === 'Numero_documento') val = val.replace(/\D/g, '');
    const newForm = { ...form, [k]: val };
    setForm(newForm);
    setErrors(p => {
      const n = { ...p };
      if (!val) { delete n[k]; return n; }
      if (k === 'Correo' && val.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) n[k] = 'Formato de correo inválido';
      else if (k === 'Confirmar_contrasena' && newForm.Contrasena && val !== newForm.Contrasena) n[k] = 'Las contraseñas no coinciden';
      else delete n[k];
      if (k === 'Contrasena' && newForm.Confirmar_contrasena) {
        if (val !== newForm.Confirmar_contrasena) n.Confirmar_contrasena = 'Las contraseñas no coinciden';
        else delete n.Confirmar_contrasena;
      }
      return n;
    });
  };

  const validate = () => {
    const e = {};
    if (!form.Nombre.trim())           e.Nombre           = 'El nombre es obligatorio';
    if (!form.Apellidos.trim())        e.Apellidos        = 'Los apellidos son obligatorios';
    if (!form.Numero_documento.trim()) e.Numero_documento = 'El número de documento es obligatorio';
    if (!form.Correo.trim())           e.Correo           = 'El correo es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Correo)) e.Correo = 'Formato de correo inválido';
    if (!form.Contrasena) {
      e.Contrasena = 'La contraseña es obligatoria';
    } else {
      const passErr = validatePassword(form.Contrasena);
      if (passErr) e.Contrasena = passErr;
    }
    if (form.Contrasena !== form.Confirmar_contrasena) e.Confirmar_contrasena = 'Las contraseñas no coinciden';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await apiFetch('/auth/registro', {
        method: 'POST',
        body: JSON.stringify({
          Nombre:               form.Nombre,
          Apellidos:            form.Apellidos,
          Tipo_documento:       form.Tipo_documento,
          Numero_documento:     form.Numero_documento,
          Correo:               form.Correo,
          Contrasena:           form.Contrasena,
          Confirmar_contrasena: form.Confirmar_contrasena,
        }),
        timeout: 75000,
      });
      setSuccessEmail(form.Correo);
      setSuccess(true);
    } catch (err) {
      setErrors({ global: err.message });
    } finally {
      setLoading(false);
    }
  };

  const PanelIzquierdo = () => (
    <div className="auth-panel-left">
      <div className="auth-shape auth-shape--1" />
      <div className="auth-shape auth-shape--2" />
      <div className="auth-shape auth-shape--3" />
      <div className="auth-shape auth-shape--4" />
      <div className="auth-shape auth-shape--5" />
      <div className="auth-left-content">
        <div className="auth-left-logo">
          <Leaf size={28} color="white" />
        </div>
        <h1 className="auth-left-brand">Tostón App</h1>
        <p className="auth-left-tagline">
          Únete a nuestra comunidad y descubre el verdadero sabor artesanal del plátano.
        </p>
        <div className="auth-left-divider" />
        <div className="auth-left-pills">
          <span className="auth-left-pill">🎁 Registro gratis</span>
          <span className="auth-left-pill">🍌 Productos únicos</span>
          <span className="auth-left-pill">⚡ Pedidos fáciles</span>
        </div>
      </div>
    </div>
  );

  if (success) {
    return (
      <div className="auth-page">
      <div className="auth-card">
        <PanelIzquierdo />
        <div className="auth-panel-right">
          <div className="auth-form-box" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
            <h2 className="auth-form-title" style={{ textAlign: 'center' }}>¡Cuenta creada!</h2>
            <p className="auth-form-subtitle" style={{ textAlign: 'center', marginBottom: 24 }}>
              Enviamos un enlace de verificación a:
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2e7d32', marginBottom: 12 }}>
              {successEmail}
            </p>
            <p style={{ fontSize: 13, color: '#90a4a1', marginBottom: 28, lineHeight: 1.6 }}>
              Haz clic en el enlace del correo para activar tu cuenta. El enlace expira en 24 horas.
            </p>
            <button className="auth-submit" onClick={() => navigate('/login')}>
              Ir al inicio de sesión <span className="auth-arrow"><ChevronRight size={18} /></span>
            </button>
          </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <div className="auth-topbar-logo">
          <div className="auth-topbar-logo-icon"><Leaf size={16} color="#fff" /></div>
          Tostón App
        </div>
        <Link to="/" className="auth-topbar-back">← Inicio</Link>
      </div>
    <div className="auth-card">
      <PanelIzquierdo />

      <div className="auth-panel-right">
        <div className="auth-form-box">

          <h2 className="auth-form-title">Crear cuenta</h2>
          <p className="auth-form-subtitle">Únete a la familia Tostón gratis</p>

          {errors.global && (
            <div className="auth-error">
              <span>⚠</span> {errors.global}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">

            {/* Nombre + Apellidos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="auth-field">
                <label className="auth-label"><User size={11} /> Nombre(s) <span className="required">*</span></label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><User size={15} /></span>
                  <input type="text" placeholder="Carlos" className="auth-input"
                    value={form.Nombre} onChange={set('Nombre')} />
                </div>
                {errors.Nombre && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{errors.Nombre}</p>}
              </div>

              <div className="auth-field">
                <label className="auth-label"><User size={11} /> Apellidos <span className="required">*</span></label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><User size={15} /></span>
                  <input type="text" placeholder="Pérez García" className="auth-input"
                    value={form.Apellidos} onChange={set('Apellidos')} />
                </div>
                {errors.Apellidos && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{errors.Apellidos}</p>}
              </div>
            </div>

            {/* Tipo y número de documento */}
            <div className="auth-field">
              <label className="auth-label"><FileText size={11} /> Tipo y número de documento <span className="required">*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className="auth-input"
                  style={{ width: 130, flexShrink: 0, cursor: 'pointer', paddingLeft: 10 }}
                  value={form.Tipo_documento}
                  onChange={set('Tipo_documento')}
                >
                  {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="auth-input-wrap" style={{ flex: 1 }}>
                  <span className="auth-input-icon"><FileText size={15} /></span>
                  <input
                    type="text"
                    placeholder="Número de documento"
                    className="auth-input"
                    value={form.Numero_documento}
                    onChange={set('Numero_documento')}
                    inputMode="numeric"
                  />
                </div>
              </div>
              {errors.Numero_documento && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{errors.Numero_documento}</p>}
            </div>

            {/* Correo */}
            <div className="auth-field">
              <label className="auth-label"><Mail size={11} /> Correo electrónico <span className="required">*</span></label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Mail size={15} /></span>
                <input type="email" placeholder="tu@correo.com" className="auth-input"
                  value={form.Correo} onChange={set('Correo')} />
              </div>
              {errors.Correo && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{errors.Correo}</p>}
            </div>

            {/* Contraseña */}
            <div className="auth-field">
              <label className="auth-label"><Lock size={11} /> Contraseña <span className="required">*</span></label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={15} /></span>
                <input type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
                  className="auth-input" value={form.Contrasena} onChange={set('Contrasena')} />
                <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {!form.Contrasena && errors.Contrasena && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{errors.Contrasena}</p>}
              <PasswordChecklist password={form.Contrasena} />
            </div>

            {/* Confirmar contraseña */}
            <div className="auth-field">
              <label className="auth-label"><Lock size={11} /> Confirmar contraseña <span className="required">*</span></label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={15} /></span>
                <input type={showConf ? 'text' : 'password'} placeholder="Repite tu contraseña"
                  className="auth-input" value={form.Confirmar_contrasena} onChange={set('Confirmar_contrasena')} />
                <button type="button" className="auth-eye" onClick={() => setShowConf(v => !v)} tabIndex={-1}>
                  {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.Confirmar_contrasena && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{errors.Confirmar_contrasena}</p>}
              {form.Confirmar_contrasena && (
                <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700,
                  color: form.Contrasena === form.Confirmar_contrasena ? '#166534' : '#991b1b',
                  display: 'flex', alignItems: 'center', gap: 4 }}>
                  {form.Contrasena === form.Confirmar_contrasena
                    ? <><Check size={12} /> Las contraseñas coinciden</>
                    : '✗ Las contraseñas no coinciden'}
                </p>
              )}
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading
                ? <span className="auth-spinner" />
                : <> Crear mi cuenta <span className="auth-arrow"><ChevronRight size={18} /></span> </>}
            </button>

          </form>

          <p className="auth-switch">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="auth-switch-link">Inicia sesión</Link>
          </p>
          <p className="auth-switch" style={{ marginTop: 6 }}>
            <Link to="/" className="auth-switch-link" style={{ opacity: 0.6, fontSize: '0.88em' }}>
              ← Volver al inicio
            </Link>
          </p>

        </div>
      </div>
    </div>
    </div>
  );
};

export default Register;
