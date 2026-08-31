from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timedelta
import uuid

from src.shared.services.models import Usuario, Rol, Venta, Domicilio, VerificacionEmail
from src.features.auth.services.service import (
    hashear_contrasena, _enviar_email_verificacion,
    _enviar_email_bienvenida_empleado,
    RESEND_API_KEY, GMAIL_CLIENT_ID, BREVO_API_KEY,
)
from .schemas import EmpleadoCreate, UsuarioCreate, PersonaUpdate, validar_cedula, validar_telefono


def _tipo_desde_rol(id_rol: int) -> str:
    return "cliente" if id_rol == 3 else "empleado"


def _formato_persona(registro: Usuario, rol_nombre: str = None) -> dict:
    id_rol = registro.ID_Rol or 0
    return {
        "id":             registro.ID_Usuario,
        "Cedula":         registro.Cedula,
        "Tipo_Documento": registro.Tipo_Documento,
        "Nombre":         registro.Nombre,
        "Apellidos":      registro.Apellidos,
        "Correo":         registro.Correo,
        "Direccion":      registro.Direccion,
        "Municipio":      registro.Municipio,
        "Departamento":   registro.Departamento,
        "Indicaciones":   getattr(registro, "Indicaciones", None),
        "Telefono":       registro.Telefono,
        "Foto":           registro.Foto_perfil,
        "ID_Rol":         id_rol,
        "nombre_rol":     rol_nombre,
        "Estado":         registro.Estado,
        "Fecha_creacion": registro.Fecha_creacion,
        "tipo":           _tipo_desde_rol(id_rol),
    }


def _rol_nombre(db: Session, id_rol: int) -> str | None:
    if not id_rol:
        return None
    rol = db.query(Rol).filter(Rol.ID_Rol == id_rol).first()
    return rol.Rol if rol else None


def obtener_todos(db: Session, pagina: int = 1, por_pagina: int = 10, busqueda: str = None) -> dict:
    q = db.query(Usuario)
    if busqueda:
        t = f"%{busqueda}%"
        q = q.filter(
            Usuario.Nombre.ilike(t) |
            Usuario.Apellidos.ilike(t) |
            Usuario.Correo.ilike(t) |
            Usuario.Cedula.ilike(t)
        )

    total  = q.count()
    offset = (pagina - 1) * por_pagina
    users  = q.offset(offset).limit(por_pagina).all()

    rol_ids   = list({u.ID_Rol for u in users if u.ID_Rol})
    roles_map = {r.ID_Rol: r.Rol for r in db.query(Rol).filter(Rol.ID_Rol.in_(rol_ids)).all()} if rol_ids else {}

    return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "personas": [_formato_persona(u, roles_map.get(u.ID_Rol)) for u in users]}


def obtener_persona(db: Session, id_persona: int) -> dict:
    registro = db.query(Usuario).filter(Usuario.ID_Usuario == id_persona).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    return _formato_persona(registro, _rol_nombre(db, registro.ID_Rol))


def _cedula_en_uso(db: Session, cedula: str, excluir_id: int = None) -> bool:
    q = db.query(Usuario).filter(Usuario.Cedula == cedula)
    if excluir_id:
        q = q.filter(Usuario.ID_Usuario != excluir_id)
    return q.first() is not None


def crear_empleado(db: Session, datos: EmpleadoCreate) -> dict:
    error_cedula = validar_cedula(datos.Cedula, datos.Tipo_Documento)
    if error_cedula:
        raise HTTPException(status_code=400, detail=error_cedula)
    error_telefono = validar_telefono(datos.Telefono) if datos.Telefono else None
    if error_telefono:
        raise HTTPException(status_code=400, detail=error_telefono)
    if db.query(Usuario).filter(Usuario.Correo == datos.Correo).first():
        raise HTTPException(status_code=400, detail="Correo ya registrado")
    if _cedula_en_uso(db, datos.Cedula):
        raise HTTPException(status_code=400, detail="Cédula ya registrada")

    nuevo = Usuario(
        Cedula            = datos.Cedula,
        Tipo_Documento    = datos.Tipo_Documento,
        Nombre            = datos.Nombre,
        Apellidos         = datos.Apellidos,
        Correo            = datos.Correo,
        Direccion         = datos.Direccion,
        Municipio         = datos.Municipio,
        Departamento      = datos.Departamento,
        Telefono          = datos.Telefono,
        Foto_perfil       = datos.Foto,
        ID_Rol            = datos.ID_Rol,
        Contrasena        = hashear_contrasena(datos.Contrasena),
        Fecha_creacion    = datetime.now(),
        Estado            = 1,
        Correo_Verificado = 1,  # admin crea la cuenta directamente — sin verificación por email
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    if GMAIL_CLIENT_ID or BREVO_API_KEY or RESEND_API_KEY:
        try:
            _enviar_email_bienvenida_empleado(datos.Correo, datos.Nombre, datos.Contrasena)
        except Exception:
            pass  # el email es informativo; la cuenta ya fue creada

    return _formato_persona(nuevo, _rol_nombre(db, nuevo.ID_Rol))


def crear_cliente(db: Session, datos: UsuarioCreate) -> dict:
    error_cedula = validar_cedula(datos.Cedula, datos.Tipo_Documento)
    if error_cedula:
        raise HTTPException(status_code=400, detail=error_cedula)
    error_telefono = validar_telefono(datos.Telefono) if datos.Telefono else None
    if error_telefono:
        raise HTTPException(status_code=400, detail=error_telefono)
    if db.query(Usuario).filter(Usuario.Correo == datos.Correo).first():
        raise HTTPException(status_code=400, detail="Correo ya registrado")
    if _cedula_en_uso(db, datos.Cedula):
        raise HTTPException(status_code=400, detail="Cédula ya registrada")

    rol_cliente = db.query(Rol).filter(Rol.Rol == "Cliente").first()
    id_rol      = datos.ID_Rol if datos.ID_Rol else (rol_cliente.ID_Rol if rol_cliente else 3)

    nuevo = Usuario(
        Cedula         = datos.Cedula,
        Tipo_Documento = datos.Tipo_Documento,
        Nombre         = datos.Nombre,
        Apellidos      = datos.Apellidos,
        Correo         = datos.Correo,
        Direccion      = datos.Direccion,
        Municipio      = datos.Municipio,
        Departamento   = datos.Departamento,
        Telefono       = datos.Telefono,
        Foto_perfil    = datos.Foto,
        ID_Rol         = id_rol,
        Contrasena     = hashear_contrasena(datos.Contrasena),
        Fecha_creacion = datetime.now(),
        Estado         = 1,  # activo de inmediato (puede iniciar sesión)
        Correo_Verificado = 0,  # debe verificar el correo para recuperar contraseña
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

    if RESEND_API_KEY:
        try:
            _enviar_email_verificacion(datos.Correo, token, datos.Nombre)
        except Exception:
            pass

    db.commit()
    db.refresh(nuevo)
    return _formato_persona(nuevo, _rol_nombre(db, nuevo.ID_Rol))


def editar_persona(db: Session, id_persona: int, datos: PersonaUpdate) -> dict:
    registro = db.query(Usuario).filter(Usuario.ID_Usuario == id_persona).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    if datos.Cedula and datos.Cedula != registro.Cedula:
        error_cedula = validar_cedula(datos.Cedula, datos.Tipo_Documento or registro.Tipo_Documento)
        if error_cedula:
            raise HTTPException(status_code=400, detail=error_cedula)
        if _cedula_en_uso(db, datos.Cedula, excluir_id=id_persona):
            raise HTTPException(status_code=400, detail="Cédula ya registrada")

    if datos.Telefono:
        error_telefono = validar_telefono(datos.Telefono)
        if error_telefono:
            raise HTTPException(status_code=400, detail=error_telefono)

    for campo, valor in datos.model_dump(exclude_none=True).items():
        if campo == "Foto":
            setattr(registro, "Foto_perfil", valor)
        elif campo == "Contrasena":
            registro.Contrasena = hashear_contrasena(valor)
        else:
            setattr(registro, campo, valor)

    db.commit()
    db.refresh(registro)
    return _formato_persona(registro, _rol_nombre(db, registro.ID_Rol))


def cambiar_estado(db: Session, id_persona: int, nuevo_estado: int) -> dict:
    registro = db.query(Usuario).filter(Usuario.ID_Usuario == id_persona).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    if registro.ID_Rol == 1:
        raise HTTPException(
            status_code=400,
            detail="No se puede desactivar al administrador del sistema.",
        )

    if nuevo_estado == 1:
        rol = db.query(Rol).filter(Rol.ID_Rol == registro.ID_Rol).first()
        if rol and rol.Estado == 2:
            raise HTTPException(
                status_code=400,
                detail=f'No se puede activar este usuario: el rol "{rol.Rol}" está desactivado. Activa el rol primero.',
            )

    registro.Estado = nuevo_estado
    db.commit()
    db.refresh(registro)
    return _formato_persona(registro, _rol_nombre(db, registro.ID_Rol))


def eliminar_persona(db: Session, id_persona: int) -> dict:
    registro = db.query(Usuario).filter(Usuario.ID_Usuario == id_persona).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    if registro.ID_Rol == 1:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar al administrador del sistema.",
        )

    # Verificar restricciones según tipo
    if registro.ID_Rol != 3:
        domicilios = db.query(Domicilio).filter(Domicilio.ID_Empleado == id_persona).count()
        if domicilios > 0:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede eliminar: el empleado tiene {domicilios} domicilio(s) asignado(s).",
            )
    else:
        ventas = db.query(Venta).filter(Venta.ID_Usuario == id_persona).count()
        if ventas > 0:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede eliminar: el cliente tiene {ventas} venta(s) registrada(s).",
            )

    db.delete(registro)
    db.commit()
    return {"mensaje": f"Usuario {id_persona} eliminado correctamente"}
