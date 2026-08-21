import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_log = logging.getLogger(__name__)

# ── Auth ──
from src.features.auth.services.router import router as auth_router

# ── Configuración ──
from src.features.configuracion.usuarios.services.router           import router as usuarios_router
from src.features.configuracion.roles.services.router              import router as roles_router
from src.features.configuracion.notificaciones.services.router     import router as notificaciones_router
from src.features.configuracion.salidas.services.router            import router as salidas_router
from src.features.configuracion.control_acceso.services.router     import router as control_acceso_router

# ── Compras ──
from src.features.compras.insumos.services.router           import router as insumos_router
from src.features.compras.categoria_insumos.services.router import router as cat_insumos_router
from src.features.compras.proveedores.services.router       import router as proveedores_router
from src.features.compras.compras.services.router           import router as compras_router

# ── Producción ──
from src.features.produccion.productos.services.router           import router as productos_router
from src.features.produccion.categoria_productos.services.router import router as cat_productos_router
from src.features.produccion.ordenes_produccion.services.router  import router as ordenes_router

# ── Ventas ──
from src.features.ventas.clientes.services.router       import router as clientes_router
from src.features.ventas.pedidos.services.router        import router as pedidos_router
from src.features.ventas.gestion_ventas.services.router import router as ventas_router
from src.features.ventas.devoluciones.services.router   import router as devoluciones_router
from src.features.ventas.domicilios.services.router     import router as domicilios_router

# ── Dashboard ──
from src.features.dashboard.services.router import router as dashboard_router


app = FastAPI(
    title="API Proyecto",
    version="1.0.0",
    description="API para gestión de producción y ventas"
)


@app.on_event("startup")
def migrate_db():
    """Agrega columnas nuevas y tablas si no existen (migraciones manuales)."""
    from sqlalchemy import text
    from src.shared.services.database import engine
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE Orden_Produccion ADD COLUMN ID_Venta INT NULL",
            "ALTER TABLE Orden_Produccion MODIFY COLUMN ID_Insumo INT NULL",
            "ALTER TABLE Orden_Produccion MODIFY COLUMN ID_Ficha  INT NULL",
            "ALTER TABLE Ficha_Tecnica ADD COLUMN Dias_Vida_Util INT NULL",
            "ALTER TABLE Compras ADD COLUMN Fecha_Llegada DATETIME NULL",
            """CREATE TABLE IF NOT EXISTS Ficha_Tecnica_Insumo (
                ID_Ficha_Insumo INT AUTO_INCREMENT PRIMARY KEY,
                ID_Ficha        INT NOT NULL,
                ID_Insumo       INT NOT NULL,
                Cantidad        DECIMAL(10,2),
                Unidad          VARCHAR(50),
                FOREIGN KEY (ID_Ficha)  REFERENCES Ficha_Tecnica(ID_Ficha),
                FOREIGN KEY (ID_Insumo) REFERENCES Insumos(ID_Insumo)
            )""",
            "ALTER TABLE Productos ADD COLUMN Fecha_Creacion DATETIME NULL",
            "ALTER TABLE Compras ADD COLUMN Notas TEXT NULL",
            "ALTER TABLE Compras ADD COLUMN Costo_Transporte DECIMAL(30,2) NULL",
            "ALTER TABLE Compras ADD COLUMN IVA_Porcentaje DECIMAL(5,2) NULL",
            "ALTER TABLE Compras ADD COLUMN Descuento_Porcentaje DECIMAL(5,2) NULL",
            "ALTER TABLE Compras ADD COLUMN Otros_Costos DECIMAL(30,2) NULL",
            """INSERT IGNORE INTO Permisos (ID_Permiso, Permiso, Descripcion)
               VALUES (60, 'ver_landing_page', 'Ver la landing page desde el panel')""",
            """CREATE TABLE IF NOT EXISTS Lote_Producto (
                ID_Lote_Producto    INT AUTO_INCREMENT PRIMARY KEY,
                ID_Orden_Produccion INT,
                ID_Producto         INT,
                Numero_Lote         VARCHAR(50),
                Fecha_Produccion    DATETIME,
                Fecha_Vencimiento   DATETIME,
                Cantidad            INT,
                Estado              INT DEFAULT 1,
                FOREIGN KEY (ID_Orden_Produccion) REFERENCES Orden_Produccion(ID_Orden_Produccion),
                FOREIGN KEY (ID_Producto)         REFERENCES Productos(ID_Producto),
                FOREIGN KEY (Estado)              REFERENCES Estados(ID_Estados)
            )""",
            """CREATE TABLE IF NOT EXISTS Codigos_Reset (
                ID_Codigo INT AUTO_INCREMENT PRIMARY KEY,
                Correo    VARCHAR(255),
                Codigo    VARCHAR(6),
                Expira_En DATETIME,
                Usado     TINYINT(1) DEFAULT 0
            )""",
            "INSERT IGNORE INTO Estados (ID_Estados, Codigo, Estado) VALUES (10, 10, 'Asignado')",
            "ALTER TABLE Devoluciones ADD COLUMN Comprobante_Imagen LONGTEXT NULL",
            # Columna agregada al modelo Venta; sin esta migración todo SELECT a
            # Ventas falla con 500 (mis-ventas, crear-venta, etc.)
            "ALTER TABLE Ventas ADD COLUMN Fecha_entrega_esperada DATETIME NULL",
            # Activa los clientes que quedaron bloqueados en Estado=2 (verificación
            # de correo) antes de eliminar el bloqueo de registro. ID_Rol=3 = Cliente.
            "UPDATE Usuarios SET Estado = 1 WHERE Estado = 2 AND ID_Rol = 3",
            # Indicaciones de entrega del cliente (referencia/punto de entrega),
            # opcional. Se muestra y edita en "Mis datos".
            "ALTER TABLE Usuarios ADD COLUMN Indicaciones VARCHAR(255) NULL",
            # FCM tokens persistidos en BD para sobrevivir reinicios de Render
            "ALTER TABLE Usuarios ADD COLUMN FCM_Token VARCHAR(300) NULL",
            # OTP seguro para confirmar entrega de domicilios (reemplaza hash predecible)
            "ALTER TABLE Domicilios ADD COLUMN OTP VARCHAR(10) NULL",
            "ALTER TABLE Domicilios ADD COLUMN OTP_Expira DATETIME NULL",
            # Pedidos por encima del stock (preorden): marca, anticipo del 50%
            # exigido y anticipo efectivamente cubierto. Los calcula el backend.
            "ALTER TABLE Ventas ADD COLUMN Sobre_Stock TINYINT(1) NOT NULL DEFAULT 0",
            "ALTER TABLE Ventas ADD COLUMN Anticipo_Requerido DECIMAL(30,2) NULL",
            "ALTER TABLE Ventas ADD COLUMN Anticipo_Pagado DECIMAL(30,2) NULL",
            # Anticipo del 50% por total > $50.000 (regla general de negocio)
            "ALTER TABLE Ventas ADD COLUMN Requiere_Anticipo TINYINT(1) NOT NULL DEFAULT 0",
            "ALTER TABLE Ventas ADD COLUMN Anticipo_Monto DECIMAL(30,2) NULL",
            "ALTER TABLE Ventas ADD COLUMN Anticipo_Metodo_Pago VARCHAR(30) NULL",
            "ALTER TABLE Ventas ADD COLUMN Anticipo_Comprobante_Url VARCHAR(500) NULL",
            "ALTER TABLE Ventas ADD COLUMN Anticipo_Registrado TINYINT(1) NOT NULL DEFAULT 0",
            "ALTER TABLE Ventas ADD COLUMN Pago_Final_Registrado TINYINT(1) NOT NULL DEFAULT 0",
            "ALTER TABLE Ventas ADD COLUMN Estado_Pago VARCHAR(30) NULL DEFAULT 'pendiente'",
            # Unidades de cada línea que van por encima del stock (preorden)
            "ALTER TABLE Venta_x_Producto ADD COLUMN Cantidad_Preorden INT NOT NULL DEFAULT 0",
            # Chat de domicilios persistido en BD (antes se perdía en cada reinicio)
            """CREATE TABLE IF NOT EXISTS MensajesChat (
                ID_Mensaje       INT AUTO_INCREMENT PRIMARY KEY,
                ID_Domicilio     INT NOT NULL,
                Tipo_Remitente   VARCHAR(20),
                ID_Remitente     INT,
                Nombre_Remitente VARCHAR(100),
                Contenido        TEXT,
                Fecha            DATETIME,
                FOREIGN KEY (ID_Domicilio) REFERENCES Domicilios(ID_Domicilio)
            )""",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # ya existe

    # ── Pago_Final: columnas para registrar el cobro del saldo al entregar ──────
    # Se verifica columna a columna en information_schema antes de alterar;
    # así el ALTER siempre es válido y los errores reales se logean — no se silencian.
    _PAGO_FINAL_COLS = [
        ("Pago_Final_Monto",           "DECIMAL(30,2) NULL"),
        ("Pago_Final_Metodo_Pago",     "VARCHAR(30)   NULL"),
        ("Pago_Final_Comprobante_Url", "VARCHAR(500)  NULL"),
        ("Pago_Final_Fecha",           "DATETIME      NULL"),
    ]
    with engine.connect() as conn:
        faltan = []
        for col_name, col_def in _PAGO_FINAL_COLS:
            existe = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "  AND TABLE_NAME   = 'Ventas' "
                "  AND COLUMN_NAME  = :col"
            ), {"col": col_name}).scalar()
            if not existe:
                faltan.append(f"ADD COLUMN {col_name} {col_def}")
        if not faltan:
            _log.info("migración pago_final: ya aplicada, sin cambios")
        else:
            alter_sql = "ALTER TABLE Ventas\n  " + ",\n  ".join(faltan)
            try:
                conn.execute(text(alter_sql))
                conn.commit()
                _log.info("migración pago_final: %d columna(s) creada(s): %s",
                          len(faltan), [f.split()[2] for f in faltan])
            except Exception as exc:
                _log.error("migración pago_final FALLÓ — %s", exc, exc_info=True)
                raise

    # ── Necesita_Produccion: flag guardado al crear la venta (stock snapshot) ───
    # Evita que el cálculo dinámico de requiere_fecha_propuesta sea incorrecto
    # cuando el stock cambia después de que el pedido fue creado.
    with engine.connect() as conn:
        existe = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "  AND TABLE_NAME   = 'Ventas' "
            "  AND COLUMN_NAME  = 'Necesita_Produccion'"
        )).scalar()
        if not existe:
            try:
                conn.execute(text(
                    "ALTER TABLE Ventas ADD COLUMN Necesita_Produccion TINYINT(1) NOT NULL DEFAULT 0"
                ))
                conn.commit()
                _log.info("migración necesita_produccion: columna creada")
            except Exception as exc:
                _log.error("migración necesita_produccion FALLÓ — %s", exc, exc_info=True)
                raise
        else:
            _log.info("migración necesita_produccion: ya existe, sin cambios")

    # Migrar FK de Domicilios.ID_Empleado: Empleados → Usuarios
    # El código usa Usuarios.ID_Usuario pero la DB de producción aún apunta a Empleados
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE Domicilios DROP FOREIGN KEY Domicilios_ibfk_2"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text(
                "ALTER TABLE Domicilios ADD CONSTRAINT Domicilios_ibfk_2 "
                "FOREIGN KEY (ID_Empleado) REFERENCES Usuarios(ID_Usuario)"
            ))
            conn.commit()
        except Exception:
            pass

    # Correo_Verificado: columna separada de Estado para distinguir "verificó su
    # correo" de "cuenta activa". Se agrega con default 0; los usuarios que YA
    # existían (creados antes de esta función) se marcan como verificados=1 para
    # no bloquearles la recuperación de contraseña. Solo se hace el backfill la
    # primera vez (cuando el ALTER tiene éxito); en arranques posteriores el ALTER
    # falla porque la columna ya existe y se omite el UPDATE.
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE Usuarios ADD COLUMN Correo_Verificado TINYINT NOT NULL DEFAULT 0"))
            conn.commit()
            conn.execute(text("UPDATE Usuarios SET Correo_Verificado = 1"))
            conn.commit()
        except Exception:
            pass  # la columna ya existe; no re-hacer el backfill

    # Comprobante_Pago: LONGTEXT para soportar imágenes en base64
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE Ventas ADD COLUMN Comprobante_Pago LONGTEXT NULL"))
            conn.commit()
        except Exception:
            try:
                conn.rollback()
                conn.execute(text("ALTER TABLE Ventas MODIFY COLUMN Comprobante_Pago LONGTEXT NULL"))
                conn.commit()
            except Exception:
                pass

    # Ventas.Fecha_entrega: timestamp real de entrega (fuente para el plazo de
    # devoluciones de 36h, también en pedidos de recoger en tienda). No se
    # rellenan filas existentes: el cálculo usa Domicilios.Fecha_entrega para
    # pedidos con domicilio y hace fallback a Fecha_pedido para los antiguos.
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE Ventas ADD COLUMN Fecha_entrega DATETIME NULL"))
            conn.commit()
        except Exception:
            pass  # la columna ya existe

    # Corrección de lotes huérfanos: lotes con Estado=1 que pertenecen a compras Pendientes
    # (creados antes de que el flujo fuera corregido para usar Estado=3)
    with engine.connect() as conn:
        try:
            conn.execute(text("""
                UPDATE Lote_Compra lc
                JOIN Detalle_Compra dc ON dc.ID_Lote_Compra = lc.ID_Lote_Compra
                JOIN Compras c ON c.ID_Compra = dc.ID_Compra
                SET lc.Estado = 3
                WHERE lc.Estado = 1
                  AND c.Estado = 3
            """))
            conn.commit()
        except Exception:
            pass

    # ── Permisos del rol "Empleado" ───────────────────────────────────────────
    # El empleado puede CREAR y VER pedidos (con selección de cliente) y VER
    # devoluciones, pero NO confirmar/cancelar pedidos ni aprobar/rechazar
    # devoluciones (esas acciones requieren editar_ventas / editar_devoluciones).
    with engine.connect() as conn:
        # Otorgar permisos necesarios (idempotente)
        try:
            conn.execute(text("""
                INSERT IGNORE INTO Rol_x_Permiso (ID_Rol, ID_Permiso)
                SELECT r.ID_Rol, p.ID_Permiso
                FROM Roles r
                JOIN Permisos p
                  ON p.Permiso IN (
                       'ver_pedidos', 'ver_ventas', 'crear_ventas',
                       'ver_usuarios', 'ver_devoluciones'
                     )
                WHERE LOWER(TRIM(r.Rol)) = 'empleado'
            """))
            conn.commit()
        except Exception:
            pass
        # Revocar acciones que el empleado NO debe tener
        try:
            conn.execute(text("""
                DELETE rxp FROM Rol_x_Permiso rxp
                JOIN Roles r     ON r.ID_Rol     = rxp.ID_Rol
                JOIN Permisos p  ON p.ID_Permiso = rxp.ID_Permiso
                WHERE LOWER(TRIM(r.Rol)) = 'empleado'
                  AND p.Permiso IN ('editar_ventas', 'editar_devoluciones')
            """))
            conn.commit()
        except Exception:
            pass

# ── CORS — origins desde variable de entorno para no hardcodear URLs ──
_CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "https://frontend-ten-xi-31.vercel.app,"
        "https://frontend-git-main-isabela-s-projects1.vercel.app,"
        "https://tostonapp.vercel.app,"
        "http://localhost:5173",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Registro de routers ──
PREFIX = "/api"

app.include_router(auth_router,            prefix=PREFIX)
app.include_router(usuarios_router,        prefix=PREFIX)
app.include_router(roles_router,           prefix=PREFIX)
app.include_router(notificaciones_router,  prefix=PREFIX)
app.include_router(salidas_router,         prefix=PREFIX)
app.include_router(control_acceso_router,  prefix=PREFIX)

app.include_router(insumos_router,         prefix=PREFIX)
app.include_router(cat_insumos_router,     prefix=PREFIX)
app.include_router(proveedores_router,     prefix=PREFIX)
app.include_router(compras_router,         prefix=PREFIX)
app.include_router(productos_router,     prefix=PREFIX)
app.include_router(cat_productos_router, prefix=PREFIX)
app.include_router(ordenes_router,       prefix=PREFIX)
app.include_router(clientes_router,      prefix=PREFIX)
app.include_router(pedidos_router,       prefix=PREFIX)
app.include_router(ventas_router,        prefix=PREFIX)
app.include_router(devoluciones_router,  prefix=PREFIX)
app.include_router(domicilios_router,    prefix=PREFIX)
app.include_router(dashboard_router,     prefix=PREFIX)


@app.get("/")
def root():
    return {"mensaje": "API funcionando ✅"}

