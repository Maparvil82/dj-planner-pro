# Aviso de sesión PRO

Implementación sin IA ni transcripción. Las notas escritas gratuitas y `sessions.notes` conservan su comportamiento.

## Recorrido

- Desde el botón **Aviso de sesión**, en las herramientas inferiores de cualquier sesión propia, incluso pasada, PRO puede grabar hasta 20 segundos. AAC mono a 48 kbps, límite adicional de 200 KiB por archivo. La grabación se abre en un panel inferior sobre la sesión, con contador y ondas del micrófono. Al detenerla o alcanzar los 20 segundos, pregunta si se desea guardar; después solicita un nombre obligatorio y, por último, pregunta si se desea recordar en la próxima visita. Se puede escuchar antes de decidir. El audio solo se sube después de responder la última pregunta. Un fallo de subida conserva la toma mientras permanezca abierta esa pantalla.
- La nota se asocia a su sesión y al identificador del local existente. Si la sesión no tiene local guardado, se permite grabar pero no activar el recordatorio por local. No se intenta identificar el local por el audio ni por coincidencias de texto.
- Al guardar una sesión nueva, se consultan las notas pendientes de ese local. Si las hay, se abre la pantalla Aviso de sesión con su panel de avisos pendientes. Un fallo en esa consulta posterior no convierte un guardado correcto en un error ni invita a duplicar la sesión.
- Los avisos se consultan desde su botón en el detalle. No existe la acción «Marcar como resuelta» ni se muestra una etiqueta de resolución. Escuchar un aviso no lo elimina; se conserva con su audio y puede eliminarse desde la sesión de origen. El campo histórico `resolved_at` se mantiene por compatibilidad con el servidor, sin acción de resolución en el cliente.
- El usuario puede activar un aviso el día anterior a esa actuación, a la misma hora local. Si ese momento ya pasó, no se ofrece un aviso retroactivo. Cambios de fecha, local, cancelaciones y eliminación se reflejan al sincronizar.
- Las notas no caducan al pasar un año. No se duplican los audios para cada visita.

## Acceso y privacidad

- PRO se comprueba con `useSessionUsage` y con `billing_private.has_pro_access()` en el servidor (suscripción y prueba vigentes).
- Gratis conserva las notas escritas. No puede crear notas de voz, modificar sus datos ni programar recordatorios. Los audios propios existentes se pueden consultar y eliminar tras finalizar PRO, pero no generan nuevos recordatorios.
- RLS limita notas y recordatorios al propietario. No se añaden a Comunidad, invitaciones, exportaciones ni al mensaje Compartir.
- El bucket `session-voice-notes` es privado. La reproducción obtiene una URL firmada de 5 minutos. El identificador y la sesión de origen son inmutables.
- Se integra el bucket en el presupuesto compartido existente de 100 MiB, en la eliminación de cuenta y en la limpieza de archivos sin referencias. El borrado de sesión elimina la referencia; el servicio de mantenimiento retira después el archivo por Storage API. No se borra `storage.objects` directamente.

## Avisos en el dispositivo

Esta primera versión programa notificaciones locales con `expo-notifications`; no requiere un servicio remoto de push ni credenciales de APNs/FCM. Una vez programadas, el sistema puede mostrarlas con la app cerrada, sujeto a permisos y ajustes del sistema.

Las preferencias se guardan en el servidor. El dispositivo sincroniza al abrir/reactivar la app, tras modificaciones y una vez por minuto mientras está activa. Usa identificadores estables y solo cancela avisos de esta función; conserva las demás notificaciones.

Hasta 50 próximos avisos de voz, dentro del presupuesto compartido con los avisos de revisión de sesión (60 notificaciones en total, descontando avisos ajenos). Los cambios hechos desde otro dispositivo se reflejan al volver a sincronizar el primero; si permanece cerrado puede mostrar un aviso antiguo. Un cambio de plan realizado fuera de la app también se refleja al sincronizar. Para invalidación inmediata entre dispositivos, la siguiente fase sería un envío remoto desde servidor. No se debe presentar esta versión como sincronización remota instantánea.

## Activación y estado

- Dependencias oficiales fijadas: `expo-audio@58.0.10`, `expo-notifications@58.1.7`.
- Plugins y permiso de micrófono configurados; grabación en segundo plano deshabilitada. La app antigua muestra un mensaje de actualización si falta el módulo nativo.
- Se requiere nueva compilación móvil y prueba real de grabación/reproducción, interrupciones y aviso con la app cerrada. La web muestra la información, pero no permite grabar ni programar notificaciones móviles.
- Migración preparada con CLI: `20261029185158_session_voice_notes_pro.sql`.
- **Migración remota aplicada y verificada el 29 de octubre de 2026**, tras la autorización explícita del usuario. Se conservan exactamente las 230 sesiones existentes y los 63 locales. Las cuatro funciones compartidas solo añaden el nuevo bucket a sus listas, sin otros cambios.
- Copia de las cuatro funciones remotas afectadas: `../outputs/notas-voz-pro/backend-functions-before.sql`.
- No se ha publicado una nueva versión móvil ni una actualización remota de JavaScript.

## Comprobaciones

- TypeScript, auditoría de claves e interpolaciones en siete idiomas, pruebas generales y exportación web.
- `node tests/voiceNotesDatabase.cjs`: PostgreSQL aislado, migración completa, PRO, aislamiento de datos, audios privados, límite de duración, año de espera, correspondencia del local, duplicados, cambios de fecha/cancelaciones/resolución, presupuesto y limpieza.
- `node --test tests/voiceReminders.test.cjs tests/voiceNotifications.test.cjs`: fecha en zona del evento y cambio de hora, avisos caducados, identidad estable, cancelación y conservación de notificaciones ajenas.
- `tests/browser/voiceNotes.cjs`: peticiones simuladas, sin datos reales; notas gratuitas, control PRO, nombre y descripción de Aviso de sesión, ausencia de acción de resolución y privacidad de invitados. Captura en 320 px oscuro.
- Servidor verificado con pruebas reales dentro de una transacción revertida: Gratis no puede crear notas de voz; PRO puede crear y consultar su borrador; se bloquea el acceso a sesiones de otro propietario. Almacenamiento privado, límite de 200 KiB y RLS comprobados. El análisis de seguridad no añade avisos respecto a los previos.
- Pendiente instalar una nueva compilación y probar en móvil la grabación, subida/reproducción del audio y el aviso con la app cerrada.

Resultado local: 322 pruebas automáticas correctas; prueba de interfaz correcta, comprobación de tipos e idiomas correcta. No se ha probado todavía la captura de audio en un móvil real.

Exportación del código y recursos para iOS correcta (Hermes). Esto comprueba el empaquetado JavaScript nativo; no sustituye compilar/instalar la app con los nuevos módulos ni probar el micrófono en un dispositivo.

Verificación del despliegue autorizado: `../outputs/notas-voz-pro/authorized-deploy-verification.json`. Copia previa actualizada: `../outputs/notas-voz-pro/backend-before-authorized-deploy.json`. Las pruebas remotas no han dejado notas ni archivos ficticios.

## Flujo de grabación en primer plano

Ajuste del 29 de octubre de 2026: panel inferior con tiempo transcurrido y máximo de 20 segundos, confirmación de guardar/descartar, nombre obligatorio y decisión explícita de recordatorio por local. El cierre durante la grabación la detiene y lleva a la confirmación; cerrar durante los pasos siguientes pide confirmar el descarte. Los fallos de subida conservan audio y nombre para reintentar desde el último paso. Si no hay local guardado, se informa de ello y se permite guardar sin recordatorio. No cambia el servidor ni los permisos PRO.

Verificado con `tests/browser/voiceRecorder.cjs`: interfaz real, micrófono, archivos y servidor simulados; no se guardan datos reales. Comprueba parada automática, descartes, nombre obligatorio, decisiones sí/no, ausencia de subidas prematuras, fallo de conexión y grabaciones sucesivas. La suite general suma 325 pruebas correctas. Pendiente la prueba del micrófono físico desde Expo Go compatible.

Nombre visible: **Aviso de sesión**. Descripción: «Graba una nota de audio y recibe un aviso la próxima vez que tengas una sesión en ese lugar». El mismo nombre se usa en la tarjeta, la pantalla de grabación, las ventajas PRO y la notificación. Se conservan el acceso PRO y los permisos existentes; no requiere cambios del servidor.

## Panel inferior y ondas del micrófono

El grabador se presenta como un sheet inferior con fondo atenuado, bordes superiores redondeados, título Aviso de sesión y local. El contador muestra tiempo transcurrido sobre 20 segundos. Se activa `isMeteringEnabled` en Expo Audio: la onda conserva el pico de nivel en 48 segmentos durante los 20 segundos. Silencio o lectura de nivel no disponible se muestran planos; no se usan barras aleatorias. La representación se mantiene solo en memoria y no cambia el tamaño del archivo ni el almacenamiento del servidor.

Guardar, nombre y recordatorio continúan en el mismo panel; el teclado reduce el espacio y el contenido puede desplazarse. PRO y el límite de 20 segundos se conservan. Verificado con `tests/browser/voiceRecorder.cjs`: anclaje inferior, ondas planas en silencio y respuesta a niveles simulados, confirmaciones, errores de conexión y grabaciones sucesivas. La respuesta al micrófono físico se debe comprobar desde Expo Go. Captura: `../outputs/notas-voz-pro/sheet-grabacion/grabando-con-ondas.png`.

## Acceso desde las herramientas de sesión

Desde el 30 de octubre de 2026, la tarjeta Detalle se sitúa inmediatamente después de Lugar, sin las tarjetas de notas incrustadas. Aviso de sesión deja de ser una tarjeta incrustada y pasa a un botón con icono de micrófono junto a Acceso, Invitados, Gastos y Preparación. Abre `/session-notice?sessionId=…`, con contexto del local/fecha y regreso al detalle mediante la navegación existente de herramientas. El botón abre la oferta PRO para cuentas Gratis; la captura conserva las comprobaciones de acceso del cliente y del servidor. Los invitados no ven el botón y no pueden abrir los avisos privados de la sesión.

La creación con avisos pendientes y las notificaciones abren directamente la nueva pantalla. Los enlaces anteriores a `/session/[id]?voiceReminder=1` se conservan mediante redirección. Verificado con `tests/browser/voiceNotes.cjs`: orden Lugar → Detalle, notas escritas, botón inferior, navegación de ida/vuelta, acceso Gratis/PRO, privacidad de invitados y enlaces anteriores. Sin cambios de base de datos.

El botón **Notas privadas**, con icono de nota, se coloca a la derecha de **Aviso de sesión** en la misma fila inferior. Abre `/session-notes?sessionId=…` y mantiene el acceso gratuito a las notas escritas. Verificado con edición y regreso al detalle en cuenta Gratis, alineación de ambos botones y privacidad de invitados.

## Revisión posterior

La app también programa un recordatorio gratuito para revisar la sesión 24 horas después de su fin. Comparte la cola de notificaciones del dispositivo con los avisos PRO de próxima visita y valida la cuenta al abrir. Detalles, pruebas y alcance local en `recordatorio-despues-sesion.md`.
