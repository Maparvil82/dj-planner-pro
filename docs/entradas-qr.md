# Entradas: contador de accesos por QR

El acceso `+ → Entradas` y el acceso desde una sesión abren ahora un contador, no un flujo de emisión/venta.

1. Seleccionar una sesión propia en curso o futura, excluyendo canceladas. Se ordenan por inicio, de la más próxima a la más lejana. La selección usa la hora de fin y la zona horaria de la sesión para conservar las actuaciones nocturnas tras medianoche. Desde el detalle de una sesión pasada se puede consultar su recuento sin registrar accesos nuevos.
2. Ver el total de accesos registrados por QR y manualmente.
3. Usar «Añadir acceso · +1» para accesos sin QR o acompañantes. Cada acción confirmada suma una persona; durante el guardado se bloquean pulsaciones repetidas. Un error ofrece reintento con el mismo identificador para evitar duplicación si el primer intento llegó al servidor.
4. Escanear un QR: la primera lectura registra un acceso; otra lectura del mismo contenido en esa sesión no suma y muestra la fecha de la primera lectura.
5. El contador se guarda en Supabase y se recupera al volver a entrar. Requiere conexión; un fallo de red no muestra éxito. Reintentar el mismo código es seguro.

## Alcance

- Acepta contenido QR de proveedores externos sin interpretar URLs ni abrirlas. Se conserva la huella SHA-256, no el contenido original. El código debe tener entre 1 y 16.384 unidades de texto.
- Cuenta códigos, no valida compra, autenticidad, pago, evento de origen ni cancelación en la plataforma externa. Un QR arbitrario también se puede contabilizar. La interfaz dice «Acceso contabilizado», no «Entrada válida».
- Un código = un acceso. Entradas de grupo y QR dinámicos/rotatorios no se pueden deduplicar por persona sin integración del proveedor. No se calcula aforo restante, ventas, cobros ni ingresos con este dato.
- Escanear una entrada emitida por DJ Planner en este modo no modifica su estado de pago ni la marca de entrada del flujo antiguo/invitados. Son registros independientes y no se suman entre sí.
- Solo el propietario de la sesión puede acceder. La deduplicación compartida entre sus dispositivos es atómica en el servidor; no se añaden permisos de personal de puerta.
- Las sesiones canceladas son consultables pero no admiten registros nuevos. Eliminar la sesión elimina su recuento. Una cuenta en eliminación no puede escribir.
- Tablas `event_entry_scans` y `event_manual_entries`, RLS de lectura, escritura exclusiva por RPC, clave única `(session_id, code_hash)`. Guardado activo mediante migraciones `external_entry_counter` y `manual_entry_counter`.

## Verificación

- `node tests/entryCounterDatabase.cjs`: códigos externos, reintentos, aislamiento por evento/propietario, permisos, sesión cancelada, cuenta en eliminación y borrado asociado.
- `tests/browser/entryCounter.cjs`: interfaz, dos códigos distintos, repetición, envío solo de huella, recarga con contador guardado y acceso manual con reintento tras fallo de red sin duplicar (servidor simulado).
- Falta probar la cámara con entradas reales en iOS/Android. No se afirma compatibilidad con todos los formatos visuales ni QR dinámicos.

---

## Implementación anterior conservada

El flujo de emisión sigue programado en `/ticket-issuance`, fuera del menú principal. Los datos y las entradas anteriores no se borran. El escáner anterior conserva su validación para Invitados y para ese flujo; el contador entra al mismo escáner con `mode=counter`.

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
