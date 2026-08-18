import os
import json
import logging

logger = logging.getLogger(__name__)

# In-memory fallback: usada cuando la DB no está disponible o en tests.
# La fuente de verdad es la columna Usuarios.FCM_Token en BD.
_fcm_tokens: dict = {}


def guardar_token_fcm(id_usuario: int, token: str, db=None) -> None:
    """Guarda el FCM token en BD (fuente de verdad) y en memoria (fallback).

    Un token identifica un DISPOSITIVO, no una cuenta: por eso antes de asignarlo
    se borra de cualquier otro usuario que lo tuviera. Así, si el usuario A cerró
    sesión sin conexión (o la app se desinstaló) y el usuario B inicia sesión en
    el mismo dispositivo, los push privados de A dejan de llegar a ese teléfono.

    Silencioso ante cualquier error para no bloquear el login."""
    # El fallback en memoria también es por dispositivo: quitar el token de otros.
    for uid, tok in list(_fcm_tokens.items()):
        if tok == token and uid != id_usuario:
            _fcm_tokens.pop(uid, None)
    _fcm_tokens[id_usuario] = token
    if db is None:
        return
    try:
        from src.shared.services.models import Usuario
        db.query(Usuario).filter(
            Usuario.FCM_Token == token,
            Usuario.ID_Usuario != id_usuario,
        ).update({"FCM_Token": None}, synchronize_session=False)
        u = db.query(Usuario).filter(Usuario.ID_Usuario == id_usuario).first()
        if u:
            u.FCM_Token = token
            db.commit()
    except Exception as e:
        logger.error(f"FCM: no se pudo guardar token en BD para usuario {id_usuario}: {e}")


def eliminar_token_fcm(id_usuario: int, token: str | None = None, db=None) -> None:
    """Desvincula el token de push del usuario al cerrar sesión.

    Si se indica [token] solo se borra cuando coincide con el guardado (evita que
    una sesión vieja borre el token de un dispositivo distinto del mismo usuario).
    Sin [token] se borra el que tenga registrado."""
    guardado = _fcm_tokens.get(id_usuario)
    if token is None or guardado is None or guardado == token:
        _fcm_tokens.pop(id_usuario, None)
    if db is None:
        return
    try:
        from src.shared.services.models import Usuario
        u = db.query(Usuario).filter(Usuario.ID_Usuario == id_usuario).first()
        if u and (token is None or not u.FCM_Token or u.FCM_Token == token):
            u.FCM_Token = None
            db.commit()
    except Exception as e:
        logger.error(f"FCM: no se pudo borrar token en BD para usuario {id_usuario}: {e}")


def _token_usuario(id_usuario: int, db=None) -> str | None:
    """Lee el FCM token desde BD (prioridad) o del dict en memoria (fallback)."""
    if db is not None:
        try:
            from src.shared.services.models import Usuario
            u = db.query(Usuario).filter(Usuario.ID_Usuario == id_usuario).first()
            tok = getattr(u, "FCM_Token", None)
            if tok:
                _fcm_tokens[id_usuario] = tok  # sincronizar cache en memoria
                return tok
        except Exception as e:
            logger.error(f"FCM: no se pudo leer token de BD para usuario {id_usuario}: {e}")
    return _fcm_tokens.get(id_usuario)


def _firebase_app():
    """Inicializa Firebase Admin SDK en el primer llamado; retorna None si no está configurado."""
    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            return firebase_admin.get_app()

        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
        if not cred_json:
            return None

        cred = credentials.Certificate(json.loads(cred_json))
        return firebase_admin.initialize_app(cred)
    except Exception as e:
        logger.error(f"FCM: no se pudo inicializar Firebase Admin SDK: {e}")
        return None


def _enviar_multicast(tokens: list, titulo: str, cuerpo: str, data: dict | None = None) -> None:
    """Envía un push a varios dispositivos. No-op silencioso si algo falta."""
    if not tokens:
        return
    from firebase_admin import messaging

    app = _firebase_app()
    if app is None:
        return

    msg = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=titulo, body=cuerpo),
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id="pedidos_channel",
                sound="default",
                icon="@mipmap/ic_launcher",
            ),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(aps=messaging.Aps(sound="default")),
        ),
        data={k: str(v) for k, v in (data or {}).items()},
    )
    messaging.send_each_for_multicast(msg, app=app)


def notificar_admins_push(titulo: str, mensaje: str, db=None, tipo: str = "",
                          referencia_id: int | None = None) -> None:
    """Push a TODOS los administradores.

    Se dispara desde `notificar()` para que cada notificación que aparece en el
    panel llegue también al celular del admin, sin duplicar reglas en cada
    módulo (pedidos, domicilios, stock, devoluciones...).

    Solo van a rol admin: el domiciliario recibe únicamente sus asignaciones y
    el cliente los cambios de estado de sus propios pedidos."""
    try:
        if db is None:
            return
        from src.shared.services.models import Usuario

        tokens = [
            u.FCM_Token
            for u in db.query(Usuario).filter(
                Usuario.ID_Rol == 1,
                Usuario.FCM_Token.isnot(None),
            ).all()
            if u.FCM_Token
        ]
        _enviar_multicast(
            tokens, titulo, mensaje,
            {"tipo": tipo or "panel", "referencia_id": referencia_id or 0},
        )
    except ImportError:
        pass  # firebase-admin no instalado
    except Exception as e:
        logger.error(f"FCM: error enviando push a admins ({tipo}): {e}")


def notificar_asignacion_domicilio_push(
    id_empleado: int,
    id_venta: int,
    direccion: str = "",
    db=None,
) -> None:
    """Push al domiciliario cuando le ASIGNAN un pedido.

    Es la única notificación que recibe el repartidor: nada de stock, pedidos
    nuevos ni movimientos de otros módulos."""
    try:
        token = _token_usuario(id_empleado, db)
        if not token:
            return
        destino = f"\U0001f4cd {direccion}" if direccion else "Revisá tus entregas"
        _enviar_multicast(
            [token],
            f"\U0001f6f5 Nuevo domicilio asignado #{id_venta:05d}",
            destino,
            {"tipo": "domicilio_asignado", "id_venta": id_venta},
        )
    except ImportError:
        pass
    except Exception as e:
        logger.error(f"FCM: error enviando push de asignación al empleado {id_empleado}: {e}")


_LABELS_ESTADO_CLIENTE = {
    4:  ("Tu pedido fue confirmado ✅",         "Confirmado ✅"),
    5:  ("Tu pedido fue cancelado ❌",          "Cancelado ❌"),
    8:  ("Tu pedido fue entregado \U0001f4e6",      "Entregado \U0001f4e6"),
    9:  ("Tu domicilio está en camino \U0001f6f5", "En camino \U0001f6f5"),
}


def notificar_cambio_pedido_push(
    id_usuario_cliente: int,
    id_venta: int,
    nuevo_estado: int,
    db=None,
) -> None:
    """Push al cliente cuando su pedido cambia de estado.
    No-op silencioso si firebase-admin no está instalado, el token no existe
    o el estado no tiene etiqueta definida."""
    try:
        from firebase_admin import messaging

        app = _firebase_app()
        if app is None:
            return

        token = _token_usuario(id_usuario_cliente, db)
        if not token:
            return

        label_info = _LABELS_ESTADO_CLIENTE.get(nuevo_estado)
        if not label_info:
            return

        notif_body, estado_label = label_info
        numero = f"#{id_venta:05d}"

        msg = messaging.Message(
            token=token,
            notification=messaging.Notification(
                title=f"\U0001f6cd️ Pedido {numero} actualizado",
                body=notif_body,
            ),
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="pedidos_channel",
                    sound="default",
                    icon="@mipmap/ic_launcher",
                ),
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default"),
                ),
            ),
            data={
                "tipo": "cambio_pedido",
                "id_venta": str(id_venta),
                "estado": estado_label,
            },
        )
        messaging.send(msg, app=app)

    except ImportError:
        pass  # firebase-admin no instalado
    except Exception as e:
        logger.error(f"FCM: error enviando push cambio estado pedido #{id_venta}: {e}")
