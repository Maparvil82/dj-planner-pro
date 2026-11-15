Actualización 27 octubre 2026: créditos automáticos al entrar en Carteles, sin botón de reclamar. Error de abono corregido y servicio v30 publicado; ver `carteles-creditos-automaticos.md`. Lo que sigue conserva el estado anterior.

# Carteles: bienvenida 3 / 5 y presupuesto 250 EUR

Activado en producción el 27 de octubre de 2026 por solicitud del propietario.

- Cuentas Gratis: 3 créditos de bienvenida (6 unidades).
- Pro de pago confirmado por RevenueCat: 5 créditos (10 unidades). Se mantiene la exclusión existente de Sandbox, trial, acceso expirado, reembolso y Family Sharing.
- Una sola vez por identidad de correo confirmado. Repetir la solicitud no repone saldo gastado. Pasar de Gratis a Pro añade 2 créditos; si alguna cuenta tuviera un regalo anterior menor, se completa solo la diferencia.
- Crear cuesta 1 crédito; cada modificación 0,5. Descargas y compartir no consumen saldo.
- Las cuentas actuales y nuevas con correo confirmado pueden solicitar el regalo desde Carteles → Tus créditos → Recibir regalo de bienvenida. El abono ocurre al pulsar; no se han creado carteras masivamente.
- El propietario conserva la cartera de simulación anterior; no recibe el regalo comercial ni se modifica su saldo de pruebas.
- Compras de créditos permanecen desactivadas.

## Presupuesto y alcance

Techo interno de IA: 250 EUR totales, compartidos entre todos los usuarios, incluyendo el historial ya contabilizado. Al activar había 3,13 EUR contabilizados y cero reservas: 246,87 EUR de margen interno. Este cálculo es conservador; no consulta el saldo de Google ni constituye un límite de facturación configurado en Google Cloud. No se ha modificado la cuenta de Google, su modalidad de prueba ni su vencimiento.

Bolsa inicial de bienvenida: 1.000 créditos flexibles (2.000 unidades). Sin cuotas separadas de Gratis / Pro; los campos técnicos de plazas se elevan a 2.000 para que solo limite la bolsa común. Esta bolsa admite hasta 2.000 modificaciones con una provisión de planificación de 0,125 EUR por operación. La provisión no garantiza el coste real. El presupuesto global y las reservas se comprueban independientemente y pueden bloquear antes; nunca hay recarga mensual automática.

La promoción conserva su cierre existente el 20 enero 2027 a las 23:00 UTC (21 enero a medianoche en Madrid). El proveedor mantiene su bloqueo por fin de prueba el 21 enero 2027 a las 00:00 UTC. No se promete continuidad gratuita después de la promoción de Google. No se configura caducidad adicional del saldo en cartera.

## Implementación y validación

Migración `20261027221952_poster_welcome_launch.sql`: amplía la restricción del presupuesto hasta 25.000 céntimos; las reservas acumuladas pueden superar 500 céntimos pero no el límite configurado. Conserva historial, saldos y reservas. Sustituye exclusivamente los importes del regalo, conserva transacciones, HMAC y verificación del plan en el servidor, y activa la campaña.

No hace falta desplegar una nueva función: `poster-ai` versión 29 ya ofrece la solicitud del regalo. La presencia de la configuración `POSTER_PROMOTION_SALT` se ha comprobado en la consola sin mostrar ni leer su valor.

Interfaz local: texto de regalo 3 / 5 y retirada del antiguo mensaje fijo «máximo 5 EUR». Los textos nuevos se ven al recargar Expo Go; la publicación de la app sigue pendiente.

Verificado: 262 pruebas automáticas correctas; TypeScript y sintaxis JSX correctos. Los casos nuevos cubren regalo Gratis / Pro directo, mejora +2, regalo anterior, duplicados después del consumo, identidad duplicada, cuentas nuevas, bolsa insuficiente sin abonos parciales, ocho reservas simultáneamente pendientes que suman 6 EUR, bloqueo por 250 EUR y ausencia de permisos de cliente para conceder saldo o cambiar límites.

En producción se han comprobado los valores, privilegios y disponibilidad. Una transacción con ROLLBACK probó saldo 3 → 5, duplicados y `canGenerate=true` sin dejar créditos, reclamaciones ni cambios de presupuesto. No se han generado imágenes ni hecho compras durante la verificación. Falta que un usuario reclame desde la app para verificar de extremo a extremo la consulta real a RevenueCat y el HMAC de la configuración de producción.

Asesor de seguridad sin avisos nuevos respecto a la revisión anterior: 28 informativos de tablas privadas con RLS sin políticas de cliente, aviso conocido de función de administración y aviso conocido de protección de contraseñas filtradas.

Evidencia y respaldo: `../outputs/carteles-bienvenida-3-5/` en la raíz del espacio de trabajo.

## Desactivación

Para detener nuevos regalos: `update public.poster_commerce_settings set promotion_enabled=false where id=true;`. Conserva los créditos ya entregados. Para detener nuevas generaciones globalmente: `update public.poster_ai_budget set enabled=false;`. No reducir el techo por debajo de las reservas pendientes ni borrar carteras, reclamaciones o movimientos.
