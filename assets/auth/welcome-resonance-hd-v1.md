# Restauración de la foto de bienvenida

Archivo en uso: `welcome-resonance-hd-v1.png`, 1166 × 1349 px, aproximadamente 2,5 MB. Generado el 4 de noviembre de 2026 con la herramienta integrada image_gen, en modo edición. Entrada: `assets/paywall_header_new.png`, 319 × 369 px, que se conserva sin sobrescribir. Referencia de código: `src/components/auth/AuthUI.tsx`, AUTH_IMAGE. Las fotos específicas de acceso, registro y recuperación siguen teniendo sus propias referencias.

Es una restauración generativa: reduce pixelación y reconstruye textura, pero no equivale a recuperar el negativo o el original de alta resolución. No debe tratarse como evidencia fotográfica exacta. Conserva la composición y el ambiente muy próximos a la entrada; algunos detalles de rostros/equipos se reconstruyen. Si se obtiene la foto original de alta resolución, es preferible usarla.

## Prompt final — herramienta integrada

Use case: identity-preserve. Edit target: the supplied original low-resolution 319x369 photograph. Produce a faithful high-resolution restoration/upscale, about 2048x2368 pixels or the largest available portrait resolution preserving this exact aspect ratio. This is an existing DJ Planner mobile app photo that looks pixelated when enlarged. Change only resolution, JPEG/block artifacts and gentle optical sharpness. Preserve the exact photo, full composition and crop, all people's identities and facial proportions, clothing and poses, hands, equipment layout and labels, wall graffiti, lighting, colors and documentary grain. Keep the central female DJ, surrounding crowd and exact RESONANCE wall lettering. Do NOT invent a different photo, beautify faces, redesign equipment, change expressions, add people, smooth skin plastically, add contrast or change style. Recover natural-looking fine textures conservatively, prioritize photographic plausibility over artificial sharp edges. No app UI, no logo overlays, no extra text, no border. Full restored photo only.

## Validación

Original y resultado inspeccionados visualmente. Relación de aspecto preservada (0,8645 frente a 0,8643); código de encuadre no modificado. La resolución lineal aumenta aproximadamente 3,65 veces. Recurso incluido dentro del proyecto; no depende del directorio de generación.
