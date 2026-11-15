# Menú de cuenta y presentación de Pro

El avatar de la cabecera abre un panel lateral desde la izquierda hacia la derecha en Inicio, Dashboard, Lugares, Comunidad e Historial. Conserva la foto o la inicial y el indicativo de notificaciones sin leer. El panel se puede cerrar con el botón, tocando el fondo, con Atrás en Android o Escape en web.

La navegación inferior contiene Inicio, Dashboard, el botón morado de añadir sesión en el centro, Lugares y Comunidad. El botón conserva su estilo y abre el formulario existente; se oculta y reaparece con la barra al hacer scroll. Las cabeceras dejan de duplicar el botón de añadir sesión. El perfil deja de ser una pestaña: desde el menú se abre como una pantalla independiente con regreso a la pantalla anterior.

## Recorrido

- **Ver mi perfil de DJ**: identidad, imagen, estilos, biografía, enlaces y visibilidad. Un único acceso a editar; guardar y cancelar se aplican al perfil de DJ.
- **Notificaciones**: listado existente con contador de no leídas en el menú.
- **Contrataciones**: configuración y conversaciones existentes.
- **Cuenta y ajustes**: correo/contraseña, **Mi plan** con el uso y la gestión de la suscripción, apariencia, soporte, información legal y eliminación de cuenta. El editor de cuenta conserva sus acciones independientes.

«Cerrar sesión» se sitúa al pie del menú lateral, separado de las opciones de navegación y siempre visible aunque se desplace la lista. Pide confirmación y utiliza el cierre existente; cancelar o un error conserva la sesión. «Eliminar cuenta» permanece en Cuenta y ajustes y conserva su recorrido de eliminación.

El lateral ya no incluye Historial de sesiones, Mi plan ni Seguridad de Comunidad. La seguridad sigue accesible desde la configuración de Comunidad; la moderación conserva su acceso para quienes tienen permiso.

Las cuentas cuyo acceso gratuito está verificado por el servidor ven una tarjeta **Descubrir Pro**. Abre `/pro`, una presentación de las ventajas y del plan gratuito. **Ver planes y suscribirme** abre el paywall existente, con precios de RevenueCat, restauración y verificación. Las cuentas Pro no ven esa promoción. La presentación permite acceder a su plan actual.

La página informa que Contrataciones públicas y avisos de correo están pendientes. No promete un servicio publicado ni una prueba gratuita no verificada. La compra sigue siendo posible únicamente en la app nativa compatible; Expo Go permite revisar la interfaz.

No cambia el nombre de la app, las compras, los identificadores de RevenueCat, los límites ni los permisos de datos.

## Verificación

- TypeScript y 59 pruebas existentes: pasan.
- Exportación iOS y Android: pasa.
- `tests/browser/accountMenu.cjs`: cuenta ficticia, todas las peticiones de Supabase simuladas, sin compras ni escrituras reales. Verifica perfil/ajustes/plan, regreso, tarjeta Gratis/Pro, paywall, Escape y siete idiomas a 320 px.
- Para ejecutar la prueba con un Expo local en 8082, proporciona `PLAYWRIGHT_MODULE` y, si procede, `PLAYWRIGHT_CHROMIUM`.
- Capturas en `docs/previews/account-menu.png`, `account-settings.png` y `pro-overview.png`. Datos ficticios.

La comprobación en navegador y la compilación no sustituyen la prueba del panel en un dispositivo físico con Expo Go.

Las cuentas Pro muestran un distintivo morado junto al nombre en el panel y una etiqueta pequeña en el avatar de la cabecera. Se basa en el acceso vigente verificado por el servidor; no sustituye ni tapa el punto de notificaciones.

## Arranque y apariencias

Las apariencias Claro, Lima, Miel, Ocean y Bubble se conservan al reiniciar. El arranque mantiene la pantalla de carga hasta terminar tanto la recuperación de la cuenta como la carga del tema guardado y su aplicación en los estilos nativos. La selección se aplica antes del pintado para evitar mezclar fondos claros con texto oscuro o viceversa.

La tarjeta sin sesiones, el filtro «Todos / Este mes» y el día actual de la agenda usan directamente la paleta del tema. Así mantienen colores coherentes aunque las clases de estilo tarden en sincronizarse. «Cachés acordados» usa color sólido también en la pantalla de Sesiones.

Validado con TypeScript, auditoría de siete idiomas, 176 pruebas y `tests/browser/accountMenu.cjs`: recarga con las cinco apariencias guardadas, comprobación de los primeros fotogramas visibles y simulación de clases oscuras retrasadas. La observación final del destello en Expo Go corresponde al dispositivo físico.
