# Publicación provisional de Contrataciones

## Preparación local

- `npm run build:web` genera `dist` con Expo Router en modo web `single`.
- `vercel.json` sirve las rutas directas, incluidas `/book/:slug` y `/booking/:id`, mediante `index.html`.
- Las conversaciones privadas llevan `X-Robots-Tag: noindex, nofollow, noarchive` y `Cache-Control: no-store`; toda la web utiliza `Referrer-Policy: no-referrer`.
- La exportación solo utiliza las variables públicas de Supabase. Ninguna clave de Resend, RevenueCat o de servicio debe incorporarse a la web.

## Publicación realizada

Repositorio: `Maparvil82/dj-planner-pro`, rama `codex/session-management-and-security`.

Cuenta Vercel verificada: `maparvil-gmailcoms-projects` (`team_yCG5jBlIayy3crdq5YBSkPth`). Proyecto creado: `dj-planner-bookings`.

El propietario confirmó expresamente el repositorio y destino. Publicación realizada mediante la CLI oficial de Vercel, utilizando únicamente la web compilada; la herramienta de despliegue del conector no estaba disponible.

- Dirección estable: https://dj-planner-bookings.vercel.app
- Despliegue: `dpl_5ZGCS9CM3Zb66AtwP2asykJPg4aB`, estado `READY`.
- Artefacto local publicado: `/private/tmp/dj-planner-bookings-publish`.
- No se ha conectado despliegue automático desde GitHub; los cambios posteriores requieren otra exportación y publicación.
- Comprobado sin autenticar: inicio y rutas `/book/*` y `/booking/*` devuelven HTTP 200; JavaScript y CSS tienen tipos correctos; cabeceras privadas y de referencia correctas.
- La cuenta Vercel visible utiliza Hobby: antes de ofrecer la función comercial, usar un plan que permita ese uso. No se ha contratado ni cambiado ningún plan.

## Pendiente para activar Contrataciones

1. Configurar `BOOKING_WEB_ORIGIN` en Supabase con la dirección efectiva.
2. Preparar Resend: clave solo de envío y remitente de un dominio verificado para destinatarios reales. La página Domains de la cuenta muestra «No domains yet». El remitente de pruebas solo permite enviar al correo de la cuenta Resend.
3. Configurar el trabajador de correos y probar el recorrido completo con destinatarios autorizados antes de activar Contrataciones.

Estado: web publicada; correo pendiente; servicio de contratación todavía desactivado. Publicar la web no habilita enlaces de DJs ni solicitudes reales por sí solo.
