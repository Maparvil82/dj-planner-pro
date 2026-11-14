# Eliminación de cuentas

## Estado a 9 de octubre de 2026

- Migración `20261009171214_complete_account_deletion.sql` aplicada en Supabase.
- Función `delete-account` desplegada. Comprueba el usuario con Supabase Auth antes de cualquier operación destructiva; la clave de servicio permanece en el servidor.
- La app incluye confirmación, progreso, errores y reanudación en `/delete-account`, accesible desde Perfil.
- La misma ruta permite autenticarse desde el navegador sin instalar la app, pero por decisión del propietario no se publicará una versión web ni se usará Vercel ahora. Antes del lanzamiento en Google Play hará falta un recurso externo para solicitar la eliminación; puede ser una página independiente, sin una versión web de la app. Contrataciones continúa oculta.

## Orden de eliminación

1. El usuario confirma el borrado y se registra un trabajo privado, idempotente.
2. Se impiden nuevas escrituras de esa cuenta mientras está pendiente el trabajo.
3. Se eliminan sus archivos mediante la API de Storage, en lotes. Se comprueba tanto el propietario como el prefijo de su cuenta en `avatars`, `venues`, `sessions`, `vault` y `expense-receipts`, incluidos archivos anidados o sin registro asociado.
4. Solo cuando no quedan archivos se elimina el usuario de Auth. Las relaciones de la base de datos eliminan sus registros asociados. La operación se rechaza si todavía hay archivos o falla una relación.
5. La app confirma el resultado y limpia la sesión local y la caché.

Los archivos de otras cuentas se conservan. Las referencias de sesiones de otras cuentas a una sesión eliminada se desvinculan sin borrar esas sesiones.

## Errores y reanudación

No se muestra éxito si el servidor no confirma el resultado. Los archivos ya borrados no son recuperables: una vez iniciado, el proceso debe completarse. Si se interrumpe, al volver a entrar se ofrece continuar. Un comprobante aleatorio permite confirmar durante una hora un resultado cuya respuesta se perdió después de eliminar Auth; solo devuelve si terminó. Los comprobantes caducados se purgan al iniciar nuevos trabajos.

## Moderación y suscripciones

Las denuncias permanecen para revisión, con la cuenta desvinculada. Se elimina la captura del perfil denunciado perteneciente a esa cuenta y se vacía el texto de las denuncias enviadas por ella. El historial de moderación no se elimina en bloque. Su rol de moderador sí se elimina; un administrador deberá otorgarlo a otra cuenta si procede.

Eliminar la cuenta no cancela la suscripción de Apple o Google ni elimina sus registros de compras. La pantalla lo indica antes de confirmar.

## Compatibilidad y publicación

La versión instalada desde las tiendas necesita una actualización para recibir la pantalla y el nuevo flujo. La antigua función `delete_user_data` ya no está habilitada para clientes: no se debe reutilizar el borrado manual anterior. Para eliminar una cuenta desde administración con archivos, usar el flujo de servidor antes de eliminar Auth; la protección de la base de datos rechazará el borrado de Auth si quedan archivos.

Se ha inspeccionado la pantalla nativa en un simulador de iPhone y exportado el código para iOS/Android. El borrado completo en una compilación de distribución y en un Android real sigue pendiente antes del lanzamiento. La publicación web se ha descartado por decisión del propietario. No se ha contratado alojamiento ni cambiado ningún plan.

## Verificación realizada

- Pruebas de orquestación: autenticación, confirmación, lotes, fallo de Storage, reanudación y respuesta perdida.
- Base de datos aislada: permisos, escrituras bloqueadas, archivos pendientes, relaciones, etiquetas, series y anonimización de moderación.
- Navegador: confirmación obligatoria, error/reintento, progreso, éxito y acceso sin sesión.
- Tipos y pruebas automatizadas del proyecto.
- Supabase real: permisos y respuestas no destructivas de la función desplegada.

No se ha eliminado ninguna cuenta real durante las pruebas.
