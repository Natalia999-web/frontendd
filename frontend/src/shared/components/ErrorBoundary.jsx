import { Component } from "react";

/**
 * Red de seguridad para los errores de render.
 *
 * Cuando un componente lanza una excepción, React desmonta TODO el árbol y el
 * usuario se queda mirando una pantalla en blanco, sin saber qué pasó ni cómo
 * salir. Peor: el error solo existe en la consola del navegador, así que quien
 * reporta el problema no tiene nada que contar.
 *
 * Esto lo convierte en una pantalla que dice qué falló y deja volver.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Queda en la consola con el árbol de componentes, que es lo que hace
    // falta para ubicar el archivo culpable.
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        minHeight: "60vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24,
      }}>
        <div style={{
          maxWidth: 520, width: "100%", background: "#fff",
          border: "1.5px solid #ffcdd2", borderRadius: 16,
          padding: "28px 30px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
          <p style={{ margin: 0, fontSize: 34 }}>😕</p>
          <h2 style={{
            margin: "10px 0 6px", fontSize: 19, fontWeight: 800, color: "#c62828",
          }}>
            Algo se rompió en esta pantalla
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: "#616161", lineHeight: 1.5 }}>
            El pedido no se perdió. Volvé a intentar y, si sigue pasando,
            pasale este mensaje a quien mantiene la aplicación:
          </p>

          <pre style={{
            marginTop: 14, padding: "12px 14px", background: "#fafafa",
            border: "1px solid #eee", borderRadius: 10, fontSize: 11.5,
            color: "#c62828", whiteSpace: "pre-wrap", wordBreak: "break-word",
            maxHeight: 160, overflow: "auto",
          }}>
            {String(error?.message || error)}
          </pre>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                background: "#2e7d32", color: "#fff", fontFamily: "inherit",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 10,
                border: "1.5px solid #e0e0e0", background: "#fff",
                color: "#616161", fontFamily: "inherit", fontSize: 14,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
