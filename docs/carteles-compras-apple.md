Actualización 28 octubre 2026: precios confirmados 5 créditos por 5,99 € y 12 créditos por 12,99 € (España). Sustituyen los precios iniciales del historial inferior. Regla final Gratis 3 / Pro activo 5, incluido Pro de prueba; cuenta corregida a 5 y servicio v31 publicado. Los dos consumibles siguen en borrador en Apple y las ventas públicas siguen pendientes de la nueva versión. Ver `carteles-normal.md`; el texto inferior conserva el historial.

# Compras de carteles — preparación Apple / RevenueCat

21 octubre 2026. Configuración autorizada por el propietario; no se envió a revisión, no se publicaron ventas ni se realizó una compra real.

## Catálogo creado

- Apple app DJ Planner, bundle com.djplannerpro.app.
- Consumible Carteles · 5 créditos: com.djplannerpro.app.postercredits5; Apple ID 6825300337; precio base España 8,99 €; nombre comercial y descripción en español guardados.
- Consumible Carteles · 12 créditos: com.djplannerpro.app.postercredits12; Apple ID 6825308839; precio base España 19,99 €; nombre comercial y descripción en español guardados.
- Ambos en Borradores / En preparación para el envío, disponibilidad configurada inicialmente España; sin revisión ni publicación.
- RevenueCat proyecto DJ Planner: productos prod879a12c6a3 y prod6f4ead8190, tipo Consumable, sin vincular a entitlement Pro.
- Oferta separada poster_credits (ofrng733a5d9a1f), paquetes credits_5 y credits_12. Oferta default de suscripciones conservada.
- RevenueCat muestra Could not check en estado Apple: no dispone de credenciales App Store Connect para comprobación/importación automática. Productos registrados manualmente con identificadores exactos.

## Integración privada de pruebas

App carga la oferta dedicada, muestra precio localizado de Apple y abre purchasePackage en entorno nativo de pruebas. Expo Go conserva simulación. Perfil EAS poster-sandbox extiende production con EXPO_PUBLIC_POSTER_STORE_TESTING=true; no se ha iniciado build ni enviado a TestFlight.

Servidor action sync_store obtiene Customer Info directamente de RevenueCat para el usuario autenticado. Solo admite productos conocidos, store app_store y is_sandbox=true; ignora producción, otras tiendas y reembolsos señalados. Acredita una sola vez cada ID de transacción mediante RPC invoker solo service_role, tabla RLS y saldo de pruebas. Nunca confía en saldo/recibo aportado por cliente. Permite recuperar compras tras desconexión. Créditos de Sandbox son de prueba y comparten cartera de pruebas existente, no representan dinero. Ninguna compra producción se acredita: lanzamiento real bloqueado hasta implementar cartera de producción y conciliación de reembolsos por notificaciones de servidor.

Migración poster_apple_sandbox_receipts aplicada. Servicio poster-ai activo versión 19, JWT y propietario privado conservados. No se modifica límite API ni se recarga OpenAI. Pruebas de recibos elegibles, duplicados, conflicto, producto desconocido, otro propietario y permisos correctas; TypeScript, Deno y JSX correctos.

## Pendiente antes de probar y vender

1. Crear y distribuir compilación nativa privada de prueba, usando el perfil indicado; Expo Go no prueba StoreKit real.
2. Probar compra y cancelación Sandbox, saldo, desconexión y recuperación, y generación dentro del presupuesto autorizado. No se hizo una compra en este cambio.
3. Captura de revisión auténtica pendiente de la pantalla nativa final. Apple indica que el primer consumible requiere envío con nueva versión. No pulsar Añadir a revisión mientras Carteles sea privado.
4. Antes de venta pública: validación de producción, cartera separada y conciliación de reembolsos, revisión de financiación y costes, credenciales Apple/RevenueCat cuando sean necesarias. No asumir que los borradores son comprables o aprobados.

Pruebas visuales: outputs/purchases/apple-creditos-borradores.png y revenuecat-creditos.png en la raíz del proyecto padre.

## Build de pruebas solicitado

21 octubre 2026: lanzado build iOS 1.0.3 (21), perfil poster-sandbox, identificador fd9508e7-c52d-4139-af4e-2257320a3889. Entorno production de Expo para Supabase y flag EXPO_PUBLIC_POSTER_STORE_TESTING=true del perfil; acceso propietario y servidor Sandbox conservados. Excluidos reportes temporales del archivo de build.

Expo rechazó únicamente programar auto-submission con what-to-test/changelog porque requiere plan Enterprise. No se repitió la compilación: programado envío independiente del mismo build con perfil submit production, sin changelog. Submission cbcae1ec-d142-40d0-9474-227d4287ff22 aceptada por Expo. Último estado comprobado de build: IN_PROGRESS; envío pendiente de que termine. No equivale todavía a disponibilidad en TestFlight ni publicación App Store.

Build: https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/builds/fd9508e7-c52d-4139-af4e-2257320a3889
Submission: https://expo.dev/accounts/funkman_82/projects/dj-planner-pro/submissions/cbcae1ec-d142-40d0-9474-227d4287ff22
