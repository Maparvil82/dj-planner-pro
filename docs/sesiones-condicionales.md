# Sesiones condicionales · Pro

## Qué resuelve

Un DJ acuerda antes del evento cómo se calculará su caché, puede simular ventas y, al terminar, introducir los resultados reales y revisar el reparto. Funciona desde **+ → Condicional**, creando una actuación nueva o convirtiendo una fecha de una sesión existente.

La conversión sustituye el caché anterior de esa fecha y conserva los pagos registrados. No modifica el resto de una serie. Una liquidación no significa que se haya cobrado: el control de pagos sigue siendo independiente.

## Investigación y decisiones

La [Musicians’ Union](https://musiciansunion.org.uk/working-performing/gigs-and-live-performances/live-engagement-rates-of-pay) recoge acuerdos con fijo, fijo más participación en taquilla, toda la taquilla y participación en beneficios, incluyendo barra. El [cuestionario para promotores del UK Live Music Census, página 18](https://uklivemusiccensus.org/wp-content/uploads/2017/12/UKLMC-Promoter-Online-Survey-March-2017-FOR-REFERENCE-ONLY.pdf) también distingue repartos, garantías y garantías más beneficios.

[Eventbrite distingue ventas brutas y netas, devoluciones, cargos e impuestos](https://www.eventbrite.co.uk/help/en-gb/articles/620300/export-payout-reports/). De ahí la separación de ventas, deducciones y pagos. Las siguientes reglas y su orden son decisiones del producto, no una interpretación automática de contratos.

## Acuerdos disponibles

| Caso | Configuración |
|---|---|
| Entrada de 10 €, local 3 €, DJs 7 € | Fijo al local de 3 € por entrada; resto para DJs |
| DJ recibe 7 € por entrada | Fijo por entrada al DJ de 7 € |
| 70 % de taquilla para DJs | Porcentaje de entradas; bruto o tras deducciones |
| 10 % de barra | Sin reparto de entradas; porcentaje de barra |
| Taquilla más barra | Ambas participaciones, sobre cajas separadas |
| 200 € más 70 % de entradas | Fijo + variable |
| 200 € o 70 % de entradas, lo que sea mayor | Fijo o variable, el mayor |
| Mínimo garantizado o límite máximo | Mínimo / tope sobre el fondo de todos los DJs |
| Bonus al vender 100 entradas pagadas | Umbral y bonus fijo |
| Anticipadas, puerta, VIP, distintos precios | Varios tipos de entrada, hasta 30 |
| Varios DJs | Partes iguales, porcentajes que suman 100, o fijos a otros y resto para el propietario; hasta 20 participantes |
| Comisiones o costes antes del porcentaje | Base tras deducciones de entradas o barra |
| Gastos deducidos del variable de los DJs | Gastos acordados, antes de garantías y reparto |
| Entradas totalmente devueltas, invitados o precio cero | Las devoluciones completas se restan; invitados y entradas gratuitas no generan caché ni cuentan para bonus |

El porcentaje de taquilla y el porcentaje de barra pueden ser distintos. No se aplica simultáneamente un fijo por entrada y un porcentaje a las mismas entradas: hay un único modelo de reparto de entradas. Sí se puede combinar con fijo general, barra, bonus, mínimo y tope.

## Recorrido

1. **Condiciones:** elegir modelo, precios, bases y reparto. Los ejemplos de 3 €/70 %/10 % son editables, no condiciones impuestas.
2. **Simulación:** cantidades y cajas esperadas, con el desglose del caché. Guardar esta información nunca la convierte en ingreso realizado.
3. **Liquidación:** se activa después de la hora de fin del evento, incluyendo actuaciones que cruzan medianoche. Introducir vendidos, devueltos, invitados, caja real y gastos. Guardar registra únicamente el caché real del propietario en las métricas.

El acuerdo es privado. Los participantes económicos son nombres para el cálculo: añadirlos no envía invitaciones ni les cambia su agenda. Las invitaciones a DJs siguen estando en el formulario habitual de sesión colaborativa.

## Orden exacto del cálculo

1. Entradas pagadas = vendidas − devoluciones completas, excluyendo precio cero e invitados.
2. Taquilla = suma de precio × cantidad pagada de cada tipo.
3. Si se eligió neto, restar las deducciones de esa caja; deben caber dentro de sus ingresos. Las devoluciones parciales se pueden introducir aquí sin duplicar una devolución completa.
4. Aplicar el modelo de entradas y, aparte, el porcentaje de barra. Añadir el bonus si corresponde.
5. Descontar los gastos acordados de este variable, con un mínimo de cero.
6. Sumar el fijo o tomar el mayor entre fijo y variable, según el acuerdo.
7. Aplicar mínimo garantizado y después tope máximo.
8. Repartir el fondo entre DJs; el propietario es el primer participante. En reparto fijo, los otros DJs reciben su importe y el propietario el resto. Se rechaza si los fijos superan el fondo.

El fijo y el mínimo no se reducen por los gastos. Si se negoció descontar costes de la recaudación antes de aplicar porcentajes, deben introducirse en **deducciones**, no en gastos del variable. No se generan deudas negativas.

Ejemplo: 100 entradas a 10 €, 10 devueltas y 3 € por entrada para el local: 900 € de taquilla, 270 € para el local y 630 € para DJs. Dos DJs al 50 % reciben 315 € cada uno. Un pago anticipado de 50 € permanece registrado y deja 265 € pendientes al propietario.

Los porcentajes se redondean al céntimo. El reparto usa restos mayores para que la suma coincida exactamente con el fondo; los empates se resuelven por orden de participantes. Un DJ con 0 % no recibe céntimos residuales.

## Pro, persistencia y seguridad

- La entrada tiene etiqueta PRO; un usuario gratuito puede conocer la función y acceder al paywall, pero no guardar condiciones.
- RevenueCat se verifica mediante el servidor. El servidor comprueba el acceso Pro al crear/modificar acuerdos y vuelve a calcular la liquidación, ignorando un importe inventado por el cliente.
- El acuerdo V2 se guarda en la sesión existente. Los acuerdos antiguos V1 y las sesiones simples conservan su comportamiento; no se reescribe información histórica.
- La simulación guarda `earning_amount = 0`; la liquidación guarda solo la parte del propietario. Los pagos existentes no se cambian.
- Al caducar Pro se conserva la lectura de la información. Editar el acuerdo requiere recuperar Pro.
- Las canceladas no se pueden seleccionar para convertir ni liquidar.

## Límites de esta versión

Los resultados son manuales: no hay venta de entradas, sincronización con plataformas, aceptación contractual ni pagos a terceros. Los impuestos y comisiones se introducen como importes de deducción acordados; no se calculan tipos fiscales.

Quedan para futuras versiones porcentajes progresivos por tramos, múltiples bonus, distintos repartos por tipo de entrada, reparto sobre una cuenta completa de beneficios del promotor con orden contractual de recuperación de gastos, indemnizaciones de cancelación y documentos de liquidación firmados. No deben presentarse como soportados por la calculadora actual.

## Verificación

Pruebas de reglas y regresión V1, 44 comparaciones entre calculadora y PostgreSQL, validación de acceso Pro y privacidad, conversión de una fecha conservando pagos, flujos en navegador con datos simulados y compilación para iOS. La reproducción en un iPhone físico requiere la revisión del usuario en Expo.

## Revisión de Supabase

La migración no añade avisos de seguridad. Siguen los avisos previos del proyecto: [función de eliminación de cuenta con permisos elevados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protección de contraseñas filtradas desactivada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) y tablas privadas de contratación cerradas por RLS sin políticas públicas. En rendimiento persisten [políticas RLS existentes que repiten llamadas de autenticación](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [políticas permisivas duplicadas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) e [índices de claves externas pendientes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys); esta migración no crea tablas ni políticas nuevas.
