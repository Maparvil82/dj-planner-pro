# Robustez: paso 1 — copia compatible del cartel de sesión

27 de octubre de 2026. Desplegado en producción como versión 29 de `poster-ai`, tras autorización del usuario.

## Cambio

La función conserva los bytes originales y su formato en `poster-ai-private`. Para `sessions` prepara una copia JPEG de hasta 1 MiB y lado largo de hasta 1600 px, siempre con extensión `.jpg`. Descarga y edición siguen utilizando el original privado, también si es PNG.

Se mantienen proporciones sin recortar ni ampliar; los JPEG compatibles conservan exactamente sus bytes. Se ajustan compresión y, si hace falta, resolución. La transparencia se compone sobre blanco. Se conservan la autorización y asignación atómica existentes: una conversión fallida no sustituye el cartel anterior ni repite la inferencia.

Se utiliza ImageScript 3.7.0, fijado por versión y solo importado por la función del servidor. No se añade una dependencia móvil. El decodificador limita a 4 MP antes de reservar los búferes; se rechazan entradas superiores a 10 MiB, firmas que no correspondan al MIME y formatos distintos de JPEG/PNG. Los formatos del proveedor actual son inferiores a 2 MP.

## Verificación en Supabase local

Se creó una instancia aislada con Supabase CLI 2.22.6 y Edge Runtime 1.67.4 (Deno 1.45.2). No se copiaron credenciales ni datos de producción. Los depósitos de prueba reproducen los límites: original privado hasta 10 MiB JPEG/PNG; sesiones hasta 1 MiB JPEG.

- Se reprodujo el fallo anterior: el depósito real de prueba rechaza el PNG grande y el JPEG grande sin convertir.
- Se guardaron y recuperaron seis casos sintéticos: PNG y JPEG grandes, transparencia, retrato, cuadrado y JPEG pequeño. Hashes de lectura confirman que los originales no cambian y que las copias almacenadas coinciden con la conversión.
- PNG de 5.833.576 bytes: copia JPEG de 842.379 bytes.
- JPEG de 4.975.393 bytes: copia JPEG de 842.481 bytes.
- Un JPEG compatible se conserva byte a byte. El original privado no se puede abrir mediante el endpoint público.
- Entradas corruptas, MIME no permitido y exceso de píxeles se rechazan. No se escribe una copia incompatible.
- Un segundo decodificador (ImageMagick, solo usado por las pruebas) confirma dimensiones, JPEG válido y blanco para la transparencia.

## Empaquetado y límites

La prueba detectó que la primera alternativa con ImageMagick excedía el límite de tamaño del paquete completo. Se sustituyó antes de publicar por ImageScript, sin cambiar el SDK ni la lógica de compras. No quedan archivos WASM añadidos al servidor ni configuración de archivos estáticos.

El paquete completo de Carteles se construyó con Edge Runtime: **17.156.823 bytes**, inferior a 20 MB. Se probó en otro contenedor limpio, a partir del paquete y sin montar el árbol de fuentes ni la caché de dependencias. La función completa arranca y responde 405 a un método incorrecto y 401 sin autenticación.

El conversor empaquetado se ejecutó en trabajadores con 256 MB y límite duro de CPU de 2 s, escribiendo y leyendo el Storage local:

- PNG grande: aproximadamente 234 ms de conversión.
- JPEG grande: aproximadamente 392 ms.
- Tres peticiones simultáneas: las tres correctas, unos 398–410 ms de conversión cada una.
- JPEG de 8.073.628 bytes y 4 millones de píxeles: copia de 809.396 bytes, unos 716 ms de conversión.

Son mediciones locales de la conversión, no capacidad de producción, memoria máxima medida ni tiempos de generación con IA. Se mantienen las 255 pruebas generales, cinco pruebas de conversión real y comprobaciones TypeScript y Deno aprobadas. CI ejecuta las cinco pruebas de imágenes; la integración con Docker se documenta como prueba manual reproducible.

## Límites y siguiente paso

Las pruebas locales no realizaron generaciones de IA ni compras. La corrección se activó después en el backend de producción, sin compilaciones de Expo. Se comprobó el arranque y el control de acceso; queda pendiente una generación real desde la app cuando se autorice su consumo de crédito. La prueba local valida conversión y almacenamiento reales; la orquestación completa de generación y asignación se cubre con los tests existentes, sin llamar a un proveedor de pago.

La recuperación de trabajos `uncertain` o abandonados se completó el 28 de octubre en `robustez-paso2-recuperacion-carteles.md` (v33). El resto de este informe conserva las comprobaciones del paso 1.

## Evidencias y reversión

Los resultados, scripts sin credenciales y hash del paquete están en `../outputs/robustez-carteles-paso1/pruebas-locales/` desde la raíz del repositorio. Las versiones previas del punto de entrada, prueba de orquestación y CI están en `../outputs/robustez-carteles-paso1/antes/`, con su manifiesto. Para revertir solo este paso, comparar primero con cambios posteriores y restaurar esos tres archivos; retirar los dos módulos nuevos una vez eliminado su import. No utilizar una restauración global de Git: existe trabajo previo ajeno a este paso.

## Despliegue de producción — versión 29

Antes de publicar se obtuvo la versión 28 activa y se guardó íntegra en `../outputs/robustez-carteles-paso1/servidor-antes-v28.json`. Se desplegaron los 25 archivos de esa versión, con el único cambio previsto en `index.ts`, y el nuevo `session-image.ts`. Los demás archivos se conservaron exactamente como estaban en el servidor. La validación JWT permanece activada.

Supabase confirmó versión 29, estado ACTIVE, el 27 de octubre de 2026. Una lectura posterior de la función confirma los 26 archivos exactos, sin archivos inesperados. Comprobaciones HTTP públicas completadas a las 21:54:51 UTC: POST sin credenciales 401; GET con clave anónima válida alcanza el código y devuelve 405/poster_method; POST con clave anónima no puede hacerse pasar por una cuenta y devuelve 401/poster_unauthorized; OPTIONS devuelve 200. No se hicieron generaciones de pago ni escrituras de datos de usuario como prueba.

Los metadatos y resultados están en `despliegue-v29.json` y `comprobaciones-produccion-v29.json` dentro de la carpeta de evidencias. La versión 28 completa permite preparar una reversión si se necesitara; no se ha ejecutado ninguna reversión.
