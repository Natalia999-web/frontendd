/* Qué se puede tocar de un pedido según su estado, y por lo tanto cuándo tiene
   sentido abrir el editor. Vive fuera del componente para que Gestión de pedidos
   pueda preguntar antes de ofrecer el botón. */
export const PERMISOS_POR_ESTADO = {
  "Pendiente": {
    cliente:           true,
    productos:         true,
    metodo_pago:       true,
    domicilio:         true,
    direccion_entrega: true,
    notas:             true,
    descuento:         true,
  },
  "En producción": {
    cliente:           false,
    productos:         false,
    metodo_pago:       true,
    domicilio:         false,
    direccion_entrega: true,
    notas:             true,
    descuento:         true,
  },
  "Listo": {
    cliente:           false,
    productos:         false,
    metodo_pago:       true,
    domicilio:         true,
    direccion_entrega: true,
    notas:             true,
    descuento:         false,
  },
  "En camino": {
    cliente:           false,
    productos:         false,
    metodo_pago:       false,
    domicilio:         false,
    direccion_entrega: true,
    notas:             true,
    descuento:         false,
  },
};


/* Estados donde el editor tiene algo que ofrecer. "Confirmado" no está en la
   tabla de arriba: el botón de editar se mostraba igual y el editor respondía
   con un cartel de "no editable". En camino queda fuera aparte, porque a esa
   altura el pedido ya va con el domiciliario. */
const NO_EDITABLES_EN_RUTA = ["Asignado", "En camino"];

export const puedeEditarsePedido = (estado) =>
  !!PERMISOS_POR_ESTADO[estado] && !NO_EDITABLES_EN_RUTA.includes(estado);
