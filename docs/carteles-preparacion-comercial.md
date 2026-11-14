Actualización 28 octubre 2026: regla final Gratis 3 / Pro activo 5, incluido Pro de prueba; cuenta corregida a 5 y servicio v31 publicado. Los dos consumibles siguen en borrador en Apple y las ventas públicas siguen pendientes de la nueva versión. Ver `carteles-normal.md`; el texto inferior conserva el historial.

Actualización 27 octubre 2026, campaña activada: 3 créditos Gratis / 5 Pro de pago verificado; compras todavía desactivadas, techo global de IA 250 EUR. Estado actual en `carteles-bienvenida-3-5.md`; el resto conserva el historial.

# Carteles: preparación comercial privada

Actualización del 27 de octubre de 2026: el acceso al creador se abre para todas las cuentas confirmadas por instrucción del propietario. Compras y regalos continúan desactivados; no se asignan créditos automáticamente. Estado actual en `carteles-acceso-general.md`. El resto de este documento conserva la preparación histórica.

23 octubre 2026. Preparación implementada y servidor actualizado, **sin lanzamiento público ni ventas activadas**. Google sigue en Vertex con la prueba de Bothside. El límite global continúa en 500 céntimos y conserva el consumo histórico. No se ha actualizado Google a pago ni configurado ninguna recarga.

## Acceso y saldo

`poster_commerce_settings` tiene tres interruptores independientes, inicialmente desactivados: acceso público, compras y promoción. `poster_commerce_access` permite invitaciones por cuenta o cuentas específicas de revisión de Apple. No hay invitaciones creadas. La cuenta propietaria conserva el modo de simulación y sus 9 créditos de prueba; ningún saldo de Sandbox pasa a producción.

La nueva app consulta `poster_feature_access()` para habilitar la creación y las consultas privadas. La navegación y las muestras son visibles para todas las cuentas autenticadas, según `carteles-navegacion.md`. Su envoltorio público es invoker; el chequeo privilegiado reside en el esquema privado, no acepta identificadores del cliente y exige el usuario autenticado confirmado. El servidor vuelve a comprobar el acceso y el estado de la cuenta. Las reservas usan la cuenta de Auth, nunca un usuario o un saldo enviado en el cuerpo. Listar, abrir, editar, publicar y guardar imágenes filtra por ese usuario. La pantalla se remonta al cambiar de cuenta para no conservar fotos ni carteles de la anterior.

Las carteras comerciales están en `poster_wallets`, separadas de `poster_test_wallets`. Un crédito son dos unidades: crear reserva dos unidades; editar, una. Los regalos se consumen primero. Las compras no caducan. Cada reserva, consumo, liberación, compra, devolución y regalo deja un movimiento. Un fallo confirmado libera créditos; un resultado desconocido retiene la reserva y bloquea otra generación para esa cuenta. Repetir una solicitud no duplica cargos.

## Compras y reembolsos

Se mantienen los productos ya preparados: `com.djplannerpro.app.postercredits5` y `com.djplannerpro.app.postercredits12`. Los precios base documentados son 8,99 EUR y 19,99 EUR; los precios de lanzamiento propuestos en conversación no se han cambiado en Apple. La interfaz obtiene el precio localizado de la tienda.

Producción utiliza la API V2 de RevenueCat desde el servidor: compras del cliente autenticado, catálogo de productos de la app fijada y estado `owned`/`refunded`. Solo se admiten App Store, entorno production y consumibles conocidos. La clave secreta tiene permisos de lectura de compras y productos, sin escritura, cobros, devoluciones ni administración de usuarios. Se usa el identificador de transacción de la tienda para conciliar recuperación y avisos, no el identificador interno que devolvía V1.

`poster-store-webhook` verifica un Authorization secreto independiente y consulta el estado actual en RevenueCat antes de liquidar. Nunca concede saldo a partir del JSON de un cliente o de un aviso sin verificar. Los duplicados no abonan dos veces; las lecturas iniciadas antes de otra liquidación no la sobrescriben. El endpoint confirma recepción después del cambio durable, para permitir los reintentos del proveedor ante fallos. Las compras quedan vinculadas al comprador autenticado original; no se fusionan saldos por alias ni por restaurar otra cuenta.

Si una compra ya gastada se reembolsa, el saldo pagado puede quedar en deuda: se conservan los carteles anteriores, se bloquean nuevas generaciones y las compras futuras compensan la deuda. Una reversión de reembolso repone exactamente el abono retirado. Tras borrar una cuenta se conserva únicamente la mínima referencia comercial de la transacción, sin usuario asociado, para impedir acreditarla otra vez en otra cuenta. Debe reflejarse esta retención en la información de privacidad antes de publicar.

Las cuentas expresamente marcadas para App Review usan Sandbox y su cartera de prueba, incluso si la app enviada es de distribución. No abonan saldo comercial. El propietario mantiene también la simulación anterior para Expo Go.

## Promoción preparada, sin activar

Regalo flexible de bienvenida: 1,5 créditos para gratuitos y 4,5 para Pro de pago verificado en el servidor. No es una asignación mensual. Si alguien recibe el gratuito y después cumple Pro, se añade solo la diferencia. No se confía en el plan enviado por el cliente ni en metadatos editables. Sandbox, pruebas de suscripción, reembolsos y acceso expirado no dan regalo Pro.

Plazas iniciales configurables: 200 gratuitas y 50 Pro; presupuesto de regalo inicial **cero**, por lo que no se puede reclamar. El operador debe asignar primero un máximo de unidades y una campaña financiada y autorizada. El cierre, las plazas y el total otorgado se comprueban en una transacción. Un HMAC de la dirección confirmada evita repetir el regalo con el mismo correo después de borrar la cuenta. La clave de HMAC solo reside en secretos del servidor; no se guarda el correo en las reclamaciones.

Estos son créditos flexibles: 4,5 créditos pueden convertirse en nueve cambios, no solamente en tres creaciones y tres cambios. Para presupuestar regalos hay que contemplar ese peor caso y no convertir créditos en número de carteles terminados automáticamente. El tope de unidades regaladas limita la responsabilidad promocional y el presupuesto global de IA limita las llamadas, también las de saldo comprado.

## Conexión externa comprobada

- Proyecto RevenueCat comprobado en la consola: `2a56c306`, identificador REST V2 `proj2a56c306`; app App Store `app9256c04b19`, paquete `com.djplannerpro.app`.
- Tras autorización explícita, creada la clave V2 «DJ Planner · Carteles · Solo lectura»: Purchases Configuration Read only y Products Configuration Read only; todo lo demás sin acceso. Guardada únicamente como `POSTER_REVENUECAT_SECRET_KEY` en secretos de Supabase. Las consultas reales de los dos productos y las compras del propietario respondieron HTTP 200; los productos pertenecen a la app fijada y son consumibles. La consulta del propietario devolvió cero compras; no se ha probado una compra real.
- Conexión creada «DJ Planner · Créditos de Carteles», identificador `whintgr20fe92212c`. Receptor: `https://voyurnwckmateohuzbab.supabase.co/functions/v1/poster-store-webhook`. Solo app DJ Planner de App Store, entorno producción y tipos Non renewing purchase, Cancellation y Refund reversed. Usa Authorization Bearer dedicado, igual a `POSTER_REVENUECAT_WEBHOOK_TOKEN`; su valor no se incluye en documentación, cliente o chat.
- Prueba TEST enviada desde RevenueCat el 23 octubre 2026 a las 13:30:43 UTC: HTTP 200 y `{"received":true}`. Sin autorización, el receptor devuelve HTTP 401. Después de esta prueba se estableció `POSTER_STORE_WEBHOOK_READY=true`. Este indicador acredita la configuración probada, no la disponibilidad futura del proveedor ni un circuito de compra real. Las compras, el acceso público y los regalos siguen desactivados en la base de datos.
- RevenueCat muestra la In-App Purchase Key existente como **Valid credentials**. En notificaciones de Apple muestra **No notifications received**: esto no demuestra que la URL esté configurada correctamente en App Store Connect. Sigue pendiente comprobar esa URL y la entrega desde Apple para validar reembolsos de consumibles. No se ha cambiado la configuración existente de Apple.

## Pendiente antes del lanzamiento

- Confirmar el estado de aprobación y disponibilidad de los dos productos en Apple; empaquetar la nueva interfaz en una compilación privada y validar compra/recuperación en Sandbox. La modificación del servidor funciona con el cliente privado anterior; la nueva navegación y pantalla comercial requieren actualizar el cliente.
- Antes de abrir: fijar precios definitivos, aprobar financiación posterior a la prueba de Google, asignar el presupuesto de campaña y de operación, completar la revisión de Apple y comprobar el circuito de compra y devolución con las integraciones conectadas. No basta con mostrar el menú para vender.

## Verificación

Pruebas automatizadas de dos cuentas, saldo histórico, techo global compartido, compras repetidas, devoluciones antes/después del consumo, eventos desordenados, regalos, mejora a Pro, borrado de cuenta, permisos de anon/authenticated/service_role y prueba de App Review. Se ejecuta además el handler real de la función con proveedor simulado para verificar que reserva, salida y descarga usan el usuario autenticado y que un cuerpo con otro usuario no lo cambia. Pruebas del receptor cubren secreto, eventos ajenos, paginación restringida a RevenueCat, estado actual y errores durables.

Comprobación remota tras migración: 9 créditos privados, 286 céntimos contabilizados, 0 reservados, tope 500 céntimos, cero carteras de pago/transacciones/invitaciones; todos los interruptores apagados. Los clientes no pueden concederse saldo ni cambiar interruptores. Asesores sin nuevos avisos WARN de seguridad para carteles; las tablas del servidor tienen RLS sin políticas de cliente a propósito. Se cubren además las claves externas de sesiones, padres, recibos y movimientos de prueba con índices.

53 pruebas automatizadas superadas, comprobación de tipos de la app y de ambas funciones, y exportación web completadas. No se ha ejecutado ninguna generación adicional de Google ni compra de dinero real durante esta preparación.

Fuentes: [RevenueCat V2 compras](https://www.revenuecat.com/docs/api-v2/purchase), [recursos del cliente](https://www.revenuecat.com/docs/api-v2/customer/resources), [webhooks](https://www.revenuecat.com/docs/integrations/webhooks), [reembolsos](https://www.revenuecat.com/docs/subscription-guidance/refunds), [autenticación de funciones Supabase](https://supabase.com/docs/guides/functions/auth-headers).
