from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from decimal import Decimal

from src.shared.services.models import Venta, VentaXProducto, Producto, Usuario


def _fecha_fin_del_dia(fecha: datetime) -> datetime:
    return fecha.replace(hour=23, minute=59, second=59, microsecond=999999)


def _rango_fechas(periodo: str, inicio: datetime | None = None, fin: datetime | None = None) -> tuple[datetime, datetime, datetime, datetime]:
    """
    Retorna (inicio_actual, fin_actual, inicio_anterior, fin_anterior)
    según el período solicitado o el rango custom.
    """
    ahora = datetime.now()

    if inicio is not None and fin is not None:
        if fin < inicio:
            inicio, fin = fin, inicio
        inicio = inicio.replace(hour=0, minute=0, second=0, microsecond=0)
        fin = _fecha_fin_del_dia(fin)
        duracion = fin - inicio
        inicio_ant = inicio - duracion - timedelta(microseconds=1)
        fin_ant = inicio - timedelta(microseconds=1)
        return inicio, fin, inicio_ant, fin_ant

    if periodo == "hoy":
        inicio  = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
        fin     = ahora
        inicio_ant = inicio - timedelta(days=1)
        fin_ant    = fin    - timedelta(days=1)

    elif periodo == "semana":
        inicio  = ahora - timedelta(days=ahora.weekday())
        inicio  = inicio.replace(hour=0, minute=0, second=0, microsecond=0)
        fin     = ahora
        inicio_ant = inicio - timedelta(weeks=1)
        fin_ant    = fin    - timedelta(weeks=1)

    else:  # mes
        inicio  = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        fin     = ahora
        # Mes anterior
        if inicio.month == 1:
            inicio_ant = inicio.replace(year=inicio.year - 1, month=12)
        else:
            inicio_ant = inicio.replace(month=inicio.month - 1)
        fin_ant = fin.replace(month=fin.month - 1) if fin.month > 1 else fin.replace(year=fin.year - 1, month=12)

    return inicio, fin, inicio_ant, fin_ant


# Solo ventas confirmadas/entregadas/en camino/completadas cuentan como revenue real
ESTADOS_VENTA = (4, 8, 9, 11)
# Para el flujo de ventas (gráfica): incluye órdenes nuevas y en producción también
ESTADOS_FLUJO = (1, 4, 5, 8, 9, 11, 13)


def _total_ventas(db: Session, inicio: datetime, fin: datetime) -> Decimal:
    resultado = db.query(func.sum(Venta.Total)).filter(
        Venta.Fecha_Venta >= inicio,
        Venta.Fecha_Venta <= fin,
        Venta.Estado.in_(ESTADOS_VENTA),
    ).scalar()
    return Decimal(str(resultado or 0))


def _total_pedidos(db: Session, inicio: datetime, fin: datetime) -> int:
    return db.query(Venta).filter(
        Venta.Fecha_Venta >= inicio,
        Venta.Fecha_Venta <= fin,
        Venta.Estado.in_(ESTADOS_VENTA),
    ).count()


def _contar_pedidos_flujo(db: Session, inicio: datetime, fin: datetime) -> int:
    """Cuenta todos los pedidos (cualquier estado activo) para la gráfica de flujo."""
    return db.query(Venta).filter(
        Venta.Fecha_pedido >= inicio,
        Venta.Fecha_pedido <= fin,
        Venta.Estado.in_(ESTADOS_FLUJO),
    ).count()


def _total_clientes_nuevos(db: Session, inicio: datetime, fin: datetime) -> int:
    return db.query(Usuario).filter(
        Usuario.Fecha_creacion >= inicio,
        Usuario.Fecha_creacion <= fin,
    ).count()


def _ticket_promedio(db: Session, inicio: datetime, fin: datetime) -> Decimal:
    resultado = db.query(func.avg(Venta.Total)).filter(
        Venta.Fecha_Venta >= inicio,
        Venta.Fecha_Venta <= fin,
        Venta.Estado.in_(ESTADOS_VENTA),
    ).scalar()
    return Decimal(str(round(resultado or 0, 2)))


def _variacion(actual, anterior) -> tuple[float, bool]:
    """Calcula el porcentaje de variación y si subió o bajó."""
    if not anterior or anterior == 0:
        return 0.0, True
    variacion = ((float(actual) - float(anterior)) / float(anterior)) * 100
    return round(variacion, 1), variacion >= 0


def _grafica_ventas(db: Session, inicio: datetime, fin: datetime, inicio_ant: datetime, fin_ant: datetime, periodo: str) -> list:
    """
    Genera los puntos de la gráfica según el período.
    Muestra CANTIDAD de pedidos (flujo), no revenue — así aparecen aunque estén Pendientes.
    """
    puntos = []

    if periodo == "hoy":
        # Agrupa por hora
        for hora in range(8, 20):  # 8am a 7pm
            hora_inicio = inicio.replace(hour=hora, minute=0)
            hora_fin    = inicio.replace(hour=hora, minute=59, second=59)
            hora_ant_i  = inicio_ant.replace(hour=hora, minute=0)
            hora_ant_f  = inicio_ant.replace(hour=hora, minute=59, second=59)

            actual   = _contar_pedidos_flujo(db, hora_inicio, hora_fin)
            anterior = _contar_pedidos_flujo(db, hora_ant_i, hora_ant_f)
            puntos.append({
                "etiqueta": f"{hora}am" if hora < 12 else f"{hora - 12 if hora > 12 else hora}pm",
                "actual":   Decimal(str(actual)),
                "anterior": Decimal(str(anterior)),
                "meta":     Decimal(str(actual + 1)),
            })

    elif periodo == "semana":
        # Agrupa por día
        dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        for i, dia in enumerate(dias):
            dia_inicio = inicio + timedelta(days=i)
            dia_fin    = dia_inicio.replace(hour=23, minute=59, second=59)
            dia_ant_i  = inicio_ant + timedelta(days=i)
            dia_ant_f  = dia_ant_i.replace(hour=23, minute=59, second=59)

            actual   = _contar_pedidos_flujo(db, dia_inicio, dia_fin)
            anterior = _contar_pedidos_flujo(db, dia_ant_i, dia_ant_f)
            puntos.append({
                "etiqueta": dia,
                "actual":   Decimal(str(actual)),
                "anterior": Decimal(str(anterior)),
                "meta":     Decimal(str(actual + 1)),
            })

    else:
        # Agrupa por semana del mes
        semana_actual = inicio
        semana_num    = 1
        while semana_actual < fin:
            semana_fin  = min(semana_actual + timedelta(weeks=1), fin)
            semana_ant  = semana_actual.replace(month=semana_actual.month - 1) if semana_actual.month > 1 else semana_actual.replace(year=semana_actual.year - 1, month=12)
            semana_ant_f = semana_ant + timedelta(weeks=1)

            actual   = _contar_pedidos_flujo(db, semana_actual, semana_fin)
            anterior = _contar_pedidos_flujo(db, semana_ant, semana_ant_f)
            puntos.append({
                "etiqueta": f"Sem {semana_num}",
                "actual":   Decimal(str(actual)),
                "anterior": Decimal(str(anterior)),
                "meta":     Decimal(str(actual + 1)),
            })
            semana_actual += timedelta(weeks=1)
            semana_num    += 1

    return puntos


def _productos_top(db: Session, inicio: datetime, fin: datetime) -> list:
    """Retorna los productos más vendidos en el período con su porcentaje."""
    resultados = (
        db.query(
            VentaXProducto.ID_Producto,
            func.sum(VentaXProducto.Cantidad).label("total_cantidad")
        )
        .join(Venta, Venta.ID_Venta == VentaXProducto.ID_Venta)
        .filter(
            Venta.Fecha_Venta >= inicio,
            Venta.Fecha_Venta <= fin,
            Venta.Estado.in_(ESTADOS_VENTA),
        )
        .group_by(VentaXProducto.ID_Producto)
        .order_by(func.sum(VentaXProducto.Cantidad).desc())
        .limit(5)
        .all()
    )

    total_vendido = sum(r.total_cantidad for r in resultados) or 1

    productos = []
    for r in resultados:
        producto = db.query(Producto).filter(Producto.ID_Producto == r.ID_Producto).first()
        productos.append({
            "ID_Producto": r.ID_Producto,
            "nombre":      producto.nombre if producto else f"Producto {r.ID_Producto}",
            "cantidad":    r.total_cantidad,
            "porcentaje":  round((r.total_cantidad / total_vendido) * 100, 1),
        })

    return productos


def obtener_dashboard(db: Session, periodo: str = "hoy", fecha_inicio: datetime | None = None, fecha_fin: datetime | None = None) -> dict:
    """Consolida toda la información del dashboard en una sola consulta."""
    if periodo not in ["hoy", "semana", "mes", "custom"]:
        periodo = "hoy"

    inicio, fin, inicio_ant, fin_ant = _rango_fechas(periodo, fecha_inicio, fecha_fin)

    # Calcula métricas actuales y anteriores
    ventas_actual   = _total_ventas(db, inicio, fin)
    ventas_ant      = _total_ventas(db, inicio_ant, fin_ant)
    pedidos_actual  = _total_pedidos(db, inicio, fin)
    pedidos_ant     = _total_pedidos(db, inicio_ant, fin_ant)
    clientes_actual = _total_clientes_nuevos(db, inicio, fin)
    clientes_ant    = _total_clientes_nuevos(db, inicio_ant, fin_ant)
    ticket_actual   = _ticket_promedio(db, inicio, fin)
    ticket_ant      = _ticket_promedio(db, inicio_ant, fin_ant)

    # Calcula variaciones
    v_ventas,   s_ventas   = _variacion(ventas_actual,   ventas_ant)
    v_pedidos,  s_pedidos  = _variacion(pedidos_actual,  pedidos_ant)
    v_clientes, s_clientes = _variacion(clientes_actual, clientes_ant)
    v_ticket,   s_ticket   = _variacion(ticket_actual,   ticket_ant)

    return {
        "periodo": periodo,
        "resumen": {
            "total_ventas": {
                "valor":         ventas_actual,
                "variacion_pct": v_ventas,
                "subiendo":      s_ventas,
            },
            "total_pedidos": {
                "valor":         Decimal(str(pedidos_actual)),
                "variacion_pct": v_pedidos,
                "subiendo":      s_pedidos,
            },
            "total_clientes": {
                "valor":         Decimal(str(clientes_actual)),
                "variacion_pct": v_clientes,
                "subiendo":      s_clientes,
            },
            "ticket_promedio": {
                "valor":         ticket_actual,
                "variacion_pct": v_ticket,
                "subiendo":      s_ticket,
            },
        },
        "grafica_ventas":  _grafica_ventas(db, inicio, fin, inicio_ant, fin_ant, periodo),
        "productos_top":   _productos_top(db, inicio, fin),
    }