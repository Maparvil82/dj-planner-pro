# Traspaso de DJ Planner

Corte del 15 de noviembre de 2026, hora de Madrid. Punto de partida en Git: `codex/session-management-and-security` (`7cb685f` antes de este documento). El repositorio es `Maparvil82/dj-planner-pro`. La rama `feature/carteles-lab` (`0d9ed16`) es un laboratorio aislado. Para continuar la app publicada, abre el repositorio `dj-planner-pro` y trabaja desde la primera rama. La raíz del proyecto de ChatGPT también contiene otros repositorios, capturas y pruebas.

## 1. Publicaciones y procedencia

| Canal | Último estado contrastado | Build, rama y evidencia |
| --- | --- | --- |
| App Store, ficha española | **1.0.6** pública desde el **4 de noviembre**. | **32**, perfil EAS `production`, desde `codex/session-management-and-security` con cambios locales todavía sin commit. El registro del 3 de noviembre muestra que se retiró el 31 y se envió el 32 a revisión. El correo de Apple del 4 de noviembre confirma la aprobación de 1.0.6 con la hora de envío de esa revisión. [Ficha pública](https://apps.apple.com/es/app/dj-planner/id6760347919) · [Revisión del 32](https://appstoreconnect.apple.com/apps/6760347919/distribution/reviewsubmissions/details/385dba97-f3bf-40e1-87c5-9e582de53253) |
| TestFlight iOS | **1.0.6 (32)** es el último build cuya disponibilidad queda acreditada. Apple envió el aviso «DJ Planner 1.0.6 (32) for iOS is now available to test». La asignación actual a grupos y la caducidad quedan por confirmar en la consola. | El mismo binario y rama que la versión pública. [Build EAS](https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/builds/886aa8f9-77ae-4046-880a-d02edda37ab4) · [Envío EAS](https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/submissions/d3d1901e-2862-49e5-adae-3b2fc979765b) · [TestFlight](https://appstoreconnect.apple.com/apps/6760347919/testflight/ios) |
| Google Play | En la cuenta de desarrollador accesible solo figura **Bothside**. No aparece DJ Planner en consola ni encontré una ficha pública para su paquete. | Sin versión, `versionCode`, rama, AAB ni pista de pruebas confirmados para DJ Planner. Si se usó otra cuenta, revisar sus pistas y el historial de versiones. [Play Console](https://play.google.com/console) · [Paquete esperado](https://play.google.com/store/apps/details?id=com.djplannerpro.app) |

**El SHA del build 32 no reproduce por sí solo el binario.** EAS registró `3f7d21c5f59ff5f24ce0378eeb2627ee48fd7761`, el HEAD de la rama en aquel momento. Ese commit todavía declara 1.0.2 en `app.json`. El archivo enviado incluía cambios locales de 1.0.6. La evidencia está fuera del repo, en `../outputs/build-ios-32/publicacion.md` y `estado-build.json`. Evita etiquetar el SHA de base o el HEAD actual como si fueran el binario exacto de App Store. Este último incluye trabajo posterior al 3 de noviembre. La consola de Apple y el panel EAS solicitaron iniciar sesión al verificar el estado actual.

## 2. Las nueve pruebas pendientes

Reproducidas sobre `7cb685f` con `npm test`: **357 pruebas, 348 correctas y 9 fallidas**. La comprobación de tipos del mismo código pasó. El registro previo del build 32 tenía 350 pruebas verdes.

| # | Prueba | Causa en el código actual |
| --- | --- | --- |
| 207 | `compact hides on the first downward pixel and reveals on the first upward pixel` | El test espera animación direccional y llama al callback de foco que el hook ya no registra. |
| 208 | `compact restores the header when returning from another screen` | Falla en la misma preparación, antes de probar el retorno a la pantalla. |
| 209 | `hide hides on the first downward pixel and reveals on the first upward pixel` | El mismo callback ausente en el modo `hide`. |
| 210 | `hide restores the header when returning from another screen` | El mismo callback ausente, antes de probar la restauración. |
| 211 | `history remains reachable without adding a bottom tab` | El cargador simulado se detiene en el import de `expo-blur` antes de montar el layout. |
| 212 | `venues remains reachable without adding a bottom tab` | Misma dependencia ausente en el cargador simulado. |
| 213 | `account remains reachable without adding a bottom tab` | Misma dependencia ausente en el cargador simulado. |
| 214 | `disabled Documents still redirects instead of exposing a future feature` | Mismo fallo antes de verificar la redirección de `vault`. |
| 215 | `sign-in protection still guards the secondary routes` | Mismo fallo antes de probar la protección sin sesión. |

- **207–210.** [Pruebas de encabezados](../tests/scrollHeader.test.cjs) devuelve `TypeError: focus is not a function` en `setup()`. [El hook](../src/hooks/useScrollHeader.ts) mantiene el encabezado expandido, con progreso cero y callbacks de scroll vacíos. Hay una diferencia de comportamiento real respecto a lo que comprueban las pruebas y a [la especificación histórica](encabezados-scroll.md). Confirmar el comportamiento deseado en iPhone antes de actualizar las aserciones o recuperar la animación.
- **211–215.** [Pruebas de navegación secundaria](../tests/secondaryNavigation.test.cjs) devuelve `Missing fixture dependency: expo-blur`. `expo-blur` está instalado y el nuevo [layout de pestañas](../app/(tabs)/_layout.tsx) también importa `expo-glass-effect`. Añadir las simulaciones de ambos a la prueba y volver a ejecutarla. Las cinco rutas aún requieren comprobación funcional, porque ninguna alcanzó sus aserciones.
- **¿Bloquean?** `npm test` sale con error y [App checks](../.github/workflows/checks.yml) lo ejecuta en PR y en pushes a `main`. Son un bloqueo de CI y de la recomendación de publicar. EAS y las tiendas tienen sus propias validaciones. Los cinco errores del cargador, por sí solos, no demuestran que la navegación falle en el binario.

## 3. Trabajo a medias

| Frente | Qué queda y dónde |
| --- | --- |
| Paywall y promoción posterior al build 32 | Las dos vistas y los estados del trial se revisaron en navegador con servicios simulados. Falta verificar en iPhone las pantallas, compra, restauración, acceso al terminar el trial y discrepancias de precio entre storefront y dispositivo. Entradas: `app/paywall.tsx`, `src/context/SubscriptionContext.tsx`, `src/services/revenuecat.ts`, `src/utils/paywallStage.ts`, `src/config/annualCampaign.ts`, `annualStorePrices.json` y `appleStorefronts.json`. QA visual en [design-qa.md](../design-qa.md). |
| Navegación y diseño posterior al build 32 | Verificar el nuevo menú de cuenta, las pestañas con vidrio/desenfoque y el comportamiento de encabezados. Probar Historial, Lugares y Cuenta mediante enlaces y menú, así como el arranque sin sesión. Entradas: `src/components/navigation/AccountDrawer.tsx`, `src/components/ui/ScrollTabBar.tsx`, `src/hooks/useScrollHeader.ts` y `app/(tabs)/_layout.tsx`. La validación visual de escritorio no cubre el teclado, tamaño de texto o safe areas de iPhone. |
| Investigación con DJs autónomos | El build 32 incluye el cuestionario y su invitación, fuera de las novedades públicas. No hay conclusión de producto aprobada a partir de las respuestas en este traspaso. Analizar datos agregados y volver al backlog antes de prometer funciones. Entradas: `app/research-survey.tsx`, `src/components/research/ResearchInvitation.tsx`, `src/services/researchSurvey.ts` y [consulta de análisis](analisis-cuestionario-autonomos.sql). |
| Plantillas de sesión | Ya llegaron con 1.0.5. Quedan por decidir sincronización, copia de preparación y límites Gratis/PRO. El comportamiento actual es local por cuenta y dispositivo. Seguir desde `src/services/sessionTemplates.ts` y [el diseño funcional](plantillas-sesiones.md). |
| Carteles | El laboratorio externo sigue separado. La renovación de catálogo de noviembre es una propuesta y queda fuera de la siguiente subida salvo decisión expresa. Para llevar un estilo a producción hay que coordinar `src/postersLab/PosterLab.js`, `supabase/functions/poster-ai/` y las referencias históricas. Ver [propuesta de noviembre](propuestas/plantillas-2026-11.md) y la sección de automatizaciones. |
| Android | Falta acreditar la app y los productos en Play Console y RevenueCat, la firma y el primer AAB en una pista real, y verificar compras/restauración. El identificador Android está configurado. La documentación anterior deja pendiente el catálogo y Android necesita su clave pública propia en EAS. |

## 4. Decisiones de conversación que conviene conservar

- **Campaña anual posterior a la documentación de octubre.** En España, 15,99 € para el primer año hasta el 6 de enero de 2027 inclusive. Desde el 7 de enero, 29,99 € al año para nuevas altas y el objetivo es que la cohorte promocional renueve a 29,99 €, sujeto a lo que admita Apple para las cohortes y sus avisos de subida. Los suscriptores anteriores a la campaña conservan su precio. El equivalente se elige por territorio de Apple, que puede variar aunque se comparta moneda. El mensual se queda como estaba (4,99 € en la ficha española). Las cifras históricas de 14,99 €/39,99 € en [monetización](monetizacion.md) corresponden a otro planteamiento. El escaparate puede mostrar precios distintos al plan de campaña y manda la confirmación de la tienda.
- **Gratis y PRO.** La decisión posterior fue ofrecer una prueba propia de 15 días iniciada voluntariamente, sin medio de pago ni renovación automática. Al agotarse se conserva la información y se vuelve a Gratis. El código de esta rama limita Gratis a 15 sesiones según las reglas de cómputo de la app. Tras confirmar con Manuel, se retiraron en App Store Connect las ofertas introductorias antiguas de dos semanas anual y una semana mensual para nuevas altas. Las que ya habían empezado se respetan. La pantalla de prueba y la de compra son pasos separados. Estar en una prueba activa o ser suscriptor cambia la pantalla de entrada, de modo que no se vuelve a ofrecer el mismo trial.
- **Qué se descartó.** La idea inicial de cobrar solo una anualidad de unos 15 € y dar precio fundador a los primeros cien pertenece a los bocetos de marzo. En noviembre se aprobó una campaña con fechas y cohortes, manteniendo el mensual. Para acceso y registro, la última palabra de Manuel fue volver a las pantallas fotográficas anteriores a todo el rediseño del formulario. Las capturas del formulario sobre tarjeta lima, incluido el experimento a pantalla completa, son iteraciones descartadas. Se conservó la foto HD de bienvenida. El último bloque de [design-qa.md](../design-qa.md) corrige las aprobaciones intermedias.
- **Alcance.** El foco de investigación son DJs autónomos que organizan sus actuaciones y cobran por ellas. Las notas escritas siguen gratis y los avisos de audio son PRO. El interés en plantillas no resolvió su segmentación comercial ni aprobó el resto del backlog. Contrataciones, Documentos y Acuerdos de caché siguen ocultos. La edición iOS se ha preparado para iPhone con soporte iPad nativo desactivado y siete idiomas. DJ Planner Pro tiene app y base propias, separadas de la edición Lite de Bothside.

## 5. Configuración externa

### Supabase

Proyecto **DJ Planner Pro**, referencia `voyurnwckmateohuzbab`, región `eu-west-1`. Se contrastaron el proyecto, los buckets y las funciones activas contra producción. Los nombres de variables proceden del código y de los registros de configuración. El inventario de secretos instalados debe comprobarse en el panel sin exportar sus valores. [Proyecto Supabase](https://supabase.com/dashboard/project/voyurnwckmateohuzbab)

| Función Edge activa | Revisión remota | Verificación JWT en el gateway |
| --- | ---: | --- |
| `subscription-access` | 7 | Sí |
| `booking-gateway` | 6 | No |
| `delete-account` | 6 | No |
| `storage-maintenance` | 6 | No |
| `poster-ai` | 36 | Sí |
| `poster-store-webhook` | 4 | No |

Los números son revisiones del despliegue. No acreditan igualdad con el árbol Git. Cuando el gateway no verifica JWT, la función aplica sus propias reglas, por ejemplo rutas públicas acotadas de contratación, comprobación de identidad para borrado/mantenimiento o token del webhook. Antes de un redeploy, conservar los ajustes remotos y comprobar cada rama de autenticación. El TOML local solo declara el ajuste de JWT para las dos funciones de carteles.

- **Buckets públicos** `avatars`, `sessions`, `venues`. **Privados** `expense-receipts`, `poster-ai-private`, `session-voice-notes`, `vault`. Probar políticas, propietarios y URLs firmadas antes de cambiar visibilidad o rutas.
- **Variables públicas de la app** `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`. **Variables del servidor** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Suscripción y correo** `REVENUECAT_API_KEY`, `RESEND_API_KEY`, `BOOKING_MAIL_FROM`, `BOOKING_WEB_ORIGIN`.
- **Proveedor de carteles y compras** `POSTER_AI_PROVIDER`, `POSTER_GOOGLE_SERVICE_ACCOUNT_JSON`, `POSTER_GOOGLE_TRIAL_CONFIRMED`, `POSTER_OPENAI_API_KEY`, `POSTER_PROMOTION_SALT`, `POSTER_REVENUECAT_APP_ID`, `POSTER_REVENUECAT_PROJECT_ID`, `POSTER_REVENUECAT_SECRET_KEY`, `POSTER_REVENUECAT_WEBHOOK_TOKEN`, `POSTER_STORE_WEBHOOK_READY`. Varios corresponden a rutas alternativas o a activación comercial. Confirmar el proveedor y las banderas efectivos antes de habilitar compras o enviar nuevas generaciones.

### RevenueCat, PostHog y Sentry

| Servicio | Cómo retomarlo |
| --- | --- |
| RevenueCat | Offering `default`, paquetes `$rc_monthly` y `$rc_annual`, productos iOS `djplanner.pro.monthly` y `djplanner.pro.yearly`. El entitlement se llama exactamente **DJ Planner Pro**, y el App User ID es el UUID de Supabase. La app iOS toma la clave pública del SDK de su servicio y Android espera `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. Revisar que ambos productos de tienda estén asociados al entitlement y que el webhook de carteles sea independiente del acceso PRO. Probar con build nativo y comprobar compra, restauración y cambio de cuenta. [Servicio de compras](../src/services/revenuecat.ts) · [Compras de carteles](carteles-compras-apple.md) |
| PostHog | Proyecto europeo `326830`, ingestión en `eu.i.posthog.com`. `EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN` y `EXPO_PUBLIC_POSTHOG_DEV_ENABLED`. Mantener consentimiento previo y excluir conversiones sandbox de informes de venta real. [Proyecto](https://eu.posthog.com/project/326830) · [Instrumentación](POSTHOG.md) |
| Sentry | Organización `dj-planner-pro`, proyecto `react-native`, región UE. Configuración pública `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DEV_ENABLED`, `EXPO_PUBLIC_SENTRY_VERIFY` (solo chequeo en desarrollo). Para compilar `SENTRY_ORG`, `SENTRY_PROJECT` y el secreto privado `SENTRY_AUTH_TOKEN`. Revisar carga de sourcemaps y símbolos en EAS. Que entren errores JS no acredita simbolicación nativa. [Monitorización](robustez-paso6-monitorizacion.md) |

### EAS y tiendas

- **EAS**. Cuenta y proyecto `funkman_82/dj-planner-pro`, ID `03382504-5cac-4497-a9cb-6f13cfee2e36`. [eas.json](../eas.json) contiene `development` (dev client interno), `preview` (distribución interna), `production` (tienda, incremento automático), `poster-sandbox` (hereda producción y activa `EXPO_PUBLIC_POSTER_STORE_TESTING`). La numeración es remota. Reutilizar las credenciales iOS remotas existentes (certificado de distribución y perfil, con caducidad documentada en enero de 2027) y la clave API existente de EAS Submit. No se verificó su estado actual por requerir inicio de sesión. Android no tiene submit configurado en `eas.json`; no se verificaron keystore de subida ni cuenta de servicio de Play.
- **App Store Connect**. App Apple ID `6760347919`, bundle `com.djplannerpro.app`, suscripción anual Apple ID `6760348721`. Se usó el perfil EAS Submit `production`; el último envío público heredó publicación automática al aprobarse. Mantener las siete localizaciones, política de privacidad, EULA, acceso del revisor y respuestas de edad/privacidad. El build 32 actualizó la declaración por contenido de usuario, audio, investigación opcional y analítica. La ficha española muestra 13+. [App Store Connect](https://appstoreconnect.apple.com/apps/6760347919/distribution/ios/version/inflight)
- **Play Console**. Paquete previsto `com.djplannerpro.app`. La única cuenta de desarrollador accesible no registra DJ Planner. Antes de planificar su lanzamiento, localizar la cuenta correcta o crear la ficha en la elegida y verificar pista, Play App Signing, clave de subida, Data safety, productos/base plans y sus asociaciones con RevenueCat. El estado de la prueba cerrada de Bothside corresponde a otra app. [Play Console](https://play.google.com/console)

## 6. Automatizaciones del Mac

Comprobé los dos archivos `~/.codex/automations/<id>/automation.toml`. Ambas están en estado **ACTIVE** en Codex local. Pausarlas desde la otra herramienta requiere acceso a esas tareas locales; la lista de recordatorios de ChatGPT no las contiene. Se pueden pausar en la interfaz de automatizaciones del Codex que las creó.

| Tarea | Estado comprobado | Si la desactivas |
| --- | --- | --- |
| **Completar precios anuales de DJ Planner** · `completar-precios-anuales-de-dj-planner` | Diaria a las 12:00. El primer tramo se guardó en Apple para España desde el 6 de noviembre, con equivalencias revisadas para 175 territorios, cambios efectivos esperados en 160 y precio protegido para suscriptores anteriores. El segundo tramo **sigue pendiente**. La última ejecución localizada, el 14 de noviembre a las 17:15 Madrid, quedó bloqueada en el login de Apple. El 15 se encontró la misma pantalla. Evidencia operativa en `../outputs/promocion-anual-2027/estado.md`. | Dejan de comprobarse la entrada en vigor y la protección de cohortes. Lo ya guardado en Apple sigue vigente. La cifra de referencia del frontend cambia por fecha incluso con esta tarea desactivada. Para que se cobre el segundo tramo, alguien debe verificar el primero y programar el nuevo precio directamente en Apple. |
| **Renovar plantillas DJ Planner** · `renovar-plantillas-dj-planner` | El día 1 de cada mes a las 10:00. Hay un entregable de noviembre con 20 familias, pendiente de revisión por Manuel. El flujo requiere aprobación de las familias, pruebas con 0–3 fotos en los tres formatos y autorización para generaciones de pago o publicación. [Propuesta](propuestas/plantillas-2026-11.md) | Dejan de producirse las propuestas mensuales y sus avisos. El catálogo activo, los carteles de usuarios, el acceso a estilos históricos y el cron de recuperación de trabajos de Supabase siguen su propio ciclo. |

Apple permite un solo cambio futuro por territorio y plan. Guardar otro mientras el primero está pendiente lo sobrescribe. Antes de confirmar 29,99 €, verificar la vigencia del primer tramo, las cohortes protegidas y la renovación prevista de la cohorte promocional. Si el panel no permite garantizarlo, registrar la limitación y resolverla antes de cambiar precios. [Reglas de Apple](https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions)

## 7. Puntos frágiles

- **Builds desde un árbol sucio.** Es posible compartir SHA de HEAD entre archivos de compilación distintos, como ocurrió en el 32. Construir desde árbol limpio y registrar SHA, rama, build, perfil y submission al lado de las notas de revisión. El número de `app.json` por sí solo tampoco acredita qué está publicado.
- **Precios y fechas.** La fecha de la campaña se evalúa con la medianoche local del dispositivo. El precio mostrado de referencia se selecciona con storefront y equivalencia territorial. El SDK puede devolver moneda o importes diferentes en sandbox y el checkout de la tienda es la autoridad. Revisar los textos del primer año y renovación contra el producto nativo antes de publicarlos. Evitar reutilizar las equivalencias Apple en Android.
- **Expo Go y firma.** Usar un build nativo para validar RevenueCat, audio, permisos y la actualización real sobre 1.0.6. El intento iOS 27 falló por APNs y el 28 por incompatibilidad de RevenueCat con Xcode. Conservar notificaciones locales y revisar [las soluciones que permitieron compilar](releases/1.0.5-testflight.md) antes de cambiar SDK o firma.
- **Rutas ocultas.** Cambiar de forma global `tabBarButton` por `href: null` puede redirigir en este SDK. Confirmar por separado que Historial, Lugares y Cuenta abren y que Documentos permanece deshabilitado. La protección de sesión y el enlace de recuperación también necesitan una prueba nativa.
- **Dos clases de plantillas.** Las de sesión son datos locales. Los estilos de cartel tienen IDs que usan Explorar y carteles previos. Un ID publicado conserva su referencia, aunque desaparezca de la selección actual. El cron de recuperación de carteles es independiente de las automatizaciones de Codex.
- **Estado local y remoto.** Antes de recrear los entornos desde cero, comparar migraciones aplicadas, revisiones Edge, políticas y versiones de la app que siguen en uso. `.env` salió del índice en las ramas de trabajo. Recuperar variables de los paneles, no desde el archivo de la rama del laboratorio ni copiando credenciales a Git. Mantener la configuración comercial de carteles separada del acceso PRO y de los entornos de pruebas.

## 8. Orden recomendado para la siguiente publicación

1. **Abrir App Store Connect y EAS con sesión iniciada.** Confirmar el build vigente y los grupos de TestFlight. Comprobar el calendario del anual y cerrar el tramo de enero con evidencia de cohortes, antes de prometer ese importe en una versión nueva. Android puede avanzar en paralelo una vez ubicada su ficha y firma.
2. **Cerrar CI desde la rama de trabajo.** Confirmar con Manuel el comportamiento esperado de las cabeceras, alinear código, pruebas y documentación, y corregir las simulaciones del layout. Ejecutar `npm run typecheck`, `npm run check:i18n`, `npm test` y los checks de base de datos y Deno del workflow sobre el entorno que corresponde.
3. **Validar en iPhone con un build candidato de producción.** Comprobar actualización desde 1.0.6, login/recuperación, navegación, sesiones y monedas, recordatorios locales, compra y restauración, y estados de Gratis/PRO. Usar cuentas de prueba y contrastar mensual/anual con Apple. Probar el flujo de revisión, el cuestionario y la privacidad sin comprometer datos reales.
4. **Enviar un único build trazable.** Con el árbol limpio, elegir una nueva versión pública si corresponde, compilar con `production`, verificar el build en TestFlight y asociar ese mismo binario a la revisión. Preparar las siete localizaciones y comprobar EULA, privacidad, revisores y modo de publicación. EAS Submit sube el binario a Apple. La revisión y la disponibilidad pública se verifican después en App Store Connect y la ficha.
5. **Después del lanzamiento.** Contrastar compras y conversiones reales en RevenueCat/PostHog y errores simbolicados en Sentry. Mantener fuera del alcance de esta publicación la publicación de estilos nuevos, la sincronización de plantillas de sesión y la activación de módulos ocultos hasta que estén decididos y probados.
