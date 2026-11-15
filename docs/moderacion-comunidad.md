# Moderación de Comunidad v1

Aplicada en Supabase mediante `20261009103647_community_safety.sql`.

## Recorrido

- En perfiles, sesiones compartidas y mixes de otros DJs: menú de tres puntos → denunciar o bloquear.
- Las denuncias ocultan el contenido al denunciante mientras se revisa. No lo retiran para todos automáticamente.
- El bloqueo es bilateral, elimina los seguimientos entre las dos cuentas y evita nuevas invitaciones, aceptación de invitaciones pendientes y notificaciones. Conserva las colaboraciones ya aceptadas en la agenda. Desbloquear no vuelve a seguir automáticamente.
- Antes de publicar perfil, mix o sesión, o seguir a otros DJs: aceptación explícita de las normas vigentes, registrada en el servidor.
- Menú de cuenta → Seguridad de la comunidad: normas, contacto cuando esté activo y DJs bloqueados.
- Menú de cuenta → Moderación: solo cuentas autorizadas; denuncias abiertas/cerradas y decisiones con una nota obligatoria. Retirar contenido, suspender perfil o restaurar la decisión de esa denuncia. Otras sanciones independientes siguen aplicándose.

## Administración

El primer moderador autorizado es la cuenta `maparvil@gmail.com`. Los permisos se guardan en una tabla privada; no dependen de un campo editable del perfil ni se otorgan automáticamente por registro.

Si se elimina esa cuenta, pierde los permisos. Las denuncias y el historial sobreviven; las referencias al moderador eliminado quedan vacías. Antes de eliminarla conviene autorizar otra cuenta existente desde el SQL Editor de Supabase:

```sql
insert into community_private.moderators(user_id)
select id from auth.users where lower(email)=lower('CORREO_DE_LA_NUEVA_CUENTA')
on conflict(user_id) do nothing;
```

La recuperación también puede hacerse después desde la administración de Supabase. No existe una puerta de recuperación dentro de la app que permita a un usuario convertirse en moderador.

## Contacto pendiente

El propietario ha indicado `plannerdj@moderacion.com` como futuro correo de contacto, pero el buzón todavía no existe. No está publicado como canal operativo. Cuando exista y se haya comprobado que recibe mensajes, activar:

```sql
update community_private.safety_settings
set contact_email='plannerdj@moderacion.com' where id;
```

No requiere integrar un proveedor de envío: la app abre el cliente de correo del usuario. Esto no crea un buzón ni envía avisos automáticos al moderador.

## Operación y límites

Debe haber una persona responsable que revise la bandeja regularmente y responda a los casos y reclamaciones. El filtrado de texto implementado es básico, no sustituye la revisión contextual ni detecta automáticamente imágenes inapropiadas. No se garantiza aprobación de Apple/Google; el contacto operativo y la revisión humana son requisitos pendientes antes de presentar la nueva versión.

Las tablas de pruebas son locales, con cuentas ficticias. Las pruebas de navegador simulan Supabase. La instalación real comprueba permisos, estado del moderador, RLS y filtros de las consultas; no crea denuncias ni sanciona usuarios reales.

Verificación: `npm run typecheck`, `npm test`, `npm run test:community-safety-db` y `tests/browser/communitySafety.cjs`.
