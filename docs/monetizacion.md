# Monetización de DJ Planner

## Oferta

| Función | Gratis | Pro |
| --- | --- | --- |
| Sesiones simples propias guardadas | Hasta 15 | Sin límite |
| Sesiones condicionales | — | Incluido |
| Invitados y acompañantes | — | Incluido |
| Acceso por QR/manual y control de puerta | — | Incluido |
| Resumen básico de estadísticas, antes de «Evolución» | Incluido | Incluido |
| Desde «Evolución», incluido cobros y cinco analíticas avanzadas | Vista previa difuminada | Incluido |
| Gastos, preparación, mixes y lugares | Incluido | Incluido |
| Comunidad y perfil DJ | Incluido | Incluido |

El límite incluye historial, canceladas y cada fecha de una serie. Eliminar libera espacio. Las sesiones recibidas por invitación no consumen el límite. El catálogo está en `src/config/proFeatures.ts`.

## Recorrido actual

Las cuentas Gratis abren directamente la paywall al tocar Condicional, Invitados o Acceso desde el menú +. Invitados y Acceso también la abren desde el detalle, conservando `sessionId` y permitiendo volver al mismo detalle. Las cuentas Pro entran directamente en las herramientas.

Estadísticas mantiene gratis los cachés acordados, los próximos 30 días y el resumen de métricas principales. Desde «Evolución», incluido ese bloque y «Cobro de tus sesiones», requiere Pro. El resto muestra una vista previa difuminada y «Ver planes Pro». Una suscripción vigente o la prueba activa desbloquea el contenido completo.

Las pantallas explicativas se han retirado del recorrido. Los enlaces antiguos de `pro-feature` redirigen a la paywall conservando motivo y sesión. La página general de Pro mantiene el catálogo, sin enlaces a explicaciones.

La paywall respeta Light y Dark, muestra las ventajas con ✓ arriba, la foto, la prueba como opción principal. «Ver precios» abre una segunda vista con mensual/anual, importe total, renovación y cancelación. No se muestran importes de ejemplo que puedan confundirse con el precio de la app.

## Prueba acordada

Oferta actual aprobada: **4,99 €/mes y 14,99 €/año como precio de lanzamiento**. **39,99 €/año es el precio estándar previsto**, aún no configurado en las tiendas. La app no lo presenta como un precio anterior ni como una renovación automática ya programada. Los precios de compra siguen viniendo de la tienda y respetan la moneda del país del usuario.

15 días de Pro desde la activación, voluntarios, sin tarjeta, sin contratar una suscripción y sin cobro automático. Al terminar se vuelve a Gratis y se conservan los datos. La duración se define como 360 horas (`PRO_TRIAL_DAYS = 15`), independiente de las ofertas introductorias de las tiendas.

**Implementada y desplegada el 15 de octubre de 2026.** El botón llama a `start_pro_trial`, autenticado, sin contactar con la tienda ni contratar una suscripción. La tabla privada `billing_private.pro_trials` conserva inicio y fin calculados en el servidor. Las nuevas pruebas duran exactamente 15 días; las activadas antes del cambio conservan el fin original. La clave por cuenta y un bloqueo transaccional impiden reinicios y duplicados; reintentar devuelve la prueba original. Una prueba caducada no vuelve a ser elegible.

El permiso se calcula en cada consulta: suscripción de pago vigente o prueba vigente. No hace falta un proceso programado para caducar. La app consulta al volver al primer plano y al alcanzar la fecha de fin. Al terminar conserva todas las sesiones, permite consultarlas y editar sus datos básicos, y vuelve al límite de 15 para nuevas creaciones. El pago vigente mantiene Pro aunque la prueba haya terminado. La página de cuenta muestra la fecha de fin y la paywall permite continuar en la herramienta que originó el acceso.

## Suscripciones y estado real

- La compra de pago y su restauración usan RevenueCat y se verifican con `subscription-access`.
- Los precios se leen de los productos de la tienda. No hay precios inventados ni descuentos entre monedas distintas. Si solo existe un paquete, se selecciona ese paquete.
- iOS está conectado. Android admite su propia clave pública mediante `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`, pero falta crear/conectar su app y productos. Web y Expo Go no realizan compras.
- Sesiones ilimitadas y condicionales ya tienen control Pro en servidor. Invitados, Acceso y puerta aún necesitan completar ese control antes de venderlos como exclusivos. La paywall del recorrido no sustituye una autorización en servidor; sus rutas directas todavía conservan el acceso de pruebas.
- Contrataciones y documentos siguen ocultos; no se venden como prestaciones disponibles.

## Pendiente antes de cobrar

1. iOS ya tiene ambos productos aprobados. Revisar las ofertas existentes (una semana mensual, dos semanas anual) y el nivel de servicio de ambos planes. Crear la app y los productos Android.
2. iOS ya está asociado a `DJ Planner Pro` y a `$rc_monthly`/`$rc_annual` en la oferta actual `default`. Añadir la conexión Google Play y su clave pública en la app.
3. Completar el control Pro de Invitados/Acceso/puerta y definir cómo continúa una sesión con personal ya autorizado tras vencer Pro. La prueba por cuenta ya está implementada y probada.
4. Comprobar claves, verificación de suscriptores, términos y privacidad definitivos.
5. Probar compra, cancelación, restauración, renovación, expiración, reembolso, periodo de gracia, cambio de cuenta y conexión en una versión nativa/TestFlight. Expo Go permite revisar la interfaz y no confirma compras reales.

No se han creado productos ni cambiado precios en las tiendas durante esta preparación.

## Verificación local

Pruebas con cuentas simuladas: acceso directo a paywall para Gratis, entrada directa a herramientas para Pro, prueba de 15 días antes de los planes renovables, tema claro/oscuro a 320/390 px, vuelta al detalle con su sesión y ninguna activación o compra al abrir la pantalla. No se verifican aquí transacciones reales de la tienda.

Referencias: https://www.revenuecat.com/docs/getting-started/installation/expo y https://www.revenuecat.com/docs/test-and-launch/sandbox.

## Comprobación de las tiendas — 14 de octubre de 2026

Inspección de las pestañas abiertas, sin cambiar configuración ni publicar:

- App Store Connect: `djplanner.pro.monthly` y `djplanner.pro.yearly` aprobados, del mismo grupo. Mensual en nivel 2 y anual en nivel 1; al ofrecer las mismas prestaciones conviene igualar el nivel para que los cambios de plan se traten como cambios de periodicidad. Las ofertas introductorias visibles son una semana y dos semanas, respectivamente. La app consulta elegibilidad antes de anunciar una prueba introductoria gratuita y usa su duración real. Estas ofertas renovables son independientes del mes sin suscripción propuesto.
- RevenueCat: conexión App Store con credenciales de compra válidas; permiso exacto `DJ Planner Pro`, dos productos y dos paquetes de la oferta `default` correctos. No hay conexión Google Play. La comprobación automática del catálogo indica `Could not check`; la clave opcional de App Store Connect no está cargada. Esto no anula la aprobación observada en Apple.
- Google Play: la cuenta abierta muestra únicamente Bothside. DJ Planner no está en esa cuenta; no se han comprobado otras cuentas.
- Apple requiere que el titular acepte el contrato actualizado antes de enviar actualizaciones. No se ha aceptado.
- La descripción de la versión 1.0.2 contiene `https://tu-dominio.com/privacy`; debe sustituirse por la política definitiva. Esta observación se refiere a la descripción, no al campo independiente de privacidad.

La nueva interfaz se puede revisar, pero todavía no está lista para enviar a las tiendas: faltan los controles Pro pendientes y las pruebas de compra/restauración/renovación en una compilación nativa. No se promete aprobación de Apple o Google por el diseño.

## Verificación de la prueba real

`tests/proTrialDatabase.cjs` verifica autenticación, activación única, duración exacta de 15 días y conservación de pruebas anteriores, reintentos, aislamiento, protección de fechas, creación de más de 15 sesiones, caducidad sin pérdida de datos y prioridad del permiso pagado. También se ejecutó una prueba transaccional en DJ Planner Pro con una cuenta temporal y una serie de 32 sesiones; la caducidad restableció el límite y permitió editar los datos existentes. Todos los datos de esa prueba se revirtieron.

En Expo Go/web se muestran 4,99 €/mes y 14,99 €/año como precios de referencia para España, con texto explícito; no se pueden comprar. En una compilación nativa se exige el paquete real con periodo correcto y se usa su importe localizado. Si falla su carga, no se sustituye el precio real ni se habilita la compra.

La paywall avisa durante la prueba de que contratar inicia la suscripción en ese momento; no se programa automáticamente para después de la prueba gratuita. Las ofertas introductorias existentes de Apple se muestran por separado cuando la tienda confirma elegibilidad.

Compilación iOS solicitada con credenciales existentes: build 15, https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/builds/c4c7af5c-29f4-4419-b812-c5e4ce485882 . Se configuraron en el entorno de producción de Expo únicamente la URL pública y la clave pública anon del proyecto existente; no se subió la clave service_role. Falta completar la compilación y comprobar transacciones nativas en TestFlight; no se ha enviado una versión a revisión ni cambiado las ofertas de Apple.

Validación adicional: exportación nativa iOS completada (6.823 módulos y bundle Hermes), comprobación de tipos y pruebas de la paywall en Light/Dark a 320/390 px. Se verificaron activación explícita, fecha persistida al reabrir, prueba caducada sin reinicio, precios de referencia y compra deshabilitada en Expo Go/web. La exportación valida el código nativo; no equivale a probar una transacción de Apple.

## Submission iOS — 15 de octubre de 2026

Build 1.0.2 (15) completado y subido correctamente a App Store Connect mediante EAS Submit, reutilizando la clave ya configurada. Submission: https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/submissions/c1bd0805-db8e-4f4e-bb00-90b406074afa . Apple está procesando la compilación para TestFlight: https://appstoreconnect.apple.com/apps/6760347919/testflight/ios . Este upload no envía la versión a App Review ni la publica en App Store. Las transacciones nativas siguen pendientes de probar tras instalarla.

## Ajuste de lanzamiento — 15 de octubre de 2026

Gratis se reduce de 30 a 15 sesiones guardadas. No se borra ninguna sesión existente; las cuentas que superan el nuevo límite conservan consulta y edición básica y no pueden añadir sesiones hasta liberar espacio o activar Pro. La misma regla del servidor cubre inserciones directas y series completas. Expo y el build actual de TestFlight comparten ese servidor; el cambio de reglas se aplica a ambos.

Las nuevas pruebas duran 15 días exactos. La actualización no toca las fechas de pruebas ya activadas y un reintento nunca reinicia la duración. El anual muestra «Precio de lanzamiento» y «Estándar previsto: 39,99 €/año» solo para el precio de referencia EUR o para un producto real de 14,99 EUR. No se compara con precios en otra moneda; cuando el producto cambie de precio, la etiqueta se retirará. El ahorro frente al mensual se identifica explícitamente como esa comparación.

Se verificaron el límite 15/16, la atomicidad de series, la duración exacta de la prueba, la conservación de pruebas anteriores y los datos al caducar. La verificación remota usó fixtures que se revirtieron. No se cambió ningún producto/precio de Apple ni se generó/subió una nueva compilación. Antes de subir el precio a 39,99 €/año habrá que configurar el cambio en App Store Connect y decidir cómo afecta a los suscriptores actuales.

## Compilación DJ Planner — 15 de octubre de 2026

Compilación iOS de producción 1.0.2 (16) completada en Expo: https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/builds/3e4774df-8b65-49a4-83c5-d7a4a5ce754d . Se reutilizaron las credenciales existentes sin modificarlas. El archivo IPA se descargó y verificó: nombre visible `DJ Planner`, versión `1.0.2`, build `16` e identificador de aplicación conservado. No se ha enviado esta compilación a App Store Connect, App Review ni publicado.

Incluye el cambio de nombre público, las traducciones completas en siete idiomas y el formato regional de monedas. Los precios orientativos y mensajes de lanzamiento españoles solo se presentan en la vista previa de España; las compras nativas usan el precio localizado del producto de tienda. Se añadió `.easignore` para excluir configuración local y archivos de firma del código enviado; el paquete se inspeccionó antes de subirlo.

## Submission DJ Planner 1.0.2 (16) — 15 de octubre de 2026

EAS Submit ha completado la subida de la compilación `3e4774df-8b65-49a4-83c5-d7a4a5ce754d` a App Store Connect usando la clave API existente. Submission: https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/submissions/042bc66c-a5d5-4efc-83f9-77dc98140ff0 . Apple está procesando el archivo para TestFlight: https://appstoreconnect.apple.com/apps/6760347919/testflight/ios . Esta operación no publica la app ni la envía a App Review.

## Corrección del catálogo de pruebas y promoción anual — 15 de octubre de 2026

Las capturas de TestFlight muestran un catálogo USD (3,99 mensual / 12,99 anual) y una confirmación de Apple de 14,99 EUR/año. RevenueCat documenta que el catálogo de las tiendas de pruebas puede devolver precios o monedas incoherentes: https://www.revenuecat.com/docs/test-and-launch/sandbox#platform-sandbox-limitations . No se fuerza la moneda según ubicación física ni se cambian productos o tarifas de Apple.

Corrección local posterior al build 16: país de la cuenta mediante `getStorefront`, actualización de metadatos con `getProducts` conservando paquetes/atribución, referencias españolas explícitas si el catálogo contradice una cuenta ES/ESP, botón de confirmación en tienda y promoción anual nativa de 14,99 EUR con estándar previsto de 39,99 EUR/año. El propietario confirmó 14,99 EUR/año mientras esté vigente la oferta, sin una renovación automática de 39,99 EUR después del primer año. Las respuestas de precios antiguas se descartan y volver de la pantalla de compra no inicia un refresco concurrente.

La corrección requiere una nueva compilación para probarla en TestFlight; el build 16 ya enviado no contiene estos cambios.


## Build y submission 1.0.2 (18) — 16 de octubre de 2026

Build de producción iOS completado: https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/builds/85867b91-2048-4feb-a726-985c8ee33bc1 . Incluye oscuro lima por defecto para nuevas instalaciones, acceso y bienvenida en oscuro lima, acento seleccionado en detalle del lugar y puntuaciones con estrellas y números visibles. Conserva las apariencias elegidas previamente. Comprobación de tipos correcta y 181 pruebas superadas.

EAS Submit confirma la subida a App Store Connect: https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/submissions/6043bca9-3373-42a2-b31c-41dc9df7c1ed . Apple procesa el archivo para TestFlight: https://appstoreconnect.apple.com/apps/6760347919/testflight/ios . Esta operación no envía la app a App Review ni la publica. Se reutilizaron las credenciales existentes.
