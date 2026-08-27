"""Creación de pedidos de punta a punta, con base de datos de verdad.

Los demás tests miran funciones sueltas. Estos arman una base SQLite en memoria
con los modelos reales, siembran cliente, productos y saldo, y llaman a
crear_venta() igual que lo hace el router. Sirven para ver el pedido que queda
guardado —total, estado de pago, anticipo, domicilio, stock— en las
combinaciones que se usan de verdad: con y sin anticipo, con y sin
transferencia, con y sin saldo a favor, con y sin domicilio.

Corre sin credenciales:
    DB_USER=u DB_PASSWORD=p DB_HOST=localhost DB_PORT=3306 DB_NAME=test \
        python tests/test_crear_venta_e2e.py
"""
import os
import sys
import unittest
from decimal import Decimal
from pathlib import Path

# database.py arma el engine al importarse; con estas variables no se conecta
# a nada, y los tests usan su propia base SQLite.
os.environ.setdefault("DB_USER", "u")
os.environ.setdefault("DB_PASSWORD", "p")
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_NAME", "test")

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.features.ventas.gestion_ventas.services.schemas import (
    DomicilioVentaInput,
    ProductoVentaInput,
    VentaCreate,
)
from src.features.ventas.gestion_ventas.services.service import (
    COSTO_DOMICILIO,
    crear_venta,
)
from src.shared.services.models import (
    Base,
    CreditoCliente,
    Domicilio,
    Producto,
    Usuario,
    Venta,
)

# Precio y stock elegidos para que las cuentas den redondo y sean fáciles de
# seguir a mano: 1 tostón = $10.000.
PRECIO = Decimal("10000")
ID_CLIENTE = 1
ID_TOSTON = 1       # stock 10
ID_TORTA = 2        # stock 2, para forzar el pedido sobre stock


class CrearVentaBase(unittest.TestCase):
    """Base de datos limpia y sembrada para cada caso."""

    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self._sembrar()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _sembrar(self, saldo=None):
        self.db.add(Usuario(
            ID_Usuario=ID_CLIENTE,
            Nombre="Cliente",
            Apellidos="De Prueba",
            Correo="cliente@prueba.test",
            Telefono="3001234567",
            ID_Rol=3,
            Estado=1,
        ))
        self.db.add(Producto(
            ID_Producto=ID_TOSTON, nombre="Tostón",
            Precio_venta=PRECIO, Stock=10, Estado=1, Publicado=1,
        ))
        self.db.add(Producto(
            ID_Producto=ID_TORTA, nombre="Torta Tropical",
            Precio_venta=PRECIO, Stock=2, Estado=1, Publicado=1,
        ))
        if saldo is not None:
            self.db.add(CreditoCliente(
                ID_Usuario=ID_CLIENTE, Saldo=Decimal(str(saldo)),
            ))
        self.db.commit()

    def dar_saldo(self, monto):
        self.db.add(CreditoCliente(
            ID_Usuario=ID_CLIENTE, Saldo=Decimal(str(monto)),
        ))
        self.db.commit()

    def desactivar(self, id_producto):
        """El admin lo saca de la tienda (Publicado = 0)."""
        prod = self.db.query(Producto).filter(
            Producto.ID_Producto == id_producto
        ).first()
        prod.Publicado = 0
        self.db.commit()

    def sin_telefono(self):
        u = self.db.query(Usuario).filter(Usuario.ID_Usuario == ID_CLIENTE).first()
        u.Telefono = None
        self.db.commit()

    # ── Ayudas ───────────────────────────────────────────────────────────
    def pedido(self, **kwargs):
        """VentaCreate con lo mínimo, y lo que cada caso quiera cambiar."""
        base = dict(
            ID_Usuario=ID_CLIENTE,
            Metodo_Pago="Efectivo",
            productos=[ProductoVentaInput(ID_Producto=ID_TOSTON, Cantidad=2)],
        )
        base.update(kwargs)
        return VentaCreate(**base)

    def domicilio(self, **kwargs):
        base = dict(
            Direccion_entrega="Calle 10 #20-30",
            Municipio_entrega="Medellín",
            Departamento_entrega="Antioquia",
        )
        base.update(kwargs)
        return DomicilioVentaInput(**base)

    def crear(self, datos):
        resultado = crear_venta(self.db, datos)
        self.db.commit()
        return resultado

    def venta_creada(self):
        return self.db.query(Venta).first()

    def saldo_actual(self):
        c = self.db.query(CreditoCliente).filter(
            CreditoCliente.ID_Usuario == ID_CLIENTE
        ).first()
        return c.Saldo if c else Decimal("0")

    def stock(self, id_producto):
        return self.db.query(Producto).filter(
            Producto.ID_Producto == id_producto
        ).first().Stock


# ══════════════════════════════════════════════════════════════════════════
# 1. Pedido normal, sin anticipo
# ══════════════════════════════════════════════════════════════════════════
class PedidoNormalTests(CrearVentaBase):

    def test_efectivo_sin_domicilio(self):
        self.crear(self.pedido())
        v = self.venta_creada()
        self.assertEqual(v.Total, Decimal("20000"))
        self.assertEqual(v.Metodo_Pago, "Efectivo")
        self.assertEqual(v.Estado_Pago, "pendiente")
        self.assertEqual(v.Sobre_Stock, 0)
        self.assertIsNone(self.db.query(Domicilio).first())

    def test_efectivo_con_domicilio_suma_el_costo(self):
        self.crear(self.pedido(domicilio=self.domicilio()))
        v = self.venta_creada()
        self.assertEqual(v.Total, Decimal("20000") + COSTO_DOMICILIO)
        dom = self.db.query(Domicilio).first()
        self.assertIsNotNone(dom)
        self.assertEqual(dom.Direccion_entrega, "Calle 10 #20-30")
        # Sin repartidor asignado nace pendiente (3), no asignado (10).
        self.assertEqual(dom.Estado, 3)

    def test_domicilio_sin_telefono_se_rechaza(self):
        self.sin_telefono()
        with self.assertRaises(HTTPException) as ctx:
            self.crear(self.pedido(domicilio=self.domicilio()))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("teléfono", ctx.exception.detail)

    def test_transferencia_con_comprobante_queda_por_validar(self):
        self.crear(self.pedido(
            Metodo_Pago="Transferencia",
            comprobante_pago="https://cloudinary.test/comp.jpg",
        ))
        v = self.venta_creada()
        self.assertEqual(v.Estado_Pago, "pendiente_validacion")
        self.assertEqual(v.Comprobante_Pago, "https://cloudinary.test/comp.jpg")

    def test_transferencia_sin_comprobante_queda_pendiente(self):
        self.crear(self.pedido(Metodo_Pago="Transferencia"))
        v = self.venta_creada()
        self.assertEqual(v.Estado_Pago, "pendiente")
        self.assertIsNone(v.Comprobante_Pago)

    def test_el_cliente_no_descuenta_stock_al_pedir(self):
        """El stock se descuenta al entregar, no al crear el pedido."""
        self.crear(self.pedido())
        self.assertEqual(self.stock(ID_TOSTON), 10)


# ══════════════════════════════════════════════════════════════════════════
# 1b. Producto desactivado de la tienda
# ══════════════════════════════════════════════════════════════════════════
class ProductoDesactivadoTests(CrearVentaBase):
    """El carrito vive en el dispositivo del cliente.

    Cuando el admin desactiva un producto desaparece del catálogo, pero sigue
    en el carrito de quien lo había agregado antes. El servidor es el único que
    puede impedir que ese pedido entre igual.
    """

    def test_el_cliente_no_puede_pedir_lo_desactivado(self):
        self.desactivar(ID_TORTA)
        with self.assertRaises(HTTPException) as ctx:
            self.crear(self.pedido(
                productos=[ProductoVentaInput(ID_Producto=ID_TORTA, Cantidad=1)],
            ))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Torta Tropical", ctx.exception.detail)

    def test_el_pedido_entero_se_frena_aunque_lo_demas_este_bien(self):
        self.desactivar(ID_TORTA)
        with self.assertRaises(HTTPException):
            self.crear(self.pedido(productos=[
                ProductoVentaInput(ID_Producto=ID_TOSTON, Cantidad=1),
                ProductoVentaInput(ID_Producto=ID_TORTA, Cantidad=1),
            ]))
        self.assertIsNone(self.venta_creada())

    def test_el_personal_si_puede_venderlo_en_mostrador(self):
        self.desactivar(ID_TORTA)
        self.crear(self.pedido(
            productos=[ProductoVentaInput(ID_Producto=ID_TORTA, Cantidad=1)],
            creado_por_admin=True,
        ))
        self.assertEqual(self.venta_creada().Total, PRECIO)

    def test_lo_publicado_sigue_pasando(self):
        self.desactivar(ID_TORTA)
        self.crear(self.pedido())
        self.assertEqual(self.venta_creada().Total, Decimal("20000"))

    def test_agotado_no_es_lo_mismo_que_desactivado(self):
        """Sin stock se puede pedir igual: eso lo resuelve el anticipo."""
        prod = self.db.query(Producto).filter(
            Producto.ID_Producto == ID_TOSTON
        ).first()
        prod.Stock = 0
        self.db.commit()
        self.crear(self.pedido(
            Metodo_Pago="Transferencia",
            comprobante_pago="https://cloudinary.test/comp.jpg",
        ))
        self.assertEqual(self.venta_creada().Sobre_Stock, 1)


# ══════════════════════════════════════════════════════════════════════════
# 2. Saldo a favor
# ══════════════════════════════════════════════════════════════════════════
class SaldoAFavorTests(CrearVentaBase):

    def test_el_saldo_baja_el_total_y_se_descuenta(self):
        self.dar_saldo(5000)
        self.crear(self.pedido(usar_credito=True, credito_monto=Decimal("5000")))
        self.assertEqual(self.venta_creada().Total, Decimal("15000"))
        self.assertEqual(self.saldo_actual(), Decimal("0"))

    def test_el_monto_pedido_es_un_tope_no_un_permiso(self):
        """Pedir más saldo del que hay no crea saldo: se recorta al real."""
        self.dar_saldo(3000)
        self.crear(self.pedido(usar_credito=True, credito_monto=Decimal("99999")))
        self.assertEqual(self.venta_creada().Total, Decimal("17000"))
        self.assertEqual(self.saldo_actual(), Decimal("0"))

    def test_se_puede_guardar_parte_del_saldo_para_despues(self):
        self.dar_saldo(20000)
        self.crear(self.pedido(usar_credito=True, credito_monto=Decimal("8000")))
        self.assertEqual(self.venta_creada().Total, Decimal("12000"))
        self.assertEqual(self.saldo_actual(), Decimal("12000"))

    def test_el_saldo_no_puede_pasar_del_total(self):
        self.dar_saldo(50000)
        self.crear(self.pedido(usar_credito=True))
        self.assertEqual(self.venta_creada().Total, Decimal("0"))
        # Solo se gastaron los $20.000 del pedido; el resto sigue disponible.
        self.assertEqual(self.saldo_actual(), Decimal("30000"))

    def test_sin_usar_credito_el_saldo_queda_intacto(self):
        self.dar_saldo(20000)
        self.crear(self.pedido())
        self.assertEqual(self.venta_creada().Total, Decimal("20000"))
        self.assertEqual(self.saldo_actual(), Decimal("20000"))

    def test_saldo_con_domicilio_el_costo_se_suma_despues(self):
        """El domicilio no se puede pagar con saldo: se suma al final."""
        self.dar_saldo(20000)
        self.crear(self.pedido(
            usar_credito=True,
            credito_monto=Decimal("20000"),
            domicilio=self.domicilio(),
        ))
        self.assertEqual(self.venta_creada().Total, COSTO_DOMICILIO)


# ══════════════════════════════════════════════════════════════════════════
# 3. Pedido con anticipo (por encima del stock)
# ══════════════════════════════════════════════════════════════════════════
class AnticipoTests(CrearVentaBase):

    def sobre_stock(self, cantidad=5, **kwargs):
        """Torta Tropical tiene stock 2: pedir 5 dispara el anticipo."""
        return self.pedido(
            productos=[ProductoVentaInput(ID_Producto=ID_TORTA, Cantidad=cantidad)],
            **kwargs,
        )

    def test_sin_respaldo_se_rechaza(self):
        with self.assertRaises(HTTPException) as ctx:
            self.crear(self.sobre_stock())
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("anticipo", ctx.exception.detail.lower())

    def test_transferencia_con_comprobante_lo_respalda(self):
        self.crear(self.sobre_stock(
            Metodo_Pago="Transferencia",
            comprobante_pago="https://cloudinary.test/comp.jpg",
        ))
        v = self.venta_creada()
        self.assertEqual(v.Sobre_Stock, 1)
        # 5 tortas × $10.000 = $50.000 → anticipo del 50%.
        self.assertEqual(v.Anticipo_Requerido, Decimal("25000"))

    def test_el_saldo_a_favor_baja_el_anticipo(self):
        """El anticipo sale de lo que QUEDA por pagar, como el checkout."""
        self.dar_saldo(10000)
        self.crear(self.sobre_stock(
            usar_credito=True,
            credito_monto=Decimal("10000"),
            requiere_anticipo=True,
            anticipo_monto=20000.0,
            anticipo_metodo_pago="Transferencia",
            anticipo_comprobante_url="https://cloudinary.test/ant.jpg",
            anticipo_registrado=True,
        ))
        v = self.venta_creada()
        # $50.000 − $10.000 de saldo = $40.000 por pagar → anticipo $20.000.
        self.assertEqual(v.Anticipo_Requerido, Decimal("20000"))
        self.assertEqual(v.Anticipo_Pagado, Decimal("10000"))

    def test_el_saldo_que_cubre_la_mitad_basta_sin_comprobante(self):
        self.dar_saldo(25000)
        self.crear(self.sobre_stock(usar_credito=True, credito_monto=Decimal("25000")))
        v = self.venta_creada()
        # $50.000 − $25.000 = $25.000 por pagar → anticipo $12.500, cubierto.
        self.assertEqual(v.Anticipo_Requerido, Decimal("12500"))
        self.assertEqual(v.Total, Decimal("25000"))

    def test_el_flujo_del_checkout_deja_el_anticipo_registrado(self):
        self.crear(self.sobre_stock(
            Metodo_Pago="Transferencia",
            requiere_anticipo=True,
            anticipo_monto=25000.0,
            anticipo_metodo_pago="Transferencia",
            anticipo_comprobante_url="https://cloudinary.test/ant.jpg",
            anticipo_registrado=True,
        ))
        v = self.venta_creada()
        self.assertEqual(v.Requiere_Anticipo, 1)
        self.assertEqual(v.Anticipo_Registrado, 1)
        self.assertEqual(v.Estado_Pago, "anticipo_pagado")
        self.assertEqual(v.Anticipo_Comprobante_Url, "https://cloudinary.test/ant.jpg")

    def test_pagar_todo_ahora_deja_el_pedido_saldado(self):
        self.crear(self.sobre_stock(
            Metodo_Pago="Transferencia",
            requiere_anticipo=True,
            anticipo_monto=50000.0,
            anticipo_metodo_pago="Transferencia",
            anticipo_comprobante_url="https://cloudinary.test/ant.jpg",
            anticipo_registrado=True,
        ))
        v = self.venta_creada()
        self.assertEqual(v.Pago_Final_Registrado, 1)
        self.assertEqual(v.Estado_Pago, "pagado_completo")

    def test_anticipo_en_efectivo_confirmado_sirve(self):
        self.crear(self.sobre_stock(
            Metodo_Pago="Efectivo",
            requiere_anticipo=True,
            anticipo_monto=25000.0,
            anticipo_metodo_pago="Efectivo",
            anticipo_registrado=True,
        ))
        self.assertEqual(self.venta_creada().Estado_Pago, "anticipo_pagado")

    def test_anticipo_declarado_sin_pagar_no_pasa(self):
        """Decir "requiere anticipo" sin respaldo no alcanza."""
        with self.assertRaises(HTTPException) as ctx:
            self.crear(self.sobre_stock(
                requiere_anticipo=True,
                anticipo_monto=25000.0,
                anticipo_metodo_pago="Efectivo",
                anticipo_registrado=False,
            ))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_con_domicilio_el_anticipo_incluye_el_costo(self):
        self.crear(self.sobre_stock(
            Metodo_Pago="Transferencia",
            comprobante_pago="https://cloudinary.test/comp.jpg",
            domicilio=self.domicilio(),
        ))
        v = self.venta_creada()
        esperado = (Decimal("50000") + COSTO_DOMICILIO) / 2
        self.assertEqual(v.Anticipo_Requerido, esperado)

    def test_el_personal_no_necesita_anticipo(self):
        """Los pedidos de mostrador se cobran en el acto."""
        self.crear(self.sobre_stock(creado_por_admin=True))
        v = self.venta_creada()
        self.assertEqual(v.Sobre_Stock, 1)
        self.assertEqual(v.Estado, 4)  # CONFIRMADO


# ══════════════════════════════════════════════════════════════════════════
# 4. Pago mixto
# ══════════════════════════════════════════════════════════════════════════
class PagoMixtoTests(CrearVentaBase):

    def test_reparte_el_total_entre_efectivo_y_transferencia(self):
        self.crear(self.pedido(
            Metodo_Pago="Mixto",
            pago_efectivo_monto=Decimal("3500"),
            comprobante_pago="https://cloudinary.test/comp.jpg",
        ))
        v = self.venta_creada()
        self.assertEqual(v.Monto_Efectivo, Decimal("3500.00"))
        self.assertEqual(v.Monto_Transferencia, Decimal("16500.00"))
        self.assertEqual(v.Monto_Efectivo + v.Monto_Transferencia, v.Total)

    def test_el_reparto_se_hace_sobre_el_total_con_saldo_y_domicilio(self):
        self.dar_saldo(5000)
        self.crear(self.pedido(
            Metodo_Pago="Mixto",
            pago_efectivo_monto=Decimal("4000"),
            usar_credito=True,
            credito_monto=Decimal("5000"),
            domicilio=self.domicilio(),
            comprobante_pago="https://cloudinary.test/comp.jpg",
        ))
        v = self.venta_creada()
        self.assertEqual(v.Total, Decimal("15000") + COSTO_DOMICILIO)
        self.assertEqual(v.Monto_Efectivo, Decimal("4000.00"))
        self.assertEqual(v.Monto_Efectivo + v.Monto_Transferencia, v.Total)

    def test_pedir_mas_efectivo_que_el_total_se_recorta(self):
        self.crear(self.pedido(
            Metodo_Pago="Mixto",
            pago_efectivo_monto=Decimal("99999"),
            comprobante_pago="https://cloudinary.test/comp.jpg",
        ))
        v = self.venta_creada()
        self.assertEqual(v.Monto_Efectivo, v.Total)
        self.assertEqual(v.Monto_Transferencia, Decimal("0.00"))

    def test_mixto_con_anticipo_se_rechaza(self):
        """Lo que se acaba de arreglar: el mixto no respalda un anticipo."""
        with self.assertRaises(HTTPException) as ctx:
            self.crear(self.pedido(
                productos=[ProductoVentaInput(ID_Producto=ID_TORTA, Cantidad=5)],
                Metodo_Pago="Mixto",
                pago_efectivo_monto=Decimal("5000"),
                comprobante_pago="https://cloudinary.test/comp.jpg",
            ))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("mixto", ctx.exception.detail.lower())

    def test_mixto_con_anticipo_declarado_tambien_se_rechaza(self):
        with self.assertRaises(HTTPException) as ctx:
            self.crear(self.pedido(
                Metodo_Pago="Mixto",
                pago_efectivo_monto=Decimal("5000"),
                requiere_anticipo=True,
                anticipo_monto=10000.0,
                anticipo_registrado=True,
            ))
        self.assertEqual(ctx.exception.status_code, 400)


# ══════════════════════════════════════════════════════════════════════════
# 5. Pedidos del personal
# ══════════════════════════════════════════════════════════════════════════
class PedidoDelPersonalTests(CrearVentaBase):

    def test_nace_confirmado_y_reserva_stock_en_pickup(self):
        self.crear(self.pedido(creado_por_admin=True))
        self.assertEqual(self.venta_creada().Estado, 4)
        # Pickup: el stock se reserva en el acto.
        self.assertEqual(self.stock(ID_TOSTON), 8)

    def test_con_domicilio_el_stock_se_descuenta_al_entregar(self):
        self.crear(self.pedido(creado_por_admin=True, domicilio=self.domicilio()))
        self.assertEqual(self.venta_creada().Estado, 4)
        self.assertEqual(self.stock(ID_TOSTON), 10)

    def test_domicilio_con_repartidor_nace_asignado(self):
        self.crear(self.pedido(
            creado_por_admin=True,
            domicilio=self.domicilio(ID_Empleado=4),
        ))
        self.assertEqual(self.db.query(Domicilio).first().Estado, 10)


if __name__ == "__main__":
    unittest.main(verbosity=2)
