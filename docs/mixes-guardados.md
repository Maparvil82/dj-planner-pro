# Mixes guardados

Implementado el 6 de octubre de 2026.

## Recorrido

- En Siguiendo y en las listas de mixes de los perfiles aparece un marcador junto a reproducir.
- Marcador vacío: guardar para después. Marcador relleno: quitar de guardados. Ambas acciones tienen etiqueta accesible y estado de carga.
- Avatar → Mixes guardados abre la colección privada, ordenada por fecha de guardado, con páginas de 20.
- Se puede abrir el perfil del autor, reproducir con el reproductor oficial existente y quitar un mix. El estado se sincroniza entre listas y colección.
- La función es gratuita y no requiere un plan Pro. No envía notificaciones ni genera publicaciones sociales.

## Datos y privacidad

`public.saved_mixes` guarda únicamente propietario, referencia al mix y fecha de guardado. No descarga ni copia audio. Clave única por propietario/mix; una repetición no crea duplicados. Las políticas permiten leer, crear y eliminar únicamente registros propios; no se permite reasignarlos ni alterar la fecha desde el cliente.

La inserción exige que el mix sea accesible con los permisos del usuario. El listado es una función SECURITY INVOKER y respeta las políticas existentes de mixes y perfiles. Si el DJ oculta su perfil, sus mixes dejan de mostrarse en la colección de otros usuarios; pueden volver a aparecer si reactiva el perfil. Si elimina el mix, se elimina la referencia guardada. Cambiar el título o enlace del mix se refleja en la colección, sin mantener una copia antigua.

Las consultas y cachés incluyen el identificador del usuario. El estado de guardado se consulta en lote para cada lista visible.

## Verificación

- Prueba de base de datos con RLS: aislamiento entre cuentas, denegación de mixes privados, duplicados, imposibilidad de reasignación, paginación, cambios de título, ocultación/reactivación y borrado del mix, rechazo del acceso anónimo.
- Recorrido de navegador en Expo web con API simulada: error al guardar y reintento, persistencia tras recargar, acceso desde el menú, reproducción y eliminación. Sin errores de página; incluye controles a 320 px.
- Comprobación de tipos y exportación iOS correctas. No sustituye una prueba en iPhone físico.
- Migración aplicada y verificada en Supabase: RLS activo, tres políticas, sin permisos de lectura/RPC anónimos ni UPDATE autenticado. No se crearon guardados de prueba en producción.
- Sin nuevos avisos de seguridad en los asesores de Supabase. Los nuevos índices aún no registran uso, algo esperable en una colección vacía. [Referencia de los asesores](https://supabase.com/docs/guides/database/database-linter).

También se corrigió la navegación del menú: primero se confirma el cierre del modal y después se abre el destino, evitando conservar la capa del menú sobre la nueva pantalla.
