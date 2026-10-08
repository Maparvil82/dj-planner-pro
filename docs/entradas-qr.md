# Entradas QR · primera versión

## Recorrido

Desde **+ → Entradas** o **Gestionar entradas** en una sesión propia:

1. Elegir una fecha concreta de sesión. Las invitaciones a sesiones de otros DJs no otorgan permisos de puerta.
2. En **Emitir**, crear un tipo con nombre y precio o una invitación de precio cero. Una sesión condicional permite copiar los nombres y precios de sus tipos de entrada.
3. Emitir entre 1 y 100 entradas por lote, indicando pago confirmado o pendiente. Cada entrada recibe un token aleatorio diferente. El mismo lote se recupera al reintentar una petición cuya respuesta se ha perdido.
4. En **Entradas**, abrir y compartir una imagen PNG con el evento, fecha, hora, tipo, importe, estado y QR. La persona que la recibe no necesita la app. El sistema no envía mensajes ni realiza cobros.
5. En **Resumen → Escanear entradas**, permitir la cámara y leer el QR. Verde confirma el acceso. Se detectan entradas utilizadas, anuladas, pendientes y códigos no pertenecientes a la sesión. Una pendiente requiere confirmar explícitamente el pago antes de admitirla.
6. El resumen muestra accesos, entradas pagadas vigentes, pendientes e invitaciones por tipo. El importe manualmente marcado como pagado incluye entradas anuladas, señalando ese importe por separado: anular no devuelve dinero.

## Reglas

- Un QR autoriza un solo acceso. Es una entrada transferible, sin identificación de asistente. Compartir una copia no crea otra entrada.
- La validación necesita internet y se confirma en PostgreSQL. Un bloqueo de fila impide que dos lectores admitan simultáneamente el mismo QR. Cámara y lector se detienen al abandonar la pantalla o enviar la app a segundo plano.
- Solo la cuenta propietaria de la sesión puede emitir, leer, anular y validar entradas. Puede usar esa misma cuenta en varios dispositivos. No hay roles de personal de puerta en esta versión.
- La sesión cancelada no permite emitir ni validar. Se pueden anular entradas todavía no utilizadas. No se deshace un acceso registrado.
- Los tipos y precios quedan guardados; las entradas no se modifican directamente. No se puede cambiar la moneda de una sesión tras emitir entradas, para conservar el significado de los importes.
- No se publican tokens ni entradas en Comunidad. RLS protege las lecturas; las escrituras pasan por funciones que comprueban propietario, sesión, estado, tipo y cantidad. No existe acceso anónimo a tablas o funciones.
- Los accesos y pagos registrados no liquidan automáticamente el caché ni cambian las ventas de una sesión condicional. Venta y asistencia son datos diferentes.
- Los tickets se borran si se elimina su sesión. No hay anulación automática por hora de fin ni entradas de plataformas externas.

## App instalada

La cámara usa `expo-camera`, el QR `react-native-qrcode-svg` y el archivo compartido `expo-file-system`/`expo-sharing`. Funcionan dentro de las aplicaciones compiladas; Expo Go no es un requisito para sus usuarios. El plugin de cámara está configurado para iOS y Android sin grabación de audio. Una actualización del código JavaScript no sustituye una compilación nativa que incluya estos módulos y permisos.

Antes de publicar: comprobar en dispositivos iOS y Android permiso inicial/denegado, lectura desde otro móvil y papel, poca luz, varios lectores, interrupción de conexión y guardado/compartición de imagen.

## Verificación

`node tests/ticketingDatabase.cjs` verifica emisión, idempotencia, pagos, anulaciones, duplicados, resumen, privacidad y denegación de escrituras directas en PostgreSQL aislado. `tests/browser/ticketing.cjs` recorre menú, tipo, validaciones, emisión, exportación PNG, pago pendiente, escaneo y resumen con datos simulados. El QR exportado se ha decodificado y comparado con su token emitido. Las comprobaciones de empaquetado nativo no sustituyen la prueba de cámara en un teléfono físico.

## Revisión del servidor

Se han comprobado RLS, la denegación de lecturas anónimas y escrituras directas, y los permisos de las funciones desplegadas. No hay nuevos avisos de seguridad. Los índices recién creados aparecen como [todavía no utilizados](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), algo esperado antes de empezar a generar entradas reales.
