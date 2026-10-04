# Por acuerdo · Pro

**Oculto temporalmente:** `FEATURES.feeAgreements = false`. La opción, calculadora y promoción Pro no aparecen en la app. Se conservan el código y los datos; no hay cambios destructivos en la base de datos.

## Recorrido

1. Al crear o editar una sesión, elegir **Por acuerdo · PRO** en Caché.
2. Usuarios gratuitos ven el paywall con la ventaja explicada. Usuarios con Pro activo pueden abrir **Configurar acuerdo**.
3. Definir condiciones, moneda y reparto. Guardar devuelve un resumen al formulario; guardar la sesión persiste el acuerdo.
4. Antes del evento se pueden introducir previsiones. El estado es **Por liquidar**: esas previsiones no suman a los ingresos de la agenda o dashboard.
5. Cuando termina la actuación, abrir su detalle → **Calcular liquidación** → **Introducir resultados reales**.
6. Confirmar cifras y cerrar la liquidación fija el caché de la persona propietaria. Registrar el cobro es un paso independiente en **Cobro de la sesión**.

## Fórmula

Cada componente se redondea a céntimos:

- Fijo adicional.
- Importe por entrada × entradas vendidas.
- Porcentaje de ingresos de entradas × ingresos reales de entradas.
- Porcentaje de ingresos de barra × ingresos reales de barra.

Se toma el mayor entre la suma y el mínimo garantizado. El mínimo no se añade a la suma. Los gastos comunes se descuentan antes del reparto y no pueden superar el caché calculado. Por ahora los importes son los que declara el DJ; no se calculan impuestos ni se sincronizan con una caja o plataforma de entradas.

El reparto admite partes iguales, porcentajes que sumen 100 o importes que coincidan exactamente con el neto disponible. Los céntimos sobrantes se asignan siguiendo el orden de participantes para conservar el total. La primera persona es el propietario de la sesión; solo su parte se registra como su caché. Hasta 20 participantes. Se admite un resultado real de cero.

## Acceso, privacidad y series

- Pro se verifica en el servidor; una etiqueta o una preferencia local no concede acceso.
- La base de datos valida la configuración y recalcula el importe guardado, sin confiar en `earning_amount` enviado por el cliente.
- Una liquidación solo puede cerrarse después de finalizar la sesión, incluyendo actuaciones que terminan al día siguiente. El acuerdo conserva la zona horaria del dispositivo al configurarse.
- Las fechas recurrentes comparten las condiciones iniciales, pero cada fecha tiene su propia liquidación. Una liquidación no se copia a toda la serie. Las ediciones de acuerdos en serie no sobrescriben liquidaciones ya cerradas.
- Al caducar Pro se conservan la consulta de acuerdos y la gestión de cobros; configurar o liquidar requiere Pro activo.
- Esta calculadora es privada. Sus participantes no reciben invitaciones ni mensajes con importes. Las invitaciones a sesiones colaborativas siguen su flujo independiente.
- Los RPC públicos de Comunidad siguen usando campos explícitos y no publican acuerdos, previsiones, cachés o cobros.

## Verificación

- `npm test`: cálculo combinado, mínimo, gastos, divisiones y céntimos, validaciones, previsiones separadas y estados de pago.
- `node tests/feeAgreementDatabase.cjs`: PostgreSQL aislado, validación Pro, RLS, cálculo del servidor, cierre tras el evento, series y caducidad.
- `tests/browser/feeAgreement.cjs`: creación y liquidación con API simulada, caché propio, cobro separado y paywall gratuito. No escribe sesiones de prueba en Supabase.
- Traducciones en es, en, de, fr, it, pt, ja.

Las compras reales necesitan una compilación nativa compatible con RevenueCat; la verificación de navegador no comprueba compras de Apple ni la presentación nativa en iPhone.
