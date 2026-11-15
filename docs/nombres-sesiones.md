# Sesiones sin nombre

El nombre del evento es opcional en crear y editar sesión. El lugar, la fecha y el horario siguen siendo necesarios.

Se guarda `title: ''` si no hay nombre. La base de datos admite ese valor sin cambiar su columna NOT NULL. No se modifican títulos existentes ni se guarda el título automático como si lo hubiera escrito el usuario.

`sessionDisplayTitle` muestra el nombre explícito cuando existe; de lo contrario, genera «Sesión en [lugar]» en el idioma activo. Si el lugar de la sesión cambia, el título mostrado cambia también. Para datos incompletos o notificaciones sin lugar se usa «Sesión».

Las tarjetas sin nombre muestran la ciudad del lugar cuando está disponible, sin duplicar el lugar. Las consultas propias incluyen la ciudad del lugar vinculado y conservan los permisos existentes. Las sesiones invitadas conservan la información que les permite ver el servicio de colaboración; no se expone la ficha privada del lugar de otro DJ.

La regla se aplica en Inicio, Historial y sus búsquedas/filtros, detalle, Comunidad/perfiles de DJ, confirmación de eliminación, mensajes de conflictos, compartir y exportación al calendario. Los títulos vacíos no generan etiquetas de autocompletado.

## Verificación

- 63 pruebas unitarias: nombre vacío aceptado, lugar requerido, nombre explícito prioritario, cambio de lugar, subtítulos y exportación; textos disponibles en siete idiomas.
- Prueba en PostgreSQL aislado con las migraciones existentes: creación de una serie sin nombre y edición de nombre a vacío conservando la columna NOT NULL.
- `tests/browser/unnamedSession.cjs`: crear sin nombre, editar a un nombre explícito, quitarlo y comprobar el título y ciudad en Inicio/Comunidad. Peticiones simuladas, sin escrituras reales.
- TypeScript y exportación iOS/Android.
- Captura con datos ficticios: `docs/previews/unnamed-session-home.png`.

El formulario público de Contrataciones y las propuestas comerciales mantienen sus reglas propias de nombre de evento. No se cambia su servicio ni su publicación.
