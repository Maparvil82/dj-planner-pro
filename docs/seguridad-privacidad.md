# Seguridad y privacidad — 10 de octubre de 2026

## Estado

Correcciones locales preparadas. No se han publicado en App Store/Google Play ni cambiado el plan de Supabase. Este punto no está cerrado: faltan ajustes de autenticación, publicación y pruebas físicas, y dos dependencias sin parche publicado.

## Cambios realizados

- Tokens de Supabase en SecureStore nativo (Keychain en iOS y almacenamiento cifrado con Keystore en Android). Migración de la sesión antigua al primer acceso, eliminando la copia en AsyncStorage solo después de confirmar la escritura cifrada.
- Valores largos divididos en fragmentos pequeños; escritura con manifiesto al final y operaciones serializadas. Si falla el cifrado, no se guarda una nueva sesión en texto plano. Una escritura fallida conserva la sesión cifrada anterior. El soporte web permanece para pruebas locales, sin despliegue de una versión web.
- El estado persistido de la app conserva únicamente la preferencia de bienvenida. No duplica tokens, usuario ni perfil; ignora esos campos al recuperar el estado antiguo.
- Al cambiar de identidad se elimina el perfil anterior, se cancelan consultas y se limpia la caché. El cierre de sesión fallido muestra un error y no simula éxito mientras el SDK conserva credenciales.
- RevenueCat usa registros de error en distribución y no escribe identificadores de usuario en los mensajes de la app. Su clave pública iOS no es una credencial secreta.
- Actualizaciones compatibles y archivo de bloqueo actualizado. Supabase JS fijado a versión exacta. Correcciones específicas: decode-uri-component 0.5.0, postcss-selector-parser 7.1.6, UUID 11.1.1 limitado a xcode. Se conserva Expo 57; no se fuerza la regresión a Expo 44 sugerida por la auditoría automática.
- SecureStore añadido a la configuración nativa con exclusión del respaldo Android. Hace falta una nueva compilación nativa: una actualización de JavaScript no añade este módulo a una app ya publicada.

Referencia de almacenamiento: [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## Verificación

- 128 pruebas aprobadas, incluida migración de tokens largos Unicode, límite de tamaño de valores, escritura fallida, concurrencia, borrado y rechazo de datos incompletos.
- Prueba del estado real de autenticación: no recupera las credenciales duplicadas del estado antiguo, no persiste perfil ni tokens, limpia perfil al cambiar de cuenta y no oculta un fallo de cierre de sesión.
- Comprobación de tipos y revisión de espacios del diff aprobadas.
- Exportación JavaScript/Hermes para iOS y Android completada. No equivale a probar Keychain/Keystore en dispositivos físicos.
- Prueba funcional de Comunidad con servicios simulados aprobada tras actualizar las dependencias: filtros, seguimiento, navegación, guardar mixes y reproducción.
- Compatibilidad de la generación de identificadores del proyecto xcode verificada con UUID 11.1.1.
- Inventario de producción: ninguna tabla pública sin RLS, ninguna vista pública ni función SECURITY DEFINER pública ejecutable por authenticated. Facturas y documentos privados; avatars, sessions y venues todavía públicos por compatibilidad con la versión instalada.
- Búsqueda de patrones de claves privadas en app/src sin hallazgos. No sustituye un análisis histórico de todo el repositorio ni una prueba de penetración.

## Dependencias pendientes

La auditoría npm pasó de **40 avisos (1 crítico, 23 altos, 15 moderados y 1 bajo)** a **17 altos, sin críticos ni moderados**. Son cadenas derivadas de dos bibliotecas:

- **braces 3.0.3**: agotamiento de pila al procesar patrones profundamente anidados. La última versión publicada consultada sigue siendo 3.0.3. Lo usan herramientas de búsqueda de archivos, estilos y Metro. [Aviso](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- **node-forge 1.4.0**: validación incorrecta de ciertas firmas RSA. La última versión publicada consultada sigue siendo 1.4.0. Está en las herramientas de certificados de Expo. [Aviso](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

No se desactivan avisos ni se afirma que estas herramientas sean seguras. No se alimentan con patrones o certificados subidos por usuarios en los flujos de la app revisados. Hasta disponer de parches, usar dependencias y código de confianza al compilar y limitar el servidor de desarrollo a la red de pruebas. Antes de distribuir una nueva compilación, volver a consultar avisos y versiones.

## Ajustes de Supabase pendientes

El panel estaba abierto, pero la herramienta de navegador rechazó dos intentos porque no pudo verificar la política de acceso del navegador. No se usó otro método para eludir ese bloqueo. No se modificó la configuración de autenticación ni se verificaron sus valores actuales.

La captura facilitada por el propietario el 10 de octubre confirma: Email activado, cambio seguro de correo desactivado, cambio seguro de contraseña desactivado, exigencia de contraseña actual desactivada, contraseñas filtradas desactivadas y mínimo de 6 caracteres. La captura no confirma el estado de confirmación de correo al registrarse ni demuestra que los cambios posteriores estén guardados.

Acciones inmediatas recomendadas: mínimo de 8 caracteres y cambio seguro de correo activado, guardando los ajustes. La app también valida ahora el mínimo de 8 en el editor de cuenta. El mensaje de cambio de correo ya indica que se requiere confirmación.

No activar todavía cambio seguro de contraseña ni exigencia de contraseña actual: AccountEditor usa updateUser directamente y carece de flujo de reautenticación/nonce y del campo de contraseña actual. Activarlos antes de adaptar y probar ese flujo podría bloquear el cambio de contraseña. La recuperación usa una sesión reciente desde el enlace, pero sigue pendiente comprobarla con las opciones nuevas.

En Authentication → Sign In / Providers → Email, revisar:

1. Contraseña mínima de al menos 8 caracteres en el servidor. Registro y recuperación ya validan 8 en la interfaz; la validación de interfaz no sustituye la del servidor.
2. Confirmación de correo y cambio seguro de correo; revisar sin activar opciones que rompan recuperación o sesiones existentes.
3. Protección contra contraseñas filtradas: actualmente desactivada según el asesor. Requiere **Supabase Pro o superior**, que es independiente de la suscripción Pro de DJ Planner. No se contrata ni cambia un plan sin autorización.
4. Revisar límites de peticiones y direcciones de recuperación autorizadas, conservando los enlaces nativos y de pruebas necesarios.

[Configuración oficial de contraseñas](https://supabase.com/docs/guides/auth/password-security).

## Privacidad y publicación pendientes

- Publicar y comprobar primero la actualización nativa; después activar el cierre de los tres depósitos de imágenes, conforme a `almacenamiento.md`. Hasta ese cierre, una persona con el enlace público puede abrir la imagen.
- La política de privacidad enlazada desde la app está en Notion. No se pudo obtener su contenido público con la herramienta web; no se confirma su accesibilidad para usuarios ni que incluya comunidad, facturas, invitados, Supabase, RevenueCat y reproductores externos. Verificarla y actualizarla antes de presentar la versión.
- Probar en iPhone y Android físico: migración desde la versión publicada, sesión tras reinicio, dispositivo bloqueado, cierre de sesión, cambio de cuenta y restauración desde respaldo. No solicitar biometría: esta implementación usa protección del sistema sin una nueva pantalla de acceso.
- Mantener pendientes el correo operativo de moderación y el recurso externo para pedir eliminación de cuenta en Google Play, según los documentos de esos puntos.
