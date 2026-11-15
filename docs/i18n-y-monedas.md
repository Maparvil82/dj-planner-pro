# Idiomas e importes

La aplicación configura español, inglés, alemán, francés, italiano, portugués y japonés. Los siete catálogos contienen 1.808 claves, sin textos vacíos y con las mismas variables de interpolación. La auditoría comprueba también las llamadas con claves literales y condicionales del código de la aplicación.

## Formato de importes

`useTranslation` ofrece `numberLocale`, `formatMoney`, `regionCode` y `defaultCurrency`. Los números siguen la configuración regional del dispositivo, independientemente del idioma de la interfaz. `formatMoney` utiliza el código de moneda y las reglas de `Intl.NumberFormat`, incluidos símbolos, separadores, posición y decimales propios de cada moneda. No convierte importes entre monedas.

Las sesiones antiguas conservan sus importes y admiten los alias € → EUR, $ → USD, £ → GBP y ¥ → JPY. Los resúmenes de cobros y totales reúnen los alias equivalentes, manteniendo separadas las monedas distintas. Las nuevas sesiones toman la moneda del dispositivo; en web, Expo no devuelve `currencyCode` y se utiliza una tabla de regiones habituales, con EUR como alternativa si no se identifica la moneda. La moneda siempre se puede revisar antes de guardar.

El formato común se aplica a Inicio, tarjetas de sesiones, previsiones, cobros, gastos, acuerdos, documentos de acuerdos, entradas, escáner, contrataciones y analíticas. Los formularios de importes mantienen sus validaciones existentes.

## Precios de Pro

Las compras muestran `product.priceString` del producto obtenido de Apple o Google mediante RevenueCat, conservando su precio y moneda de tienda. El idioma de la interfaz no determina el país de compra ni convierte el precio.

Los importes orientativos de España (EUR) se muestran en la vista previa cuando la región es ES. En la compra nativa se consulta el país de la cuenta de la tienda. Si confirma España (ES/ESP), pero el catálogo devuelve otra moneda, los importes españoles aparecen expresamente como referencia y el botón pide confirmar el precio en la tienda; el producto no se convierte ni se modifica. Una cuenta estadounidense conserva sus precios aunque el dispositivo esté en España. Si falta el producto, la compra queda deshabilitada. Los descuentos anuales solo comparan productos de la misma moneda y se ocultan cuando el catálogo contradice la moneda española.

El anual de 14,99 EUR muestra también en la app nativa «Precio de lanzamiento» y «Estándar previsto: 39,99 €/año». La promoción se retira cuando cambia el precio del producto. No se configura una subida automática a 39,99 € después del primer año. Al abrir los planes, actualizar precios o volver a la app se solicitan los productos actuales y el país de la tienda. Las respuestas antiguas y los refrescos durante una compra no sustituyen el estado más reciente.

Se han eliminado importes fijos en euros de los textos antiguos de planes: requieren `{{price}}` ya formateado si se vuelven a utilizar.

## Comprobaciones

- `npm run check:i18n`: paridad de claves, textos vacíos, variables y claves estáticas utilizadas.
- `npm test`: incluye renderizado de todos los catálogos sin idioma de respaldo y casos regionales de EUR, USD, GBP, BRL, JPY y monedas con tres decimales.
- `npm run typecheck` y exportación web.
- `tests/browser/paywallNativePricing.cjs`: pantalla, contexto y servicio reales con tienda simulada; discrepancia ESP/USD, refresco a EUR, promoción, cambio a precio estándar, cuenta de EE. UU., respuestas fuera de orden y vuelta de la pantalla de compra. No ejecuta compras ni llamadas reales a Apple.
- `tests/browser/monetization.cjs`: planes en siete idiomas y nueve regiones; sesión con importe en cada región adicional; pantallas a 320/390 px y modos claro/oscuro, con datos simulados.

`update_translations.js` ahora verifica los catálogos. Ya no rellena idiomas con traducciones inglesas.

La verificación del navegador usa productos no disponibles y datos simulados. Las tarifas efectivas, disponibilidad comercial y compras reales por país requieren probar las ofertas publicadas con cuentas de pruebas de App Store y Google Play. No se han modificado precios en las tiendas ni en RevenueCat.
