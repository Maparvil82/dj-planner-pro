# Tipo de sesión

Crear y editar permiten elegir Club, Festival, Boda, Evento corporativo o Residencia en la sección del evento. El campo es un desplegable compacto con Club seleccionado al crear una sesión. «Sin especificar» permite quitar una clasificación existente. No se asigna automáticamente un tipo a las sesiones antiguas.

El tipo describe el formato de la actuación. Es independiente del lugar, del modelo de cobro, de la repetición y de los participantes. Elegir Residencia no activa una repetición automáticamente. El selector está disponible tanto en sesiones habituales como condicionales, sin un bloqueo Pro adicional.

El detalle muestra el tipo cuando existe. Las series nuevas conservan el mismo tipo en todas las fechas; al editar se respeta el alcance ya elegido por el usuario: esta sesión o esta y las siguientes. Solo se envía el campo cuando cambia. Los DJs invitados reciben el tipo mediante la proyección privada existente, conservando los filtros de bloqueo y sin añadir información económica.

La columna opcional `sessions.event_type` admite `club`, `festival`, `wedding`, `corporate`, `residency` o `NULL`. La validación del formulario y una restricción en la base de datos rechazan otras clasificaciones. Se conservan los permisos de las sesiones y las comprobaciones de cuota de la operación de creación de series.

La migración `20261015203918_session_event_type.sql` está aplicada en el proyecto existente. Se verificaron la columna opcional, los cinco valores permitidos, la conservación de RLS y las funciones de series e invitados. Los avisos de seguridad existentes no cambiaron.

## Verificación

- `npm run typecheck`, `npm run check:i18n` y `npm test`.
- `node tests/sessionEventTypeDatabase.cjs`: PostgreSQL aislado; tipos, recurrencias, sesiones antiguas, retirada de clasificación, valores inválidos, cuota, aislamiento y proyección de invitados con bloqueos.
- `node tests/browser/sessionEventType.cjs`: creación, detalle, edición, retirada de clasificación y sesiones antiguas en móvil, con tema claro y los cuatro temas oscuros. Comprueba también fondo y texto de los inputs, apertura/cierre del desplegable y conservación del borrador. Peticiones de la API simuladas; no modifica cuentas reales. Admite `BASE_URL`, `PLAYWRIGHT_MODULE` y `PLAYWRIGHT_CHROMIUM`.

La verificación de navegador no sustituye la prueba en un dispositivo iOS/Android real. La selección del tipo todavía no genera tareas de preparación.

Los inputs de crear y editar usan `SessionTextInput` con fondo, texto y placeholder explícitos según el tema. El color ya no depende únicamente de las clases de estilos.

## Colores al entrar en el formulario nativo

Fecha, repetición, horas, color, etiquetas, calendarios y listas de opciones usan colores explícitos del tema en crear y editar. Los selectores de hora de iOS reciben además `themeVariant`. El borde del nombre y de los campos también respeta el tema al enfocar.

«Añadir lugar» y su indicador de carga usan el color de contenido asociado al acento (`onAccent`): oscuro sobre lima y el color correspondiente en cada variante.

`tests/browser/sessionNativeTheme.cjs` desactiva los colores de las clases `dark:` para reproducir su ausencia: verifica los campos y etiquetas, las listas de repetición/color y un contraste mínimo de 4,5:1 en el botón, en los cinco temas. Usa respuestas simuladas y no guarda datos reales. Es una regresión de estilos en navegador; no sustituye la revisión de iOS.
