# Robustez: paso 2 — recuperación de generaciones interrumpidas

28 octubre 2026. Autorización del propietario: «ok pues vamos con eso».

## Problema corregido

Los trabajos `running` abandonados y los resultados `uncertain` bloqueaban la siguiente generación y retenían el crédito sin conciliación automática. La imagen podía estar guardada en Storage aunque se hubiera perdido la confirmación final.

## Comportamiento publicado

- Recuperación antes de listar, consultar un trabajo, consultar el saldo o crear otro cartel. El usuario se obtiene del token confirmado; no se acepta un propietario enviado por el cliente.
- Vigilante de base de datos `poster-job-recovery` cada minuto, incluso con la app cerrada. Procesa hasta 200 trabajos caducados por pasada; las comprobaciones normales sin recuperación no bloquean el presupuesto global.
- Una generación activa conserva su reserva durante diez minutos. Después, la consulta o el vigilante busca los archivos de salida en sus rutas inmutables y exactas. Un trabajo incierto con imagen guardada puede recuperarse antes.
- Si existe el original, se entrega y consume el crédito reservado una sola vez. Si también existe la copia de sesión, se recupera su enlace estable y se aplica solo si sigue coincidiendo el cartel que el usuario confirmó al empezar. Una sustitución manual posterior prevalece.
- Si solo existe el original, queda accesible en Mis carteles; la sesión conserva su cartel anterior. No se repite la IA para reconstruir la copia.
- Si vence el plazo sin imagen recuperable, el trabajo termina como fallido, se libera el crédito del usuario y se desbloquea la cuenta. Una respuesta tardía no resucita un trabajo ya terminado ni vuelve a cobrar. La protección de Storage impide nuevas escrituras privadas de un trabajo cerrado.
- La falta de medición del proveedor no se interpreta como coste cero: su reserva global se convierte en una estimación conservadora de coste, identificada por `provider_cost_estimated`. Si ya se contabilizó un uso conocido, no se suma otra vez. El fallo confirmado antes de enviar la petición sí se liquida con coste cero. Esto conserva la protección del límite global de 250 € aunque se devuelva el crédito comercial al usuario.
- `poster_begin_provider` permite un solo envío para cada trabajo. Ni la recuperación ni los reintentos del mismo identificador llaman a Google.
- La app consulta al regresar a primer plano y sigue comprobando los resultados inciertos. Distingue «Generando», «Comprobando» y fallos con crédito liberado.

La caducidad se observa alrededor de diez minutos; el vigilante añade hasta el siguiente intervalo de ejecución y puede necesitar más de una pasada si hay una cola grande. Sin conexión, la pantalla se actualiza al recuperarla. No es una garantía de tiempo del proveedor.

## Despliegue y permisos

Migraciones `20261028000011_poster_job_recovery.sql` y `20261028000214_poster_job_recovery_cron.sql` aplicadas. Activado `pg_cron`. Las funciones nuevas son `SECURITY INVOKER`, con acceso revocado a PUBLIC, anon y authenticated; solo el servidor puede ejecutarlas. Se mantienen RLS y el bucket privado.

`poster-ai` v33 ACTIVE, JWT obligatorio. Lectura posterior: los 27 archivos coinciden exactamente con el despliegue; únicamente cambia `index.ts` respecto a v32. El vigilante real ejecutó correctamente a las 00:11 y 00:12 UTC. Consulta manual del recuperador: 0 trabajos que conciliar y 0 activos.

Antes y después: 17 trabajos completos, 3 fallidos, 20 intentos; presupuesto 25000 céntimos, 322 contabilizados y cero reservados. No se realizaron compras ni llamadas de pago al proveedor durante estas pruebas. Avisos del asesor de seguridad sin cambios respecto al inicio.

## Pruebas

289 pruebas generales correctas. Tras el ajuste final para evitar bloquear el presupuesto en lecturas sanas: 31 pruebas específicas correctas. TypeScript, Deno y JSX correctos.

Los casos específicos cubren petición duplicada tras perder su respuesta, desconexión del proveedor, pérdida de escritura final, envío único, aislamiento, permisos, crédito Gratis/Pro y cartera de simulación, resultado tardío, salida PNG/JPEG, recuperación sin copia de sesión, cambio manual del cartel, coste desconocido, uso ya contabilizado y plazo agotado.

Además se creó un contenedor temporal aislado con PostgreSQL de Supabase 15.8.1.054. Ocho peticiones simultáneas: una sola devolución y un solo consumo. El vigilante local resolvió un trabajo por sí solo sin consulta de la app. La prueba se repitió con la función final. No se utilizó la instancia local de otro proyecto. El contenedor temporal se retiró al terminar.

Expo compiló el paquete iOS con los cambios. El propietario confirmó el 28 de octubre de 2026 que realizó la comprobación propuesta en su iPhone y funciona: «ok comprovado y funciona». Con esta confirmación, el paso 2 queda completado. Las interrupciones de red, los fallos de escritura y la concurrencia se cubrieron con las pruebas automatizadas anteriores; la confirmación del propietario no se extiende a casos adicionales que no haya indicado probar.

Evidencias y archivos anteriores: `outputs/robustez-carteles-paso2/` en el espacio padre. No restaurar todo Git: hay cambios anteriores ajenos a este paso. Para una reversión se puede desactivar únicamente el trabajo Cron por su nombre y restaurar la función v32; revisar los estados ya conciliados antes de cualquier reversión de datos.
