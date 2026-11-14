# Carteles: rama aislada

Base: instantánea local 125da0f del trabajo actual, con índice temporal y sin alterar la rama ni el índice de la app publicable. Rama feature/carteles-lab. No se ha hecho push.

La app completa y sus componentes viven en esta copia. El prototipo usa el tema real (useCommunityColors). Entrada local directa /carteles y opción + → Carteles. Sesiones y galería ficticias; borradores en memoria. API IA desconectada.

Arranque: npm run start:carteles, puerto 8096. No copiar .env. Supabase apunta al localhost sin credenciales reales y compras deshabilitadas. EAS sin perfiles, updates deshabilitadas y build bloqueada. No desplegar funciones ni migraciones desde esta rama.

Los cambios normales siguen en ../dj-planner-pro. No mezclar esta rama ni cherry-pick de carteles hasta autorización expresa. El prototipo antiguo ../dj-planner-posters-lab queda como referencia, no como base futura.

Pendiente: comprobar en teléfono, sustituir gradualmente el prototipo por componentes de formulario/galería compartidos y habilitar un backend de pruebas con fixtures para recorrer toda la app sin producción. No se dispone aún de autenticación de pruebas ni agenda real.

## Plantillas beta · propuesta visual 1

Ocho direcciones creadas a partir de las 13 referencias del usuario: Forma Retro (1), Tropical Club (2), Botánica Surreal (3), Headliner (4/8/9), Rave Digital (5), Neo Futuro (6), Groove Vintage (11/12) y Editorial (7/10/13). Los números corresponden al orden de los adjuntos originales.

Catálogo versionado en `src/postersLab/templates.js`: nombre, paleta, composición, descripción e instrucción de fondo para futura IA. El selector, filtros, ejemplos y vista previa usan el mismo catálogo. Los ejemplos comparten datos para facilitar la comparación. Las muestras son bocetos vectoriales propios, sin fotografías de las referencias y sin llamadas de IA; no son el acabado fotográfico o ilustrado final.

Cartel 2:3, Historia 9:16 y Cuadrado 1:1; el texto se compone localmente. Fotos opcionales seleccionadas por el usuario, en paneles, hasta cuatro retratos en la muestra. No hay recorte de siluetas todavía. Datos, guardado y privacidad conservan las limitaciones del laboratorio.

Muestras comparables: `../outputs/DJPlannerPro/carteles-beta/index.html` y `ocho-estilos.png`. Regenerar el HTML y los SVG desde la raíz del proyecto ChatGPT con `node dj-planner-carteles-worktree/scripts/preview-poster-templates.mjs outputs/DJPlannerPro/carteles-beta`.

Validación: sintaxis JSX/JS comprobada; 24 variantes SVG rasterizadas (8 estilos × 3 formatos) y lámina de carteles y variantes cuadradas inspeccionadas. Pendiente verificación en Expo Go del renderizado nativo de SVG, fotos y textos largos. No se ha conectado IA ni modificado la app publicable.
