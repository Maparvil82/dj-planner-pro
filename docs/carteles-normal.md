# Carteles: Pro coherente y estado de compras

Actualización posterior de precios: guardados en Apple 5 créditos por 5,99 € y 12 por 12,99 €. Ver `carteles-precios-2026-10-28.md`. El informe inferior conserva el estado anterior a ese cambio de precios.

Actualización 28 octubre 2026. Solicitud del propietario: «arregla todo, déjalo normal».

## Resultado publicado

Servicio `poster-ai` versión 31, con JWT obligatorio. Un usuario con acceso Pro activo recibe 5 créditos de bienvenida; Gratis recibe 3. Incluye el período de prueba de Pro. Se mantiene un solo regalo, se completa solo la diferencia y no se repone lo gastado al volver a abrir.

La migración `20261027225945_poster_pro_welcome_consistency.sql` hace que el estado devuelto por el servidor incluya `proActive`, calculado con los mismos registros de acceso temporal y suscripción que utiliza la app. La reclamación vuelve a verificar este acceso en la base de datos. Los derechos de RevenueCat activos también cuentan para el regalo (incluidos prueba, compartido y Sandbox); las compras de créditos continúan exigiendo transacciones de producción de App Store y no cambian por esta regla.

Se completó a 5 el regalo de la única cuenta que había recibido 3 y tenía prueba Pro activa. Comprobación remota: 5 créditos concedidos, 5 disponibles, `proActive=true`, `pro_claimed=true`. Se mantienen los 250 EUR de techo, 3,13 EUR contabilizados y cero reservas. No se generaron imágenes ni se realizaron compras para este cambio.

Interfaz: retirado «Pro de pago»; el mensaje incluye Pro de prueba. No se muestra recuperación de compras a una cuenta sin saldo comprado mientras las ventas estén cerradas. Tampoco se invita a comprar en iPhone desde Expo Go cuando no está disponible el catálogo. El saldo confirmado sigue visible; los regalos se abonan automáticamente.

## Compras: bloqueo externo confirmado

Comprobación directa en App Store Connect el 28 octubre: los consumibles `com.djplannerpro.app.postercredits5` (6825300337) y `com.djplannerpro.app.postercredits12` (6825308839) siguen en Borradores / En preparación para el envío. En el producto de 5, Apple indica que el primer consumible requiere una nueva versión. La captura de revisión no está cargada; las notas están vacías; la disponibilidad del producto está limitada a 1 de 175 países o regiones (preparación previa: España).

No se han publicado ventas ni se ha cambiado un precio, disponibilidad, producto o envío en Apple. El indicador público de compras sigue apagado porque los consumibles no están aprobados. La app indica que la compra estará disponible próximamente. La aprobación de Apple y la validación de StoreKit real no se pueden sustituir activando un interruptor del servidor.

El envío de la nueva versión sigue previsto para el 1 de noviembre por instrucción anterior del usuario. Se ha actualizado el recordatorio existente con los dos consumibles y las comprobaciones de compra, cancelación, recuperación y devolución en TestFlight; captura y notas de revisión; disponibilidad regional y activación pública posterior. Mantiene la instrucción de confirmar crédito de Expo antes de compilar y no autoriza publicación automática.

Fuente de Apple: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase

## Validación

269 pruebas correctas; TypeScript, Deno y JSX correctos. Casos añadidos: Pro de prueba validado por servidor sin depender de la tienda, rechazo de un `isPro` enviado por el cliente, corrección retroactiva +2 después de gastar, no reponer en reintentos, prueba caducada, activación posterior y preservación de saldo comprado/presupuesto. Los 26 archivos leídos de producción coinciden con el despliegue esperado; solo cambian `index.ts` y `commerce.ts` respecto a v30.

Asesor de seguridad sin avisos nuevos. Respaldos, pruebas y evidencia: `outputs/carteles-normal/` en la raíz del espacio de trabajo.
