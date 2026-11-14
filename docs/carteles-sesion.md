# Carteles vinculados a sesiones

## Comportamiento

En el detalle de una sesión propia, futura y no cancelada, si falta el cartel aparece Crear cartel. Abre Plantillas con la sesión seleccionada; al elegir estilo se cargan sus datos y se continúa con fotos y formato. Crear desde Carteles usa el mismo recorrido y asigna el resultado a la sesión elegida.

Ambos selectores usan tarjetas de 106 px con una miniatura de 48 × 72 px a la izquierda. Sin cartel conservan ese mismo espacio con un icono. La miniatura respeta la firma de medios protegidos. Una sesión con cartel pide confirmar antes de continuar; cancelar no selecciona ni gasta créditos.

El cartel anterior se conserva hasta completar la generación. Se invalida la caché de sesión y agenda al completar o recuperar trabajos, para mostrar el resultado en detalle y selector.

## Persistencia

reserve_session_poster_job envuelve la reserva existente, conserva autorización, presupuesto e idempotencia y captura el cartel confirmado. Una discrepancia se rechaza antes de reservar. La app vuelve al selector y actualiza las sesiones.

El generador guarda la imagen original privada y una copia duradera en el almacenamiento de carteles de sesiones. No se almacena una URL firmada que caduque. Al completar el trabajo, el trigger apply_generated_session_poster actualiza poster_url en la misma transacción, únicamente para la sesión y propietario del trabajo y si su cartel todavía coincide con el confirmado. Si cambió durante la generación se guarda el resultado en Mis carteles sin sobrescribir la sesión. Funciona con la app cerrada. No se reasignan carteles históricos.

La migración no concede acceso de cliente a la reserva ni al trigger. El servicio conserva JWT y controles de cuenta, créditos y gasto.

## Verificación

33 pruebas del servicio, proveedor, notificaciones y asignación correctas. Incluyen sesión sin cartel, sustitución confirmada, reintentos, cambio manual concurrente, fallo y aislamiento entre cuentas. TypeScript y JSX correctos. Recorrido completo con API simulada en Chrome a 390 y 320 px: detalle → plantilla → generación → cartel visible en sesión; miniatura y tarjetas iguales; cancelar/aceptar sustitución; asociación de la sesión exacta.

Migración aplicada y servicio poster-ai activo versión 27 con JWT. Verificados columnas, trigger y permisos en el proyecto real. No se realizaron generaciones de pago durante las pruebas. La app está disponible para probar mediante el servidor de Expo Go actual; no se publicó una build de tienda.
