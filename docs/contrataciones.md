# Contrataciones: primera versión Pro

## Estado

La migración `20261003151535_booking_workspace.sql` está aplicada en `voyurnwckmateohuzbab` y `booking-gateway` está desplegada y activa (versión 1), tras la aprobación del propietario. El nombre del archivo coincide con la versión asignada por el historial remoto de Supabase.

La web está publicada en https://dj-planner-bookings.vercel.app; véase `publicacion-vercel.md`. La configuración del origen en Supabase, el correo real y el trabajador de la cola siguen pendientes. Resend no tiene ningún dominio verificado. El servicio permanece desactivado: se pueden guardar ajustes y previsualizar la página desde la app, pero no activar un enlace ni recibir consultas reales.

En la app: **Tú → Contrataciones → Ver mi página** permite previsualizar el perfil real del DJ sin activar un enlace público. Mientras el servicio no está preparado, la interfaz muestra «Próximamente» y la pantalla de pago no anuncia Contrataciones como disponible.

## Recorrido

1. El DJ configura su nombre de enlace, zona horaria y condiciones habituales. Activar un enlace exige perfil público, Pro verificado y servicio publicado con correo configurado.
2. El promotor abre `/book/nombre-del-dj`, ve la presentación, enlaces musicales y exclusivamente las sesiones que el DJ ha publicado. No necesita instalar la app ni registrarse.
3. Envía evento, lugar, ciudad, fecha, horario, presupuesto y contacto. La consulta no reserva la fecha. Solo aparece en la bandeja del DJ tras verificar el correo.
4. El correo lleva a `/booking/id#access=clave`. La clave se guarda en la sesión del navegador y se elimina de la URL y del estado de navegación. La verificación inicial dura 24 horas; tras verificar, el acceso dura 30 días. Abrir repetidamente la página no prolonga ese plazo.
5. El DJ recibe una notificación en el perfil y responde desde `/bookings/id`. El promotor responde en su página privada. Los correos avisan y enlazan a esa página; responder al correo no se integra con la conversación.
6. El DJ envía una propuesta con fecha, horarios, caché, moneda, condiciones y plazo de 1–168 horas. Cada nueva propuesta conserva las versiones anteriores. El plazo nunca supera el inicio del evento.
7. Opcionalmente bloquea la fecha hasta vencer la propuesta. Puede liberar el bloqueo sin rechazar la consulta, incluso si posteriormente vence Pro. Pedir cambios o rechazar también libera el bloqueo.
8. El promotor revisa la última versión y confirma expresamente el acuerdo. La aceptación, notificación y creación de la sesión son una sola transacción. Aceptar dos veces devuelve la misma sesión. Una propuesta antigua, cambiada, vencida o con conflicto no se confirma.
9. La sesión aparece confirmada y pendiente de cobro en la agenda del DJ, con el caché acordado. No se publica automáticamente en Comunidad. La conversación sigue disponible después del acuerdo.

## Privacidad y reglas

- Los clientes autenticados solo leen sus propias consultas verificadas. No escriben directamente mensajes, propuestas o ajustes: las funciones autorizadas derivan el DJ de `auth.uid()`.
- Los promotores acceden únicamente a la conversación identificada por una clave aleatoria de 256 bits; se conserva su hash en el esquema privado. Nunca reciben la agenda completa, identidad interna del propietario ni claves de otras consultas.
- La página pública no incluye presupuesto, caché, contactos, mensajes, bloqueos ni sesiones sin publicación explícita.
- Pro se verifica en el servidor contra RevenueCat usando el ID de Supabase. Los clientes no pueden autoasignarse Pro. La caché privada tiene un máximo de cinco minutos.
- La aceptación respeta la cuota de 30 sesiones si Pro ha vencido. Un fallo de cuota no deja un acuerdo confirmado sin sesión.
- Las sesiones propias, participaciones aceptadas y bloqueos activos se comprueban con intervalos que incluyen sesiones que terminan al día siguiente. Dos intervalos contiguos no se solapan.
- Los bloqueos se respetan al crear/editar sesiones y aceptar colaboraciones. Las operaciones utilizan el mismo bloqueo transaccional por DJ que la cuota existente.
- La sesión creada conserva `booking_timezone` para interpretar el acuerdo si después cambian los ajustes. Las sesiones antiguas sin zona horaria se interpretan según los ajustes de su propietario, con Europe/Madrid como alternativa. Su interfaz anterior sigue utilizando horarios locales; no se ha migrado toda la agenda a fechas UTC.
- Modificar manualmente una sesión después de aceptar no modifica las condiciones históricas de la propuesta ni renegocia el acuerdo. Cualquier cambio posterior debe comunicarse al promotor por la conversación.
- Los mensajes se consultan cada 15 segundos y la bandeja cada 30; esta versión no utiliza WebSockets.

## Base y función desplegadas; publicación pendiente

Los pasos 1 y 2 ya están completados. Los siguientes corresponden a la publicación:

1. Aplicar y registrar `20261003151535_booking_workspace.sql` en el proyecto correcto. Añade tablas, permisos, notificaciones de contratación, zona horaria opcional en sesiones y los controles de bloqueos. No borra las sesiones existentes.
2. Desplegar `supabase/functions/booking-gateway/index.ts` **con `verify_jwt=false`** porque sirve a visitantes sin cuenta. Esto no elimina la autorización: cada acción del DJ verifica su JWT con `auth.getUser`; las acciones de promotor exigen su clave privada; el despachador de correos exige credenciales de servicio.
3. Elegir y publicar la web Expo, con reescrituras para `/book/*` y `/booking/*`, usando HTTPS. No asociar `/booking/*` a enlaces que abran la aplicación nativa: el promotor debe continuar en el navegador. Servir las páginas privadas sin indexación y con `Referrer-Policy: no-referrer`.
4. Configurar exclusivamente como secretos del servidor:

   | Variable | Uso |
   | --- | --- |
   | `BOOKING_WEB_ORIGIN` | Origen HTTPS exacto, sin ruta ni barra final, de la web publicada. |
   | `RESEND_API_KEY` | Proveedor preparado en esta versión: Resend. No se ha creado ninguna cuenta ni contratado un plan. |
   | `BOOKING_MAIL_FROM` | Remitente de un dominio verificado por el proveedor. |
   | `REVENUECAT_API_KEY` | Opcional, igual que en `subscription-access`. |

   Supabase aporta `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Nunca copiar secretos en variables `EXPO_PUBLIC_*`, URLs o registros de clientes.
5. Configurar un trabajador de la cola que invoque la acción `deliver` con credenciales de servicio y vigilar mensajes fallidos. Cada llamada entrega un correo; ajustar frecuencia y lote a la demanda antes del lanzamiento. No hay una tarea programada activa en esta rama.
6. Probar con dos personas el correo real, confirmación, notificación, cambios, aceptación, Pro, restauración y vencimiento. Las compras reales requieren iOS nativo/TestFlight; Expo Go sirve para la interfaz.

La cola reclama mensajes con `SKIP LOCKED`, conserva el mismo enlace durante reintentos y utiliza la clave de idempotencia del proveedor. Un fallo de correo no hace repetir una propuesta ya guardada. Tras entregar, elimina la clave en texto claro de la cola. Los fallos se reintentan tras cinco minutos, con un máximo de ocho intentos; requieren seguimiento operativo si se agotan. Definir antes del lanzamiento retención y limpieza de solicitudes sin verificar, claves caducadas y límites horarios.

## Comprobaciones realizadas

- `npm run typecheck`: correcto.
- `npm test`: 59 pruebas correctas.
- `deno check supabase/functions/booking-gateway/index.ts`: correcto.
- `npm run test:bookings-db`: 48 comprobaciones con PostgreSQL temporal en memoria (PGlite), usando las migraciones reales de cuota y Contrataciones sobre un esquema reducido de las tablas existentes. Comprueba permisos, aislamiento, Pro, correo verificado, intervalos nocturnos, colaboraciones, cambios, vencimiento, versiones, aceptación atómica, cuota, liberación de bloqueo e idempotencia. No conecta a Supabase. No sustituye una prueba de concurrencia con conexiones independientes en staging.
- Prueba del navegador con llamadas externas simuladas: formulario público completo, creación de propuesta, clave privada retirada de la URL, revisión/aceptación explícita y pantallas en siete idiomas a 320 px. No se han enviado correos, creado consultas ni comprado suscripciones reales.

La prueba del navegador está en `tests/browser/bookingFlow.cjs`; requiere Playwright y la vista previa en localhost:8081. Se puede configurar `PLAYWRIGHT_MODULE` y `PLAYWRIGHT_CHROMIUM` para usar un runtime instalado. Las capturas en `docs/previews` muestran datos ficticios.

### Verificación del despliegue

- `tests/booking-workspace-database.sql` pasó en el proyecto real con todas sus escrituras revertidas: ajustes, servicio pendiente, permisos, claves privadas, correo verificado, aviso único, acceso exclusivo del DJ, bloqueo nocturno, versiones, aceptación de la última propuesta, una sola sesión, caché, cobro pendiente, zona horaria y ausencia de publicación automática. La prueba de aceptación utiliza el contexto de servicio sin identidad de DJ, como el servidor real.
- Después de revertir: 189 sesiones originales, cero consultas y cero usuarios de prueba; publicación desactivada.
- La revisión de seguridad muestra RLS activa. Las cuatro tablas del esquema privado no tienen políticas para clientes deliberadamente; solo operan las funciones autorizadas y el servidor. Los avisos existentes de borrado de cuenta y protección de contraseñas no pertenecen a esta incorporación.
- La función desplegada rechaza acceso sin autenticar al DJ, enlaces no publicados y claves privadas inválidas. No se han enviado correos reales.
- Los bundles de iOS y Android se generaron correctamente antes del despliegue.
