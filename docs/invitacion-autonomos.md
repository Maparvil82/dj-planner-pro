# Invitación y cuestionario para DJs autónomos · 1.0.6

Actualizado el 3 de noviembre de 2026. Disponible en la vista previa con el mismo QR. No se añade al sheet de novedades y no se genera un nuevo build sin el visto bueno del propietario.

## Invitación

Tarjeta con acento sólido y sin iconos en Estadísticas, justo encima de Evolución, tanto en cuentas gratuitas como Pro. Abre una invitación a pantalla completa con fotografía local de cabina (`assets/research/dj-collaboration-v1.png`), cierre «Ahora no» y texto de participación situado encima del botón.

Aparición automática: cuenta de al menos siete días, una actuación realizada y novedades reconocidas en una visita anterior. Tras consultar Estadísticas y dejar de desplazarse espera 20 segundos sin interacciones. Se cancela la espera con toques, desplazamientos, navegación, segundo plano o aparición del sheet. La preferencia por cuenta se guarda en este dispositivo; una visita nueva es una apertura o regreso tras 30 minutos en segundo plano.

Cerrar evita repeticiones automáticas. La tarjeta permite participar voluntariamente y retomar un cuestionario iniciado.

## Cuestionario

«Quiero participar» cierra la invitación y abre `/research-survey`, esperando a la finalización del cierre nativo en iOS. Las ocho preguntas están preparadas en español, inglés, alemán, francés, italiano, portugués y japonés.

- Una pregunta por paso, progreso, navegación atrás y revisión antes del envío.
- Dos campos abiertos opcionales; máximo 1500 caracteres. Las aclaraciones de «Otra» admiten hasta 300 caracteres.
- Máximo tres prioridades. «Ninguna» es excluyente.
- Se omite la última actuación si no ha habido ninguna, y la prioridad principal se resuelve automáticamente cuando solo se ha seleccionado una.
- Las preguntas abiertas pueden omitirse. El perfil profesional se conserva para segmentar, sin deducirlo del plan de suscripción.

## Borradores y envíos

El borrador se guarda por cuenta y versión en el dispositivo. «Guardar y salir» espera a que se guarde antes de navegar. Los cambios se guardan también durante la edición y al pasar a segundo plano. Un error de almacenamiento se comunica sin afirmar que se ha guardado correctamente.

La pantalla de revisión explica que las respuestas se vinculan a la cuenta para evitar duplicados y se utilizarán para mejorar DJ Planner. No se solicita contacto ni se inscribe al participante en comunicaciones.

«Enviar respuestas» registra la respuesta en Supabase, tabla `public.research_survey_responses`. Solo después de confirmar la lectura del registro propio muestra agradecimiento. Si falla, conserva el borrador y permite reintentar. La clave de cuenta y versión impide duplicados y permite recuperar la confirmación si se perdió la respuesta de red.

Cada cuenta puede insertar y leer exclusivamente su respuesta. No puede modificar ni borrar registros mediante el cliente, consultar los de otras personas ni falsificar la fecha del envío. La eliminación de la cuenta elimina su respuesta mediante la relación con `auth.users`.

Los identificadores de respuesta son comunes a todos los idiomas. El idioma original queda registrado. La administración del proyecto puede analizar resultados con `docs/analisis-cuestionario-autonomos.sql`; no hay acceso público a las respuestas.

## Verificación

Pruebas de reglas de selección y saltos; base de datos local con dos cuentas, respuestas inválidas, duplicados y permisos; comprobación del esquema y permisos en el servidor; comprobación de tipos y paridad de idiomas. El navegador usa datos simulados para recorrer borradores, revisión, fallo y reintento de envío y los siete idiomas. No se han introducido respuestas de prueba en la base de producción.
