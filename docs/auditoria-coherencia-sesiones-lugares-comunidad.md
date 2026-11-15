# Auditoría de coherencia: sesiones, lugares y Comunidad

Fecha: 5 de octubre de 2026. Código de referencia: `a7e3062`.

## Alcance y evidencia

Revisión de formularios, servicios, consultas, permisos y funciones desplegadas en Supabase, con consultas de lectura sobre los datos actuales. Incluye ubicación, historial, descubrimiento, colaboración, publicación, filtros, estados y efectos sobre métricas y notificaciones. No es una auditoría completa de seguridad, facturación, accesibilidad o rendimiento de toda la aplicación.

La auditoría inicial fue de solo lectura. Las correcciones activadas el 5 de octubre se detallan en «Implementación y verificación» al final; los hallazgos siguientes describen la situación anterior al cambio. Los riesgos descritos no deben confundirse con incidentes observados.

### Situación real de los datos

| Dato | Resultado |
| --- | ---: |
| Lugares guardados | 46 |
| Lugares sin ciudad | 32 |
| Lugares sin dirección | 32 |
| Sesiones guardadas | 192 |
| Sesiones sin vínculo a un lugar | 129 |
| Sesiones vinculadas a un lugar sin ciudad | 46 |
| Sesiones sin ciudad obtenible por el vínculo actual | 175 de 192 |
| Sesiones compartidas | 1 |
| Sesiones compartidas sin ciudad obtenible | 1 |
| Vínculos a lugares de otro propietario observados | 0 |
| Nombres de sesión/lugar vinculados distintos observados | 0 |
| Grupos de lugares duplicados por propietario y nombre normalizado | 0 |
| Estados `pending` o nulos actuales | 0 |
| Perfiles visibles incompletos según la comprobación actual | 0 |

Son recuentos globales, no una muestra. No se han extraído contactos, notas, importes individuales ni direcciones particulares.

## Decisión principal recomendada

**La sesión ocurre en un lugar; la ciudad del evento pertenece a esa ubicación, no a la residencia del DJ.** La dirección completa puede ser opcional. Para descubrir una sesión por ciudad necesitamos una ciudad identificable, no una calle.

Separar tres conceptos:

1. **Lugar guardado:** ficha personal reutilizable, con nombre, ciudad, dirección opcional, equipo y notas privadas.
2. **Ubicación de la sesión:** copia de los datos mínimos del lugar en esa fecha, para que borrar o mover el lugar no cambie el historial.
3. **Ubicación pública:** nombre y ciudad compartidos deliberadamente; dirección precisa privada por defecto, con una decisión explícita si en el futuro se publica.

La ciudad del perfil sirve para seleccionar inicialmente qué ciudad explorar. Nunca debe rellenar automáticamente la ciudad de una actuación: un DJ de Sevilla puede pinchar en Madrid.

## Hallazgos confirmados

Prioridad alta: afecta al descubrimiento, historial, integridad o coordinación. Media: coherencia de filtros y experiencia.

### 1. Alta — Crear un lugar desde una sesión lo deja sin ciudad

La sheet crea `{ name }`. El formulario general tampoco obliga a escribir ciudad ni dirección. Después, la publicación solo comprueba perfil completo y sesión activa: no avisa de la falta de ubicación.

**Consecuencia:** sesión publicable que no aparece al filtrar por ciudad ni en «Próximas en tu ciudad».

**Propuesta:** pedir nombre y ciudad en la creación rápida; dirección opcional. Mantener borradores/lugares antiguos incompletos en la agenda, pero antes de una nueva publicación ofrecer completar su ciudad y regresar al mismo flujo.

Evidencia: [creación](../app/add-session.tsx), [edición](../app/edit-session/[id].tsx), [sheet](../src/components/venues/SessionVenueSheet.tsx), [formulario de lugar](../app/venue/[id].tsx), [publicación](../src/components/community/SessionCommunitySharing.tsx).

### 2. Alta — Borrar un lugar conserva la sesión pero elimina su geografía

La FK desplegada `sessions_venue_id_fkey` usa `ON DELETE SET NULL`. No borra las sesiones. Sin embargo, las ciudades públicas proceden del lugar vinculado, por lo que desaparecen después del borrado. La confirmación solo dice que las sesiones se conservarán.

**Propuesta:** preferir «Archivar lugar» cuando tenga sesiones; para eliminación definitiva, conservar una copia de la ubicación de cada sesión. La confirmación debe explicar el efecto real.

Evidencia: constraint verificada en Supabase, [servicio](../src/services/venues.ts), [texto ES](../src/i18n/languages/es.json).

### 3. Alta — Cambiar la ciudad del lugar modifica actuaciones antiguas

Las consultas leen `venues.city` en cada petición. No existe una ciudad histórica guardada en la sesión. Si un club cambia de ciudad o se corrige equivocadamente la ficha, cambia la clasificación de todas sus actuaciones.

**Propuesta:** distinguir corrección de datos y traslado del establecimiento. Una corrección puede actualizar las sesiones seleccionadas; un traslado debe crear otra ubicación o aplicarse a futuras fechas. No reescribir el pasado por defecto.

Evidencia: [shelves](../supabase/migrations/20261005182846_community_session_shelves.sql), [servicio de sesiones](../src/services/sessions.ts).

### 4. Alta — Dashboard y Comunidad resuelven la ubicación de forma diferente

El Dashboard intenta enlazar una sesión antigua por nombre si encuentra exactamente un lugar coincidente. Comunidad solo usa `venue_id`. Además, el Dashboard resuelve lugares usando la lista privada del usuario; para un invitado no tiene el lugar del organizador.

**Consecuencia:** una sesión puede contar en una ciudad en estadísticas y carecer de ciudad en Comunidad; una invitación puede asociarse por nombre a un lugar propio que no sea el verdadero.

**Propuesta:** una única resolución de ubicación compartida por agenda, métricas y Comunidad. La coincidencia por nombre puede sugerir una reparación, pero no debe decidir silenciosamente la ciudad.

Evidencia: [métricas](../src/utils/dashboardMetrics.ts), [shelves](../supabase/migrations/20261005182846_community_session_shelves.sql).

### 5. Alta — La agenda del invitado no recibe ciudad ni dirección

La función desplegada `community_private.collaboration_inbox` envía nombre del lugar y horario, pero no ciudad, dirección ni una proyección de ubicación accesible. El detalle impide abrir la ficha privada del lugar a un invitado, lo cual es correcto para proteger las notas.

**Propuesta:** proporcionar a participantes invitados/aceptados una proyección específica con la ubicación necesaria para acudir. Mantener excluidos equipo privado, contactos, notas y caché del organizador. No dar acceso a la ficha completa del propietario.

Evidencia: función desplegada, [servicio de colaboraciones](../src/services/collaborations.ts), [detalle](../app/session/[id].tsx).

### 6. Alta — Cambiar ciudad/dirección no notifica a participantes

Las notificaciones de cambios observan título, texto del lugar, fecha, horas y estado de la sesión. No observan las modificaciones de ciudad/dirección del lugar. Cambiar de `venue_id` manteniendo el mismo nombre también queda fuera de ese disparador.

**Propuesta:** avisar ante cambios efectivos de ubicación de la actuación a los participantes afectados; una corrección de mayúsculas no debería generar un aviso operativo.

Evidencia: [disparadores de notificaciones](../supabase/migrations/20261002141740_social_notifications.sql).

### 7. Media — Ciudad del DJ y del lugar tienen modelos distintos

El perfil dispone de búsqueda híbrida y `city_location` con identificador, región y país. El lugar guarda texto libre, solo recortado. Los filtros normalizan mayúsculas, espacios y algunos acentos, pero no equivalencias como nombres traducidos ni errores ortográficos. No existe identidad geográfica en el lugar.

**Propuesta:** reutilizar la búsqueda híbrida para lugares. Comparar identificadores cuando existan; para entrada manual guardar ciudad y país, con clave normalizada y condición de identificación manual. No asumir que dos ciudades del mismo nombre son la misma.

Evidencia: [CityInput](../src/components/profile/CityInput.tsx), [utilidades](../src/utils/cities.ts), [modelo de lugar](../src/types/venue.ts).

### 8. Media — La creación rápida confunde lugares con el mismo nombre

La sheet busca un nombre normalizado existente y lo selecciona en lugar de crear otro. No considera ciudad ni dirección. Dos locales llamados «Sala X» en distintas ciudades no se distinguen en esta acción.

**Propuesta:** tratar nombre + ubicación como candidato a duplicado, mostrar las coincidencias y permitir «Crear otro lugar». No fusionar automáticamente.

Evidencia: [SessionVenueSheet](../src/components/venues/SessionVenueSheet.tsx).

### 9. Media — Hay dos escrituras independientes al renombrar un lugar

Se guarda primero el lugar y después se actualiza el texto de todas sus sesiones, incluidas históricas. Si la segunda operación falla, solo aparece una advertencia en consola. No se sincronizan los textos antiguos de `user_tags`.

**Propuesta:** una operación transaccional con alcance explícito y manejo de etiquetas obsoletas. Preservar el nombre histórico cuando represente un cambio real de identidad, no una corrección.

Evidencia: [updateVenue](../src/services/venues.ts).

### 10. Media — Las cachés de ubicación no se refrescan de manera uniforme

Actualizar lugar invalida `sessions` pero no el detalle `session`; borrar lugar no invalida ninguno de los dos. Comunidad sí se invalida. Puede quedar una pantalla mostrando un vínculo o ciudad antiguos hasta otra recarga.

**Propuesta:** invalidar detalles, listas, métricas y datos derivados afectados tras una modificación o archivo; incluir colaboraciones cuando se proyecte ubicación.

Evidencia: [hooks de lugares](../src/hooks/useVenuesQuery.ts), [hooks de sesiones](../src/hooks/useSessionsQuery.ts).

### 11. Media — «Próximas» compara días, no finalización de actuaciones

La clasificación usa `date >= hoy`. Incluye actuaciones de hoy que ya terminaron y excluye una sesión de ayer que todavía está sonando después de medianoche. La galería «Cartel» usa `date < current_date`: puede considerar pasada una actuación aún en curso y no mostrar otra que terminó hoy.

**Propuesta:** definir inicio y fin reales, incluida la madrugada; usar «en curso» / «próximas» / «finalizadas» de forma uniforme. La zona horaria debe pertenecer al evento.

Evidencia: [shelves](../supabase/migrations/20261005182846_community_session_shelves.sql), [carteles](../supabase/migrations/20261005002722_community_profile_posters.sql), [rangos actuales](../src/utils/sessionPlanning.ts).

### 12. Media — Los filtros mezclan significados

- En DJs, ciudad significa residencia/base del DJ.
- En sesiones, ciudad significa ciudad del lugar.
- En Actividad, un mismo filtro usa ciudad del evento para actuaciones y residencia del DJ para mixes.
- Los estilos de una sesión se deducen de los perfiles del autor/invitados aceptados; no describen necesariamente la música de esa noche.
- Los filtros de «Sesiones» también se aplican al bloque local fijado a la ciudad del perfil. Filtrar otra ciudad vacía el bloque local sin cambiar su ciudad de referencia.

**Propuesta:** etiquetas/contexto claros; en sesiones filtrar estilo del evento cuando se añada ese dato, con herencia inicial editable desde los DJs. Si se elige otra ciudad, cambiar el bloque de descubrimiento a esa ciudad o mostrar resultados filtrados sin un bloque local contradictorio.

Evidencia: [pantalla Comunidad](../app/(tabs)/community.tsx), [actividad](../supabase/migrations/20261005173137_community_following_activity.sql), [shelves](../supabase/migrations/20261005182846_community_session_shelves.sql).

### 13. Media — Publicación oculta no equivale a publicación retirada

Cancelar la sesión o desactivar el perfil la oculta; la fila de publicación se conserva. Si vuelve a estar activa/visible, reaparece sin una nueva publicación. Es una regla implementada deliberadamente y el texto español la explica, pero puede sorprender.

**Propuesta:** mantener clara la diferencia entre «Oculta temporalmente» y «Retirada». Al reactivar mostrar un resumen de lo que volverá a ser público. Los textos de otros idiomas todavía mencionan reservas/no confirmado y necesitan alinearse.

Evidencia: [sharing](../src/components/community/SessionCommunitySharing.tsx), [traducciones](../src/i18n/languages/en.json), [consulta pública](../supabase/migrations/20261005182846_community_session_shelves.sql).

## Riesgos y decisiones pendientes (no incidentes observados)

| Caso | Riesgo o límite actual | Regla recomendada |
| --- | --- | --- |
| Lugar de otro propietario | La FK garantiza existencia, no pertenencia. Las políticas de sesión solo comprueban su propietario; no hay un disparador de pertenencia del lugar entre los desplegados. No se han observado vínculos cruzados; la consulta pública impide exponer ese lugar mediante el join por propietario. | Validar en servidor que el lugar vinculado pertenece al creador. Participantes reciben una proyección, no un vínculo editable. |
| Boda, vivienda o fiesta privada | Compartir nombre/cartel puede revelar ubicación o datos personales aunque la dirección no se publique. | Explicar exactamente qué se comparte. Permitir etiqueta pública del lugar y mantener dirección precisa reservada a participantes. |
| Evento con lugar aún por confirmar | El formulario exige un lugar con texto, incentivando crear «Por confirmar» como establecimiento real. | Si se admite, tratarlo como estado de ubicación, nunca como ciudad real; no incluirlo en descubrimiento local. |
| Evento online o itinerante | El modelo actual presupone un solo lugar para cada fecha. | No simular una ciudad. Dejar estos casos explícitamente fuera de la primera versión o modelar modalidad/ubicaciones después. |
| Dos ciudades homónimas | El carrusel local compara solo nombre normalizado, aunque el perfil tenga país y región. | Identificador de ciudad o combinación país + ciudad; las entradas manuales ambiguas necesitan confirmación. |
| Viaje del DJ | Usar su residencia como referencia local no refleja dónde quiere explorar hoy. | Ciudad del perfil como valor inicial; selector de ciudad explorada independiente, sin pedir GPS obligatorio. |
| Dos DJs crean por separado el mismo evento | Se eliminan duplicados entre los tres bloques por ID de sesión, no duplicados de un mismo evento creado por distintos usuarios. | Favorecer una sesión con participantes aceptados; sugerir coincidencias, sin fusionar por título/fecha automáticamente. |
| Invitado quiere publicar y organizador no publica | Su aceptación da agenda, pero su aparición pública depende de que el organizador comparta y mantenga perfil visible. | Explicar quién publica y controla la sesión. No interpretar aceptación como permiso ilimitado para cualquier publicación futura. |
| Sesión de serie cambia de local | La edición puede afectar esta y futuras fechas; modificar la ficha del lugar afecta todas las fechas vinculadas. | Ofrecer un alcance coherente para cambios de ubicación; conservar actuaciones anteriores. |
| Cancelación con anticipo cobrado | Las métricas excluyen canceladas y el estado de pago devuelve cancelada antes de considerar dinero. | En una revisión financiera posterior, separar actuación cancelada de anticipo retenido, devolución pendiente y devolución realizada. No perder el importe registrado. |
| Cambio de zona horaria / gira internacional | `sessionRange` interpreta las horas en la zona del dispositivo; el campo `booking_timezone` no se utiliza ahí. | Zona IANA del evento e instantes de inicio/fin; verificar especialmente madrugada y cambios de hora. |
| Sesión propia en Comunidad | La exclusión del usuario existe en descubrimiento de DJs, no en el carrusel local/resto de sesiones. | Decidir si se incluye con marca «Tu sesión» o se oculta de descubrimiento; no dejar que parezca un error. |

## Matriz del comportamiento propuesto

| Situación | Agenda privada | Comunidad | Datos necesarios / acción |
| --- | --- | --- | --- |
| Nombre de lugar + ciudad, sin calle | Permitida | Publicable | Ciudad identificada; no exigir calle. |
| Lugar sin ciudad | Conservar borrador/antiguas | Pedir completar antes de nueva publicación | Sin rellenar con la ciudad del DJ. |
| Dirección escrita pero ciudad vacía | Permitida como incompleta | No clasificar localmente | Pedir ciudad explícita; no adivinar desde texto libre. |
| Sesión antigua con nombre de lugar sin vínculo | Conservar | Pedir reparar ubicación al publicar | Sugerir coincidencias y confirmar. |
| Ciudad manual | Permitida | Publicable con ciudad/país suficientes | Normalizar y distinguirla de una ciudad identificada externamente. |
| Club cambia solo una errata | Actualización controlada | Reflejar corrección | Confirmar alcance y guardar coherentemente. |
| Club se traslada | Historial sin cambios | Futuras fechas con ubicación nueva | Otro lugar/ubicación o cambio explícito en las fechas futuras. |
| Lugar archivado | Sesiones conservadas | Publicaciones conservadas | Fuera del selector por defecto; ubicación histórica disponible. |
| Lugar eliminado definitivamente | Sesiones conservadas | Publicaciones conservan ciudad/nombre | Copia de ubicación previa; quitar vínculo. |
| DJ invitado acepta | En su agenda | Solo bajo las reglas de publicación acordadas | Ubicación operativa accesible; datos privados del dueño excluidos. |
| Actuación sin nombre propio | Permitida | Permitida | Título derivado del lugar; no obligar a inventar un nombre. |
| Sesión sin cartel | Permitida | Permitida | La ausencia de imagen no impide descubrirla. |
| Sesión cancelada | Conservar y marcar | Oculta | Cobros independientes del estado de actuación. |
| Sesión en curso tras medianoche | En curso | En curso, no pasada | Fin real y zona del evento. |
| Sesión de hoy ya terminada | Historial/finalizada | Fuera de próximas; cartel elegible | No esperar a mañana para considerarla finalizada. |

## Qué funciona y conviene preservar

- Nombre de sesión opcional, con título automático localizado basado en el lugar.
- Pagos independientes del paso del tiempo; los invitados no heredan el caché del organizador.
- Privacidad de cachés, contactos, notas y equipo en las proyecciones sociales.
- Invitación aceptada para incorporar la sesión a la agenda del otro DJ.
- Publicación voluntaria; una sesión privada no entra automáticamente en Comunidad.
- No se borra una sesión al eliminar su lugar.
- Borrado de sesión con alcance explícito «solo esta» / «serie», por IDs, no por nombre.
- Perfil completo obligatorio para seguir y publicar, con controles en servidor.
- Límite gratuito de 30 sesiones propias guardadas; borrar libera espacio, acorde con la decisión actual.
- Los tres bloques sociales clasifican antes de paginar y no duplican una misma sesión entre bloques.

## Orden de corrección recomendado

1. **Captura y publicación:** nombre + ciudad en creación rápida; dirección opcional; reparación guiada antes de compartir. Misma búsqueda híbrida y modelo geográfico para perfil y lugar.
2. **Conservar historia:** copia de ubicación en sesiones, archivo de lugares vinculados, validación de propietario en servidor y cachés coherentes.
3. **Reparar datos existentes:** sugerencias por nombre, pero confirmación si hay ambigüedad. Nunca asignar la residencia del DJ a sus sesiones antiguas. No retirar en bloque publicaciones ya existentes.
4. **Coordinación:** ubicación segura para invitados, avisos de cambios y alcance de cambios en series.
5. **Descubrimiento:** identidad de ciudad/pais, selector de ciudad explorada, horarios reales y semántica clara de filtros.
6. **Posterior:** estilo propio de evento, cancelaciones con anticipos, duplicados entre autores y modalidades online/itinerantes.

## Criterios para verificar la implementación futura

- Crear y publicar una actuación en Madrid desde un perfil de Sevilla: se descubre en Madrid.
- Crear sin calle pero con ciudad: no hay bloqueo innecesario.
- Cancelar el completar ciudad: se conserva el formulario y no se publica accidentalmente.
- Borrar/archivar lugar: no desaparecen ciudad histórica, sesiones ni carteles públicos.
- Corregir un lugar: elegir alcance, sin reasignación silenciosa del pasado.
- Dos «Sala X» en distintas ciudades: ambas seleccionables sin mezcla.
- Dos ciudades del mismo nombre en distintos países: resultados locales distintos.
- Invitado aceptado: ve ubicación necesaria, nunca notas/caché privados del organizador.
- Cambiar ubicación: participante recibe aviso; corregir mayúsculas no genera aviso operativo.
- Madrugada y sesión de hoy finalizada: misma fase en agenda, carrusel y carteles.
- Intento de vincular un lugar ajeno: rechazo del servidor.
- Sesión heredada sin vínculo: propuesta de reparación, sin asignación automática falsa.

## Verificación realizada

Inspección del código y funciones efectivamente desplegadas, constraints, políticas y disparadores. Consultas agregadas de lectura en Supabase. Pruebas existentes de lógica de sesión y nombres: **11/11 correctas** (`sessionWorkflow.test.cjs`, `sessionNaming.test.cjs`). Estas pruebas respaldan las reglas existentes de fechas, título y alcance de serie; no validan todavía las soluciones propuestas ni sustituyen una prueba en iPhone de los flujos nuevos.


## Implementación y verificación — 5 de octubre de 2026

Migración `session_location_integrity` aplicada en Supabase. Se mantienen 192 sesiones, 46 lugares y 4 notificaciones; no se borraron registros ni se emitieron avisos por la migración. Se copiaron ciudad y dirección desde vínculos reales en 17 sesiones con ciudad conocida. Las 175 restantes necesitan completar sus datos; no se dedujo su ciudad desde nombres ni residencia del DJ. La publicación antigua sin ciudad se conserva.

### Correcciones activadas

- Ciudad obligatoria al crear un lugar, también desde el formulario de sesión. Dirección opcional y privada. Búsqueda híbrida y ubicación estructurada como en el perfil, con alternativa manual normalizada.
- Cada sesión conserva nombre, ciudad, ubicación estructurada y dirección de su lugar. Dashboard y Comunidad usan esa copia; se eliminó la asociación automática por nombre.
- Editar un lugar actualiza atómicamente sus sesiones aún no empezadas. Las ya iniciadas o pasadas conservan su ubicación. La ficha explica esta regla; volver a seleccionar el lugar en una sesión permite actualizarla explícitamente.
- Los lugares se archivan y se pueden restaurar. Desaparecen del selector habitual y siguen accesibles mediante «Mostrar archivados». Incluso un borrado definitivo conserva la ubicación de las sesiones.
- La creación rápida diferencia nombre, ciudad identificada y dirección, y no confunde automáticamente locales de ciudades diferentes.
- El servidor rechaza vínculos con lugares de otro propietario y nuevos vínculos con lugares archivados.
- El participante ve ciudad, dirección y zona horaria en su sesión invitada; las notas y el caché del organizador siguen excluidos. Los cambios operativos de ubicación y zona horaria generan aviso; las mayúsculas por sí solas no lo generan.
- Antes de una nueva publicación sin ciudad aparece un selector para completar o crear el lugar. La regla también se aplica en el servidor. Las sesiones privadas antiguas se conservan sin exigir una reparación inmediata.
- Invalidación de listas, detalle, sesiones, Comunidad, invitaciones y notificaciones al modificar o archivar lugares.
- Nuevas sesiones y series guardan la zona horaria del evento, visible en el formulario. «Próximas» usa el final de la actuación y admite sesiones en curso tras medianoche; los carteles pasados usan el mismo criterio.
- El filtro de ciudad controla también el carrusel local. Los filtros de sesiones dicen «Estilos de los DJs»; la actividad aclara que ciudad se refiere al evento o al perfil según el contenido.
- El texto de una publicación temporalmente oculta explica que puede reaparecer al reactivar el perfil o la sesión; retirarla requiere dejar de compartirla.

### Verificación

- Tipos y 83 pruebas de lógica: correctos.
- Prueba de base de datos con la migración completa y permisos reales: conservación histórica, propagación futura, propietario, archivo/borrado, publicación incompleta, privacidad del invitado, filtros por país, notificaciones y series con zona horaria.
- Dos recorridos en Expo web con respuestas simuladas: creación de lugar con ciudad manual y dirección opcional, alta de sesión, detalle privado; filtros y seguimiento de Comunidad. Sin errores de página.
- Exportación iOS completada. Falta comprobar el comportamiento nativo en un iPhone real.
- Verificación remota: recuentos conservados, cinco nuevos disparadores activos, funciones auxiliares sin acceso anónimo y feed vacío sin identidad.
- Asesores de Supabase: no aparecen nuevas advertencias de seguridad. Permanecen avisos previos de protección de contraseñas, función de borrado de cuenta y políticas de tablas privadas. [Referencia de los asesores](https://supabase.com/docs/guides/database/database-linter). Rendimiento: 6 claves foráneas sin índice, 21 advertencias de evaluación de políticas y 15 políticas duplicadas previas; el nuevo índice de lugares activos todavía no tiene uso registrado.

### Límites y decisiones que siguen pendientes

- No se puede recuperar una ubicación histórica que nunca se guardó. La copia inicial usa la ficha actual del lugar, no una dirección histórica desconocida.
- Las sesiones antiguas sin zona horaria conservan el comportamiento previo en agenda; las consultas sociales usan UTC cuando falta zona. Al editarlas se muestra la zona del dispositivo para confirmarla. Hace falta revisar esos datos heredados, especialmente actuaciones cercanas a medianoche.
- Una ciudad manual sin país sigue siendo ambigua si existen homónimos. Las ciudades seleccionadas del servicio externo incluyen región y país; no se inventa un país para las antiguas.
- El filtro musical representa los estilos declarados por los DJs, no un estilo específico del evento.
- No se añadió resolución de eventos compartidos por autores distintos, sesiones online o con varios lugares, ni cambios contables sobre anticipos en cancelaciones. Son decisiones de producto separadas, no correcciones de ubicación.
