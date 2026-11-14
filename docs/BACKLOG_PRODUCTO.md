# Backlog de producto · DJ Planner

Creado el 30 de octubre de 2026. Documento de planificación; no activa funciones ni compromete fechas de entrega.

## Objetivo

Ayudar al DJ a preparar actuaciones con menos trabajo, controlar sus cobros y recuperar la información que necesita en cada local.

Las propuestas nacen de una revisión del producto y del código. Son hipótesis pendientes de contrastar con usuarios. El propietario ha expresado interés explícito en las plantillas; esto no equivale a haber aprobado su desarrollo ni su alcance definitivo.

## Cómo utilizarlo

- **P1:** primera selección para definir y validar. No implica que deban desarrollarse todas a la vez.
- **P2:** siguientes oportunidades, sujetas a evidencia y capacidad.
- **P3:** explorar más adelante.
- **Esfuerzo:** comparación orientativa entre propuestas, pendiente de diseño y revisión técnica. No es una estimación de calendario.
- **Estados:** Propuesta → Por definir → Validación → Lista para desarrollar → En desarrollo → Verificación → Publicada. Una propuesta puede descartarse o posponerse.
- **Gratis/PRO:** pendiente de decisión en todas las propuestas. Se mantienen las reglas actuales: notas escritas gratuitas; avisos de audio y sus recordatorios PRO.

## Vista general

| ID | Funcionalidad | Prioridad | Estado | Esfuerzo orientativo |
| --- | --- | --- | --- | --- |
| DJP-01 | Plantillas de sesión | P1 | Primera versión local para revisión | Medio |
| DJP-02 | Seguimiento de cobros y vencimientos | P1 | Propuesta | Alto |
| DJP-03 | Historial privado del local | P1 | Propuesta | Medio |
| DJP-04 | Consulta de próximas sesiones sin conexión | P2 | Validación técnica pendiente | Alto |
| DJP-05 | Listas de preparación reutilizables | P2 | Propuesta | Medio |
| DJP-06 | Hora y preferencias de recordatorios | P2 | Propuesta | Medio |
| DJP-07 | Margen de desplazamiento entre actuaciones | P2 | Propuesta | Medio |
| DJP-08 | Exportación de datos a CSV | P2 | Propuesta | Medio |
| DJP-09 | Contactos profesionales vinculados a actuaciones | P3 | Propuesta | Alto |
| DJP-10 | Calendario externo actualizado | P3 | Propuesta | Alto |
| DJP-11 | Compartir disponibilidad privada | P3 | Propuesta | Alto |
| DJP-12 | Ficha de coordinación para el organizador | P3 | Propuesta | Medio |
| DJP-13 | Mejora de visualización de sesiones pasadas | P1 | Por definir · petición del propietario | Medio |
| DJP-14 | Mejoras en funciones para autónomos | P2 | Próximamente · alcance por definir | Por estimar |

## DJP-13 · Mejora de visualización de sesiones pasadas

**Petición del propietario (3 de noviembre de 2026):** facilitar la búsqueda y consulta de una sesión antigua.

**Alcance solicitado:**

- El historial está integrado en el calendario. Se elimina el selector entre calendario y lista y no se añade una pantalla de historial separada.
- En la agenda, mejorar la visualización de las sesiones pasadas dentro del calendario.
- Debajo de «Bloquear día» aparecen en forma de tarjetas todas las sesiones del mes que se está consultando, incluidas las pasadas.
- Encima del calendario se añade un botón «Volver a hoy» para regresar rápidamente al mes actual después de navegar a meses anteriores.

**Criterios de aceptación:**

- Una sesión antigua puede localizarse navegando por meses en el calendario, con el historial integrado debajo.
- Al cambiar el mes del calendario, las tarjetas inferiores muestran las sesiones de ese mes, sin quedar limitadas al día seleccionado.
- Cada tarjeta permite abrir el detalle de la sesión correspondiente.
- «Volver a hoy» devuelve el calendario al mes actual y selecciona el día de hoy.
- Las sesiones pasadas siguen siendo identificables y accesibles desde el calendario.
- Si el mes no tiene sesiones, se muestra un estado vacío claro.

**Estado (3 de noviembre de 2026):** primera implementación local para revisión del propietario en 1.0.6. Incluida en el sheet de novedades de esta revisión; pendiente del visto bueno antes de generar otro build. Véase `calendario-historial-1.0.6.md`.

## DJP-14 · Mejoras en funciones para autónomos

**Próximamente:** mejorar la gestión profesional para DJs autónomos.

**Líneas a concretar:** presupuestos y documentación, seguimiento de señales y cobros, gastos por actuación, rentabilidad y preparación de información para la gestoría. Se coordina con DJP-02 y DJP-08 para evitar duplicar funciones.

**Texto propuesto para «Próximamente»:** «Mejoras para DJs autónomos: más herramientas para organizar tus cobros, gastos y gestión profesional».

**Estado (3 de noviembre de 2026):** incluido en «Próximamente» del sheet de esta revisión de 1.0.6; alcance pendiente de definición, sin fecha de lanzamiento ni disponibilidad Gratis/PRO acordadas.

## DJP-01 · Plantillas de sesión

**Petición:** «Repito muchas actuaciones parecidas. Quiero guardar sus datos y reutilizarlos cuando tenga una nueva fecha».

**Base actual:** creación de sesiones y recurrencias. Una plantilla no crea actuaciones automáticamente.

**Primera versión propuesta:** guardar una configuración con nombre, local, horarios y caché; aplicarla al crear una sesión. La preparación reutilizable se incorpora después con DJP-05.

**Criterios de aceptación:**

- Se puede guardar, renombrar y eliminar una plantilla propia sin alterar sesiones existentes.
- Aplicarla rellena un borrador editable; el usuario elige y confirma la fecha antes de guardar.
- La nueva sesión empieza sin cobros, gastos, asistentes, accesos ni liquidaciones anteriores. No se copian avisos de audio, notas privadas o publicaciones automáticamente.
- No crea una serie recurrente de forma implícita ni elude comprobaciones de disponibilidad o límites del plan.
- Cambiar una plantilla no modifica las actuaciones ya creadas con ella.

**Por decidir:** punto de creación —desde una sesión, desde el formulario o ambos—; campos reutilizables; comportamiento si el local está archivado; acceso Gratis/PRO.

**Validación:** observar si un DJ puede crear su siguiente actuación con menos pasos y sin corregir datos arrastrados por error.

## DJP-02 · Seguimiento de cobros y vencimientos

**Petición:** «Quiero saber quién me debe dinero, cuándo acordamos cobrar y qué cantidades he recibido».

**Base actual:** total recibido por sesión, cobros parciales, saldo pendiente y agrupación por antigüedad de la actuación. Esa antigüedad no es un vencimiento de pago.

**Primera versión propuesta:** fecha acordada de pago e historial de cobros con fecha e importe. Añadir después avisos opcionales de vencimiento.

**Criterios de aceptación:**

- Una sesión admite varios cobros y permite corregir un registro con confirmación.
- Los totales y pendientes coinciden en detalle, inicio, estadísticas y exportaciones.
- Los importes ya registrados se conservan: no se inventan fechas para cobros antiguos al introducir el historial.
- Se distingue un pago vencido de una actuación antigua sin fecha pactada de pago.
- Cancelar una actuación no registra automáticamente una devolución ni elimina el dinero recibido.
- Los recordatorios respetan preferencias, permisos y cambios de fecha o saldo. No se envían reclamaciones a terceros automáticamente.

**Por decidir:** señales, devoluciones, ajustes y método de pago; migración de importes existentes; alcance de recordatorios; acceso Gratis/PRO.

**Validación:** comprobar si facilita localizar y gestionar pendientes frente al total recibido actual.

## DJP-03 · Historial privado del local

**Petición:** «Sé que anoté algo de este sitio, pero no recuerdo en qué actuación».

**Base actual:** locales, sesiones anteriores, notas privadas y avisos de audio vinculados a sesiones.

**Primera versión propuesta:** cronología desde el local con actuaciones, notas escritas y accesos a sus avisos de audio; filtros por fecha y búsqueda en texto y títulos.

**Criterios de aceptación:**

- Se puede abrir la sesión de origen de cada anotación.
- El historial solo muestra datos autorizados del propietario, sin publicarlos en Comunidad.
- Se respetan las reglas Gratis/PRO existentes para texto y audio; esta agrupación no añade recordatorios gratuitos a las notas escritas.
- La búsqueda de audio utiliza su título, sin prometer transcripción ni búsqueda dentro de la grabación.
- Se define el tratamiento de locales archivados y sesiones antiguas sin identificador de local, evitando mezclar lugares distintos con nombres parecidos.

**Por decidir:** ubicación de la cronología y relación con las notas generales del local.

**Validación:** recuperar una información de una visita anterior sin tener que recordar la fecha.

## DJP-04 · Consulta de próximas sesiones sin conexión

**Petición:** «Cuando llego a una sala sin cobertura necesito consultar los datos de mi actuación».

**Base actual:** consultas en línea y caché de ejecución; no hay un modo offline completo preparado para este recorrido.

**Paso previo:** investigar almacenamiento local, aislamiento por cuenta, protección de datos privados y comportamiento al cerrar o eliminar la cuenta.

**Primera versión propuesta:** descargar un conjunto acotado de próximas sesiones para consulta, con horario, dirección, contacto y preparación. Definir expresamente qué notas o archivos se descargan.

**Criterios de aceptación:**

- La información descargada sigue disponible tras cerrar y abrir la app sin conexión.
- Se muestra qué está disponible y cuándo se actualizó por última vez.
- Los datos de una cuenta no aparecen al acceder con otra.
- No se presenta como actualizada una cancelación o modificación que todavía no ha podido sincronizarse.
- Esta primera versión no admite escrituras, validación de entradas ni sincronización de accesos offline.

**Dependencias:** revisión técnica y decisión sobre retención local. La investigación puede adelantarse sin comprometer el desarrollo completo.

**Validación:** prueba real en modo avión después de reiniciar la app.

## DJP-05 · Listas de preparación reutilizables

**Petición:** «Siempre escribo la misma lista para bodas o clubs».

**Base actual:** tareas individuales por sesión.

**Primera versión propuesta:** guardar una lista propia y aplicarla a una actuación futura; posteriormente vincularla a una plantilla de sesión.

**Criterios de aceptación:**

- Las tareas copiadas empiezan sin completar y son independientes de la lista original.
- Se pueden editar las tareas de esa actuación sin modificar la plantilla.
- Repetir una aplicación exige una decisión clara para evitar duplicados involuntarios.
- Los contadores de preparación existentes siguen reflejando las tareas reales de la sesión.

**Dependencia opcional:** DJP-01 para aplicar todo en un único recorrido.

**Validación:** tiempo y pasos necesarios para preparar una segunda actuación similar.

## DJP-06 · Hora y preferencias de recordatorios

**Petición:** «No quiero que la pregunta sobre cómo fue la sesión me llegue de madrugada».

**Base actual:** aviso posterior calculado a las 24 horas del final y recordatorios de audio para próximas visitas.

**Primera versión propuesta:** hora preferida para la revisión posterior, activación/desactivación de tipos de aviso y opción de posponer.

**Criterios de aceptación:**

- El usuario comprende cuándo recibirá el siguiente aviso.
- Cambiar una preferencia actualiza los avisos pendientes sin duplicarlos.
- Se contemplan medianoche, cambios de zona horaria, actuaciones canceladas y permisos del sistema denegados.
- Los avisos de audio continúan sujetos a PRO y a la elección de recordar en la siguiente visita.

**Por decidir:** mantener 24 horas como alternativa; cómo se interpreta la hora preferida al viajar; duración de la opción «más tarde».

**Validación:** configurar y comprobar avisos con sesiones nocturnas y cambios de horario.

## DJP-07 · Margen de desplazamiento entre actuaciones

**Petición:** «Los horarios encajan, pero no tengo tiempo para ir de una sala a otra».

**Base actual:** detección de solapamientos y días bloqueados.

**Primera versión propuesta:** margen manual de traslado o preparación entre actuaciones; no requiere un proveedor de rutas.

**Criterios de aceptación:**

- Crear o editar una sesión avisa si invade el margen de otra.
- El aviso explica las actuaciones afectadas y el margen aplicado.
- Se contemplan series, actuaciones nocturnas y participaciones aceptadas.
- Un margen manual no se presenta como una estimación de tráfico ni una garantía de llegada.

**Por decidir:** margen global, por local o por actuación; cuándo permitir continuar tras el aviso.

**Validación:** casos reales de dos actuaciones el mismo día con desplazamiento.

## DJP-08 · Exportación de datos a CSV

**Petición:** «Quiero trabajar mis actuaciones y gastos en una hoja de cálculo o enviárselos al gestor».

**Base actual:** informe PDF de estadísticas.

**Primera versión propuesta:** exportaciones CSV separadas de sesiones y gastos, con periodo seleccionable. Excel nativo se evalúa después si aporta valor adicional.

**Criterios de aceptación:**

- Se distinguen caché acordado, cobrado, pendiente y gastos; los importes conservan su moneda.
- Los datos coinciden con las reglas del panel, explicando qué fecha determina cada periodo.
- Los nombres, decimales y caracteres especiales se abren correctamente en hojas de cálculo; los textos no ejecutan fórmulas.
- El usuario elige el destino mediante las opciones del dispositivo; no se envía nada automáticamente.

**Dependencia opcional:** DJP-02 si se incluye el detalle de movimientos de cobro.

**Validación:** apertura en una hoja de cálculo y conciliación con una muestra conocida de sesiones y gastos.

## DJP-09 · Contactos profesionales

**Petición:** «Un mismo promotor me contrata en varios locales y necesito tenerlo localizado».

**Base actual:** campo de contacto en la ficha del local.

**Primera versión propuesta:** contactos privados independientes del local, con rol y vínculos a actuaciones o lugares.

**Criterios de aceptación:**

- Un contacto puede estar vinculado a varios locales y actuaciones.
- Se distinguen organizador, técnico y responsable de pagos sin exigir cuentas de DJ Planner.
- La información no se publica en perfiles, carteles o Comunidad automáticamente.
- El usuario puede consultar las actuaciones relacionadas y corregir o desvincular el contacto.

**Por decidir:** campos mínimos, duplicados y relación con el módulo de Contrataciones antes de crear modelos paralelos.

**Validación:** localizar a quién llamar o reclamar un pago en una actuación concreta.

## DJP-10 · Calendario externo actualizado

**Petición:** «Quiero que mis actuaciones aparezcan en mi calendario habitual y reflejen los cambios».

**Base actual:** exportación puntual de una sesión a un archivo de calendario.

**Primera versión propuesta:** estudiar un calendario suscribible de solo lectura antes de plantear sincronización bidireccional.

**Criterios de aceptación:**

- Se define qué sesiones y campos salen; cachés y notas privadas quedan fuera por defecto.
- Cambios y cancelaciones mantienen una identidad estable para evitar duplicados.
- Se explican los posibles retrasos de actualización del proveedor externo.
- El usuario puede revocar el acceso; el enlace de suscripción se trata como privado.
- Se preservan horarios nocturnos y zonas horarias.

**Por decidir:** suscripción privada frente a permisos del calendario del dispositivo; compatibilidad y mantenimiento.

**Validación:** modificación y cancelación de una misma actuación en los calendarios elegidos.

## DJP-11 · Compartir disponibilidad privada

**Petición:** «Me preguntan qué fechas tengo libres y no quiero mandar capturas de mi agenda».

**Base actual:** agenda privada, días bloqueados y restricciones de disponibilidad; Contrataciones está oculto.

**Primera versión propuesta:** vista compartible de un periodo elegido que muestre únicamente disponibilidad, sin títulos de otras actuaciones.

**Criterios de aceptación:**

- El destinatario puede consultarla sin crear una cuenta.
- No se muestran cachés, contactos, notas, otros clientes ni datos privados de sesiones.
- El propietario puede limitar el periodo, caducar y revocar el enlace.
- Se explica que consultar una fecha no la reserva y se define cómo se muestran horarios o días parcialmente ocupados.

**Dependencias:** modelo de disponibilidad y evaluación conjunta con Contrataciones y DJP-07.

**Validación:** un organizador identifica fechas posibles sin recibir información adicional.

## DJP-12 · Ficha para el organizador

**Petición:** «Quiero enviar de una vez los horarios, contactos y necesidades técnicas de la actuación».

**Base actual:** compartir texto con título, lugar, fecha y horario; ficha del local con equipamiento; Documentos está oculto.

**Primera versión propuesta:** resumen compartible con campos elegidos por el DJ, incluyendo llegada, prueba de sonido y necesidades técnicas si se han registrado.

**Criterios de aceptación:**

- Hay vista previa y selección de campos antes de compartir.
- Cachés, notas privadas y contactos quedan excluidos salvo elección expresa y coherente con su finalidad.
- Se distingue una ficha operativa de un contrato o acuerdo aceptado.
- El envío requiere la acción del usuario en las opciones de compartir del dispositivo.
- Si es un archivo estático, se indica la fecha de generación; no se promete actualización automática.

**Dependencias opcionales:** DJP-09 para contactos y decisión sobre Documentos. No requiere activar esos módulos para un primer resumen básico.

**Validación:** comprobar con DJ y organizador si contiene lo necesario para coordinar una actuación.

## Trabajo existente pendiente de decisión

Estos módulos tienen implementación conservada y están desactivados mediante `src/config/features.ts`. No se consideran funciones totalmente nuevas ni se activarán por estar en este documento.

| Módulo | Antes de retomarlo |
| --- | --- |
| Contrataciones | Confirmar necesidad, completar configuración de correo y publicación, y comprobar el recorrido real de consulta a aceptación. |
| Documentos | Acordar qué documentos necesita guardar o compartir el DJ y revisar el recorrido antes de habilitarlo. |
| Acuerdos de caché | Validar las modalidades necesarias y revisar cálculo, liquidación y presentación antes de habilitarlos. |

## Próximo paso sugerido

Definir DJP-01 con un flujo y un prototipo pequeño. Validar qué datos quieren reutilizar los DJs y comparar el esfuerzo con crear una sesión desde cero. Después decidir acceso Gratis/PRO, criterios definitivos y si pasa a «Lista para desarrollar».

En paralelo se pueden investigar DJP-02 y DJP-03 con ejemplos reales, y hacer el estudio técnico de DJP-04. No hay desarrollos iniciados ni métricas nuevas instrumentadas como parte de este backlog.

Actualización 1 de noviembre de 2026: DJP-01 tiene una primera versión local para revisión del propietario. Véase `plantillas-sesiones.md`. No sincroniza entre dispositivos; preparación reutilizable y decisión Gratis/PRO siguen pendientes.
