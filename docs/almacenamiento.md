# Almacenamiento: corrección del punto 4 de la auditoría

## Estado

Activado en Supabase de producción el 10 de octubre de 2026, tras autorización del usuario. Migración aplicada y función storage-maintenance desplegada (versión 1, ACTIVE). La primera aplicación falló por intentar añadir un índice a la tabla interna storage.objects; se revirtió completa. Se adaptaron las consultas para utilizar los índices existentes de Storage y la migración corregida se aplicó correctamente. No se ha publicado una web ni cambiado planes de alojamiento.

## Cambios activados

| Contenido | Tamaño máximo por archivo | Formato |
| --- | --- | --- |
| Avatar y cabecera | 1 MiB | JPEG, reducido a 400/1600 píxeles en el lado largo |
| Cartel | 1 MiB | JPEG, lado largo máximo 1600 píxeles |
| Foto de lugar | 1 MiB | JPEG, lado largo máximo 1200 píxeles |
| Factura | 600 KiB | JPEG, privado, enlace de 5 minutos |
| Documentos | 10 MiB | PDF, JPEG/PNG/WebP, texto/CSV, Word y Excel |

Las imágenes se comprimen sin recortar ni aumentar su resolución. Si siguen excediendo el límite, se rechazan. La compresión nativa limpia su archivo temporal. Los límites también se aplican en Supabase: no basta con omitir la comprobación de la app para evitarlos.

La protección de almacenamiento total es **100 MiB por cuenta**, igual para gratuitas y Pro. Cuenta todos los archivos, también los subidos pero no asociados. La cuota de sesiones y las compras Pro no cambian. El servidor comprueba los tamaños y serializa las escrituras para evitar sobrepasar la cuota con varias subidas simultáneas. La clave de servicio sigue siendo exclusivamente del servidor.

## Limpieza de archivos sin uso

- Se mantiene un inventario privado e indexado de referencias desde perfiles, sesiones, lugares, gastos, documentos y capturas de denuncias. Se inicializa también con los registros existentes.
- Solo se seleccionan archivos de la cuenta autenticada, de más de 24 horas y sin referencias.
- Se conservan las rutas antiguas ambiguas; no se decide su borrado interpretando nombres dudosos.
- Una reserva impide volver a asociar un archivo que ya esté siendo limpiado. Se coordinan también referencias a fotos de otra cuenta.
- La función `storage-maintenance` verifica la identidad con Auth y elimina mediante Storage API. No acepta un usuario objetivo enviado desde el cliente.
- Solo se confirma la limpieza tras la respuesta de Storage. Si falla, conserva el trabajo para reintentar. No se borra el contenido de la cuenta.
- La app solicita un lote pequeño de hasta 50 archivos cinco segundos después de entrar y al volver al primer plano, como máximo cada 15 minutos. No hay un cron ni limpieza de cuentas inactivas programados.

Los comprobantes de limpieza conservan únicamente identificadores y rutas, con acceso reservado al servidor. Se eliminan cuando se elimina la cuenta. Las fotografías usadas por sesiones recurrentes u otros registros se mantienen mientras siga existiendo una referencia.

## Documentos

El código anterior intentaba guardar `vault_files.path`, pero la columna no existía. Se añade en la migración; los documentos antiguos siguen funcionando mediante la ruta obtenida de su URL.

El borrado de documentos/carpetas ahora comprueba Storage antes de borrar los registros. Si falla guardar los datos de una subida, se intenta eliminar el archivo recién subido y el trabajador puede recogerlo después. Se usan identificadores aleatorios en las rutas nuevas. Documentos continúa oculto por su configuración actual.

## Privacidad y compatibilidad con la app publicada

Facturas y documentos son privados y seguirán siéndolo. Actualmente avatars, sessions y venues son públicos. La migración prepara permisos para que las imágenes firmadas solo sean accesibles al propietario o, en Comunidad, cuando la foto o sesión esté publicada y no bloqueada/retirada para quien la consulta. La app utiliza enlaces de 5 minutos, sin guardar esos enlaces temporales en los registros.

**El cierre de los tres depósitos públicos no se ejecuta todavía.** Es necesario publicar primero la actualización nativa y comprobar las imágenes y la edición en dispositivos. Después se podrá cambiar su visibilidad a privada. Los enlaces públicos de versiones antiguas dejarán de funcionar al activar ese cierre; hasta entonces, conocer el enlace público permite abrir la imagen. Los enlaces firmados ya expedidos pueden funcionar hasta su caducidad.

## Verificación

- 119 pruebas automatizadas del proyecto, incluidos fallos de limpieza y borrado de documentos.
- Base de datos aislada: límites configurados, cuota, permisos, inventario, referencias cruzadas, denuncias, archivos recientes y rutas ambiguas protegidas.
- Tipos TypeScript verificados.
- Exportación JavaScript/Hermes de iOS y Android completada. No equivale a pruebas de una compilación de distribución en dispositivos.
- El borrado de cuenta se ha comprobado de nuevo en navegador con datos simulados y su pantalla se ha inspeccionado en el simulador de iPhone.

Inventario real antes de los cambios: 56 archivos, aproximadamente 11,6 MiB en total; los mayores son menores de 1 MiB. No se han eliminado archivos reales durante estas pruebas.

## Verificación en producción y pendiente nativo

- Límites y formatos de los cinco depósitos comprobados; imágenes siguen públicas, facturas y documentos privados.
- 56 archivos conservados al terminar la aplicación, 29 referencias inventariadas y ninguna reserva de limpieza creada durante la comprobación.
- Cuota mediante trigger instalada. RPC de limpieza accesible exclusivamente al servidor, sin ejecución para anon ni authenticated.
- Petición real sin credenciales a la función: HTTP 401 / AUTH_REQUIRED, sin seleccionar ni borrar archivos. La función autentica cada petición con Auth antes de seleccionar archivos. La limpieza automática se solicitará desde la app actualizada; no se ejecutó una limpieza real como prueba.
- Las pruebas de base de datos aislada se repitieron y pasaron tras adaptar las consultas a los índices existentes.
- Los avisos de rendimiento restantes se abordarán en el siguiente punto de la auditoría. La comprobación de contraseñas filtradas de Auth continúa pendiente; las tablas privadas sin políticas están cerradas deliberadamente.

**Pendiente:** publicar y comprobar la actualización nativa en dispositivos antes de cerrar los depósitos de imágenes. La app instalada no recibe los cambios de interfaz y compresión hasta actualizarse.
