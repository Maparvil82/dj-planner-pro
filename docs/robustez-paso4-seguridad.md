# Robustez: paso 4 — seguridad y permisos del backend

28 de octubre de 2026. Cambios aplicados en producción mediante `20261028154756_backend_privileged_boundaries.sql`.

## Resultado

El panel administrativo ya rechazaba a usuarios distintos del propietario. No se ha demostrado una filtración de información. Faltaba comprobar también que la cuenta administrativa siguiera existiendo y no estuviera en eliminación: se añade esa comprobación usando `account_private.active_user`.

La lógica privilegiada del panel se sitúa en `account_private.admin_dashboard_snapshot`, con identidad del propietario comprobada dentro de la función, búsqueda de esquemas vacía y ejecución denegada a anónimos y PUBLIC. La función pública conserva nombre, respuesta y permisos de llamada para el panel existente, y se ejecuta como el llamante. Su auxiliar privado sigue comprobando la autorización incluso cuando se llama directamente.

La confirmación de la bienvenida de Carteles sigue el mismo patrón: entrada pública con permisos del llamante y auxiliar privado con identidad obtenida de la sesión, comprobación de cuenta activa e inserción idempotente. No acepta un identificador de usuario suministrado por el cliente. Los usuarios no pueden insertar directamente en esa tabla. No se modifica el estado de las bienvenidas existentes.

Cambiar de esquema no sustituye la autorización: ambos auxiliares conservan sus comprobaciones internas. El panel conserva acceso a los mismos contadores e identificadores que necesita, sin añadir datos personales a la respuesta.

## Revisión y pruebas

- Las 36 tablas públicas inspeccionadas tienen RLS activado; no hay vistas públicas en el inventario revisado.
- Las políticas de sesiones, gastos, tareas, lugares y perfil restringen por propietario. Las políticas adicionales de bloqueos en invitaciones son RESTRICTIVE, no amplían el acceso.
- Las invitaciones permiten actualizar únicamente `status`; las notificaciones, únicamente `read_at`. Se conserva el filtro de participante/destinatario.
- Las tablas de créditos, compras y presupuesto no conceden lectura directa a anónimos ni usuarios autenticados. Las funciones de compra, regalo, recuperación y gestión de saldo inspeccionadas no son ejecutables por esos roles.
- 308 pruebas generales correctas. Prueba nueva con propietario, otra cuenta, anónimo, cuenta desactivada y propietario eliminado; llamada directa a auxiliares; denegación de lectura de Auth y de escritura de otra bienvenida; repetición idempotente; entradas públicas SECURITY INVOKER.
- Bases aisladas: pasan Comunidad/moderación/bloqueos, eliminación de cuentas/tokens antiguos, almacenamiento/documentos privados, acceso de personal de puerta y aislamiento de sesiones/estadísticas con 1.928 sesiones visibles.
- Servidor real, transacción revertida: propietario obtiene la estructura esperada; usuario normal y anónimo rechazados por el panel; anónimo rechazado por la bienvenida; confirmación de bienvenida funciona y se conserva una sola entrada. La transacción revertida evita consumir la bienvenida de la cuenta de prueba.
- El asesor posterior deja de mostrar los dos avisos SECURITY DEFINER públicos. Permanecen 28 avisos informativos de RLS sin políticas en tablas cerradas deliberadamente y el aviso de contraseñas filtradas.

## Pendientes y límites

La protección de contraseñas filtradas continúa desactivada. Este cambio de permisos no modifica configuración de Auth ni contrata planes. Referencia: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Las pruebas del servidor usan el rol real de base de datos y la identidad de sesión dentro de una transacción; no equivalen a una prueba completa por HTTP con inicio de sesión desde un dispositivo. Tampoco equivalen a una auditoría de penetración de todos los endpoints. No se modifican los buckets de imágenes por compatibilidad con versiones instaladas; su cierre sigue la secuencia documentada en `almacenamiento.md`.

No hay cambio de interfaz, migración de datos de usuarios ni necesidad de recompilar la app para este refuerzo. Evidencias y definiciones previas en `../outputs/robustez-paso4-seguridad/`. Para revertir, restaurar únicamente las definiciones públicas anteriores; no restaurar todo el repositorio ni borrar las tablas.

Referencias: https://supabase.com/docs/guides/database/functions y https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
