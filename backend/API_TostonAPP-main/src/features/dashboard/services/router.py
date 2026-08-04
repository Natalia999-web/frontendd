from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from src.shared.services.database import get_db
from src.features.auth.services.dependencies import requiere_permiso
from .schemas import DashboardResponse
from .service import obtener_dashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/", response_model=DashboardResponse)
def vista_general(
    periodo: str                 = Query("hoy", description="hoy | semana | mes | custom"),
    fecha_inicio: Optional[datetime] = Query(None, description="Fecha inicial del rango ISO"),
    fecha_fin:    Optional[datetime] = Query(None, description="Fecha final del rango ISO"),
    db:          Session        = Depends(get_db),
    _:           dict           = Depends(requiere_permiso("ver_dashboard")),
):
    """
    Retorna toda la información del dashboard en una sola llamada.

    Incluye:
    - Resumen general (4 tarjetas con variación vs período anterior)
    - Gráfica de ventas en el tiempo (barras/líneas)
    - Top 5 productos más vendidos (torta + ranking)

    Períodos disponibles: hoy | semana | mes | custom
    """
    if (fecha_inicio is not None) ^ (fecha_fin is not None):
        raise HTTPException(
            status_code=422,
            detail="Debe proporcionar fecha_inicio y fecha_fin juntos para un rango personalizado.",
        )
    return obtener_dashboard(db, periodo, fecha_inicio, fecha_fin)