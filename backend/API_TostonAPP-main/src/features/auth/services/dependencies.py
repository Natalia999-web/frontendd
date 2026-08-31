from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

from src.shared.services.database import get_db
from src.shared.services.models import Usuario, Rol, RolXPermiso, Permiso
from .schemas import TokenData

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")

oauth2_scheme = HTTPBearer()


def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Decodifica el token y retorna el usuario o empleado activo."""
    token = credentials.credentials

    credenciales_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload    = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        id_persona = payload.get("id")
        tipo       = payload.get("tipo")

        # Rechazar tokens de reset usados como tokens de sesión
        if payload.get("tipo") == "reset":
            raise credenciales_error

        if id_persona is None:
            raise credenciales_error

        token_data = TokenData(cedula=id_persona, tipo=tipo or "usuario", rol=payload.get("rol"))

    except JWTError:
        raise credenciales_error

    registro = db.query(Usuario).filter(Usuario.ID_Usuario == id_persona).first()

    if registro is None:
        raise credenciales_error

    if getattr(registro, "Estado", None) == 2:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esta cuenta ha sido desactivada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Deriva tipo desde el rol real del registro (ignora el tipo del token para consistencia)
    tipo_real = "cliente" if registro.ID_Rol == 3 else "empleado"
    return {"registro": registro, "tipo": tipo_real, "rol": token_data.rol}


def solo_empleados(actual: dict = Depends(obtener_usuario_actual)):
    """
    Protege endpoints exclusivos de empleados (cualquier rol que no sea Cliente).
    """
    if actual["tipo"] == "cliente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder a este recurso"
        )
    return actual


def requiere_permiso(nombre_permiso: str):
    """
    Dependencia factory que verifica si el usuario autenticado
    tiene el permiso requerido según su rol en Rol_x_Permiso.

    Reglas:
    - Clientes (ID_Rol=3): bypass total (no acceden al panel de gestión)
    - Admin (ID_Rol=1): bypass total
    - Otros roles: verificar Rol_x_Permiso
    """
    def verificar(
        actual: dict    = Depends(obtener_usuario_actual),
        db:     Session = Depends(get_db)
    ):
        registro = actual["registro"]
        id_rol   = registro.ID_Rol

        # Bypass total para Admin
        if id_rol == 1:
            return actual

        # Todos los demás roles (empleados, clientes, domiciliarios)
        # deben tener el permiso explícito en Rol_x_Permiso.
        tiene_permiso = (
            db.query(RolXPermiso)
            .join(Permiso, Permiso.ID_Permiso == RolXPermiso.ID_Permiso)
            .filter(
                RolXPermiso.ID_Rol == id_rol,
                Permiso.Permiso    == nombre_permiso
            )
            .first()
        )

        if not tiene_permiso:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción"
            )

        return actual

    return verificar