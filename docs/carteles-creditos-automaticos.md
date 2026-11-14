Actualización 28 octubre 2026: regla final Gratis 3 / Pro activo 5, incluido Pro de prueba; cuenta corregida a 5 y servicio v31 publicado. Los dos consumibles siguen en borrador en Apple y las ventas públicas siguen pendientes de la nueva versión. Ver `carteles-normal.md`; el texto inferior conserva el historial.

# Carteles: créditos de bienvenida automáticos

27 octubre 2026. Publicado `poster-ai` versión 30 con JWT obligatorio. El propietario solicita saldo visible al entrar, sin reclamar un premio.

## Causa del error

El registro de PostgreSQL de las solicitudes de las 22:34:57 y 22:35:37 UTC mostraba `UPDATE requires a WHERE clause`. PostgREST carga `safeupdate` en su conexión. La función de regalo actualizaba la tabla de configuración única sin un `WHERE`: funcionaba en una conexión SQL administrativa y fallaba al usar la API desde la app.

La migración `20261027223843_poster_automatic_welcome_credits.sql` añade `where id=true` a esa actualización. No añade permisos, cambia roles ni desactiva la protección.

## Comportamiento

- `list` y `status` verifican el regalo y devuelven el saldo después del abono. El antiguo `claim_promotion` se conserva como alias idempotente para clientes anteriores.
- Pro se verifica en RevenueCat desde el servidor; no se acepta el plan ni el usuario del cuerpo enviado por el cliente.
- Gratis recibe 3 créditos, Pro de pago 5; una mejora añade solo los 2 restantes. El saldo gastado no se repone al abrir la pantalla.
- Identidad HMAC y transacción con bloqueo de cuenta/configuración impiden duplicados, incluida la apertura simultánea.
- Cuentas de simulación conservan sus créditos existentes. Se mantienen la campaña de 1.000 créditos y el techo interno global de 250 EUR.
- Un fallo de verificación o abono inesperado devuelve un error de sincronización, en lugar de confirmar un cero provisional. Campaña cerrada o identidad ya usada conserva el saldo existente.
- La interfaz ya no muestra el botón de reclamar; el saldo se actualiza al enfocar Carteles. Durante la primera consulta muestra «Consultando…». El saldo confirmado permanece visible en la cabecera.

## Validación

266 pruebas automáticas correctas; TypeScript, JSX y Deno correctos. Casos nuevos de handler: abono antes de responder `list`, Pro directo, mejora +2 después de gastar, clientes antiguos, errores de RevenueCat y base de datos, campañas cerradas, identidad usada y simulación.

Prueba con Supabase local aislado y la API PostgREST real: se reprodujo el fallo de `safeupdate` con la función anterior, se aplicó la corrección y se comprobaron 3 créditos Gratis, 5 Pro, mejora +2, dos peticiones simultáneas sin duplicar y rechazo del cliente anónimo. No cambió el presupuesto del proveedor. Solo cuentas ficticias; ninguna generación de imágenes ni compra.

Producción: los 26 archivos leídos tras el despliegue coinciden con la versión esperada; únicamente cambia el handler respecto a v29. Restricción y configuración verificadas: 250 EUR de techo, 3,13 EUR contabilizados, cero reservas al comprobar, compras apagadas. Asesor de seguridad sin avisos nuevos.

Expo Go: se envió la orden de recarga al servidor local y los clientes volvieron a conectarse. Aún no se había registrado un abono real al verificar; queda comprobarlo al entrar en Carteles con una cuenta normal. No se afirma haber visto la pantalla del iPhone ni comprobado una suscripción concreta del usuario.

El entorno local aislado se detiene al terminar; no se detienen otros proyectos. Evidencia en `outputs/carteles-creditos-automaticos/` de la raíz del espacio de trabajo, con respaldo de v29.
