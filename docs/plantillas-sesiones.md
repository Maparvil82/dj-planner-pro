# Plantillas de sesión · primera versión

1 de noviembre de 2026. Primera versión para valorar el recorrido; no hay cambios en Supabase ni nuevas dependencias.

## Recorrido

- En el detalle de una sesión propia, «Guardar como plantilla», antes de la tarjeta Lugar. Abre un panel inferior con nombre editable, resumen y explicación de lo que se conserva.
- En Crear sesión normal, «Usar una plantilla» al principio del formulario. Abre el listado en un panel inferior.
- Elegir una plantilla rellena lugar, horario, zona horaria si estaba registrada, tipo de actuación, caché, moneda y color. La fecha seleccionada, el título escrito y los demás campos no se cambian. Si se detectan datos ya introducidos en los campos reutilizables, se pide confirmar su sustitución.
- Renombrar y eliminar desde la misma lista. Eliminar una plantilla no elimina actuaciones.

No crea recurrencias ni copia título, notas, audios, carteles, colaboradores, cobros, gastos, invitados, accesos o liquidaciones. Los controles existentes al guardar la sesión siguen comprobando disponibilidad, importes y límites del plan.

## Alcance y límites

- Plantillas locales en AsyncStorage, con almacenamiento y caché separados por cuenta. No se sincronizan con otros dispositivos y pueden perderse al eliminar los datos de la aplicación o desinstalarla.
- Interfaz disponible sin un nuevo bloqueo PRO en esta iteración. La decisión comercial sigue pendiente en el backlog.
- Una plantilla guarda una instantánea. Editarla o eliminarla no cambia las sesiones que ya se hayan creado.
- Se utilizan locales activos: una plantilla cuyo local vinculado ya no aparece entre los disponibles ofrece un error sin rellenar parcialmente el formulario.
- Se admiten sesiones gratuitas, caché fijo y por hora. Las sesiones por acuerdo no admiten guardado de plantillas en esta versión; se explica en el panel. El formulario condicional no ofrece este selector.
- Los errores de almacenamiento se muestran y no se sustituyen datos dañados por una lista vacía. Las escrituras se serializan por cuenta para evitar pérdidas por operaciones concurrentes.

## Archivos de esta incorporación

Nuevos:
- `src/utils/sessionTemplates.ts`
- `src/services/sessionTemplates.ts`
- `src/hooks/useSessionTemplates.ts`
- `src/components/sessionTemplates/SessionTemplates.tsx`
- `tests/sessionTemplates.test.cjs`
- `tests/browser/sessionTemplates.cjs`
- Este documento.

Integración: `app/add-session.tsx`, `app/session/[id].tsx`, traducciones `templates` en los siete idiomas y actualización del estado de DJP-01 en el backlog.

La copia previa a esta incorporación está en `/tmp/djplanner-templates-before-20261101`, con manifiesto de hashes. No restaurar esos archivos completos si después reciben otros cambios: revisar y revertir únicamente las incorporaciones de plantillas. Deshacer el código no requiere borrar ni alterar sesiones en el servidor. Las claves locales de plantillas usan el prefijo `djplanner-session-templates-v1:`.

## Comprobación

- Pruebas de lista blanca de campos, sesiones ajenas/invitadas, aislamiento por cuenta, persistencia, renombrado, eliminación, nombres duplicados, concurrencia y fallos de almacenamiento: `node --test tests/sessionTemplates.test.cjs`.
- TypeScript y auditoría de los siete idiomas.
- `tests/browser/sessionTemplates.cjs`: recorrido de navegador con Supabase simulado para guardar, volver a abrir, aplicar conservando fecha, renombrar y eliminar. Sin errores de página. No equivale a una prueba en iPhone físico.
- Resultado: 342 pruebas correctas; TypeScript y siete idiomas correctos.
