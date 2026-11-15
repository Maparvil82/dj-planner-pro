# Carteles con Google · prueba privada

Estado 23 octubre 2026: metering aplicado y servicio `poster-ai` desplegado con `verify_jwt=true`. Capturas del propietario confirman el estado de cuenta de prueba gratuita y la vinculación de DJ Planner a esa misma cuenta de Bothside. Credencial privada y selección de Google guardadas en secretos de Supabase. Acceso al modelo verificado con OAuth y una petición gratuita `countTokens` (HTTP 200, 9 tokens). Dos intentos de la app rechazados; se ha identificado y corregido la estructura REST de las opciones de imagen. Primera generación y edición satisfactorias desde la app pendientes.

## Proyecto y financiación

- Proyecto comunicado por el propietario: `dj-planner-512422`, cuenta Bothside.
- La consola de Bothside mostró «Prueba gratuita», 264 EUR sin usar, vence 21 enero 2027.
- Comprobado mediante capturas aportadas el 23 octubre 2026: la cuenta `01F47A-A56908-918428` indica «Cuenta de prueba gratuita», gasto 0 EUR, y sus proyectos vinculados incluyen `dj-planner-512422` (DJ Planner) y My Maps Project. El proyecto `dj-planner-512400` de la otra cuenta usa Nano_Prompt y no debe utilizarse para estas pruebas.
- El crédito Nano_Prompt «Trial credit for GenAI App Builder» no cubre llamadas directas a Gemini Flash Image según la respuesta automatizada de facturación obtenida anteriormente.
- No actualizar la cuenta a pago, activar recargas ni ampliar el límite interno de 500 céntimos. El usuario requiere que cualquier operación futura de pago se financie con ingresos realmente recibidos de la app, sin depender de su nómina.

## Credencial privada

Habilitar `aiplatform.googleapis.com` en DJ Planner sin convertir la cuenta a pago. Crear una cuenta de servicio exclusiva del proyecto (por ejemplo `poster-generator`) con rol Vertex AI User (`roles/aiplatform.user`). No conceder Owner, Editor ni permisos de facturación. Descargar una clave JSON de esa cuenta y guardarla únicamente como secreto de Edge Functions en Supabase, nunca en el chat, repositorio ni variables `EXPO_PUBLIC_*`.

Secretos para activar tras revisar la cuenta de prueba:

```text
POSTER_AI_PROVIDER=vertex
POSTER_GOOGLE_SERVICE_ACCOUNT_JSON=<contenido completo del JSON privado>
POSTER_GOOGLE_TRIAL_CONFIRMED=true
```

El JSON se valida contra el proyecto y el dominio de la cuenta de servicio. OAuth usa JWT RS256 de una hora y un endpoint fijo; no delega usuarios ni confía en el token_uri del archivo. No se guardan tokens ni claves en trabajos, respuestas o logs. Las llamadas de autorización y generación no tienen reintentos automáticos. Si una política impide claves de servicio, revisar autenticación federada en vez de deshabilitar políticas a ciegas.

## Comportamiento y límites

- Proveedor seleccionado únicamente por el servidor, Google por defecto. Sin fallback automático a OpenAI. Sin credencial y confirmación, las nuevas generaciones quedan desactivadas. OpenAI solo puede seleccionarse explícitamente con `POSTER_AI_PROVIDER=openai`.
- Modelo `gemini-3.1-flash-image`, endpoint Vertex global, una candidata, resolución 1K, máximo 4096 tokens de salida; sin búsqueda, grounding ni herramientas.
- Proporciones: Cartel 2:3, Historia 9:16, Cuadrado 1:1. El prompt ya no impone las dimensiones de OpenAI a Google.
- Mismo orden de imágenes: referencia de estilo, cartel previo si se edita, hasta tres fotos de artistas con nombre.
- JPEG solicitado; si Google devuelve PNG, se conserva su tipo real y se comparte correctamente con el cliente actualizado. Los clientes antiguos piden JPEG al compartir, por lo que conviene verificar el resultado en el teléfono y actualizar el cliente si Google devuelve PNG.
- Acceso exclusivo del propietario, cartera y reservas atómicas existentes. Reserva de 75 céntimos y límite acumulado de 500 céntimos sin ampliar ni reiniciar el historial.
- Metering conserva `usageMetadata` original con `_provider` y `_model`. Estima entrada a $0,50/M y toda salida —incluidos pensamiento y texto— a $60/M como provisión conservadora. Conserva margen anterior de 125 céntimos EUR/USD. No es factura ni saldo de crédito promocional.
- Uso ausente o inválido conserva la reserva. Errores inciertos bloquean otras llamadas y no se repiten. Fecha de parada local conservadora: 21 enero 2027 00:00 UTC.
- `POSTER_GOOGLE_TRIAL_CONFIRMED` registra una comprobación humana, **no consulta** el estado de facturación o crédito en Google. No protege si alguien convierte después la cuenta a pago. La garantía de no facturación durante la prueba procede de mantener esa modalidad en Google.

## Pendiente antes de darlo por operativo

1. Completado: confirmada facturación de DJ Planner → Prueba gratuita Bothside mediante capturas del propietario. El propietario también confirma que habilitó la API Vertex AI.
2. Completado: API habilitada por el propietario y credencial de su cuenta de servicio validada contra el proyecto y guardada directamente en secretos de Supabase. Archivo temporal de configuración con permisos 600 eliminado tras la carga. No se ha mostrado su contenido en el chat.
3. Completado: metering aplicado y función desplegada con JWT obligatorio, sin ampliar acceso ni saldo.
4. Acceso anónimo devuelve 401 y presupuesto comprobado sin cambios. Acceso directo al modelo comprobado mediante `countTokens`, sin generación de contenido. Falta comprobar el estado autenticado desde el cliente.
5. Una generación y una edición desde la cuenta propietaria; comprobar identidad, textos, proporciones, compartir, aviso de finalización y consumo en Google.

Validación: 31 pruebas locales correctas (presupuesto, cartera, notificaciones, entradas y proveedor Google), comprobación Deno y TypeScript correctas. En remoto: límite 500 céntimos, consumo estimado previo 277, reservas 0, intentos 13, sin nuevos avisos de seguridad para carteles. El cálculo remoto de prueba devuelve 12 céntimos para 4000 tokens de entrada y 1500 de salida, sin crear trabajos ni llamar al proveedor. El cliente actualizado para compartir PNG y mensajes neutrales está en código local; no se ha realizado otra compilación o publicación de Expo.

## Documentación consultada

### Corrección del primer intento desde TestFlight

Los trabajos `83870f06-b020-4ed2-9c9e-f491fed97f96` y `154e200e-6743-452e-95f6-21604dd3dc98` fallaron con `poster_provider_rejected`, sin imagen ni uso devuelto. Una petición deliberadamente vacía (imposible generar) reprodujo el error HTTP 400: Vertex REST no reconoce `outputMimeType` ni `outputCompressionQuality` directamente en `generationConfig.imageConfig`. Son propiedades del SDK que su conversor anida dentro de `imageOutputOptions` como `mimeType` y `compressionQuality`.

Corregido a `imageConfig.imageOutputOptions={mimeType:'image/jpeg',compressionQuality:90}`. La misma comprobación vacía con la estructura corregida pasa la validación de campos y solo reclama el contenido ausente. No se ha ejecutado generación automática de diagnóstico. Pruebas de los tres formatos verifican la estructura REST; 31 pruebas y `deno check` correctos. Se registra proveedor y estado HTTP en los rechazos, sin cuerpo, fotos, prompts ni credenciales. Cartera remota conserva 10 créditos (20 medios créditos), reservas cero y presupuesto histórico 277/500 céntimos. No requiere nueva compilación del cliente.

- https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1beta1/GenerationConfig
- https://raw.githubusercontent.com/googleapis/python-genai/main/google/genai/models.py (`_ImageConfig_to_vertex`).

- https://firebase.google.com/docs/ai-logic/pricing?api=vertex (crédito de bienvenida cubre API Vertex/Agent Platform, no Gemini Developer API).
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-image
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-generation
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.ImageConfig.html
- https://developers.google.com/identity/protocols/oauth2/service-account
- https://docs.cloud.google.com/vertex-ai/docs/general/access-control
- https://cloud.google.com/vertex-ai/generative-ai/pricing
- https://supabase.com/docs/guides/functions/background-tasks
