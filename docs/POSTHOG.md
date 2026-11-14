# Analítica de DJ Planner con PostHog

## Conexión

Proyecto europeo creado: https://eu.posthog.com/project/326830. El token público ya está configurado en `.env` local, con el modo de pruebas activado para Expo Go. Elegir Product analytics y React Native/Expo. No hace falta activar Session Replay ni añadir una tarjeta.

El token está configurado en `.env` local y en los perfiles de `eas.json` (development, preview y production). En EAS el modo de pruebas está desactivado. Si se cambia el proyecto, actualizar:

```
EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
```

Es el **Project token** de ingestión, nunca una Personal API key. El servidor está fijado a `https://eu.i.posthog.com` para este proyecto europeo. Reiniciar Expo al cambiar el entorno.

En desarrollo la analítica está desactivada por defecto. Para comprobarla conscientemente en Expo Go:

```
EXPO_PUBLIC_POSTHOG_DEV_ENABLED=true
```

Los eventos de estas pruebas llevan `environment=development`. Filtrar `environment=production` en los informes reales. El SDK y los módulos instalados son compatibles con Expo Go; no se ha añadido el módulo nativo de Session Replay.

## Permiso y privacidad

No se inicializa PostHog hasta tener configuración, usuario autenticado y permiso explícito. Se pregunta una vez por cuenta y dispositivo; el usuario puede cambiar su decisión en Ajustes → Compartir datos de uso. No se pide permiso si la conexión no está configurada. El permiso no da acceso a funciones PRO ni condiciona el uso de la app.

Se usa un identificador derivado mediante SHA-256 para contar usuarios recurrentes sin mandar su ID de autenticación. Es un identificador seudónimo, no una garantía de anonimato. No se envían nombres, emails, lugares, fechas de actuaciones, cachés, textos, archivos ni audios. Cada evento se filtra de nuevo antes de entrar en la cola. No se capturan pantallas, pulsaciones, errores, perfiles personales ni geolocalización en PostHog. Sentry y RevenueCat siguen cumpliendo sus funciones actuales.

La cola vive en memoria, está limitada a 100 eventos y se descarta al cambiar de cuenta o retirar el permiso. No hay recuperación de eventos de antes de aceptar ni persistencia de analítica al cerrar la app; esto puede perder algunos eventos sin conexión. Eventos ya enviados no se eliminan al retirar el permiso.

Antes de activar en una versión pública, actualizar la política de privacidad y las declaraciones de privacidad de App Store/Google Play para reflejar el uso opcional de PostHog, los eventos y el identificador seudónimo. La política externa no se ha modificado automáticamente.

## Eventos

| Evento | Cuándo | Propiedades propias |
| --- | --- | --- |
| `app_opened` | Inicio tras aceptar, y regreso a primer plano | ninguna |
| `session_created` | Sesión guardada correctamente | ninguna |
| `private_note_saved` | Se guarda una nota privada no vacía | ninguna |
| `audio_note_saved` | Audio subido y confirmado como listo | `reminder_enabled`: booleano |
| `paywall_viewed` | Pantalla PRO adquiere el foco y se conoce el estado de suscripción | `paid_pro`: booleano |
| `research_survey_submitted` | Envío del cuestionario confirmado como guardado; no al abrirlo ni leer respuestas previas | `survey_version`: self-employed-djs-v1 |
| `pro_trial_started` | Activación de prueba devuelve estado activo | ninguna |
| `pro_purchase_completed` | Compra completada y acceso PRO confirmado por RevenueCat; usuario antes no suscrito | `plan`: monthly/yearly, `is_sandbox`: booleano |

Todos incluyen `environment` y `platform`. Nunca añadir objetos de sesión, rutas con IDs, errores o parámetros de navegación a estos eventos.

## Primer panel

1. Usuarios activos semanales: usuarios únicos de `app_opened`.
2. Activación: embudo `app_opened` → `session_created` en 7 días.
3. Interés por PRO: `paywall_viewed` → `pro_trial_started` en 7 días.
4. Retención semanal: `app_opened` → `app_opened`.
5. Adopción de notas y avisos: usuarios únicos de `private_note_saved` y `audio_note_saved`.

Las cifras solo representan a los usuarios que aceptan la analítica. Los totales de registros y suscriptores deben contrastarse con Counter y RevenueCat. Esta integración no importa compras a PostHog ni crea automáticamente el panel; el panel todavía debe crearse.

## Verificación de conexión

Con token real y el modo de pruebas activado, iniciar sesión, aceptar el permiso, crear una sesión de prueba y abrir PRO. En PostHog → Activity deben aparecer los eventos con `environment=development`. Rechazar/retirar el permiso y comprobar que dejan de llegar. Cerrar sesión y cambiar de cuenta; los identificadores deben ser distintos. Quitar la variable de pruebas al terminar.

Verificación realizada: 334 pruebas pasan, TypeScript e idiomas correctos, exportación web correcta y navegador con cuenta de demostración. Cero peticiones antes del consentimiento; después, `/batch/` europeo respondió 200 y los eventos `app_opened` se comprobaron en Activity. Estos eventos llevan `environment=development`. Expo se reinició con caché limpia.

## Conversión de paywall a compra

El informe «Conversión a PRO desde el paywall · 30 días» usa usuarios únicos y secuencia `paywall_viewed` (`paid_pro=false`) → `pro_purchase_completed` (`is_sandbox=false`), con `environment=production` y ventana de conversión de 30 días. Si entran 100 usuarios y compran 20, convierte el 20 % y el 80 % no ha comprado dentro de esa ventana. Un periodo todavía abierto no es una decisión definitiva de no comprar.

No se cuentan cancelaciones, fallos, restauraciones, refrescos de estado, usuarios ya suscritos ni activaciones de prueba gratuita como compras. La app deduplica por cuenta/producto/fecha de compra durante su ejecución, sin enviar estos identificadores o fechas a PostHog. Las pruebas de tienda llevan `is_sandbox=true`, también en TestFlight aunque el entorno de la app sea production.

Este evento mide compras completadas dentro de la app. No cubre cobros automáticos posteriores a una prueba gratuita de Apple/Google, compras pendientes que se completan tras cerrar la app ni compras hechas sin consentimiento. Para conciliación completa de pagos y esas conversiones diferidas se necesita integrar webhooks de RevenueCat; RevenueCat sigue siendo la fuente de pagos. No se ha realizado ninguna compra real como prueba.

## Cuestionario de Estadísticas

Contar usuarios únicos de `research_survey_submitted`, filtrando `environment=production` y `survey_version=self-employed-djs-v1`. No sumar usuarios únicos diarios para obtener el total del periodo. Los eventos de Expo (`development`) quedan fuera del informe real.

Se captura únicamente después de guardar y verificar la respuesta. No se envían respuestas, texto libre ni datos del formulario. Respeta el consentimiento de analítica existente. No registra retrospectivamente respuestas anteriores y no garantiza el total de respuestas: quienes rechazan analítica o no consiguen entregar el evento no aparecerán en PostHog. La tabla de respuestas sigue siendo la fuente para el total exacto.

Informe guardado: https://eu.posthog.com/project/326830/insights/C77vhY7o (contador de personas únicas, últimos 30 días).
