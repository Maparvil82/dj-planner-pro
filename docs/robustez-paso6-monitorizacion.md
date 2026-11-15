# Robustez: paso 6 — detección de fallos y rendimiento en iPhone

28 de octubre de 2026. Corresponde al punto 7 de la auditoría original.

## Estado

Integración de JavaScript activa y recepción comprobada desde el iPhone del propietario en Expo Go. Cuenta creada con autorización explícita del propietario: organización `dj-planner-pro`, región UE, proyecto `react-native`, cuenta `maparvil@gmail.com`. Sentry inició una prueba gratuita de 14 días; no se ha añadido tarjeta ni contratado un plan de pago. La distribución nativa completa sigue pendiente de la compilación y prueba del 1 de noviembre.

## Qué recoge

- SDK oficial @sentry/react-native 8.32.0. Excepciones JavaScript y promesas no gestionadas; cierres nativos solo en una nueva compilación que incluya el SDK.
- Fallos finales de consultas y mutaciones de React Query. Solo se clasifica la familia conocida de consulta; nunca se envían claves completas, usuarios, búsquedas o filtros. Las incidencias manejadas se limitan a una por operación y minuto para reducir ruido.
- Operaciones de Carteles con nombres estáticos: generar, editar, sincronizar compras y otras consultas. Los fallos esperados como saldo insuficiente no se notifican como incidentes. El error se vuelve a lanzar y conserva el comportamiento de la app; la instrumentación no repite llamadas ni compras.
- Medición desde el foco de Inicio, Historial y Estadísticas hasta que sus datos iniciales están listos y pasa un frame de renderizado. No mide interacción completa ni todos los fotogramas. Se descartan las mediciones interrumpidas al abandonar la pantalla o ir al segundo plano.
- Tiempos de las operaciones instrumentadas de Carteles. No sustituyen las mediciones de carga de todo el backend ni detectan por sí solos trabajos atascados mientras todos los dispositivos están cerrados.
- Muestreo del 10 % de las trazas de producción; errores no muestreados por ese porcentaje. El servidor puede aplicar su cuota gratuita.

## Privacidad y configuración

La salida se reconstruye con una lista de campos permitidos antes de enviar. Se eliminan usuario, correo, IP del evento, peticiones, URL, cabeceras, tokens, parámetros, mensajes originales de error, extras, rutas absolutas, variables locales y contexto de navegación. Se conservan tipo de excepción, posiciones y nombres estáticos de pila, versión de app/SDK, modelo y sistema operativo. Los mensajes originales se reemplazan por un texto genérico; esto reduce el detalle diagnóstico a cambio de evitar datos introducidos por usuarios.

No se habilitan grabaciones, capturas, jerarquía de vistas, perfiles de CPU, logs ni breadcrumbs. Tampoco se propagan cabeceras de trazado a servicios externos. Las trazas solo admiten nombres de operación de una lista fija y no incluyen spans HTTP automáticos. El servicio recibe una conexión de red; estos filtros no significan anonimato de la conexión ni sustituyen la política de privacidad.

Sin `EXPO_PUBLIC_SENTRY_DSN` no se inicializa ni envía nada. La dirección pública real está configurada en el entorno local y en los perfiles de compilación de EAS. En desarrollo hace falta además `EXPO_PUBLIC_SENTRY_DEV_ENABLED=true`. Expo Go usa exclusivamente JavaScript, sin handlers nativos. No se añade un botón de fallo a la app de producción.

En Sentry se comprobaron guardados: privacidad mejorada activada, bloqueo del almacenamiento de IP en eventos nuevos, limpieza de datos de servidor activada y posibilidad de compartir informes con anónimos desactivada. La descarga de contexto JavaScript conserva su ajuste previo: el intento de desactivarla se canceló, sin alterar ese ajuste.

Variables de configuración:

- `EXPO_PUBLIC_SENTRY_DSN`: dirección pública del proyecto de recepción. Puede estar en la app; no da acceso a leer informes.
- `SENTRY_ORG` y `SENTRY_PROJECT`: organización y proyecto para compilar.
- `SENTRY_AUTH_TOKEN`: credencial privada de carga de mapas y símbolos; nunca en expo.extra, variables EXPO_PUBLIC, código ni documentación. Configurar en el entorno privado de compilación.

El plugin nativo desactiva la carga automática si falta la credencial privada, manteniendo la compilación disponible. Hasta configurar y comprobar esa carga, no dar por verificada la simbolicación de una versión distribuida.

## Verificación y siguientes pasos

316 pruebas generales correctas y TypeScript correcto. Cinco casos nuevos comprueban filtrado de datos y pila, rechazo de trazas con nombres libres, descarte de cargas canceladas, desactivación sin configuración, límites de repetición y separación entre Expo Go y compilación nativa. Configuración de Expo correcta con el plugin y Metro de Sentry combinado con NativeWind.

Recepción real verificada:

- Dos peticiones sintéticas (error y transacción), ambas HTTP 200, entorno `verification`. El dato sintético que debía eliminarse no sale del proceso. Eventos `26d1565e9b3c49c3bff9b6cd6b8ebca8` y `7cff3fe614f64d9383831d4b4867745d` recibidos.
- El panel confirmó «Error Received» y mostró el tipo MonitoringCheck, pila y mensaje privado sustituido, con cero usuarios identificados. También recibió `MonitoringSDKCheck` desde el SDK real de Expo Go, incidencia `REACT-NATIVE-2` (156906216), un evento y cero usuarios identificados.
- El propietario entró en Estadísticas desde su iPhone. Sentry muestra `screen.dashboard` en torno a 530 ms y `screen.home` en torno a 3,80 s, además de la traza `monitoring.check` enviada por el SDK real de la app. Son muestras de desarrollo, no garantías de tiempo de producción. No se confirma aún una muestra de Historial.
- El chequeo automático del SDK solo puede activarse en desarrollo con `EXPO_PUBLIC_SENTRY_VERIFY=true`. Se retiró esa variable tras recibir la comprobación, para que los siguientes arranques no generen errores de prueba.
- El alta mantiene alertas por correo sin conectar Slack, repositorios ni otros servicios. La pantalla de facturación confirma Trial plan, 14 días, sin datos de facturación ni método de pago; todos los gastos adicionales figuran a cero. El asistente no ha verificado la entrega de un correo en la bandeja del destinatario.

Pendientes para cerrar la validación nativa:

1. Configurar credenciales de mapas/símbolos en el entorno privado antes de la compilación del 1 de noviembre.
2. En TestFlight, verificar un incidente controlado y una traza, versión de la app y pila simbolicada. No provocar un cierre en cuentas de usuarios reales.
3. Revisar la declaración de diagnóstico en App Store y política de privacidad antes de publicar.

La integración por sí sola no detecta automáticamente todos los problemas. Las alertas de trabajos de servidor atascados y conciliaciones siguen dependiendo del vigilante de Carteles y sus registros. No sustituye una prueba de capacidad ni una restauración de respaldo.

Referencias oficiales: https://docs.expo.dev/guides/using-sentry/ y https://docs.sentry.io/platforms/react-native/guides/expo/ y https://docs.sentry.io/platforms/react-native/data-management/sensitive-data/

Copias previas y pruebas en `../outputs/robustez-paso6-monitorizacion/`. No restaurar todo Git: hay cambios anteriores ajenos.
