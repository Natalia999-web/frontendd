from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from src.shared.services.database import get_db
from src.features.auth.services.dependencies import obtener_usuario_actual
from .schemas import (
    LoginInput, TokenResponse, RegistroInput, RegistroResponse,
    RecuperarContrasenaInput, RecuperarContrasenaResponse,
    VerificarCodigoInput, VerificarCodigoResponse,
    ResetearContrasenaInput, ResetearContrasenaResponse,
    CambiarContrasenaInput, CambiarContrasenaResponse,
    PerfilUpdate, FotoUrlInput,
    ReenviarVerificacionInput, ReenviarVerificacionResponse,
)
from .service import (
    autenticar, crear_token, obtener_nombre_rol,
    registrar_cliente, solicitar_recuperacion,
    verificar_codigo_recuperacion, resetear_contrasena,
    cambiar_contrasena, actualizar_foto_perfil, eliminar_foto_perfil,
    obtener_mis_permisos, verificar_email_token, reenviar_verificacion,
    verificar_token_empleado, eliminar_mi_cuenta,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _formato_perfil(actual: dict) -> dict:
    registro = actual["registro"]
    return {
        "id":             registro.ID_Usuario,
        "Nombre":         registro.Nombre,
        "Apellidos":      registro.Apellidos,
        "Correo":         registro.Correo,
        "Cedula":         registro.Cedula,
        "Tipo_Documento": getattr(registro, "Tipo_Documento", None),
        "Telefono":       registro.Telefono,
        "Direccion":      registro.Direccion,
        "Municipio":      registro.Municipio,
        "Departamento":   registro.Departamento,
        "Indicaciones":   getattr(registro, "Indicaciones", None),
        "Foto_perfil":    registro.Foto_perfil,
        "Fecha_creacion": registro.Fecha_creacion,
        "Estado":         registro.Estado,
        "Correo_Verificado": getattr(registro, "Correo_Verificado", 1),
        "tipo":           actual["tipo"],
        "rol":            actual.get("rol"),
    }


# ─────────────────────────────────────────
# AUTH PÚBLICA
# ─────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(datos: LoginInput, db: Session = Depends(get_db)):
    registro, tipo = autenticar(db, datos.correo, datos.contrasena)
    if not registro:
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    id_campo   = registro.ID_Usuario
    nombre_rol = obtener_nombre_rol(db, registro.ID_Rol) if registro.ID_Rol else None

    token = crear_token({"id": id_campo, "tipo": tipo, "rol": nombre_rol})

    return TokenResponse(
        access_token = token,
        token_type   = "bearer",
        tipo         = tipo,
        cedula       = id_campo,
        nombre       = registro.Nombre,
        apellidos    = registro.Apellidos,
        rol          = nombre_rol,
        correo_verificado = getattr(registro, "Correo_Verificado", 1),
    )


@router.post("/registro", response_model=RegistroResponse, status_code=201)
def registro_cliente(datos: RegistroInput, db: Session = Depends(get_db)):
    nuevo      = registrar_cliente(db, datos)
    nombre_rol = obtener_nombre_rol(db, nuevo.ID_Rol) if nuevo.ID_Rol else None
    token      = crear_token({"id": nuevo.ID_Usuario, "tipo": "cliente", "rol": nombre_rol})

    return RegistroResponse(
        mensaje="Registro exitoso. Tu cuenta ya está activa.",
        access_token = token,
        token_type   = "bearer",
        tipo         = "cliente",
        cedula       = nuevo.ID_Usuario,
        nombre       = nuevo.Nombre,
        apellidos    = nuevo.Apellidos,
        rol          = nombre_rol,
        correo_verificado = getattr(nuevo, "Correo_Verificado", 0),
    )


@router.get("/verificar-empleado")
def verificar_empleado(token: str, db: Session = Depends(get_db)):
    try:
        redirect_url = verificar_token_empleado(db, token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RedirectResponse(url=redirect_url)


@router.get("/verificar-email")
def verificar_email(token: str, db: Session = Depends(get_db)):
    try:
        redirect_url = verificar_email_token(db, token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RedirectResponse(url=redirect_url)


@router.post("/reenviar-verificacion", response_model=ReenviarVerificacionResponse)
def reenviar_verificacion_endpoint(datos: ReenviarVerificacionInput, db: Session = Depends(get_db)):
    try:
        reenviar_verificacion(db, datos.correo)
    except Exception:
        pass  # no revelar nada
    return ReenviarVerificacionResponse(
        mensaje="Si el correo está registrado y pendiente de verificación, recibirás un nuevo enlace."
    )


@router.post("/recuperar-contrasena", response_model=RecuperarContrasenaResponse)
def recuperar_contrasena(datos: RecuperarContrasenaInput, db: Session = Depends(get_db)):
    solicitar_recuperacion(db, datos.correo)
    return {"mensaje": "Si el correo está registrado, recibirás un código de verificación."}


@router.post("/verificar-codigo", response_model=VerificarCodigoResponse)
def verificar_codigo(datos: VerificarCodigoInput, db: Session = Depends(get_db)):
    try:
        reset_token = verificar_codigo_recuperacion(db, datos.correo, datos.codigo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"reset_token": reset_token, "mensaje": "Código verificado correctamente"}


@router.post("/resetear-contrasena", response_model=ResetearContrasenaResponse)
def resetear_contrasena_endpoint(datos: ResetearContrasenaInput, db: Session = Depends(get_db)):
    try:
        resetear_contrasena(db, datos.token, datos.nueva_contrasena)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"mensaje": "Contraseña actualizada correctamente"}


# ─────────────────────────────────────────
# PERFIL (requiere token)
# ─────────────────────────────────────────

@router.get("/me")
def perfil_basico(actual: dict = Depends(obtener_usuario_actual)):
    registro = actual["registro"]
    return {
        "id":        registro.ID_Usuario,
        "nombre":    registro.Nombre,
        "apellidos": registro.Apellidos,
        "correo":    registro.Correo,
        "correo_verificado": getattr(registro, "Correo_Verificado", 1),
        "tipo":      actual["tipo"],
        "rol":       actual.get("rol"),
    }


@router.get("/perfil")
def perfil_completo(actual: dict = Depends(obtener_usuario_actual)):
    return _formato_perfil(actual)


@router.put("/perfil")
def actualizar_perfil(
    datos:  PerfilUpdate,
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    registro = actual["registro"]
    campos   = datos.model_dump(exclude_none=True)

    # Cedula y Tipo_Documento solo se pueden establecer si aún no tienen valor
    for campo_unico in ("Cedula", "Tipo_Documento"):
        if campo_unico in campos:
            valor_actual = getattr(registro, campo_unico, None)
            if valor_actual:          # ya tiene valor → ignorar
                del campos[campo_unico]

    for campo, valor in campos.items():
        setattr(registro, campo, valor)

    db.commit()
    db.refresh(registro)
    return _formato_perfil(actual)


@router.post("/cambiar-contrasena", response_model=CambiarContrasenaResponse)
def cambiar_password(
    datos:  CambiarContrasenaInput,
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    try:
        cambiar_contrasena(db, actual, datos.contrasena_actual, datos.nueva_contrasena)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"mensaje": "Contraseña actualizada correctamente"}


@router.delete("/mi-cuenta")
def eliminar_cuenta_propia(
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    """Elimina la cuenta del usuario autenticado (cualquier rol excepto admin)."""
    return eliminar_mi_cuenta(db, actual)


@router.post("/foto-perfil")
def subir_foto_perfil(
    datos:  FotoUrlInput,
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    url = actualizar_foto_perfil(db, actual, datos.url)
    return {"foto_perfil": url}


@router.delete("/foto-perfil")
def borrar_foto_perfil(
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    eliminar_foto_perfil(db, actual)
    return {"mensaje": "Foto de perfil eliminada"}


# ─────────────────────────────────────────
# PERMISOS
# ─────────────────────────────────────────

@router.get("/mis-permisos")
def mis_permisos(
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    return {"permisos": obtener_mis_permisos(db, actual)}


@router.delete("/mi-cuenta")
def eliminar_mi_cuenta(
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    registro = actual["registro"]
    if registro.ID_Rol != 3:
        raise HTTPException(
            status_code=403,
            detail="Solo los clientes pueden eliminar su propia cuenta desde aquí",
        )
    registro.Estado = 2
    db.commit()
    return {"mensaje": "Tu cuenta ha sido desactivada correctamente"}


# ─────────────────────────────────────────
# PUSH NOTIFICATIONS — FCM token
# ─────────────────────────────────────────

from typing import Optional

from pydantic import BaseModel as _BaseModel


class _FCMTokenInput(_BaseModel):
    token: str


class _FCMTokenBaja(_BaseModel):
    token: Optional[str] = None


@router.post("/fcm-token")
def registrar_token_fcm(
    datos:  _FCMTokenInput,
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    """Guarda el FCM device token del usuario en BD para enviar push notifications.

    El token pertenece al dispositivo: al asignarlo se desvincula de cualquier
    otra cuenta que lo tuviera registrado."""
    from src.shared.services.fcm_service import guardar_token_fcm
    guardar_token_fcm(actual["registro"].ID_Usuario, datos.token, db=db)
    return {"ok": True}


@router.delete("/fcm-token")
def desregistrar_token_fcm(
    datos:  Optional[_FCMTokenBaja] = None,
    db:     Session = Depends(get_db),
    actual: dict    = Depends(obtener_usuario_actual),
):
    """Desvincula el token de push del usuario autenticado (cierre de sesión).

    A partir de aquí el backend NO tiene a dónde enviar las notificaciones
    privadas de esta cuenta, así que el dispositivo deja de recibirlas aunque la
    app siga instalada o el borrado local del token falle."""
    from src.shared.services.fcm_service import eliminar_token_fcm
    eliminar_token_fcm(
        actual["registro"].ID_Usuario,
        datos.token if datos else None,
        db=db,
    )
    return {"ok": True}
