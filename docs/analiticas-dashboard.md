# Analíticas del dashboard

El plan Gratis muestra cachés acordados, próximos 30 días y el resumen de sesiones, horas, media por sesión y balance previsto. Desde «Evolución», incluido ese bloque y «Cobro de tus sesiones», el contenido requiere Pro (suscripción vigente o prueba activa). Las cuentas Gratis pueden seguir bajando por doce tarjetas de vista previa, una por cada bloque Pro. Los títulos y las insignias Pro son legibles, y los gráficos de ejemplo están difuminados. Hay un botón para abrir la paywall al principio y al final. Todo se desplaza dentro del scroll principal del dashboard, sin un scroll anidado. Los datos y controles de las estadísticas bloqueadas no se montan ni se exponen a lectores de pantalla. Si no se puede verificar el acceso, las estadísticas básicas siguen disponibles.

Las cinco analíticas avanzadas siguen al final del dashboard, después de «Próxima sesión», y utilizan las mismas tarjetas del resto: borde suave en modo claro y sin borde en modo oscuro. La tarjeta de cachés acordados utiliza un fondo sólido: el acento del tema en oscuro y violeta en claro. El difuminado de las vistas previas usa `expo-blur`, con destino de desenfoque también en Android. Requiere una nueva compilación nativa.

- **Margen por sesión y por hora:** caché acordado del propietario menos gastos externos vinculados a cada actuación. Usa actuaciones terminadas del periodo y moneda elegidos, excluye participaciones invitadas, cancelaciones, propuestas pendientes y acuerdos sin liquidar. Los gastos vinculados se atribuyen a su sesión aunque se registren en otro periodo. Los gastos incluidos en acuerdos no se restan otra vez. El margen no representa cobros recibidos ni incluye impuestos o costes no registrados.
- **Locales más rentables:** suma del margen por local y margen dividido entre horas de actuación. Agrupa por ID y, para registros antiguos sin ID, por nombre normalizado. Muestra el número de sesiones y permite revisar las actuaciones de cada local.
- **Evolución del caché:** mediana mensual del caché y de la tarifa por hora de actuaciones terminadas con caché positivo. Ventanas de 3, 6 y 12 meses hasta el final del periodo seleccionado. Para un año, el último mes es diciembre. Los meses sin datos muestran un guion. No compara ni mezcla monedas.
- **Pendientes por antigüedad:** saldo del caché tras descontar cobros registrados, agrupado por días completos desde el final de la actuación: 0–30, 31–60, 61–90 y más de 90. Se calcula a día de hoy en toda la agenda, independientemente del filtro de periodo. No equivale a retraso respecto a un vencimiento.
- **Concentración de cachés:** porcentaje del caché acordado de actuaciones terminadas que corresponde a cada local, al principal y a los tres principales. No agrupa promotores ni mide dinero cobrado.

Los gastos generales sin sesión se muestran aparte y no se distribuyen automáticamente. Las sesiones sin gastos vinculados se identifican para evitar interpretar un registro incompleto como rentabilidad definitiva. Las sesiones gratuitas pueden tener margen negativo, pero no afectan a la mediana del caché.

Las tarjetas permiten desplegar las sesiones de cada resultado y abrir su detalle. Las listas tienen paginación visual y las etiquetas están disponibles en los siete idiomas de la app. El detalle del margen muestra el margen registrado; el detalle de pendientes muestra el saldo por cobrar.

Validación: `node --test tests/dashboardAdvancedAnalytics.test.cjs tests/dashboardMetrics.test.cjs`, `npm run typecheck` y `tests/browser/dashboardAnalytics.cjs` con un navegador Playwright disponible.

## Exportación de estadísticas Pro

El icono PDF del encabezado solo aparece con acceso Pro. El informe A4 utiliza el período y la moneda seleccionados, las mismas funciones de cálculo del panel y un detalle de sesiones con su moneda original. Incluye resumen, evolución de actividad, márgenes, locales, concentración, mediana mensual, ciudades y antigüedad de pendientes (esta última usa toda la agenda, como el panel). No convierte divisas. La exportación espera a que sesiones, gastos y lugares estén cargados correctamente.

En iOS y Android se ofrece el correo de registro como destinatario editable. Se genera el PDF localmente con `expo-print` y se abre el compositor del sistema con destinatario, asunto, cuerpo y adjunto mediante `expo-mail-composer`. El usuario confirma el envío en su aplicación de correo. Si el dispositivo no tiene correo configurado, se abre la hoja de compartir PDF. En web se abre impresión/guardar PDF y se explica que el adjunto debe añadirse manualmente.

La nueva dependencia nativa `expo-mail-composer` requiere una nueva compilación de la app instalada; una actualización de JavaScript por sí sola no incorpora el módulo. Verificar el compositor y el adjunto en un iPhone físico con Mail configurado; los simuladores no permiten configurar una cuenta de Mail.
