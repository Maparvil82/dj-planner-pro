# Pulso

Plantilla incorporada el 28 de octubre de 2026 por petición del propietario. Referencia de dirección visual: https://es.pinterest.com/pin/226939268710814582/ . La muestra es una composición nueva; no se descarga ni reutiliza el cartel de Pinterest.

Datos ficticios: FRECUENCIA LIBRE; NORA VELA + ÁLEX NOX; 14.11.2026 · 23:30; SALA PRISMA · VALENCIA. Estos datos son solo de muestra: el generador recibe la información real de la sesión y tiene instrucciones de no repetir los de la referencia.

Original: `assets/posters/pulso-v1.png`. Vista previa: `assets/posters/previews/pulso-v1.jpg`. Miniatura: `assets/posters/thumbnails/pulso-v1.jpg`. Referencia del servidor: `supabase/functions/poster-ai/pulso-reference.ts`.

Generación mediante la herramienta integrada de imágenes, sin usar la API de generación de carteles ni créditos de los usuarios. Prompt de la muestra:

> Create a polished original 2:3 portrait electronic DJ event poster, flat full bleed artwork, no mockup. Minimal Swiss music editorial design. Matte vivid warm coral-red paper, ivory and near-black ink, very subtle print grain. Upper two thirds: a striking original geometric rhythmic sculpture built from three staggered groups of ivory rectangular bars with alternating widths and heights forming a rising and falling syncopated pulse; asymmetrical spacious composition, no literal copied waveform. Lower third: bold clean black neo-grotesk headline with exact text 'FRECUENCIA' then 'LIBRE'. Below a thin black rule, medium clearly legible exact artist names 'NORA VELA + ÁLEX NOX'. Bottom organized restrained information grid with exact text '14.11.2026 · 23:30' and 'SALA PRISMA · VALENCIA'. Strong typography, generous safe margins, clear hierarchy, all text sharp complete and spelled exactly. No English slogans, no God bless electronic music text, no Quim Marin branding, no logos, no watermarks, no extra text, no photography. This is a distinct original musical poster for a reusable app template called Pulso.

El estilo se admite en Cartel, Historia y Cuadrado. Las fotografías opcionales conservan la identidad de los artistas. La inclusión del estilo no cambia precios, regalos, límites, permisos ni el proveedor de generación.

Validación: 300 pruebas generales, TypeScript y Deno correctos; paquete iOS compilado. `poster-ai` v34 ACTIVE, JWT obligatorio. Lectura posterior de los 28 archivos del servidor coincidente con los locales. Solo cambian el registro/estilo en domain.ts, la selección en index.ts y la nueva referencia frente a v33. La verificación no llamó a Google ni generó un cartel contra la cartera de un usuario.


## Corrección v2 pedida por el propietario

Se retira del catálogo la muestra v1 de tres ondas. La v2 mantiene una sola secuencia de barras marfil, fondo coral apagado, título negro de tamaño moderado, separadores y cuadrícula inferior como la referencia elegida; los datos siguen siendo ficticios. Los archivos activos son `pulso-v2.png`, `previews/pulso-v2.jpg` y `thumbnails/pulso-v2.jpg`. La instrucción del servidor exige conservar la composición de la referencia, no reinventarla en cada generación. Sin fotos no se añaden ventanas fotográficas ni arquitectura.

Se prepararon muestras visuales con uno, dos y tres retratos ficticios mediante la herramienta integrada de imágenes. Se guardan en `outputs/pulso-v2-fotos/` en el espacio padre del repositorio. Estas imágenes comprueban la composición visual; NO son resultados del proveedor de producción ni validan la identidad de una persona real. No se llamó a Google ni se gastaron créditos de los usuarios. La generación con fotos reales del propietario en la app sigue pendiente.

Prompt de corrección de la base: conservar la composición del pin elegido, coral #d65351, exactamente UNA secuencia horizontal compacta de barras marfil de alturas parecidas escalonadas verticalmente, margen superior amplio, separador negro y título Frecuencia / libre de tamaño moderado; después otro separador, tres columnas con Nora Vela + Álex Nox, 14.11.2026 · 23:30 y Sala Prisma · Valencia, y línea inferior gruesa. No ondas adicionales, retratos ni textos originales del pin.

Prompts de las variantes: usar `pulso-v2.png` como imagen objetivo y conservar su fondo, onda única, texto y reglas. Añadir respectivamente uno, dos o tres retratos editoriales monocromos ficticios en el área superior coral, sin cubrir caras, onda ni tipografía y sin duplicar personas. Se explicita que son muestras de composición y no retratos reales de los nombres del cartel.

Validación automatizada: cero, una, dos y tres fotos, asociación imagen/artista, tres referencias de la misma identidad, formato de datos y reglas de onda única. Las pruebas automatizadas verifican instrucciones y admisión de imágenes; no equivalen a una evaluación visual de resultados de Google.

Despliegue final: poster-ai v35 ACTIVE con JWT obligatorio. Los 28 archivos leídos del servidor coinciden con el conjunto esperado. 301 pruebas correctas, TypeScript, Deno y paquete iOS correctos; Expo recargado.
