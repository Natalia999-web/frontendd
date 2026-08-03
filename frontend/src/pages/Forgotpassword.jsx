import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { recuperarContrasena, verificarCodigo, resetearContrasena } from "../services/authService";
import { Mail, Lock, Eye, EyeOff, Key, ChevronRight, CheckCircle, ArrowLeft, ShieldCheck, Leaf } from "lucide-react";
import "./Auth.css";

const COOLDOWN = 60; // segundos entre reenvíos

const ForgotPassword = () => {
  const [step, setStep]         = useState(1); // 1: Email | 2: Code | 3: Password | 4: Success
  const [email, setEmail]       = useState("");
  const [code, setCode]         = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [resending, setResending]   = useState(false);
  const [resendMsg, setResendMsg]   = useState("");   // mensaje de éxito del reenvío
  const [countdown, setCountdown]   = useState(0);   // segundos restantes
  const timerRef = useRef(null);

  // Limpia el intervalo al desmontar
  useEffect(() => () => clearInterval(timerRef.current), []);

  const startCountdown = () => {
    setCountdown(COOLDOWN);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await recuperarContrasena(email);
      setStep(2);
      startCountdown();
    } catch (err) {
      setError(err.message || "No encontramos una cuenta con ese correo.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setResendMsg("");
    setError("");
    try {
      await recuperarContrasena(email);
      setResendMsg("Código reenviado. Revisa tu correo.");
      setCode("");
      startCountdown();
    } catch (err) {
      setError(err.message || "No se pudo reenviar el código.");
    } finally {
      setResending(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) {
      setError("El código debe tener 6 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const data = await verificarCodigo(email, code);
      setResetToken(data.reset_token);
      setStep(3);
    } catch (err) {
      setError(err.message || "Código incorrecto o expirado.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await resetearContrasena(resetToken, password);
      setStep(4);
    } catch (err) {
      setError(err.message || "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Correo', 'Código', 'Contraseña', 'Listo'];
  const stepIcons  = [Mail, ShieldCheck, Lock, CheckCircle];

  const PanelIzquierdo = () => (
    <div className="auth-panel-left">
      <div className="auth-shape auth-shape--1" />
      <div className="auth-shape auth-shape--2" />
      <div className="auth-shape auth-shape--3" />
      <div className="auth-shape auth-shape--4" />
      <div className="auth-shape auth-shape--5" />
      <div className="auth-left-content">
        <div className="auth-left-logo">
          <Key size={28} color="white" />
        </div>
        <h1 className="auth-left-brand">Tostón App</h1>
        <p className="auth-left-tagline">
          Recupera el acceso a tu cuenta de forma rápida y segura.
        </p>
        <div className="auth-left-divider" />
        {/* Indicador de pasos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginTop: 8 }}>
          {stepLabels.map((label, i) => {
            const s = i + 1;
            const done   = step > s;
            const active = step === s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: done ? '#2e7d32' : active ? '#fff' : 'rgba(255,255,255,0.25)',
                    color: active ? '#2e7d32' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800,
                    border: active ? '2px solid #fff' : done ? '2px solid #2e7d32' : '2px solid rgba(255,255,255,0.4)',
                    transition: 'all 0.3s',
                  }}>
                    {done ? '✓' : s}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#fff' : 'rgba(255,255,255,0.55)', letterSpacing: 0.3 }}>
                    {label}
                  </span>
                </div>
                {s < 4 && (
                  <div style={{
                    width: 24, height: 2, marginBottom: 18,
                    background: done ? '#2e7d32' : 'rgba(255,255,255,0.25)',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <div className="auth-topbar-logo">
          <div className="auth-topbar-logo-icon"><Leaf size={16} color="#fff" /></div>
          Tostón App
        </div>
        <Link to="/login" className="auth-topbar-back">← Inicio de sesión</Link>
      </div>

      <div className="auth-card">
        <PanelIzquierdo />

        <div className="auth-panel-right">
          <div className="auth-form-box">

            {/* ── PASO 1: CORREO ── */}
            {step === 1 && (
              <>
                <h2 className="auth-form-title">Recuperar contraseña</h2>
                <p className="auth-form-subtitle">Ingresa tu correo para continuar</p>

                {error && <div className="auth-error"><span>⚠</span> {error}</div>}

                <form onSubmit={handleEmailSubmit} className="auth-form">
                  <div className="auth-field">
                    <label className="auth-label"><Mail size={11} /> Correo electrónico</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon"><Mail size={14} /></span>
                      <input type="email" required placeholder="tu@correo.com" className="auth-input"
                        value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                  </div>
                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading
                      ? <><span className="auth-spinner" /> Conectando…</>
                      : <>Verificar correo <span className="auth-arrow"><ChevronRight size={18} /></span></>}
                  </button>
                </form>
              </>
            )}

            {/* ── PASO 2: CÓDIGO ── */}
            {step === 2 && (
              <>
                <h2 className="auth-form-title">Código de seguridad</h2>
                <p className="auth-form-subtitle">Enviamos un código a <strong>{email}</strong></p>

                {error && <div className="auth-error"><span>⚠</span> {error}</div>}
                {resendMsg && (
                  <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 8, background: '#e8f5e9', border: '1px solid #a5d6a7', color: '#2e7d32', fontSize: 13, fontWeight: 600 }}>
                    ✓ {resendMsg}
                  </div>
                )}

                <form onSubmit={handleCodeSubmit} className="auth-form">
                  <div className="auth-field">
                    <label className="auth-label"><ShieldCheck size={11} /> Código de 6 dígitos</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon"><ShieldCheck size={14} /></span>
                      <input type="text" required maxLength={6} placeholder="123456" className="auth-input"
                        style={{ letterSpacing: '0.5em', textAlign: 'center', paddingLeft: 14 }}
                        value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setResendMsg(""); }} />
                    </div>
                  </div>
                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading
                      ? <span className="auth-spinner" />
                      : <>Validar código <span className="auth-arrow"><ChevronRight size={18} /></span></>}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 4 }}>
                    {countdown > 0
                      ? <p style={{ fontSize: 13, color: '#9e9e9e', margin: 0 }}>Puedes reenviar en <span style={{ fontWeight: 700, color: '#2e7d32' }}>{countdown}s</span></p>
                      : <button type="button" onClick={handleResend} disabled={resending} className="auth-forgot" style={{ fontWeight: 600 }}>
                          {resending ? 'Reenviando…' : '¿No recibiste el código? Reenviar'}
                        </button>
                    }
                  </div>
                  <button type="button" onClick={() => { setStep(1); setError(""); setResendMsg(""); setCode(""); }} className="auth-forgot" style={{ textAlign: 'center' }}>
                    Cambiar correo electrónico
                  </button>
                </form>
              </>
            )}

            {/* ── PASO 3: NUEVA CONTRASEÑA ── */}
            {step === 3 && (
              <>
                <h2 className="auth-form-title">Nueva contraseña</h2>
                <p className="auth-form-subtitle">Elige una contraseña segura</p>

                {error && <div className="auth-error"><span>⚠</span> {error}</div>}

                <form onSubmit={handlePasswordSubmit} className="auth-form">
                  <div className="auth-field">
                    <label className="auth-label"><Lock size={11} /> Nueva contraseña</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon"><Lock size={14} /></span>
                      <input type={showPass ? 'text' : 'password'} required placeholder="••••••••"
                        className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} />
                      <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {password && password.length < 8 && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✗ Mínimo 8 caracteres ({8 - password.length} restantes)
                      </p>
                    )}
                  </div>
                  <div className="auth-field">
                    <label className="auth-label"><Lock size={11} /> Confirmar contraseña</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon"><Lock size={14} /></span>
                      <input type={showConf ? 'text' : 'password'} required placeholder="••••••••"
                        className="auth-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                      <button type="button" className="auth-eye" onClick={() => setShowConf(v => !v)} tabIndex={-1}>
                        {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  {confirm && (
                    <p style={{ margin: '0', fontSize: 12, fontWeight: 700, color: password === confirm ? '#166534' : '#991b1b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {password === confirm ? <><CheckCircle size={12} /> Las contraseñas coinciden</> : '✗ Las contraseñas no coinciden'}
                    </p>
                  )}
                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading
                      ? <span className="auth-spinner" />
                      : <>Guardar contraseña <span className="auth-arrow"><ChevronRight size={18} /></span></>}
                  </button>
                </form>
              </>
            )}

            {/* ── PASO 4: ÉXITO ── */}
            {step === 4 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                <h2 className="auth-form-title" style={{ textAlign: 'center' }}>¡Contraseña actualizada!</h2>
                <p className="auth-form-subtitle" style={{ textAlign: 'center', marginBottom: 28 }}>
                  Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
                <Link to="/login" className="auth-submit" style={{ textDecoration: 'none' }}>
                  Ir a iniciar sesión <span className="auth-arrow"><ChevronRight size={18} /></span>
                </Link>
              </div>
            )}

            {step < 4 && (
              <p className="auth-switch">
                <Link to="/login" className="auth-switch-link">
                  <ArrowLeft size={14} style={{ marginRight: 4 }} />
                  Volver al inicio de sesión
                </Link>
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
