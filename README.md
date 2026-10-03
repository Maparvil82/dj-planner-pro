# DJ Planner Pro

Aplicación Expo / React Native para organizar sesiones, locales, ingresos y documentos de DJs.

## Desarrollo

```sh
npm ci
npm start
```

La conexión usa `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Estas variables son públicas en la aplicación; nunca deben contener una clave `service_role`.

El proyecto usa Expo SDK 57. Para probar en un móvil con Expo Go compatible, ejecutar `npx expo start --go --lan` y escanear el QR desde la misma Wi-Fi. Las compras reales requieren una compilación de desarrollo o de tienda; Expo Go utiliza el modo de previsualización de RevenueCat. Las compilaciones de desarrollo anteriores a esta actualización deben regenerarse.

```sh
npm run typecheck
npm test
npm run web
```

## Gestión de sesiones y cobros

- El soporte de anticipos y cobros está preparado en la base de datos. Sus nuevas secciones están ocultas en Inicio y en el detalle de sesión por decisión de producto. Una sesión pasada no implica que esté pagada.
- Los totales de Inicio se muestran por moneda, sin conversión automática.
- Al crear o editar sesiones se comprueban los horarios cruzados, incluidas madrugadas, sesiones del día anterior y repeticiones. El DJ puede continuar después de revisar el aviso. Es una comprobación previa al guardado, no un bloqueo de concurrencia en la base de datos.
- Las repeticiones mensuales conservan el día original o el último día disponible del mes. Las series se guardan en una única transacción, hasta 500 sesiones por operación.
- Cada sesión puede exportarse como `.ics`, con un aviso dos horas antes. La aplicación de calendario debe importar el archivo y respetar sus avisos. Se conserva el horario local introducido; todavía no hay zona horaria específica por local ni sincronización automática de cambios posteriores.

## Dashboard y documentos

- Dashboard permite navegar por mes o año y elegir moneda para los importes. La actividad incluye todas las monedas, sin sumarlas financieramente.
- Los ingresos corresponden a honorarios acordados de sesiones confirmadas, no a cobros. Los pendientes se muestran aparte y las cancelaciones se excluyen de ingresos y horas.
- Incluye horas programadas y realizadas, media de sesiones remuneradas, media por hora, estado de agenda, locales frecuentes y acceso a pendientes y próxima sesión.
- El balance es una previsión: honorarios confirmados menos gastos del periodo. Los gastos históricos no tienen moneda y se tratan como EUR, igual que en la interfaz anterior; en otras monedas no se calcula balance.
- Los próximos 30 días cuentan sesiones que empiezan desde ahora, separando confirmadas y pendientes. Los patrones del periodo incluyen duración media, días activos, cancelaciones, remuneradas/gratuitas y mejor tarifa media por hora.
- Los locales habituales se calculan usando una actuación confirmada que ya hubiera terminado antes de la sesión analizada. Las tarifas sin importe se distinguen de las sesiones gratuitas.
- Ciudades agrupa la ciudad actual de cada local asociado (ID o nombre único), normalizando espacios, mayúsculas y tildes. Los nombres ambiguos o las ciudades ausentes no se adivinan; se indica qué sesiones requieren completar el local. Cada ciudad permite desplegar sus sesiones.
- La comparación utiliza el periodo anterior completo. El gráfico muestra seis meses hasta el mes elegido, o los doce meses del año seleccionado.
- Documentos permanece conservado bajo `FEATURES.documents = false`: se ocultan su pestaña y los bloques de sesiones/locales, sus rutas redirigen a Inicio y no se consultan carpetas. No se borran datos ni archivos.

## Supabase

Proyecto: `voyurnwckmateohuzbab`.

Las migraciones de `supabase/migrations/` están aplicadas en ese proyecto y sus versiones coinciden con el historial remoto. Son cambios incrementales sobre la base de datos existente. Los SQL sueltos de la raíz son referencias históricas; no deben volver a ejecutarse indiscriminadamente.

El historial registra estas mejoras sobre el proyecto existente; todavía no contiene una migración inicial para un proyecto vacío. Antes de crear otro entorno debe prepararse y validarse esa migración inicial con acceso al esquema de origen.

Los carteles y fotos de locales conservan su lectura pública; las escrituras se restringen al directorio del propietario. Las funciones internas de triggers no tienen permisos de ejecución para clientes. La eliminación de cuenta conserva permisos para usuarios autenticados y verifica `auth.uid()`.

`tests/database.sql` comprueba series, cobros, aislamiento entre propietarios y permisos de imágenes dentro de una transacción que termina en `ROLLBACK`. Debe ejecutarse con el propietario de la base de datos.

## Verificación y publicación

Las pruebas cubren horarios nocturnos, límites de repetición, fechas de fin de mes, cobros parciales, monedas y formato del calendario. La compilación de Expo para iOS y Android comprueba los bundles; no sustituye la prueba en un dispositivo real.

Antes de publicar la siguiente versión en las tiendas, comprobar en iPhone y Android la importación del `.ics`, el teclado decimal, la restauración de sesión y el guardado de cobros. La política de privacidad de la ficha de App Store también necesita una URL real.

## Próximas mejoras de producto

1. Preparación del evento: contacto del promotor, dirección, notas, rider y lista de equipo.
2. Presupuestos y resumen de la sesión en PDF, con anticipos y saldo restante.
3. Respaldo/exportación de datos y un entorno de pruebas reproducible con migración inicial.
4. Finanzas del dashboard por moneda y gastos vinculados a cada sesión.
5. Revisión de documentos privados, rendimiento de políticas e índices y protección frente a contraseñas filtradas en Supabase Auth.

## Estados y formularios de sesiones

- La reserva se marca como pendiente de confirmar, confirmada o cancelada. Las sesiones nuevas empiezan pendientes y el DJ puede confirmarlas al crear; las existentes conservan su estado.
- «En curso» y «Finalizada» se calculan a partir del horario local para sesiones confirmadas. No certifican que la actuación se haya realizado ni que se haya cobrado. Inicio y Dashboard excluyen cancelaciones y separan honorarios confirmados de propuestas.
- Crear y editar comparten validación de fechas, horarios, importes positivos con hasta dos decimales y participantes de sesiones colectivas. La duración y el caché total se muestran antes de guardar; las madrugadas terminan al día siguiente.
- Editar permite guardar solo esta sesión o esta y las siguientes de su serie real. Cambiar la fecha solo afecta a la sesión elegida. El título no determina qué sesiones se modifican. Solo se guardan los campos cambiados y cada actualización se filtra por propietario.
- Editar no reinicia el formulario cuando llegan datos actualizados. Abrir el local conserva su vínculo; modificar su texto lo desvincula. Quitar un cartel no borra anticipadamente el archivo compartido por otras sesiones. Los archivos sin referencias quedan pendientes de una futura limpieza de almacenamiento.

## Detalle de lugares

- El alta y la edición de lugares siguen siendo manuales, sin integración con Google Places. El detalle utiliza las tarjetas y cabecera compartidas con los formularios de sesiones: datos, ubicación, cabina/aforo, valoraciones, notas y fotos.
- Los cambios válidos se guardan automáticamente después de un segundo. Solo se envían campos modificados; las respuestas y recargas de datos no sustituyen los cambios posteriores del usuario. Si falla el guardado se ofrece reintentar. El cierre desde la cabecera espera a guardar los cambios válidos.
- Aforo vacío y valoraciones desmarcadas se guardan como `null`. Aforo y cantidades de equipo se validan como enteros; las cantidades deben ser mayores que cero. Quitar fotos elimina su referencia al guardar, sin borrar archivos anticipadamente. Los archivos sin referencias quedan pendientes de limpieza futura.

## Comunidad

- Nueva pestaña con sesiones compartidas, feed de DJs seguidos y búsqueda de perfiles por nombre artístico. El perfil único de «Tú» incluye nombre artístico, ciudad, estilos, biografía y foto. Los listados se cargan en páginas de 20 elementos y se pueden actualizar deslizando hacia abajo.
- Participación voluntaria: no se crean perfiles sociales para las cuentas existentes. El perfil empieza oculto y debe activarse expresamente. Se puede guardar oculto; para seguir a un DJ o publicar se necesita activar la visibilidad en «Tú». Dejar de seguir y retirar publicaciones siguen disponibles.
- Cada sesión confirmada se publica desde su detalle, después de revisar los datos compartidos. Solo aparecen título, lugar, ciudad, fecha, horario, cartel e identidad del perfil DJ. No se exponen el perfil privado, correo, importes, pagos, contactos, notas, invitados ni recurrencias.
- La agenda privada mantiene sus permisos actuales. `community_session_shares` registra el consentimiento del propietario; el feed obtiene únicamente una proyección fija de los campos autorizados, con comprobación de sesión autenticada en una función interna de esquema no expuesto. Sus funciones públicas usan `SECURITY INVOKER`.
- Los cambios en las sesiones publicadas se reflejan al actualizar el feed. Reservas pendientes o canceladas quedan ocultas. Al ocultar el perfil desaparecen todas sus sesiones compartidas; al reactivarlo pueden volver a aparecer. Retirar una publicación elimina su consentimiento y no borra la sesión privada. Eliminar una sesión o cuenta borra sus referencias sociales por cascada.
- `tests/community-database.sql` verifica con usuarios temporales la privacidad, permisos, seguimiento, publicación y retirada, perfiles ocultos, cambios/cancelación/borrado y denegación a usuarios no autenticados. Termina en `ROLLBACK` y no deja perfiles ni publicaciones de ejemplo en el proyecto.

## Perfil único

- «Tú» reúne foto, nombre artístico, ciudad, estilos, biografía, visibilidad en Comunidad y los ajustes privados de la cuenta. Los accesos desde Comunidad, las sesiones y los antiguos enlaces de edición llevan a esta misma pantalla. El perfil propio en `/community/:id` redirige a «Tú»; `?preview=1` permite comprobar la vista para otros DJs.
- Nombre y foto utilizan la identidad de la cuenta. La migración conserva los datos de Comunidad y reconcilia la identidad con el perfil general existente. Las actualizaciones de foto/nombre en la cuenta sincronizan su proyección social mediante un trigger interno no ejecutable por clientes.
- `save_unified_profile` guarda la identidad y los datos de DJ en una transacción; una validación fallida no deja cambios parciales. Las modificaciones de correo/contraseña utilizan después el flujo de Auth y muestran los errores sin descartar el formulario. Estos cambios de Auth no forman parte de la transacción de perfil.
- La vista para otros DJs muestra únicamente los datos autorizados y las sesiones compartidas. El correo, contraseña y ajustes solo aparecen en «Tú». No cambia la visibilidad de sesiones privadas ni se pierden seguimientos o publicaciones.
- `tests/unified-profile-database.sql` comprueba identidad única, sincronización de foto, guardado atómico, participación voluntaria, aislamiento y conservación de seguimientos/publicaciones. Todas sus escrituras terminan en `ROLLBACK`.


## Plan Gratis y PRO

- Gratis incluye todas las funciones actuales y hasta 30 sesiones propias guardadas en total. Cuentan historial, cancelaciones y cada fecha de una serie. Las sesiones recibidas como invitado no cuentan. Eliminar una sesión libera espacio.
- PRO permite sesiones ilimitadas. Las funciones avanzadas futuras se definirán antes de anunciarlas; la pantalla de pago solo ofrece funciones disponibles.
- El registro entra directamente en la app. Al guardar una sesión o serie que exceda el límite, se abre `/paywall` sobre el formulario; cerrar conserva el borrador. Tras comprar/restaurar y verificar PRO, el usuario vuelve y pulsa Guardar para finalizar. No se guardan series a medias.
- El perfil muestra «Mi plan», uso del límite y acceso a PRO o a la gestión de la suscripción de Apple. Una suscripción vencida conserva todas las sesiones existentes y permite consultarlas, editarlas y eliminarlas.
- Los precios vienen de RevenueCat; no se inventan precios si la tienda no carga. Apple confirma la elegibilidad de las pruebas gratuitas antes de comprar. La restauración solo se considera válida si existe el acceso PRO activo.
- `subscription-access` valida al usuario con Supabase Auth y consulta RevenueCat v1 usando su ID de cuenta. Nunca acepta una bandera PRO del cliente. La clave pública de iOS permite leer Customer Info; opcionalmente puede usarse `REVENUECAT_API_KEY` como secreto del servidor. La función exige JWT y no devuelve detalles de la compra.
- El acceso verificado se guarda en `billing_private.subscription_access`, inaccesible para los clientes, durante un máximo de cinco minutos. Cada creación que exceda la cuota gratuita vuelve a consultar RevenueCat. Si no se puede verificar, se pide reintentar y no se guarda ni se redirige como si el usuario hubiese perdido PRO.
- El límite se comprueba en la base de datos, tanto para series como para inserciones directas, con un bloqueo por propietario que serializa creaciones simultáneas. Las sesiones existentes no se borran al superar el límite.
- La compra real requiere la versión nativa de iOS/TestFlight; Expo Go y web sirven para probar la interfaz. Android aún no tiene productos de compra configurados.
- `tests/sessionLimit.test.cjs` verifica el servicio y errores de cuota/conexión. `tests/session-limit-database.sql` prueba el límite, series, permisos, PRO y vencimiento con fixtures dentro de una transacción que termina en `ROLLBACK`.

## Bienvenida, acceso y registro

- Una sola pantalla de bienvenida sustituye los tres pasos del onboarding. «Siguiente» lleva al inicio de sesión, que incluye el enlace para crear una cuenta gratis. El antiguo enlace `/onboarding` redirige a `/welcome`.
- Una sesión ya iniciada entra directamente en Inicio. El indicador histórico `hasSeenOnboarding` ya no condiciona el acceso de usuarios autenticados.
- Bienvenida, acceso, registro, errores y confirmación están traducidos a los siete idiomas disponibles. Se usa el idioma del dispositivo con inglés como respaldo.
- Los formularios comparten diseño, etiquetas accesibles, navegación por teclado y opción de mostrar/ocultar contraseña. Se adaptan a móvil, escritorio y tema claro/oscuro. El login admite contraseñas antiguas sin imponer la validación de creación de cuentas.
- Si el registro exige confirmar el correo, muestra instrucciones y no intenta escribir el perfil sin una sesión autenticada. Si devuelve sesión, entra en Inicio con el plan gratuito.
- La fotografía nueva de cabina y su prompt están documentados en `assets/auth/README.md`.

### Recuperación de contraseña

- Acceso → «¿Has olvidado tu contraseña?» → correo → enlace → nueva contraseña y confirmación → volver a iniciar sesión.
- El enlace se valida con Supabase antes de permitir guardar una nueva contraseña. Las credenciales se retiran de la URL del navegador y los enlaces caducados permiten pedir otro.
- El retorno se genera con `Linking.createURL('reset-password')`. La app instalada utiliza `djplannerpro://reset-password`; en Expo Go se utiliza la dirección concreta del servidor de desarrollo. Cuando cambie esa dirección, debe añadirse el nuevo retorno exacto en Supabase Auth → URL Configuration. No se permiten comodines de destinos externos.
- Revisado el 2 de octubre de 2026: este proyecto todavía usa el envío básico de Supabase. Debe conectarse un proveedor SMTP para enviar recuperación y confirmación de registro a todos los usuarios en producción. La plantilla actual utiliza `{{ .ConfirmationURL }}`.
- Verificación: escenarios de recuperación y acceso en navegador con respuestas simuladas (sin crear cuentas ni enviar correos reales), pantallas de 320 y 390 px, modo claro/oscuro y los siete idiomas de la app.

## Contrataciones Pro (preparado, pendiente de activar)

- Acceso desde **Tú → Contrataciones**. El DJ gestiona las consultas en la app; el promotor utiliza una página web sin instalar ni registrarse.
- Perfil público, consulta con correo verificado, conversación privada, propuestas con versiones, bloqueos temporales y creación de sesión al aceptar la última propuesta.
- Dominio, correo real, despliegue y cambios de Supabase siguen pendientes. La vista previa funciona sin publicarlos; la pantalla de pago anuncia la función solo cuando el servidor confirma que está disponible.
- Recorrido, privacidad, activación y pruebas: [docs/contrataciones.md](docs/contrataciones.md).
- Prueba de base de datos aislada: `npm run test:bookings-db`. Nunca modifica el proyecto Supabase.
