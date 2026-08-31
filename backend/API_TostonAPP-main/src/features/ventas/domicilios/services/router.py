from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import unicodedata

from src.shared.services.database import get_db
from src.shared.services.models import Domicilio, Venta  # Venta para validar acceso de cliente al chat
from src.features.auth.services.dependencies import requiere_permiso, obtener_usuario_actual
from .schemas import (
    DomicilioCreate, DomicilioUpdate, DomicilioEstado,
    AsignarRepartidor, DomicilioResponse, DomicilioListResponse,
    OTPVerify, MensajeCreate, MensajeResponse, RegistroPagoEfectivo,
)
from .service import (
    obtener_domicilios, obtener_domicilio, crear_domicilio,
    editar_domicilio, asignar_repartidor, cambiar_estado,
    obtener_resumen_dia, verificar_otp, regenerar_otp, obtener_mensajes, enviar_mensaje,
    obtener_repartidores, registrar_pago_efectivo,
)

router = APIRouter(prefix="/domicilios", tags=["Domicilios"])


def _es_repartidor(actual: dict) -> bool:
    """¿Quien llama es de reparto?

    El rol de reparto no siempre es el ID 4: desde Configuración → Roles se
    puede crear otro ("Repartidor", "Domiciliario 2"…) y entonces todas las
    reglas de "solo lo suyo" dejaban de aplicarse en silencio. Se reconoce
    también por el nombre, igual que el panel web y la app móvil.
    """
    if getattr(actual["registro"], "ID_Rol", None) == 4:
        return True
    nombre = unicodedata.normalize("NFD", (actual.get("rol") or "").lower())
    nombre = "".join(c for c in nombre if unicodedata.category(c) != "Mn")
    return "domicil" in nombre or "repart" in nombre


def _exigir_domicilio_propio(db: Session, actual: dict, id_domicilio: int) -> None:
    """Un repartidor solo toca los domicilios que lleva él."""
    if not _es_repartidor(actual):
        return
    dom = db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first()
    if not dom or dom.ID_Empleado != actual["registro"].ID_Usuario:
        raise HTTPException(status_code=403, detail="Sin acceso a este domicilio")


@router.get("/resumen")
def resumen_domiciliario(
    db:     Session = Depends(get_db),
    actual: dict    = Depends(requiere_permiso("ver_domicilios"))
):
    """Resumen del día para el domiciliario autenticado: activos, entregados hoy, total hoy."""
    registro    = actual["registro"]
    id_empleado = getattr(registro, "ID_Usuario", None)
    if not id_empleado:
        return {"activos": 0, "entregados_hoy": 0, "total_hoy": 0}
    return obtener_resumen_dia(db, id_empleado)


@router.get("/", response_model=DomicilioListResponse)
def listar_domicilios(
    pagina:       int                  = Query(1, ge=1),
    por_pagina:   int                  = Query(10, ge=1, le=100),
    busqueda:     Optional[str]        = Query(None),
    estado:       Optional[int]        = Query(None),
    id_empleado:  Optional[int]        = Query(None),
    fecha_inicio: Optional[datetime]   = Query(None),
    fecha_fin:    Optional[datetime]   = Query(None),
    db:           Session              = Depends(get_db),
    actual:       dict                 = Depends(requiere_permiso("ver_domicilios"))
):
    """Lista paginada. Filtra por empleado, estado y rango de fechas (fecha_inicio / fecha_fin ISO)."""
    registro = actual["registro"]
    # Domiciliario solo puede ver sus propios domicilios — forzar filtro sin importar el parámetro
    if _es_repartidor(actual):
        id_empleado = registro.ID_Usuario
    return obtener_domicilios(db, pagina, por_pagina, busqueda, estado, id_empleado, fecha_inicio, fecha_fin)


@router.get("/repartidores")
def listar_repartidores(
    db: Session = Depends(get_db),
    _:  dict    = Depends(requiere_permiso("ver_domicilios")),
):
    """Empleados con rol de domiciliario, para el dropdown de asignación."""
    return obtener_repartidores(db)


@router.get("/{id_domicilio}", response_model=DomicilioResponse)
def ver_domicilio(
    id_domicilio: int,
    db:           Session = Depends(get_db),
    actual:       dict    = Depends(requiere_permiso("ver_domicilios"))
):
    """Retorna el detalle de un domicilio."""
    registro = actual["registro"]
    dom = obtener_domicilio(db, id_domicilio)
    if _es_repartidor(actual) and dom.get("ID_Empleado") != registro.ID_Usuario:
        raise HTTPException(status_code=403, detail="Sin acceso a este domicilio")
    return dom


@router.post("/", response_model=DomicilioResponse, status_code=201)
def agregar_domicilio(
    datos: DomicilioCreate,
    db:    Session = Depends(get_db),
    _:     dict    = Depends(requiere_permiso("crear_domicilios"))
):
    """Crea un domicilio. Con ID_Empleado → Asignado. Sin él → Pendiente."""
    return crear_domicilio(db, datos)


@router.put("/{id_domicilio}", response_model=DomicilioResponse)
def actualizar_domicilio(
    id_domicilio: int,
    datos:        DomicilioUpdate,
    db:           Session = Depends(get_db),
    _:            dict    = Depends(requiere_permiso("editar_domicilios"))
):
    """Edita dirección, observaciones o fecha de entrega."""
    return editar_domicilio(db, id_domicilio, datos)


@router.patch("/{id_domicilio}/repartidor", response_model=DomicilioResponse)
def asignar_empleado(
    id_domicilio: int,
    datos:        AsignarRepartidor,
    db:           Session = Depends(get_db),
    _:            dict    = Depends(requiere_permiso("editar_domicilios"))
):
    """Asigna un repartidor. Si estaba Pendiente cambia automáticamente a Asignado."""
    return asignar_repartidor(db, id_domicilio, datos.ID_Empleado)


@router.post("/{id_domicilio}/verificar-otp")
def verificar_otp_domicilio(
    id_domicilio: int,
    datos:        OTPVerify,
    db:           Session = Depends(get_db),
    actual:       dict    = Depends(requiere_permiso("cambiar_estado_domicilios"))
):
    """Verifica el código OTP para confirmar entrega sin necesidad de columna adicional en BD."""
    _exigir_domicilio_propio(db, actual, id_domicilio)
    if not verificar_otp(db, id_domicilio, datos.codigo):
        raise HTTPException(status_code=400, detail="Código incorrecto")
    return {"valido": True}


@router.post("/{id_domicilio}/regenerar-otp")
def regenerar_otp_domicilio(
    id_domicilio: int,
    db:           Session = Depends(get_db),
    actual:       dict    = Depends(requiere_permiso("editar_domicilios"))
):
    """
    Regenera el OTP de un domicilio cuyo código anterior expiró (>48h) o se perdió.
    Solo accesible para empleados/admin con permiso 'editar_domicilios'.
    """
    return regenerar_otp(db, id_domicilio)


def _verificar_acceso_chat(db: Session, id_domicilio: int, actual: dict):
    """Chat de un domicilio: el cliente dueño, el repartidor que lo lleva y la gestión."""
    dom = db.query(Domicilio).filter(Domicilio.ID_Domicilio == id_domicilio).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")
    registro = actual["registro"]
    if actual["tipo"] == "cliente":
        venta = db.query(Venta).filter(Venta.ID_Venta == dom.ID_Venta).first()
        if not venta or venta.ID_Usuario != registro.ID_Usuario:
            raise HTTPException(status_code=403, detail="Sin acceso a este domicilio")
        return
    # Cualquier empleado entraba a cualquier chat, incluido el de un domicilio
    # que lleva otro repartidor. Para reparto, solo el suyo.
    if _es_repartidor(actual) and dom.ID_Empleado != registro.ID_Usuario:
        raise HTTPException(status_code=403, detail="Sin acceso a este domicilio")


@router.get("/{id_domicilio}/mensajes")
def listar_mensajes_chat(
    id_domicilio: int,
    db:           Session = Depends(get_db),
    actual:       dict    = Depends(obtener_usuario_actual)
):
    """Devuelve los mensajes del chat de un domicilio. Accesible por el domiciliario asignado, admins y el cliente dueño."""
    _verificar_acceso_chat(db, id_domicilio, actual)
    return obtener_mensajes(db, id_domicilio)


@router.post("/{id_domicilio}/mensajes", response_model=MensajeResponse)
def enviar_mensaje_chat(
    id_domicilio: int,
    datos:        MensajeCreate,
    db:           Session = Depends(get_db),
    actual:       dict    = Depends(obtener_usuario_actual)
):
    """Envía un mensaje al chat del domicilio."""
    _verificar_acceso_chat(db, id_domicilio, actual)
    registro = actual["registro"]
    tipo = actual["tipo"]

    if tipo == "cliente":
        tipo_rem    = "cliente"
        id_rem      = registro.ID_Usuario
        nombre_rem  = f"{registro.Nombre} {registro.Apellidos}"
    elif registro.ID_Rol == 1:
        tipo_rem    = "admin"
        id_rem      = registro.ID_Usuario
        nombre_rem  = f"{registro.Nombre} {registro.Apellidos}"
    else:
        tipo_rem    = "domiciliario"
        id_rem      = registro.ID_Usuario
        nombre_rem  = f"{registro.Nombre} {registro.Apellidos}"

    return enviar_mensaje(db, id_domicilio, datos.Contenido, tipo_rem, id_rem, nombre_rem)


@router.patch("/{id_domicilio}/registrar-pago-efectivo", response_model=DomicilioResponse)
def registrar_cobro_efectivo(
    id_domicilio: int,
    datos:        RegistroPagoEfectivo,
    db:           Session = Depends(get_db),
    actual:       dict    = Depends(requiere_permiso("cambiar_estado_domicilios")),
):
    """
    El domiciliario registra si cobró el efectivo al entregar.
    recibido=True → monto exacto obligatorio.
    recibido=False → motivo (≥10 chars) obligatorio → Estado_Pago='no_recibido'.
    Idempotente: 409 si ya fue registrado.
    """
    _exigir_domicilio_propio(db, actual, id_domicilio)
    return registrar_pago_efectivo(db, id_domicilio, datos, actual["registro"].ID_Usuario)


@router.patch("/{id_domicilio}/estado", response_model=DomicilioResponse)
def actualizar_estado(
    id_domicilio: int,
    datos:        DomicilioEstado,
    db:           Session = Depends(get_db),
    actual:       dict    = Depends(requiere_permiso("cambiar_estado_domicilios"))
):
    """Cambia el estado. Si es Entregado → registra Fecha_entrega automáticamente. Acepta Observaciones opcional."""
    _exigir_domicilio_propio(db, actual, id_domicilio)
    return cambiar_estado(db, id_domicilio, datos.Estado, datos.Observaciones)