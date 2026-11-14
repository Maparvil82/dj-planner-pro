# Prueba de calidad y edición conversacional · 18 octubre 2026

## Objetivo

Crear un cartel completo y editarlo conversando, con un nivel visual que justifique usar DJ Planner Pro. Los ocho bocetos vectoriales anteriores no son plantillas finales aprobadas y no validan la calidad de la función.

## Caso concreto

MIDNIGHT SESSION. ALEX NOVA / LUNA. 24 OCT 2026. 23:30. SALA ÓRBITA · MADRID. Datos y retratos ficticios. Dirección visual: club futurista, fotografía editorial, petróleo y rojo, dos retratos integrados, tipografía y datos generados como parte del cartel.

1. Generar cartel vertical completo.
2. Sobre esa imagen, pedir: «Cambia el rojo por violeta y la hora a 00:30; conserva los rostros, nombres, fecha y composición».
3. Comparar el original y la edición: texto exacto, calidad de los retratos, jerarquía, legibilidad a tamaño móvil y conservación de lo no solicitado.

Esta prueba visual usa la herramienta integrada del chat. No mide coste, latencia ni fidelidad del backend de la app y no acredita equivalencia completa con el producto ChatGPT.

## Experiencia que debemos construir si la prueba convence

Sesión o datos nuevos → fotos y logos opcionales → estilo de inspiración o descripción libre → generar → conversación con imagen y versiones → volver a una versión o exportar. El usuario puede aportar referencias y pedir cambios libres. Los estilos sugieren una dirección y se pueden abandonar; no limitan la composición.

Cada versión registra su imagen de origen, petición, datos de sesión y resultado. Una edición parte de la versión elegida y conserva el original. Las adaptaciones a otros formatos deben recomponer la pieza, no limitarse a recortarla. Los textos integrados en el bitmap no se convierten automáticamente en capas editables.

## API y coste: pendiente de prueba autorizada

La documentación oficial contempla generación y edición en conversaciones con Responses API, usando contexto de imagen o `previous_response_id`. Debemos conservar imágenes y versiones propias para no depender solo de ese identificador. No es suficiente enviar instrucciones sobre un fondo predeterminado.

Antes de fijar créditos, medir una generación y varias ediciones con el modelo elegido, tamaño y calidad explícitos. Registrar uso del modelo conversacional, entrada de texto e imágenes y salida de imagen. No extrapolar el precio únicamente de tokens de texto o del precio de salida. Las tarifas iguales entre modelos no implican igual precio por imagen.

Propuesta de protección de margen: saldo prepagado, reserva previa suficiente por operación, límite de tamaño/calidad, una operación activa por usuario, idempotencia, conciliación de consumo y bloqueo al agotar saldo. No ofrecer revisiones ilimitadas. Precio mostrado antes de confirmar cada generación o edición; tarifas y margen aún no decididos.

No se han realizado llamadas a la API de pago ni conectado producción. Las instrucciones del laboratorio exigen presupuesto autorizado antes de esas pruebas.

Fuentes consultadas el 18 octubre 2026:
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/models/gpt-image-2
