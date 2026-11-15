# Precios vigentes — 28 octubre 2026

Importes confirmados por el propietario: 5 créditos por 5,99 € y 12 créditos por 12,99 €, precio base España. Crear consume 1 crédito y cada cambio 0,5. La app nativa muestra el precio localizado recibido de Apple; la simulación usa estos mismos importes. Los dos productos siguen pendientes de revisión y las ventas públicas permanecen desactivadas. Esta decisión sustituye las propuestas históricas inferiores.

---

# Revisión histórica — 21 octubre 2026

Decisión delegada por el usuario: generación 1 crédito y edición 0,5. Simulación privada: 5 créditos a precio indicativo 8,99 €; 12 a 19,99 €. Sustituye los precios y regla de edición del borrador histórico inferior. Ningún precio está publicado. El paquete anterior era demasiado ajustado al descontar medio crédito por cambios de coste similar. Bajo el supuesto de IVA 21 %, comisión 30 % y coste 0,30 €/operación, gastar todo en ediciones (10 o 24 operaciones) deja contribución aproximada de 2,20 € o 4,36 €, antes de otros gastos. No garantiza beneficios; falta validar máximos y costes reales.

Cartera de prueba en unidades enteras de medio crédito, libro de movimientos e idempotencia de compra/reserva/liquidación. Compras simuladas exclusivas del propietario; no acreditan saldo real ni activan pagos. Un resultado incierto conserva reserva; fallo confirmado la libera. El límite global de API sigue vigente y no aumenta con compras simuladas. Los trabajos previos no se cobran retroactivamente.

---

# Propuesta comercial de carteles — 20 octubre 2026

Estado: propuesta para revisar; no hay productos nuevos publicados, cobros activados ni créditos vendidos. Beta privada y presupuesto existentes conservados.

## Evidencia actual

Consulta de trabajos: 8 generaciones completas, estimación interna total 1,81 €; 4 ediciones completas, estimación total 0,96 €; un fallo sin cargo estimado. Media: 0,22625 € generación y 0,24 € edición. No es factura: la estimación usa tokens y margen de conversión. Muestra pequeña; no establece percentiles ni coste máximo. Falta validar tres fotos y todos los formatos antes de cerrar precio.

## Oferta inicial propuesta

Una generación o una edición completada consume 1 crédito. Descargar y compartir no consume. Mostrar el coste antes de enviar. No caducar créditos comprados. No ofrecer uso ilimitado ni incluirlo sin límite en Pro.

Paquetes candidatos: 5 créditos por 4,99 €; 12 créditos por 9,99 €. No son precios publicados ni rentabilidad garantizada. Precios finales deben configurarse por tienda y moneda.

Ejemplo de sensibilidad para España, puramente de planificación: PVP con IVA supuesto del 21 %, comisión de tienda supuesta del 30 % sobre base sin IVA, coste presupuestado 0,30 € por operación. Neto ilustrativo = PVP / 1,21 × 0,70. Para 5: neto 2,89 €, IA 1,50 €, contribución 1,39 €. Para 12: neto 5,78 €, IA 3,60 €, contribución 2,18 €. No incluye alojamiento, RevenueCat si aplica, soporte, devoluciones, diferencias de cambio ni tributación del beneficio. Con coste de 0,40 €/operación quedan 0,89 € y 0,98 € respectivamente antes de esos gastos. Las liquidaciones y comisiones reales dependen del programa, región y tienda; sustituir supuestos por extractos antes de publicar.

## Implementación necesaria

RevenueCat ya integrado para suscripciones; añadir productos consumibles de carteles, sin alterar los derechos Pro. Confirmación de compra desde servidor con identificador de transacción único y verificación de proveedor; nunca acreditar basándose solo en el cliente. Libro de movimientos por usuario: compra, reserva, consumo, liberación y ajustes. Reserva atómica de 1 crédito antes de llamar al proveedor; finalizar una sola vez al guardar imagen. Fallo confirmado sin resultado libera el crédito. Resultado incierto conserva la reserva hasta conciliación, sin repetir la llamada automáticamente. Reconexión recupera saldo y trabajos. Reembolsos y eventos repetidos deben ser idempotentes y auditables.

El usuario paga a la tienda; la tienda liquida al desarrollador según su calendario. OpenAI factura al desarrollador por separado: requiere financiación disponible aunque la tienda aún no haya liquidado. La cuenta de API es del servidor; cada usuario tiene su propio saldo comercial, no acceso al saldo OpenAI compartido. Mantener controles de coste global y por usuario.

## Próximo paso

Validar costes de formatos y tres fotos con pruebas autorizadas; confirmar precios y política de créditos. Después preparar cartera y compras en sandbox, probar compras duplicadas, concurrencia, desconexión, errores y reembolsos antes de habilitar ventas reales.

Fuentes oficiales consultadas: https://developers.openai.com/api/docs/pricing y https://developer.apple.com/app-store/review/guidelines/#in-app-purchase . Los porcentajes del ejemplo son supuestos, no una determinación fiscal ni contractual.
