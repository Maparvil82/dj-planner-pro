# Carga de las plantillas

La galería cargaba los 16 PNG originales (unos 41 MB) a la vez, incluso en tarjetas pequeñas. Ahora cada ejemplo tiene una miniatura JPEG de 420 px y una vista previa JPEG de 1050 px. Los originales quedan conservados, pero no se importan en la pantalla. Las referencias del generador no se modifican.

Las 16 miniaturas suman 727.193 bytes; las vistas previas suman 4.479.424 bytes. La galería utiliza exclusivamente la miniatura del ejemplo; las imágenes de carteles de usuarios conservan su origen propio. Mientras carga aparece un indicador; ante error aparece Reintentar, que vuelve a montar la imagen. El estado se reinicia al cambiar la fuente.

Validación: 32 referencias de recursos existentes, 16 miniaturas JPEG válidas y presupuesto total inferior a 1 MB. JSX correcto. Chrome con conexión limitada a 120 KB/s y 150 ms de latencia: las 16 plantillas cargadas y decodificadas. El acceso superior a Lugares no aparece en Carteles.


## Optimización del 25 de octubre de 2026

20 miniaturas activas reducidas a un máximo de 280 × 420 px en JPEG progresivo, conservando originales y vistas previas. Peso combinado: 788260 a 487657 bytes. El carrusel de estilos utiliza también miniaturas; la vista ampliada conserva su recurso de mayor resolución. La muestra Verde Indie usa una vista previa de hasta 720 × 1080 px y miniatura de 240 × 360 px.
