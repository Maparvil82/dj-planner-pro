# Catálogo de carteles y renovación mensual

28 octubre 2026. Decisión del propietario: mantener 20 plantillas activas; retirar Jardín Surreal del catálogo; conservar estilos antiguos accesibles mediante Explorar → Crear con este estilo. El día 1 se prepararán 20 propuestas nuevas para revisar antes de publicar sustituciones.

## Implementación actual

El catálogo activo es la lista `examples` de `src/postersLab/PosterLab.js`. La galería Plantilla y el selector visual derivan de esa misma lista, con 20 identificadores distintos. Jardín Surreal no forma parte de ella. Se mantienen sus colores, imágenes y referencia del servidor, así como su admisión en el generador, para no romper los trabajos históricos ni su reutilización.

Retirar una plantilla de la selección principal NO significa borrar imágenes, trabajos, estilos o referencias. No se elimina contenido de Explorar. Los nuevos catálogos deben usar identificadores nuevos para nuevos diseños; nunca sobrescribir el significado de un identificador histórico. Mientras `form.style` sea el identificador de generación, sus definiciones históricas deben seguir registradas. Una futura renovación requiere ampliar el registro histórico y sustituir únicamente la lista activa, validando de nuevo los accesos antiguos.

Pulso conserva el lenguaje coral/marfil/negro y una sola onda, pero permite variar el ritmo de barras, posición, escala, jerarquía, espacios y composición fotográfica en nuevas generaciones. Se preserva la composición e identidad existentes en ediciones salvo petición expresa. Las fotografías reales siguen asociadas a su artista; varias referencias de una persona no inventan nuevos artistas.

## Renovación programada

Automatización de este chat: `renovar-plantillas-dj-planner`, activa el día 1 de cada mes a las 10:00, hora de Europe/Madrid. Prepara 20 propuestas para revisión del propietario; no sustituye ni publica el catálogo sin la revisión acordada. Considera cero, una, dos y tres fotos y formatos Cartel, Historia y Cuadrado. Conserva los estilos anteriores. La primera ejecución prevista es el 1 de noviembre de 2026.

## Validación

305 pruebas correctas, TypeScript y Deno correctos. Pruebas del catálogo verifican exactamente 20 estilos activos únicos con imágenes existentes, retirada visible de Jardín Surreal, conservación de su soporte histórico y apertura del flujo de creación para ese estilo. La compilación iOS incluye el catálogo nuevo. No se realizan generaciones de pago durante estas comprobaciones.
