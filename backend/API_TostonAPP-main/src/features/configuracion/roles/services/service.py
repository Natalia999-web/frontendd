from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from src.shared.services.models import (
    Rol, Permiso, RolXPermiso, Usuario
)
from .schemas import RolUpdate, ROLES_PROTEGIDOS

# Estados quemados
ESTADO_ACTIVO   = 1
ESTADO_INACTIVO = 2


def _es_protegido(id_rol: int) -> bool:
    return id_rol in ROLES_PROTEGIDOS



def _contar_usuarios(db: Session, id_rol: int) -> int:
    return (
        db.query(func.count(Usuario.ID_Usuario))
        .filter(Usuario.ID_Rol == id_rol)
        .scalar()
    ) or 0


def _formato_rol(rol, db: Session) -> dict:
    """Construye el dict de respuesta con permisos, conteo de usuarios y flag protegido."""
    permisos = (
        db.query(Permiso)
        .join(RolXPermiso, RolXPermiso.ID_Permiso == Permiso.ID_Permiso)
        .filter(RolXPermiso.ID_Rol == rol.ID_Rol)
        .all()
    )
    return {
        "ID_Rol":         rol.ID_Rol,
        "Rol":            rol.Rol,
        "Icono":          rol.Icono,  # URL de Cloudinary, emoji, o None
        "Estado":         rol.Estado,
        "total_usuarios": _contar_usuarios(db, rol.ID_Rol),
        "protegido":      _es_protegido(rol.ID_Rol),
        "permisos": [
            {
                "ID_Permiso":  p.ID_Permiso,
                "Permiso":     p.Permiso,
                "Descripcion": p.Descripcion,
            }
            for p in permisos
        ],
    }


def obtener_roles(
    db:       Session,
    busqueda: str = None,
    estado:   int = None,
):
    query = db.query(Rol)
    if busqueda:
        query = query.filter(Rol.Rol.ilike(f"%{busqueda.strip()}%"))
    if estado is not None:
        query = query.filter(Rol.Estado == estado)

    roles = query.all()
    if not roles:
        return {"total": 0, "roles": []}

    rol_ids = [r.ID_Rol for r in roles]

    rxp_rows = (
        db.query(RolXPermiso, Permiso)
        .join(Permiso, Permiso.ID_Permiso == RolXPermiso.ID_Permiso)
        .filter(RolXPermiso.ID_Rol.in_(rol_ids))
        .all()
    )
    permisos_by_rol: dict = {}
    for rxp, perm in rxp_rows:
        permisos_by_rol.setdefault(rxp.ID_Rol, []).append({
            "ID_Permiso":  perm.ID_Permiso,
            "Permiso":     perm.Permiso,
            "Descripcion": perm.Descripcion,
        })

    count_rows = (
        db.query(Usuario.ID_Rol, func.count(Usuario.ID_Usuario).label("cnt"))
        .filter(Usuario.ID_Rol.in_(rol_ids))
        .group_by(Usuario.ID_Rol)
        .all()
    )
    count_by_rol = {r.ID_Rol: r.cnt for r in count_rows}

    return {
        "total": len(roles),
        "roles": [
            {
                "ID_Rol":         r.ID_Rol,
                "Rol":            r.Rol,
                "Icono":          r.Icono,
                "Estado":         r.Estado,
                "total_usuarios": count_by_rol.get(r.ID_Rol, 0),
                "protegido":      _es_protegido(r.ID_Rol),
                "permisos":       permisos_by_rol.get(r.ID_Rol, []),
            }
            for r in roles
        ],
    }


def obtener_rol(db: Session, id_rol: int):
    """Retorna un rol por ID o lanza 404."""
    rol = db.query(Rol).filter(Rol.ID_Rol == id_rol).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return _formato_rol(rol, db)


def crear_rol(
    db:     Session,
    nombre: str,
    icono:  str | None,
    estado: int,
):
    """
    Crea un nuevo rol.
    - Valida nombre duplicado ignorando mayúsculas y espacios extras.
    - Ícono: URL de Cloudinary o emoji (string), enviado por el frontend.
    - Estado inicial enviado por el frontend (default: Activo=1).
    """
    nombre_limpio = " ".join(nombre.strip().split())

    duplicado = (
        db.query(Rol)
        .filter(func.lower(func.trim(Rol.Rol)) == nombre_limpio.lower())
        .first()
    )
    if duplicado:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un rol con ese nombre"
        )

    nuevo = Rol(
        Rol    = nombre_limpio,
        Icono  = icono,
        Estado = estado,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return _formato_rol(nuevo, db)


def editar_rol(
    db:            Session,
    id_rol:        int,
    nombre:        str | None,
    icono:         str | None,
    limpiar_icono: bool,
):
    """
    Edita nombre e ícono de un rol.
    - Roles protegidos (Admin) no se pueden editar.
    - limpiar_icono=True permite quitar el ícono sin enviar uno nuevo.
    - Valida nombre duplicado si se cambia.
    """
    if _es_protegido(id_rol):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El rol Admin está protegido y no puede editarse",
        )

    rol = db.query(Rol).filter(Rol.ID_Rol == id_rol).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    if nombre is not None:
        nombre_limpio = " ".join(nombre.strip().split())
        duplicado = (
            db.query(Rol)
            .filter(
                func.lower(func.trim(Rol.Rol)) == nombre_limpio.lower(),
                Rol.ID_Rol != id_rol,
            )
            .first()
        )
        if duplicado:
            raise HTTPException(
                status_code=400,
                detail="Ya existe un rol con ese nombre"
            )
        rol.Rol = nombre_limpio

    if icono is not None:
        rol.Icono = icono
    elif limpiar_icono:
        rol.Icono = None

    db.commit()
    db.refresh(rol)
    return _formato_rol(rol, db)


def cambiar_estado(db: Session, id_rol: int, nuevo_estado: int):
    """
    Cambia el estado de un rol (Activo/Inactivo).
    - Roles protegidos (Admin) no se pueden modificar.
    - Si se desactiva: desactiva todos los empleados y usuarios (clientes) con ese rol.
    - Si se activa: reactiva todos los empleados y usuarios con ese rol.
    """
    if _es_protegido(id_rol):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El rol Admin está protegido y no puede modificarse",
        )

    rol = db.query(Rol).filter(Rol.ID_Rol == id_rol).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    if nuevo_estado not in (ESTADO_ACTIVO, ESTADO_INACTIVO):
        raise HTTPException(
            status_code=400,
            detail="Estado inválido. Use 1 (Activo) o 2 (Inactivo)"
        )

    rol.Estado = nuevo_estado

    # Propagar estado a todos los usuarios con este rol
    (
        db.query(Usuario)
        .filter(Usuario.ID_Rol == id_rol)
        .update({"Estado": nuevo_estado}, synchronize_session=False)
    )

    db.commit()
    db.refresh(rol)
    return _formato_rol(rol, db)


def eliminar_rol(db: Session, id_rol: int):
    """
    Elimina un rol.
    - Admin nunca se puede eliminar.
    - Si tiene usuarios o empleados asociados, retorna error 400.
    """
    if _es_protegido(id_rol):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El rol Admin está protegido y no puede eliminarse",
        )

    rol = db.query(Rol).filter(Rol.ID_Rol == id_rol).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    total = _contar_usuarios(db, id_rol)
    if total > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: el rol tiene {total} usuario(s) asociado(s)"
        )

    db.query(RolXPermiso).filter(RolXPermiso.ID_Rol == id_rol).delete()
    db.delete(rol)
    db.commit()
    return {"mensaje": f"Rol '{rol.Rol}' eliminado correctamente"}


def asignar_permisos(db: Session, id_rol: int, permisos_ids: list[int]):
    """
    Reemplaza todos los permisos del rol con la nueva lista.
    Lista vacía = quitar todos los permisos.
    Valida todos los IDs antes de hacer cualquier cambio para evitar estados inconsistentes.
    """
    rol = db.query(Rol).filter(Rol.ID_Rol == id_rol).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    # Elimina todos los permisos actuales del rol
    db.query(RolXPermiso).filter(RolXPermiso.ID_Rol == id_rol).delete(
        synchronize_session=False
    )

    # Asigna los nuevos permisos; IDs inexistentes en la BD se omiten sin error
    seen = set()
    for id_permiso in permisos_ids:
        if id_permiso in seen:
            continue
        seen.add(id_permiso)
        permiso = db.query(Permiso).filter(Permiso.ID_Permiso == id_permiso).first()
        if permiso:
            db.add(RolXPermiso(ID_Rol=id_rol, ID_Permiso=id_permiso))

    db.commit()
    return _formato_rol(rol, db)