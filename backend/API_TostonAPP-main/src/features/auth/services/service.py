from sqlalchemy.orm import Session
from fastapi import HTTPException
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Dict, Any
import requests as _requests
import random
import uuid
import os
import time
from collections import defaultdict
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from src.shared.services.models import (
    Usuario, Rol, Permiso, RolXPermiso, VerificacionEmail, CodigoReset,
    Venta, Devolucion, Domicilio
)

load_dotenv()

SECRET_KEY   = os.getenv("SECRET_KEY")
ALGORITHM    = os.getenv("ALGORITHM", "HS256")
# 30 días por defecto: la app móvil mantiene la sesión iniciada hasta que el
# usuario presione "cerrar sesión" (se puede ajustar con la variable de entorno).
EXPIRE_MIN   = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))  # 7 días
API_URL      = os.getenv("API_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

RESET_TOKEN_EXPIRE_MIN = 10
CODE_EXPIRE_MIN        = 10

# Proveedores de email — prioridad: Gmail API > Brevo > Resend HTTP
GMAIL_USER          = os.getenv("GMAIL_USER", "bromsapp@outlook.com").strip()
GMAIL_CLIENT_ID     = os.getenv("GMAIL_CLIENT_ID", "").strip()
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET", "").strip()
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN", "").strip()
BREVO_API_KEY       = os.getenv("BREVO_API_KEY", "").strip()
RESEND_API_KEY      = os.getenv("RESEND_API_KEY", "").strip()

# Rate limiting de login: { correo_lower: [timestamps de intentos fallidos] }
_intentos_login: Dict[str, list] = defaultdict(list)
_VENTANA_LOGIN  = 300   # 5 minutos en segundos
_MAX_INTENTOS   = 5

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─────────────────────────────────────────
# UTILIDADES
# ─────────────────────────────────────────

def verificar_contrasena(contrasena_plana: str, contrasena_hash: str) -> bool:
    return pwd_context.verify(contrasena_plana, contrasena_hash)


def hashear_contrasena(contrasena: str) -> str:
    return pwd_context.hash(contrasena)


def crear_token(data: dict) -> str:
    payload = data.copy()
    payload.update({"exp": datetime.utcnow() + timedelta(minutes=EXPIRE_MIN)})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def crear_reset_token(correo: str) -> str:
    payload = {
        "correo": correo,
        "tipo":   "reset",
        "exp":    datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MIN),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def validar_reset_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise ValueError("Token inválido o expirado")

    if payload.get("tipo") != "reset":
        raise ValueError("El token proporcionado no es un token de recuperación")

    correo = payload.get("correo")
    if not correo:
        raise ValueError("Token malformado")

    return correo


# ─────────────────────────────────────────
# BÚSQUEDA Y AUTENTICACIÓN
# ─────────────────────────────────────────

def buscar_por_correo(db: Session, correo: str):
    """Busca por correo en la tabla Usuarios (tabla unificada)."""
    usuario = db.query(Usuario).filter(Usuario.Correo == correo).first()
    if usuario:
        tipo = "cliente" if usuario.ID_Rol == 3 else "empleado"
        return usuario, tipo
    return None, None


def obtener_nombre_rol(db: Session, id_rol: int) -> str:
    rol = db.query(Rol).filter(Rol.ID_Rol == id_rol).first()
    return rol.Rol if rol else None


def _verificar_limite_login(correo: str) -> None:
    """Bloquea el login si hay demasiados intentos fallidos recientes."""
    ahora    = time.time()
    clave    = correo.lower()
    recientes = [t for t in _intentos_login[clave] if ahora - t < _VENTANA_LOGIN]
    _intentos_login[clave] = recientes
    if len(recientes) >= _MAX_INTENTOS:
        minutos = _VENTANA_LOGIN // 60
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos fallidos. Espera {minutos} minutos antes de intentar de nuevo.",
        )


def autenticar(db: Session, correo: str, contrasena: str):
    clave = correo.lower()
    _verificar_limite_login(clave)

    registro, tipo = buscar_por_correo(db, correo)

    if not registro or not verificar_contrasena(contrasena, registro.Contrasena):
        _intentos_login[clave].append(time.time())
        return None, None

    # Cuenta desactivada por admin (Estado=2) o eliminada por el usuario (Estado=0).
    if getattr(registro, "Estado", 1) in (0, 2):
        raise HTTPException(
            status_code=403,
            detail="Tu cuenta no está activa. Contacta al administrador.",
        )

    # Los CLIENTES deben verificar su correo antes de poder iniciar sesión. Los
    # clientes que ya existían fueron marcados como verificados en la migración,
    # así que esto solo afecta a los registros nuevos (Correo_Verificado=0).
    if tipo == "cliente" and getattr(registro, "Correo_Verificado", 1) != 1:
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu correo electrónico antes de iniciar sesión. "
                   "Revisa tu bandeja de entrada (y la carpeta de spam).",
        )

    # Login exitoso: limpia el historial de intentos
    _intentos_login[clave] = []
    return registro, tipo


# ─────────────────────────────────────────
# REGISTRO
# ─────────────────────────────────────────

def registrar_cliente(db: Session, datos):
    """
    Crea un nuevo usuario (cliente) ACTIVO (Estado=1) para que pueda usar la
    cuenta de inmediato (crear pedidos, ver su panel) sin esperar la verificación
    de correo. Igualmente se le envía el email de verificación si hay proveedor
    configurado, pero ya no bloquea el acceso.
    Asigna el rol Cliente directamente en la columna ID_Rol.
    Devuelve el Usuario creado para que el router pueda iniciar la sesión.
    """
    if buscar_por_correo(db, datos.Correo)[0]:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    rol_cliente = db.query(Rol).filter(Rol.Rol == "Cliente").first()
    if not rol_cliente:
        raise HTTPException(status_code=500, detail="Rol Cliente no encontrado en el sistema")

    nuevo = Usuario(
        Nombre         = datos.Nombre,
        Apellidos      = datos.Apellidos,
        Correo         = datos.Correo,
        Contrasena     = hashear_contrasena(datos.Contrasena),
        Fecha_creacion = datetime.now(),
        Estado            = 1,  # activo de inmediato: el cliente puede usar la cuenta
        Correo_Verificado = 0,  # debe verificar el correo para recuperar contraseña
        ID_Rol         = rol_cliente.ID_Rol,
        Cedula         = None,
        Tipo_Documento = None,
        Direccion      = None,
        Municipio      = None,
        Departamento   = None,
        Telefono       = None,
    )
    db.add(nuevo)
    db.flush()

    token = str(uuid.uuid4())
    db.add(VerificacionEmail(
        ID_Usuario = nuevo.ID_Usuario,
        Token      = token,
        Expira_En  = datetime.utcnow() + timedelta(hours=24),
        Usado      = False,
    ))

    if GMAIL_CLIENT_ID or BREVO_API_KEY or RESEND_API_KEY:
        try:
            _enviar_email_verificacion(datos.Correo, token, datos.Nombre)
        except Exception:
            pass  # el correo es informativo; la cuenta ya está activa

    db.commit()
    db.refresh(nuevo)
    return nuevo


# ─────────────────────────────────────────
# ENVÍO DE EMAIL (Gmail > Resend SMTP > Resend HTTP)
# ─────────────────────────────────────────

def _enviar_smtp(msg: MIMEMultipart, correo_destino: str) -> None:
    """Envía usando Gmail API (preferido) > Brevo HTTP > Resend HTTP."""
    html_part = next(
        (p.get_payload(decode=True).decode() for p in msg.walk()
         if p.get_content_type() == "text/html"), ""
    )
    subject = msg.get("Subject", "")

    if GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN:
        _send_via_gmail_api(correo_destino, subject, html_part)
    elif BREVO_API_KEY:
        resp = _requests.post(
            "https://api.brevo.com/v3/smtp/email",
            json={
                "sender":      {"name": "TostonApp", "email": GMAIL_USER},
                "to":          [{"email": correo_destino}],
                "subject":     subject,
                "htmlContent": html_part,
            },
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            timeout=12,
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Brevo error {resp.status_code}: {resp.text}")
    elif RESEND_API_KEY:
        resp = _requests.post(
            "https://api.resend.com/emails",
            json    = {"from": "Brom's <onboarding@resend.dev>", "to": [correo_destino],
                       "subject": subject, "html": html_part},
            headers = {"Authorization": f"Bearer {RESEND_API_KEY}"},
            timeout = 12,
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Resend error {resp.status_code}: {resp.text}")
    else:
        raise RuntimeError("Sin proveedor de email. Configura GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET y GMAIL_REFRESH_TOKEN en Render.")


def _send_via_gmail_api(to: str, subject: str, html: str) -> None:
    """Envía email usando la API oficial de Gmail con OAuth2."""
    import base64
    from email.message import EmailMessage as StdEmailMessage
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = Credentials(
        token         = None,
        refresh_token = GMAIL_REFRESH_TOKEN,
        client_id     = GMAIL_CLIENT_ID,
        client_secret = GMAIL_CLIENT_SECRET,
        token_uri     = "https://oauth2.googleapis.com/token",
        scopes        = ["https://www.googleapis.com/auth/gmail.send"],
    )
    creds.refresh(Request())

    em = StdEmailMessage()
    em["To"]      = to
    em["From"]    = f"TostonApp <{GMAIL_USER}>"
    em["Subject"] = subject
    em.set_content(html, subtype="html")

    service = build("gmail", "v1", credentials=creds)
    encoded = base64.urlsafe_b64encode(em.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": encoded}).execute()


# ─────────────────────────────────────────
# VERIFICACIÓN DE EMAIL
# ─────────────────────────────────────────

def _enviar_email_verificacion(correo_destino: str, token: str, nombre: str = "", endpoint: str = "verificar-email") -> None:
    link   = f"{API_URL}/api/auth/{endpoint}?token={token}"
    saludo = f"Hola <strong>{nombre}</strong>," if nombre else "Hola,"
    html   = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#2E7D32,#66BB6A);padding:24px;border-radius:14px;text-align:center;margin-bottom:24px;">
        <h1 style="color:white;margin:0;font-size:22px;">Brom's</h1>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Verificacion de correo</p>
      </div>
      <p style="color:#333;">{saludo}</p>
      <p style="color:#555;font-size:14px;">Gracias por registrarte. Haz clic en el boton para activar tu cuenta:</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{link}" style="background:#2E7D32;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:bold;display:inline-block;">
          Verificar mi correo
        </a>
      </div>
      <p style="color:#999;font-size:12px;">El enlace es valido por 24 horas. Si no creaste esta cuenta, ignora este correo.</p>
    </div>
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verifica tu correo — Brom's"
    msg.attach(MIMEText(html, "html"))
    _enviar_smtp(msg, correo_destino)


def crear_token_verificacion_empleado(id_usuario: int) -> str:
    """Genera un JWT para verificar el email de un usuario empleado (válido 24 h)."""
    payload = {
        "id_usuario": id_usuario,
        "tipo":       "verificar_empleado",
        "exp":        datetime.utcnow() + timedelta(hours=24),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verificar_token_empleado(db: Session, token: str) -> str:
    """Valida el JWT y activa al usuario (Estado=1). Retorna URL de redirect."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise ValueError("Token inválido o expirado")

    if payload.get("tipo") != "verificar_empleado":
        raise ValueError("Token inválido")

    id_usuario = payload.get("id_usuario")
    usuario = db.query(Usuario).filter(Usuario.ID_Usuario == id_usuario).first()
    if not usuario:
        raise ValueError("Usuario no encontrado")
    usuario.Estado            = 1
    usuario.Correo_Verificado = 1
    db.commit()
    return f"{FRONTEND_URL}/login?verificado=1"


def verificar_email_token(db: Session, token: str) -> str:
    """
    Valida el token UUID de verificación.
    Si es válido → activa el usuario (Estado=1) y marca el token como Usado.
    Retorna la URL del frontend para el redirect.
    """
    verificacion = db.query(VerificacionEmail).filter(VerificacionEmail.Token == token).first()

    if not verificacion:
        raise ValueError("Token de verificación inválido o inexistente.")

    if verificacion.Usado:
        raise ValueError("Este enlace ya fue utilizado.")

    if datetime.utcnow() > verificacion.Expira_En:
        raise ValueError("El enlace de verificación ha expirado. Solicita uno nuevo.")

    usuario = db.query(Usuario).filter(Usuario.ID_Usuario == verificacion.ID_Usuario).first()
    if not usuario:
        raise ValueError("El usuario asociado al token no existe.")

    usuario.Estado            = 1
    usuario.Correo_Verificado = 1
    verificacion.Usado        = True
    db.commit()

    return f"{FRONTEND_URL}/login?verificado=1"


def reenviar_verificacion(db: Session, correo: str) -> None:
    """
    Invalida tokens anteriores del correo, genera uno nuevo y lo envía.
    No revela si el correo existe o no para evitar enumeración.
    """
    usuario = db.query(Usuario).filter(Usuario.Correo == correo).first()
    if not usuario or getattr(usuario, "Correo_Verificado", 0) == 1:
        return  # no existe o ya está verificado

    # Invalidar tokens previos
    db.query(VerificacionEmail).filter(
        VerificacionEmail.ID_Usuario == usuario.ID_Usuario,
        VerificacionEmail.Usado      == False,
    ).update({"Usado": True})

    token = str(uuid.uuid4())
    db.add(VerificacionEmail(
        ID_Usuario = usuario.ID_Usuario,
        Token      = token,
        Expira_En  = datetime.utcnow() + timedelta(hours=24),
        Usado      = False,
    ))
    db.commit()

    nombre = usuario.Nombre or ""
    try:
        _enviar_email_verificacion(correo, token, nombre)
    except Exception:
        pass  # no revelar el error, el token ya fue generado


# ─────────────────────────────────────────
# RECUPERACIÓN DE CONTRASEÑA
# ─────────────────────────────────────────

def _enviar_email_codigo(correo_destino: str, codigo: str, nombre: str = "") -> None:
    saludo = f"Hola <strong>{nombre}</strong>," if nombre else "Hola,"
    html   = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#2E7D32,#66BB6A);padding:24px;border-radius:14px;text-align:center;margin-bottom:24px;">
        <h1 style="color:white;margin:0;font-size:22px;">Brom's</h1>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Recuperacion de contrasena</p>
      </div>
      <p style="color:#333;">{saludo}</p>
      <p style="color:#555;font-size:14px;">Recibimos una solicitud para restablecer tu contrasena. Ingresa el siguiente codigo:</p>
      <div style="background:#f5f9f5;border:2px solid #C8E6C9;border-radius:14px;padding:28px;text-align:center;margin:24px 0;">
        <div style="font-size:42px;font-weight:bold;letter-spacing:14px;color:#2E7D32;font-family:monospace;">{codigo}</div>
        <p style="color:#888;margin:10px 0 0;font-size:12px;">Valido por {CODE_EXPIRE_MIN} minutos</p>
      </div>
      <p style="color:#999;font-size:12px;">Si no solicitaste esto, ignora este correo. Tu contrasena no sera modificada.</p>
    </div>
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Codigo de recuperacion — Brom's"
    msg.attach(MIMEText(html, "html"))
    _enviar_smtp(msg, correo_destino)


def solicitar_recuperacion(db: Session, correo: str) -> None:
    """
    Genera un código de 6 dígitos, lo guarda en BD con expiración de 10 minutos
    y lo envía al correo. Silencioso si el correo no existe.
    """
    registro, _ = buscar_por_correo(db, correo)
    if not registro:
        raise HTTPException(
            status_code=404,
            detail="Correo no registrado.",
        )

    # No permitir recuperar contraseña si el correo no fue verificado.
    if getattr(registro, "Correo_Verificado", 1) != 1:
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu correo electrónico antes de recuperar la contraseña. "
                   "Revisa tu bandeja de entrada o solicita un nuevo enlace de verificación.",
        )

    # Invalidar códigos anteriores del mismo correo
    db.query(CodigoReset).filter(
        CodigoReset.Correo == correo.lower(),
        CodigoReset.Usado  == False,
    ).update({"Usado": True})

    codigo = str(random.randint(100000, 999999))
    db.add(CodigoReset(
        Correo    = correo.lower(),
        Codigo    = codigo,
        Expira_En = datetime.utcnow() + timedelta(minutes=CODE_EXPIRE_MIN),
        Usado     = False,
    ))
    db.commit()

    nombre = getattr(registro, "Nombre", "") or ""
    try:
        _enviar_email_codigo(correo, codigo, nombre)
    except Exception as e:
        import logging
        logging.error(f"[recuperacion] fallo al enviar email a {correo}: {e}")
        raise HTTPException(
            status_code=503,
            detail="No se pudo enviar el correo de recuperación. Intenta de nuevo más tarde.",
        )
    


def verificar_codigo_recuperacion(db: Session, correo: str, codigo: str) -> str:
    """Valida el código desde BD. Si es correcto lo marca como usado y retorna JWT reset."""
    entrada = (
        db.query(CodigoReset)
        .filter(
            CodigoReset.Correo == correo.lower(),
            CodigoReset.Usado  == False,
        )
        .order_by(CodigoReset.Expira_En.desc())
        .first()
    )

    if not entrada:
        raise ValueError("No hay una solicitud activa para este correo. Solicita un nuevo codigo.")

    if datetime.utcnow() > entrada.Expira_En:
        entrada.Usado = True
        db.commit()
        raise ValueError("El codigo ha expirado. Solicita uno nuevo.")

    if entrada.Codigo != codigo.strip():
        raise ValueError("Codigo incorrecto. Verifica e intenta de nuevo.")

    entrada.Usado = True
    db.commit()

    return crear_reset_token(correo)


def resetear_contrasena(db: Session, token: str, nueva_contrasena: str) -> None:
    correo = validar_reset_token(token)

    registro, _ = buscar_por_correo(db, correo)
    if not registro:
        raise ValueError("El correo asociado al token no existe en el sistema")

    registro.Contrasena = hashear_contrasena(nueva_contrasena)
    db.commit()


# ─────────────────────────────────────────
# CAMBIO DE CONTRASEÑA AUTENTICADO
# ─────────────────────────────────────────

def eliminar_mi_cuenta(db: Session, actual: dict) -> dict:
    """
    Permite a cualquier usuario eliminar su propia cuenta, EXCEPTO el administrador.
    Intenta un borrado físico; si hay registros dependientes (ventas, devoluciones,
    domicilios) que lo impiden, hace un "borrado lógico": libera el correo y
    desactiva la cuenta (Estado=0) para que no se pueda volver a iniciar sesión.
    Siempre tiene éxito (salvo para el admin).
    """
    registro = actual["registro"]

    if getattr(registro, "ID_Rol", None) == 1:
        raise HTTPException(
            status_code=403,
            detail="El administrador no puede eliminar su propia cuenta.",
        )

    id_u   = registro.ID_Usuario
    correo = registro.Correo

    # 1) Limpia tokens asociados (no son registros de negocio)
    try:
        db.query(VerificacionEmail).filter(VerificacionEmail.ID_Usuario == id_u).delete()
        if correo:
            db.query(CodigoReset).filter(CodigoReset.Correo == correo.lower()).delete()
        db.commit()
    except Exception:
        db.rollback()

    # 2) ¿Tiene registros de negocio que impidan el borrado físico?
    tiene_dependencias = False
    try:
        if db.query(Venta).filter(Venta.ID_Usuario == id_u).count() > 0:
            tiene_dependencias = True
        elif db.query(Devolucion).filter(Devolucion.ID_Usuario == id_u).count() > 0:
            tiene_dependencias = True
        elif db.query(Domicilio).filter(Domicilio.ID_Empleado == id_u).count() > 0:
            tiene_dependencias = True
    except Exception:
        db.rollback()
        tiene_dependencias = True  # ante la duda, no intentar borrado físico

    # 3) Sin dependencias → borrado físico real (libera el correo de la BD)
    if not tiene_dependencias:
        try:
            obj = db.query(Usuario).filter(Usuario.ID_Usuario == id_u).first()
            if obj:
                db.delete(obj)
                db.commit()
            return {"mensaje": "Tu cuenta fue eliminada correctamente."}
        except Exception:
            db.rollback()

    # 4) Con dependencias → borrado lógico: anonimiza, libera el correo y desactiva.
    #    El correo original queda libre para volver a registrarse y el login con ese
    #    correo dará "credenciales incorrectas" (ya no existe esa cuenta).
    obj = db.query(Usuario).filter(Usuario.ID_Usuario == id_u).first()
    if obj:
        obj.Correo            = f"eliminado+{id_u}@cuenta.local"
        obj.Estado            = 0
        obj.Correo_Verificado = 0
        obj.Contrasena        = hashear_contrasena(uuid.uuid4().hex)
        db.commit()
    return {"mensaje": "Tu cuenta fue eliminada correctamente."}


def cambiar_contrasena(db: Session, actual: dict, contrasena_actual: str, nueva_contrasena: str) -> None:
    """
    Cambia la contraseña de un usuario o empleado autenticado.
    Valida que la contraseña actual sea correcta antes de actualizar.
    Funciona para tipo 'usuario' y tipo 'empleado'.
    """
    registro = actual["registro"]

    if getattr(registro, "Correo_Verificado", 1) != 1:
        raise ValueError(
            "Debes verificar tu correo electrónico antes de cambiar la contraseña."
        )

    if not verificar_contrasena(contrasena_actual, registro.Contrasena):
        raise ValueError("La contraseña actual es incorrecta")

    registro.Contrasena = hashear_contrasena(nueva_contrasena)
    db.commit()


# ─────────────────────────────────────────
# FOTO DE PERFIL (Cloudinary)
# ─────────────────────────────────────────

def serializar_foto(url: str | None) -> str | None:
    """Retorna la URL de Cloudinary tal cual (ya no hay base64)."""
    return url or None


def actualizar_foto_perfil(db: Session, actual: dict, url: str) -> str:
    """
    Guarda la URL de Cloudinary en Foto_perfil del usuario o empleado.
    El frontend sube la imagen a Cloudinary y envía solo la URL resultante.
    """
    registro = actual["registro"]
    registro.Foto_perfil = url
    db.commit()
    db.refresh(registro)
    return registro.Foto_perfil


def eliminar_foto_perfil(db: Session, actual: dict) -> None:
    """Elimina la foto de perfil poniendo el campo en NULL."""
    registro = actual["registro"]
    registro.Foto_perfil = None
    db.commit()


# ─────────────────────────────────────────
# PERMISOS DEL USUARIO ACTUAL
# ─────────────────────────────────────────

def obtener_mis_permisos(db: Session, actual: dict) -> list[str]:
    """
    Retorna los nombres de permisos del usuario autenticado.
    Admin (ID_Rol=1) recibe todos los permisos existentes sin consultar Rol_x_Permiso.
    """
    registro = actual["registro"]
    id_rol   = getattr(registro, "ID_Rol", None)

    if not id_rol:
        return []
    if id_rol == 1:
        return [p.Permiso for p in db.query(Permiso).all()]

    return [
        p.Permiso
        for p in (
            db.query(Permiso)
            .join(RolXPermiso, RolXPermiso.ID_Permiso == Permiso.ID_Permiso)
            .filter(RolXPermiso.ID_Rol == id_rol)
            .all()
        )
    ]