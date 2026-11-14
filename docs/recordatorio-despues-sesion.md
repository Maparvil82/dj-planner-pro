# Recordatorio 24 horas después de una sesión

Función de revisión disponible en Gratis y PRO. La nota escrita sigue siendo gratuita; la grabación de Aviso de sesión sigue siendo PRO.

## Comportamiento

Se programa una notificación local para **24 horas exactas después de la hora de fin** de cada sesión propia. Respeta los horarios que cruzan medianoche y la zona horaria del evento. Si hay un cambio de hora, son 24 horas transcurridas, no la misma hora de reloj del día siguiente.

Texto: «¿Qué tal fue tu sesión en Zoco?». Cuerpo: «Entra para completar los datos de la sesión o dejar una nota».

Al tocarla se abre `/session/[id]?postSessionReview=1`, con un bloque de revisión y accesos para editar la sesión, abrir Notas privadas o Aviso de sesión PRO. Lugar y Detalle mantienen su orden. Los invitados no ven el bloque ni acceden a las notas del propietario.

No se notifican sesiones canceladas, de otro usuario, vistas como invitado, con fecha inválida o cuyo momento de aviso ya pasó. Una sesión histórica añadida después no genera una tanda de notificaciones atrasadas. La clave estable por sesión evita duplicados; editar fecha, horas, lugar o zona horaria reemplaza el aviso al sincronizar. Eliminar o cancelar la sesión lo retira del programa del dispositivo.

## Integración

- Reutiliza `expo-notifications`: compatible con Expo Go que incluya estos módulos; sin nueva dependencia ni nueva compilación para esta prueba.
- Se solicita permiso del sistema cuando existen sesiones que pueden generar un recordatorio y el estado aún es indeterminado. No se repite la solicitud tras una negativa. En Android se configura el canal antes de programar.
- Consulta ligera de sesiones propias bajo RLS existente; no hay migraciones ni cambios en los datos del servidor.
- La consulta cubre desde tres días atrás y las siguientes 200 sesiones por fecha; incluye las madrugadas y las zonas horarias extremas. Los avisos se ordenan después por el instante real de entrega.
- Los recordatorios de próxima visita y los de revisión posterior comparten una cola y un presupuesto de hasta 60 notificaciones pendientes, descontando avisos ajenos a esta función. Se priorizan los próximos en el tiempo. No se cancelan avisos de otras funciones.
- Al cerrar sesión o cambiar de cuenta se retiran los avisos de la cuenta anterior. La identidad de cuenta se adjunta al aviso y se valida antes de navegar. La respuesta de apertura se procesa una sola vez, también en inicio en frío.
- Si falla una consulta, se conservan los avisos conocidos de esa cuenta, sin borrar su planificación por un error de conexión.

## Alcance de la entrega

Se programan en el dispositivo al cargar/sincronizar las sesiones: al abrir/reactivar la app, tras cambios y cada minuto mientras está activa. Una vez programadas, el sistema operativo puede mostrarlas con la app cerrada. La entrega depende de permisos y ajustes del sistema; no es un envío remoto desde el servidor.

Los cambios realizados en otro dispositivo no invalidan de inmediato un aviso del primero si este permanece cerrado. Los nuevos avisos que queden fuera del presupuesto se incorporan en posteriores sincronizaciones. Para invalidación y programación remotas sin volver a abrir la app sería necesario añadir un servicio de push del servidor.

## Comprobaciones

- `tests/postSessionReminders.test.cjs`: 24 horas desde el fin, madrugada, cambio de hora, canceladas/invitados/otras cuentas, vencidas, identidad estable y destino de navegación.
- `tests/voiceNotifications.test.cjs`: convivencia con avisos de voz, ausencia de duplicados, cambios de fecha, conservación ante errores de red, presupuesto compartido y limpieza por cambio de cuenta/salida.
- `tests/browser/voiceNotes.cjs`: bloque de revisión real y navegación a editar/notas/audio, Gratis/PRO, notas privadas y aislamiento de invitados; peticiones simuladas sin modificar datos reales.
- Suite general: 330 pruebas correctas. Comprobación de tipos e idiomas en siete idiomas correcta.
- Pendiente confirmar entrega física desde Expo Go con permisos activados. Las pruebas de horarios y notificaciones utilizan reloj y servicio de dispositivo simulados; no se ha enviado una notificación real de prueba al usuario.
