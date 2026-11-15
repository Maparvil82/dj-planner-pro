Actualización 27 octubre 2026: créditos automáticos al entrar en Carteles, sin botón de reclamar. Error de abono corregido y servicio v30 publicado; ver `carteles-creditos-automaticos.md`. Lo que sigue conserva el estado anterior.

Actualización 27 octubre 2026, campaña activada: 3 créditos Gratis / 5 Pro de pago verificado, regalo único y techo global de 250 EUR. Ver `carteles-bienvenida-3-5.md`. Las notas inferiores describen el estado anterior a esta activación.

# Carteles: acceso general al creador

27 de octubre de 2026. El propietario autoriza retirar la restricción de acceso por cuenta.

## Activado en producción

`poster_commerce_settings.public_enabled=true` permite acceder a todas las cuentas activas con correo confirmado, también a cuentas nuevas. La consulta de navegación ya existente `poster_feature_access()` habilita el creador; el servidor continúa verificando identidad, saldo y propiedad de sesiones, trabajos y archivos en cada operación. No se cambiaron funciones, permisos RLS ni la versión 29 del generador.

Antes de activar se preservó mediante una excepción explícita en `poster_commerce_access` el modo de simulación de la identidad que contiene el presupuesto histórico. Se obtiene su identificador del registro existente, sin aceptar identidades del cliente. Así el cambio del valor general no convierte su saldo de prueba en saldo comercial ni hace desaparecer sus créditos. No se otorgaron saldos a otras cuentas.

Verificación remota: 50 de 50 cuentas activas y confirmadas admitidas por el modelo de acceso. La RPC pública devuelve true ejecutada con el rol authenticated y la identidad temporal de una cuenta normal; la comprobación se realiza en una transacción de solo lectura terminada con ROLLBACK, sin crear sesiones ni tokens de usuario.

## Créditos y límites

El acceso general no incluye por sí solo créditos. Las cuentas normales utilizan el modelo de producción y inicialmente tienen saldo cero. Compras y regalos siguen desactivados, con máximo promocional cero, y no se incrementa el presupuesto de IA: tope de 500 céntimos, 313 contabilizados y cero reservados al comprobarlo. La cuenta propietaria conserva su saldo de prueba separado.

Por tanto se ha abierto el creador para todos, pero **la generación desde una cuenta sin saldo todavía necesita una asignación de créditos autorizada o la posterior activación comercial**. No se presenta este paso como lanzamiento financiado ni como activación de ventas o de regalos. Queda pendiente concretar esa distribución y el presupuesto para que todas las cuentas puedan generar efectivamente.

## Cliente y pruebas

El permiso lo consulta el cliente al servidor: no requiere nueva compilación para las versiones que ya utilizan esa RPC. Reiniciar la app o recargar Expo Go vuelve a consultar el permiso. Las versiones antiguas con un bloqueo incorporado al binario necesitan actualizarse.

Se añade una prueba de base de datos aislada: cuentas existentes y nuevas, correo no confirmado, identidades inexistentes, excepción denegada, conservación del saldo de prueba y del techo global, imposibilidad de generar con saldo cero y rechazo del rol anónimo. El archivo de resultados y el estado previo están en `../outputs/carteles-acceso-general/` desde la raíz del repositorio.

Para cerrar el acceso general en caso de reversión, cambiar únicamente `public_enabled=false`. La excepción explícita del propietario puede conservarse: reproduce su permiso anterior. No modificar saldos, presupuestos ni otros interruptores al revertir el acceso.
