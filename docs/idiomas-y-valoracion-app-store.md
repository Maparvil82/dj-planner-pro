# Idiomas y valoración en App Store

27 de octubre de 2026. Revisada la ficha real de DJ Planner en App Store Connect: ID 6760347919, versión 1.0.3 lista para distribución. No se modificaron datos ni respuestas de reseñas en Apple.

El botón Valorar App conservaba el ID de ejemplo 6444444444. Se sustituye por 6760347919 y el enlace HTTPS de Apple con action=write-review, también en la alternativa web de iOS. El mensaje de región observado no demuestra una restricción territorial de DJ Planner: se estaba abriendo una ficha incorrecta.

Las traducciones internas existen en es, en, de, fr, it, pt y ja. Faltaba declarar los idiomas del binario iOS. Se añade CFBundleLocalizations con es, en, de, fr, it, pt-BR y ja, sin cambiar el idioma elegido por el usuario. La ficha traducida de App Store Connect y los idiomas del binario son configuraciones distintas.

Las correcciones están en el proyecto local. Los idiomas visibles en la ficha requieren una nueva compilación enviada y publicada; Expo Go no cambia los metadatos de la app de tienda. El enlace corregido también debe distribuirse para llegar a quienes utilizan la versión instalada anterior.

Verificación: TypeScript; correspondencia del ID con eas.json y con la ficha real; comprobación de siete idiomas declarados y ausencia del identificador de ejemplo.
