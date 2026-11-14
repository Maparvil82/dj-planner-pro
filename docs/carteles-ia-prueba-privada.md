# Generación de carteles: cambio preparado para revisión

Cuenta única: la misma cuenta propietaria de la prueba privada existente. App oficial, ruta `/carteles`. No se publica una build ni se habilita para otros usuarios.

## Recorrido implementado localmente

Elegir sesión propia futura → Retrato Editorial → hasta dos fotos opcionales → generar → imagen privada → pedir cambios → nueva versión → descargar/compartir mediante el menú nativo del dispositivo. Los resultados se recuperan del servidor en Mis carteles; los ejemplos locales antiguos siguen siendo temporales y están identificados como composiciones sin IA.

Las fotos se convierten a JPEG de hasta 1024 píxeles por lado y no se guardan en nuestra base de datos. Solo se envían al proveedor al pulsar generar. Cada foto tiene asociado el nombre de su DJ. Si no hay fotos, no se inventan rostros atribuidos a los artistas. En una edición se utiliza la imagen anterior para conservar sus identidades.

## Autorización económica recibida

El usuario aceptó un máximo de 5 € de pruebas. Reserva conservadora: 2,50 € por petición, máximo dos intentos, modelo fijado en servidor `gpt-image-2-2026-04-21`, calidad alta, una imagen por petición y resoluciones limitadas (Cartel 1024×1536, Historia 864×1536, Cuadrado 1024×1024). La reserva es una protección de aplicación; no es la factura del proveedor ni una conversión exacta de USD a EUR. No se libera automáticamente en errores o resultados inciertos. El proveedor no admite en este endpoint un límite monetario en euros por petición; la protección combina parámetros fijos, límite de intentos y margen conservador. Medir el consumo real antes de ampliar el acceso o poner precios comerciales.

Presupuesto reservado en transacción SQL con bloqueo de fila, peticiones con UUID y hash para idempotencia, una operación activa, y bloqueo de operaciones nuevas si el resultado es incierto. No hay reintentos automáticos al proveedor. Se almacena el `usage` devuelto y el ID de petición, también si falla después la subida. No se registra la clave, las fotos ni el cuerpo completo de errores del proveedor.

## Cambios de servidor pendientes de autorización explícita

- Tablas `poster_ai_budget` y `poster_ai_jobs`, ambas con RLS y sin permisos de cliente. Solo la cuenta autorizada aparece en el presupuesto.
- RPC `reserve_poster_ai_job`, invoker, ejecutable únicamente por `service_role`. Comprueba cuenta activa, sesión propia futura, versión anterior, concurrencia y presupuesto.
- Bucket privado `poster-ai-private`. Descarga mediante URLs firmadas tras comprobar el usuario.
- Edge Function `poster-ai`, que valida el token con Auth.getUser y la identidad/confirmación de la cuenta antes de cualquier operación. Verificación JWT en el gateway debe quedar activada.
- Incluir `poster-ai-private` en las dos funciones existentes de borrado de cuenta, para que esos archivos también se eliminen. Un trigger privado de Storage impide guardar archivos si la eliminación ya está en curso, usando el mismo bloqueo de la cuenta. Este es el único ajuste transversal al flujo existente.
- La migración inicia el presupuesto desactivado. La activación debe hacerse después de desplegar/verificar el servicio y configurar el secreto.

## Estado de despliegue

La revisión automática rechazó aplicar la migración porque el alcance de producción, incluido el ajuste transversal del borrado, no estaba autorizado suficientemente. No se ha aplicado ni se ha intentado sortear la revisión con otro mecanismo. Tampoco se ha desplegado la función. El código queda preparado localmente, con la generación bloqueada.

Falta crear la clave y configurarla como secreto de Supabase `POSTER_OPENAI_API_KEY`. Nunca en `EXPO_PUBLIC_*`, en Git ni en el chat. El usuario indicó que necesita crearla.

## Verificación realizada

Sintaxis JSX y TypeScript de la app; `deno check` del servidor; pruebas con Postgres embebido de reserva, repetición de UUID/hash, llamadas simultáneas, cuenta ajena, bloqueo por resultado incierto, conservación del presupuesto tras fallos, límite de dos intentos y denegación de permisos a clientes. Pruebas existentes de encuadre incluidas. Sin llamadas de IA de pago.

Pendiente: prueba de servidor desplegado sin autenticación y con otra cuenta; prueba real desde el teléfono con foto, generación y edición; comprobación de identidad, texto, formatos y consumo. La compilación no valida el resultado visual de la API.

Fuentes consultadas el 19 octubre 2026:
- https://developers.openai.com/api/reference/resources/images/methods/edit
- https://developers.openai.com/api/docs/guides/image-generation
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/functions/background-tasks
- https://supabase.com/docs/guides/functions/limits

## Despliegue autorizado · actualización

Tras la autorización expresa del usuario, la migración se aplicó correctamente y la función `poster-ai` versión 1 está ACTIVE con `verify_jwt=true`. El endpoint sin Authorization devuelve HTTP 401. Las dos funciones de borrado de cuentas incluyen el bucket nuevo. El asesor no detectó nuevos avisos de nivel WARN para carteles; la ausencia de políticas RLS de cliente es intencionada (acceso solo desde el servicio).

La activación `enabled=true` fue rechazada por la revisión automática: requiere autorización expresa de la activación de llamadas de pago, aparte del despliegue y del techo económico. No se ha sorteado ese bloqueo. La prueba sigue desactivada y no se ha realizado ninguna llamada de IA. El usuario comunica que ya guardó `POSTER_OPENAI_API_KEY`; aún no se ha verificado su presencia mediante una sesión autenticada ni su validez en el proveedor.

## Activación autorizada

El usuario autorizó expresamente activar las llamadas de pago. Activado `enabled=true` solo para la cuenta propietaria, con `limit_eur_cents=500`, `reserved_eur_cents=0` y `attempts=0`, comprobado en la respuesta del servidor. No se ha generado ninguna imagen ni validado todavía la clave contra OpenAI. Las llamadas se iniciarán al pulsar generar desde la app.

## Conciliación del intento rechazado por cuota

Por autorización expresa del usuario se liberó únicamente la reserva del intento `20a46963-4cc7-4080-a521-e320b95a8a4d`, fallido por cuota, sin uso devuelto y sin archivo de salida. Actualización atómica condicionada a presupuesto previo de 500 céntimos/dos intentos; se marcó `poster_provider_quota_reconciled` para impedir una segunda liberación. Se conserva el trabajo y el ID de proveedor para auditoría.

Resultado comprobado: prueba activada, límite de 500 céntimos sin cambios, 250 céntimos aún reservados y un intento contabilizado. Queda una operación disponible para editar el cartel. El trabajo completado conserva íntegro su consumo (1784 tokens de entrada, 5488 de salida) y archivo. El usuario aportó captura de gasto de 0,18 USD y saldo 4,82 USD; la reserva de seguridad no se presenta como factura real. No se realizó otra llamada a OpenAI.

## Segundo estilo: Headliner

Aprobadas por el usuario las muestras de uno y dos DJs. Añadida miniatura real al selector lateral y Explorar de la app oficial. Headliner comparte las fotos, versiones y protección económica de la prueba, pero usa su propia imagen de referencia y dirección visual: fotografía a página completa, tipografía grande amarillo ácido y composición de festival, sin paneles. El servidor acepta únicamente los dos estilos aprobados. Pruebas de selección de estilo, validación, presupuesto y permisos: 11 correctas; Deno check correcto. Servicio desplegado con ambas referencias. Ninguna nueva llamada al proveedor ni modificación de presupuesto. Las dos operaciones disponibles están reservadas tras las pruebas anteriores; no se habilitaron intentos adicionales.

## Prueba de Headliner con foto real

El usuario pidió probar Headliner con su foto desde la app. Revisados los dos trabajos completos: 312 tokens de texto +1472 de imagen +5488 de salida, y 325 de texto +2240 de imagen +5488 de salida. Se mantiene una provisión conjunta conservadora de 250 céntimos para ambos trabajos previos (125 por trabajo, identificada en `usage._budget_reconciliation`, conservando los contadores originales). Es una provisión, no una factura ni una conversión de divisa. La conciliación manual es atómica e idempotente, condicionada a los dos IDs completados, los tokens registrados y la ausencia de una conciliación anterior.

Resultado: enabled=true, attempts=1, reserved_eur_cents=250, limit_eur_cents=500. Disponible una operación adicional para la prueba solicitada; al reservarla vuelve a 500 céntimos y dos operaciones contabilizadas. No se hicieron nuevas llamadas de IA. Las conciliaciones futuras requieren revisar otra vez el consumo acumulado; esto no activa liberaciones automáticas ni amplía el presupuesto.

## Presupuesto por consumo, sin límite de dos intentos

El usuario solicitó pruebas repetidas manteniendo los 5 € totales. Desplegada migración `poster_ai_metered_budget` y función `poster-ai` versión 3. Se elimina el límite de dos intentos: `attempts` conserva el contador histórico, pero ya no decide la disponibilidad.

Cada operación reserva 100 céntimos temporalmente. Al terminar se liquida una vez según todos los tokens registrados: texto de entrada a $5/M, imagen de entrada a $8/M y salida a $30/M, sin aplicar descuentos de caché. Se contabilizan 250 céntimos EUR por USD como provisión conservadora de conversión/impuestos, no como tipo de cambio real ni factura exacta. Se libera la diferencia con la reserva. Los errores de cuota/clave/rechazo confirmados sin uso liberan la reserva; los resultados inciertos o uso ausente conservan la protección. El servidor impide otra llamada si no queda margen para la reserva, si hay una en curso o si existe un resultado incierto.

Los trabajos anteriores se han recalculado desde su `usage`, preservando las anotaciones de conciliación histórica. El límite continúa en 500 céntimos y el acceso sigue restringido a la misma cuenta. Liquidación atómica por RPC invoker, permisos exclusivos de service_role e idempotencia: una respuesta no puede contabilizarse dos veces. Si el coste inesperadamente supera la reserva, se registra completo y se desactiva la prueba en caso de exceso, sin falsear el consumo. El margen es conservador; no sustituye la factura del proveedor.

Validación: 18 pruebas correctas, incluida migración histórica, más de dos operaciones completadas, agotamiento por presupuesto, devoluciones de cuota, concurrencia, uso incompleto, liquidación duplicada y permisos de cliente; TypeScript, JSX y Deno correctos. No se hicieron llamadas de IA de pago en este cambio.

Fuentes de tarifas: https://developers.openai.com/api/docs/pricing y guía de generación, consultadas el 19 octubre 2026. Modelo y tamaños siguen fijados en el servidor; revisar tarifas antes de cambiar modelo o condiciones.

## Tercer estilo: Rave Industrial

El usuario aprobó incluir la muestra. Añadidos miniatura real y ejemplo a Explorar y al selector lateral, con instrucciones y referencia de servidor propias. Negro/verde fósforo, collage industrial y textura de fotocopia. Sin fotos usa arquitectura; con fotos integra retratos reconocibles sin inventar identidades. Comparte generación, edición, formatos, acceso privado y control por consumo dentro de los mismos 5 €. No se genera ninguna imagen al integrar ni se cambia el saldo.

Validación: 19 pruebas correctas (incluidas distinción de estilo y regresión de presupuesto), JSX, TypeScript y Deno correctos. Función actualizada con las tres referencias y verificación JWT activada. La adaptación visual real con fotos y otros datos queda para las pruebas del usuario dentro de la app.

## Cuarto estilo: Disco Collage

Muestra aprobada e inclusión autorizada por el usuario. Miniatura real y ejemplo en Explorar y selector lateral; referencia de servidor y dirección propias de collage disco/funk setentero, semitonos, vinilo y tipografía curva. Fotos opcionales con preservación de identidad; sin fotos se usa collage musical sin inventar rostros. Mantiene los formatos, edición por versiones, cuenta privada y el control por consumo dentro de los mismos 5 €. Integración sin llamadas de IA ni cambios del saldo. Pruebas: 20 correctas; JSX, TypeScript y Deno correctos. Servicio actualizado con las cuatro referencias, con JWT activado. La adaptación visual con las fotos y datos del usuario se prueba desde la app.

## Quinto estilo: Jazz de Autor

Inclusión autorizada por el usuario: miniatura real y ejemplo en selector lateral y Explorar, referencia e instrucciones propias en servidor. Ilustración de concierto, serigrafía azul/naranja sobre crema y ambiente nocturno. Con fotos se solicita retrato ilustrado reconocible; sin ellas, objetos musicales y arquitectura sin inventar la identidad del DJ. Comparte formatos, edición, permisos y límite existente de 5 €. Integración sin llamadas de pago. JSX, TypeScript, Deno y 20 pruebas existentes correctos; pendiente de validar la adaptación visual real desde la app. Servicio desplegado con cinco referencias y JWT activado.

## Calibración del presupuesto para continuar pruebas

Autorizada por el usuario manteniendo los mismos 5 € totales. Migración `20261019032802_poster_ai_calibrated_budget.sql` aplicada y función `poster-ai` desplegada en versión 7 con JWT activado. Reserva temporal por operación: 75 céntimos. Conversión de estimación: 125 céntimos EUR por USD, con margen; no equivale al saldo ni a la factura de OpenAI. Historial conocido recalculado desde usage sin borrar trabajos; reservas de resultados inciertos conservadas. Cuenta privada y límite de 500 céntimos preservados.

Verificación tras desplegar: habilitado, consumo estimado 208 céntimos, reserva 0, disponible estimado 292 céntimos. 21 pruebas correctas, TypeScript, JSX y Deno correctos. Sin llamadas de generación de pago durante el ajuste. Referencia de cambio consultada: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.hr.html (16 octubre 2026).

## Sexto estilo: Jardín Surreal

Muestra aprobada e inclusión autorizada. Añadidas miniatura y muestra con datos coherentes, referencia de servidor e instrucciones específicas: flores escultóricas coral, follaje burdeos, sol cálido y formas cromadas. Con fotos se preserva la identidad entre elementos botánicos, sin cubrir rostros; sin fotos no se inventan artistas. Selector lateral, formatos y edición compartidos. Función desplegada activa en versión 8 con JWT; 21 pruebas, Deno y JSX correctos. Sin llamadas a la API de imágenes de pago durante la integración. Adaptación visual pendiente de probar desde la app del usuario.

## Séptimo estilo: Bauhaus Sonoro

Inclusión aprobada: miniatura, muestra con datos coherentes y selector lateral; referencia propia e instrucciones de geometría musical, tipografía grotesca, papel crema, rojo y azul. Fotos opcionales con retratos reconocibles integrados en recortes geométricos; sin fotos no se inventan personas. Recomposición por formato y textos largos. Servicio activo versión 9 con JWT. 21 pruebas correctas, Deno y JSX correctos. Acceso privado y presupuesto existente conservados; sin generación de pago durante la integración. La calidad de adaptación con fotos queda para la prueba del usuario en la app.

## Octavo estilo: Pop Club

Muestra aprobada e inclusión autorizada. Miniatura y muestra coherentes en selector lateral y Explorar, referencia e instrucciones propias para campaña comercial juvenil: rosa, azul, crema, flash editorial, estrellas y detalles cromados. Con fotos se solicita preservar rostro, edad e identidad del artista real; no sustituirlo por la mujer de muestra. Sin fotos se usan gráficos y luces sin inventar rostros de artistas. Comparte formatos y edición. Servicio activo versión 10 con JWT. 21 pruebas correctas, JSX y Deno correctos. Misma cuenta privada y presupuesto; integración sin llamadas de generación de pago. Validación de la adaptación visual pendiente de pruebas del usuario desde la app.

## Noveno estilo: Premium Night sustituye a Minimal

Sustitución aprobada por el usuario. Minimal retirado del selector y sus muestras; Premium Night ocupa su lugar con miniatura real y ejemplo coherente. Dirección propia de arquitectura nocturna, reflejos, luz cálida y tipografía marfil; fotos opcionales preservando identidad, edad y equilibrio entre artistas. Sin fotos no se inventan rostros. Servicio activo versión 11 con JWT. 21 pruebas correctas, JSX y Deno correctos. Acceso privado y límite existente conservados; integración sin generación API de pago. Pendiente prueba visual con fotos reales desde la app. Restan Neón, Club y Ocean por sustituir conforme al plan aprobado.

## Décimo estilo: Urban Chrome sustituye a Club

Muestra aprobada e inclusión autorizada. Club retirado del selector y sus ejemplos; Urban Chrome ocupa su lugar con miniatura real y muestra coherente. Dirección urbana de azul cobalto, retratos monocromos con flash y metal líquido; fotos opcionales preservando identidad, edad y equilibrio entre artistas. Sin fotos se usan esculturas cromadas sin inventar caras. Servicio activo versión 12 con JWT. 21 pruebas correctas, Deno y JSX correctos. Sin modificar acceso privado ni presupuesto; integración sin llamadas de generación de pago. Pendiente validar adaptación visual desde la app. Restan Neón y Ocean por sustituir.

## Undécimo estilo: Summer Club sustituye a Ocean

Inclusión aprobada. Ocean retirado del selector y sus ejemplos; Summer Club incorpora miniatura y muestra coherentes. Referencia e instrucciones para fotografía luminosa de piscina turquesa, coral, sombras de palmera y tipografía clara. Fotos opcionales preservando identidad, edad, ropa y rasgos; sin fotos no se inventan personas. Servicio activo versión 13 con JWT. 21 pruebas correctas, Deno y JSX correctos. Presupuesto y acceso privado conservados; integración sin llamadas de generación de pago. Pendiente prueba visual con fotos desde la app. Resta Neón por sustituir por Remember.

## Duodécimo estilo: Remember sustituye a Neón

Inclusión aprobada. Neón retirado del selector y muestras; Remember incorpora miniatura real y ejemplo coherente. Dirección dance 90/00 con espiral translúcida lima/ámbar, violeta, trazos de movimiento y tipografía futurista. Fotos opcionales preservando identidad y edad; sin fotos usa abstracción sin inventar artistas. No trasladar etiquetas de épocas de la muestra a los datos del usuario sin petición. Servicio activo versión 14 con JWT. 21 pruebas correctas, Deno y JSX correctos; comprobados 12 temas y 12 miniaturas coincidentes. Los cuatro estilos locales antiguos han sido sustituidos. Acceso privado y presupuesto conservados; sin generación API de pago durante integración. Adaptación visual real pendiente de pruebas en app.

## Decimotercer estilo: Duotono Editorial

Inclusión aprobada a partir de la referencia visual aportada. Miniatura y muestra propias, fondo marfil, retratos duotono azul y letras coral, sin identidad ni patrocinadores del cartel de referencia. Instrucciones preservan rostro, edad y rasgos de las fotos reales sin forzar la pose de muestra; sin fotos se usan objetos musicales. No trasladar encabezados adicionales de la muestra. Servicio activo versión 15 con JWT. 21 pruebas correctas, Deno y JSX correctos; 13 temas y miniaturas coincidentes. Acceso privado y presupuesto conservados; sin generación API de pago durante integración. Adaptación real pendiente de probar desde la app.

## Galería: Explorar y Plantillas

Solicitud del usuario: Explorar solo muestra imágenes de carteles de usuarios; pestaña Plantillas con los 13 estilos en dos columnas y Mis carteles debajo. Eliminadas muestras y descripciones de Explorar. Añadido publicar/retirar voluntariamente cada cartel completado desde su detalle; los existentes permanecen privados. Feed limitado a 60 publicaciones, devuelve solo id, formulario e imagen firmada, sin instrucciones, uso ni datos internos. Actualización de publicación restringida al propietario y trabajos completos. Se conserva el bloqueo de beta a la cuenta autorizada; no se ha abierto la generación a otros usuarios. Migración de columna privada por defecto e índice aplicada. Servicio activo versión 16 con JWT. Verificación: 11 trabajos, 0 publicados; TypeScript, Deno, JSX y 21 pruebas previas correctos. Validación visual y publicación desde app pendientes de prueba del usuario. No se realizaron llamadas de IA de pago.

## Creación en sheet de tres pasos y texto libre

Pulsar plantilla abre modal inferior con progreso: sesión futura guardada, fotos opcionales (hasta tres, asociadas a DJs, varias referencias permitidas del mismo artista), formato Cartel/Historia/Cuadrado y generar. Compositor inferior en galería permite iniciar con instrucciones de texto; estas se revisan en el último paso y se transmiten al generador. Edición por texto del resultado conservada. Backend admite tres JPEG con dimensiones y tamaño individual previos, cuerpo total acotado a 2.750.000 bytes; propietario, clave privada y presupuesto sin cambios. Servicio activo versión 17 con JWT. JSX, TypeScript y Deno correctos; 22 pruebas, incluida aceptación de tres referencias y rechazo de cuarta o artista ajeno. No se generaron imágenes de pago; pendiente validación visual del sheet con teclado y fototeca en teléfono.

## Aviso de cartel terminado y detalle simplificado

Detalle con compartir arriba a la derecha y solo input de cambios con envío debajo; retirados presupuesto, publicación y lista de versiones del detalle. Al completar una generación se guarda una notificación interna con enlace al cartel exacto. Aviso inmediato mientras la pantalla está montada; buzón persistente si el usuario sale. No es push del sistema operativo. Trigger invoker e índice único evitan duplicados; referencias se eliminan al borrar cartel. Migración aplicada, trigger confirmado, prueba local de finalización/idempotencia/borrado correcta; TypeScript y JSX correctos. Sin llamadas de IA para verificar. Pendiente prueba de interacción en móvil.

## Cartera de créditos simulada

Decisión delegada por el usuario: 1 crédito al crear y 0,5 al editar. Saldo y paquetes de prueba exclusivos del propietario, sin compras de tiendas ni cargos. Precios indicativos revisados 8,99 €/5 y 19,99 €/12. Reserva mediante trigger dentro de la transacción de creación del trabajo: sin crédito revierte también reserva de presupuesto API. Estado incierto conserva reserva; completado descuenta una sola vez; fallido libera. Movimientos auditables e idempotencia; RLS sin escritura de clientes, funciones invoker solo service_role. Historial previo exento. Servicio versión 18 con JWT, límite API original intacto. No se generaron imágenes de pago para probar. Pruebas locales cubren compra duplicada, conflicto, saldo insuficiente, generación, edición, incertidumbre, devolución y permisos. Costes y financiación pendientes antes de cualquier lanzamiento público.
