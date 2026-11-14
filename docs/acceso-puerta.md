# Acceso a puerta sin registro

## Flujo

1. El propietario abre una sesión → **Acceso a puerta**. También hay acceso desde Live.
2. Asigna un nombre o puesto y crea una invitación por persona. Puede compartirla mediante el menú del móvil o copiar el enlace; la pantalla también muestra el QR y permite compartir su imagen. La imagen se genera en la caché local y se elimina al finalizar el envío; no se sube a Storage.
3. La persona necesita la versión actualizada de DJ Planner instalada, pero no una cuenta, un perfil de DJ ni Pro. Abre su invitación para entrar directamente en Control de acceso.
4. La primera instalación que la acepta queda vinculada. Compartir el mismo enlace con otra instalación después no le da acceso. Se permite reintentar desde la instalación original si se pierde la respuesta.
5. Puede contabilizar QR, sumar accesos manuales y admitir invitados o acompañantes de uno en uno. No puede editar invitados, crear entradas, acceder a cachés, acuerdos, contactos ni otras sesiones.
6. El propietario consulta los recuentos en Live y puede revocar cada acceso por separado.

No aparece un botón de puerta en la bienvenida ni en el inicio de sesión. Cuando la persona vuelve a abrir la app sin una cuenta y conserva un acceso activo, la app retoma su modo puerta. Cerrar la pantalla permite volver a la bienvenida; no obliga a registrarse. Si ya tiene una cuenta, su sesión permanece intacta.

## Varias personas y conexión

Hasta 20 invitaciones activas por sesión. Cada persona usa una diferente. Todas escriben en los registros que ya utilizan Entradas, Invitados y Live. Las lecturas se actualizan cada 10 segundos mientras la pantalla está visible y en primer plano.

- Un QR exacto solo suma una vez por evento, incluso si lo escanean dos personas. El QR se envía como SHA-256, sin conservar el contenido original.
- Cada acceso manual y admisión de invitado tiene un identificador de operación. Reintentar tras una respuesta perdida no duplica el acceso.
- Las operaciones se serializan bloqueando la sesión antes de comprobar y escribir. La capacidad de cada invitado se comprueba en el servidor: ninguna combinación de dispositivos puede admitir más personas que las autorizadas.
- Entradas e invitados son recuentos separados; una persona podría figurar en los dos. No son aforo actual ni ventas. El contador no valida entradas de proveedores externos.

Requiere conexión. No se encolan admisiones offline. La puerta puede registrar accesos desde dos horas antes del inicio del set hasta su final; antes puede consultar la lista. Se contemplan sesiones que terminan de madrugada y la zona horaria del evento. Para sesiones antiguas sin zona, se guarda la zona del dispositivo del organizador al crear la invitación; si después se configura la zona de la sesión, prevalece esta.

## Seguridad y privacidad

El nombre del puesto lo asigna el organizador; no es una identidad verificada. La invitación es una credencial privada: quien la reciba primero puede activarla, por eso debe compartirse únicamente con la persona prevista.

- Tokens de invitación y dispositivo de 256 bits, generados con aleatoriedad criptográfica.
- Solo se guardan hashes de las credenciales en `door_private.invites`. El enlace original queda en memoria durante la creación; no se puede recuperar desde la lista. Si se pierde antes de compartirlo, se revoca y se crea otro.
- La credencial del dispositivo se guarda con SecureStore en iOS/Android, separada de la sesión del DJ. La vinculación es a la instalación que conserva esa credencial, no una identificación física del teléfono.
- Cliente independiente sin Supabase Auth, con persistencia y renovación de sesión desactivadas. No crea usuarios anónimos de Auth ni sustituye el inicio de sesión existente.
- Las tablas privadas tienen RLS y ningún permiso de lectura o escritura para `anon` o `authenticated`. Solo las operaciones comprobadas de puerta son accesibles sin cuenta. La gestión de invitaciones exige propietario autenticado.
- Cada llamada comprueba la credencial, revocación, cancelación, final de sesión y estado de la cuenta organizadora. Se limita a 180 solicitudes por minuto por credencial válida.
- Revocar impide nuevas operaciones inmediatamente en el servidor. La pantalla lo refleja en su siguiente consulta, como máximo en el intervalo habitual de 10 segundos si tiene conexión.
- El resumen del organizador atribuye entradas e invitados a cada invitación sin mostrar sus secretos. Los datos se eliminan en cascada al eliminar la sesión y mediante el flujo de eliminación de cuenta existente.

## Desarrollo y publicación

En Expo Go, `expo-linking` genera el enlace de desarrollo (`exp://…/--/door?…`). Ambos móviles deben poder acceder al servidor de Expo. En la app publicada se utiliza el esquema ya configurado `djplannerpro://door?…`; no depende de Vercel ni de un servicio de correo.

Los enlaces personalizados pueden no ser clicables en todas las aplicaciones de mensajería. Se muestra también un QR para abrirlo con la cámara del sistema. No hay redirección automática a la tienda si la app no está instalada ni un dominio universal verificado: estas opciones requerirían configurar enlaces HTTPS y un dominio. Es necesario publicar una nueva versión para que la app de la tienda incluya estas pantallas.

## Verificación

- Prueba de PostgreSQL aislado: tres invitaciones, permisos, secretos incorrectos, vinculación, reintentos, QR repetidos, capacidad de invitados, aislamiento de eventos, revocación, cancelación, expiración, eliminación y horario nocturno.
- Prueba de interfaz conectada al mismo SQL aislado: el propietario crea tres invitaciones; tres contextos sin registro admiten personas y consultan los mismos recuentos; reintento tras respuesta perdida; escáner con código repetido; invitación reenviada rechazada; reanudación y revocación.
- Migración aplicada en Supabase; comprobados los permisos reales y rechazo de credenciales inválidas vía la API pública. Ningún registro real se ha usado para las pruebas.
- TypeScript y revisión de diferencias. Asesores de Supabase: las dos tablas privadas añaden avisos informativos de RLS sin políticas, intencionados por su falta de permisos directos. Continúa la advertencia previa de protección de contraseñas filtradas.

Pendiente: probar el enlace nativo y la cámara con dos o tres móviles físicos, tanto en Expo como en una compilación de distribución. Las pruebas de interfaz usan Chromium y no sustituyen esa comprobación.
