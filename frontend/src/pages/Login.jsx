import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../services/authService";
import { Mail, Lock, Eye, EyeOff, Leaf, ChevronRight, AlertTriangle } from "lucide-react";
import "./Auth.css";

const Login = () => {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const newErrors = {};
    if (!email.trim()) newErrors.email = "El correo es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Formato de correo inválido";
    if (!password) newErrors.password = "La contraseña es obligatoria";
    else if (password.length < 6) newErrors.password = "Mínimo 6 caracteres";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.tipo === "empleado") {
        navigate("/admin");
      } else {
        navigate("/cliente");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

      {/* Panel izquierdo */}
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
            El sabor auténtico del plátano, directo desde el campo hasta tu mesa.
          </p>
          <div className="auth-left-divider" />
          <div className="auth-left-pills">
            <span className="auth-left-pill">🍌 100% Natural</span>
            <span className="auth-left-pill">🚚 Entrega rápida</span>
            <span className="auth-left-pill">✨ Calidad premium</span>
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="auth-panel-right">
        <div className="auth-form-box">

          <h2 className="auth-form-title">Bienvenido de vuelta</h2>
          <p className="auth-form-subtitle">Inicia sesión para continuar</p>

          {error && (
            <div className="auth-error">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">

            <div className="auth-field">
              <label className="auth-label">
                <Mail size={11} /> Correo electrónico
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Mail size={15} /></span>
                <input
                  type="email"
                  required
                  placeholder="tu@correo.com"
                  className="auth-input"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    setError("");
                    let err = "";
                    if (!val.trim()) err = "El correo es obligatorio";
                    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) err = "Formato de correo inválido";
                    setErrors(p => ({ ...p, email: err }));
                  }}
                />
              </div>
              {errors.email && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{errors.email}</p>}
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label">
                  <Lock size={11} /> Contraseña
                </label>
                <Link to="/recuperar" className="auth-forgot">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={15} /></span>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="auth-input"
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPassword(val);
                    setError("");
                    let err = "";
                    if (!val) err = "La contraseña es obligatoria";
                    else if (val.length < 6) err = "Mínimo 6 caracteres";
                    setErrors(p => ({ ...p, password: err }));
                  }}
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>{errors.password}</p>}
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  Iniciar sesión
                  <span className="auth-arrow"><ChevronRight size={18} /></span>
                </>
              )}
            </button>

          </form>

          <p className="auth-switch">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="auth-switch-link">Regístrate gratis</Link>
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

export default Login;
