# Paso 7: copia cifrada y recuperación local

28 de octubre de 2026. Sin cambiar datos de producción, contraseña de la base ni plan gratuito de Supabase.

## Resultado comprobado

Copia `../private-backups/djplanner-20261028-185350.tar.aesgcm` (aprox. 22 MiB), cifrada con AES-256-GCM. Informe junto al archivo: `djplanner-20261028-185350.tar.verification.json`.

Restauración real con `pg_restore --exit-on-error --single-transaction` en PostgreSQL 17.6.1.063, dentro de un contenedor temporal sin red ni puertos publicados, tareas programadas desactivadas y datos temporales eliminados al terminar. Coinciden 92 tablas comprobadas, 1.988 filas, 77 políticas RLS y las sumas SHA-256 de 83 objetos de Storage. El volcado completo incluye esquemas administrados; la comparación de filas se limita a los esquemas enumerados en el manifiesto. No es una prueba de todos los servicios de Supabase ni de la app conectada al entorno recuperado.

La copia usa una instantánea consistente de PostgreSQL. Los objetos de Storage se descargan después y no forman una transacción conjunta con la base: se comprueban tamaño y hash, pero una modificación simultánea del mismo tamaño puede no detectarse. Para recuperación estricta de contenido cambiante hace falta coordinar una ventana sin escrituras o versionado.

## Uso

Desde la carpeta del proyecto, con Docker iniciado y Supabase CLI autenticado y enlazado:

```sh
python3 scripts/backup/snapshot.py
python3 scripts/backup/restore.py /ruta/absoluta/copia.tar.aesgcm
node --test tests/backupCrypto.test.cjs
```

El primer comando exporta en lectura, cifra y ejecuta la prueba. El segundo repite solo la restauración local. Los scripts no ofrecen restauración de producción. CLI fijada a 2.81.3; obtiene acceso temporal, sin necesitar la contraseña original. No ejecutar varias exportaciones simultáneas: pueden invalidarse las credenciales temporales.

La clave está en `../private-backups/recovery-key.local` (fuera de la carpeta de la app), permisos 0600, excluida de Git y EAS. Nunca enviarla al chat, telemetría o al mismo destino que la copia. Sin ella el archivo es irrecuperable. El cifrado se prueba con ida/vuelta, rechazo de clave equivocada, manipulación y sobrescritura.

## Pendiente antes de considerar resuelto el respaldo operativo

- Guardar el archivo cifrado fuera de este Mac y la clave en un gestor de contraseñas o soporte separado. Actualmente ambos dependen del mismo equipo.
- Acordar frecuencia y retención; no se ha programado una copia recurrente sin indicación del propietario.
- Documentar y recuperar por separado configuración del proyecto, proveedores de acceso, secretos de funciones y claves de integraciones. El archivo incluye fuentes locales de funciones y migraciones, que no prueban coincidencia con todo lo desplegado.
- Una recuperación a otro proyecto requiere roles y membresías adecuados, valores secretos, configuración de Auth/Storage, tareas, despliegue de funciones y validación de acceso y flujos de la app. Se conservan propietarios y ACL del volcado, pero el manifiesto de roles no es un respaldo completo de roles globales ni de contraseñas. Los privilegios elevados usados en esta prueba se limitan al contenedor aislado.

Referencias oficiales: https://supabase.com/docs/guides/platform/backups y https://supabase.com/docs/reference/api/v1-create-login-role . Las copias de base de datos no contienen por sí solas los bytes de Storage; aquí se incluyeron expresamente.
