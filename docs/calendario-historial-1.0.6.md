# Calendario e historial · revisión de 1.0.6

Preparación local del 3 de noviembre de 2026, pendiente del visto bueno del propietario antes de generar o enviar otro build.

- El icono de calendario en Sesiones abre `/history`, una única pantalla que integra calendario e historial. `/calendar` redirige a esa misma pantalla.
- El calendario muestra las sesiones pasadas y futuras con sus colores. Bajo «Bloquear día» aparecen todas las sesiones del mes consultado, ordenadas por fecha y hora. Seleccionar un día cambia la fecha de bloqueo, sin filtrar las tarjetas del mes.
- «Volver a hoy» actualiza tanto el mes visible como la fecha seleccionada. Navegar a otro mes selecciona su primer día para evitar bloquear por error una fecha del mes anterior.
- El historial está integrado en el calendario: no hay botón a un historial separado ni selector Calendario/Lista. Las tarjetas de cada mes son el historial de ese mes.
- El rango mensual utiliza la consulta existente que recorre todas las páginas; no se limita a la primera página del historial.

## Novedades y Próximamente

`src/components/updates/versionUpdates.ts` añade a las novedades de 1.0.6 «Mejor visualización de sesiones pasadas» y a Próximamente «Más herramientas para DJs autónomos», en los siete idiomas. Conserva las tarjetas existentes del servidor.

Estos dos anuncios se incluyen en el código de esta revisión. No se publican por separado en `product_updates`, para evitar que la compilación anterior pendiente de revisión anuncie una pantalla que no contiene. Se podrá centralizar el contenido en el servidor después de publicar el nuevo build.

La confirmación de lectura incorpora una revisión de contenido para que las personas que probaron la primera compilación 1.0.6 puedan ver las nuevas tarjetas una vez. La versión pública sigue siendo 1.0.6; esta tarea no cambia la compilación enviada ni la revisión en Apple.

## Verificación

- Comprobación de tipos y paridad de textos en los siete idiomas.
- Pruebas de consulta mensual con varias páginas y aislamiento del contenido por versión.
- Prueba de navegador con respuestas simuladas de sesiones: tarjetas del mes, navegación a meses anteriores, selección de día, regreso a hoy, mes vacío, historial y búsqueda.
- Evidencias visuales y estado final en `../outputs/calendario-1.0.6/` desde la raíz del proyecto compartido.

La validación visual utiliza datos ficticios; no registra sesiones ni bloqueos en cuentas reales. La prueba en iPhone y la aprobación del propietario quedan pendientes antes del nuevo build.
