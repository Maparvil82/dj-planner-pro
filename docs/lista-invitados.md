# Lista de invitados · v1

## Recorrido

`+ → Invitados → Sesión → Añadir invitado`. También desde el detalle de una sesión.
Solo aparecen sesiones propias y no canceladas. Si no existen, se ofrece crear una.
Nombre y apellidos (2–120 caracteres) y acompañantes (0–99). «Manuel Parra +3» son cuatro personas.
La búsqueda ignora mayúsculas y acentos. Un nombre coincidente muestra un aviso y permite guardar un homónimo.

La lista muestra personas previstas, dentro y pendientes. Tocar un invitado abre el control de acceso:
registrar una cantidad, deshacer la última entrada de una persona, editar y eliminar con confirmación.
No se puede reducir un grupo por debajo del número ya admitido ni eliminarlo mientras tenga personas dentro.

## Un único registro de acceso

Cada persona tiene una entrada gratuita interna en `event_tickets`, vinculada a su grupo.
El resumen de Entradas incluye estas personas y ofrece acceso a la lista. No se mezclan con la emisión ni
la lista de entradas normales. Escanear un token de este registro actualiza también la lista nominal;
la v1 no ofrece enviar QR de grupo ni invitaciones por correo.
Una entrada ordinaria ya emitida no se convierte automáticamente en un invitado nominal:
si se añade además el mismo asistente a la lista, son dos permisos diferentes. No hay identificación automática por nombre.

Los cambios se serializan por sesión. Registrar accesos usa un identificador de solicitud para evitar duplicados
al reintentar tras un fallo de conexión. Los cambios del nombre/cupo usan revisión para detectar ediciones simultáneas.
El contador se obtiene de las entradas individuales, también si hay accesos por QR.
Reducir el grupo cancela las entradas pendientes sobrantes; ampliarlo emite nuevas entradas, sin revalidar tokens cancelados.
Añadir invitados gratuitos no bloquea la moneda de la sesión; las entradas ordinarias mantienen su protección monetaria.

## Privacidad y límites

Lista privada del organizador, RLS, sin lectura anónima ni escrituras directas. RPC públicas con SECURITY INVOKER;
funciones internas protegidas por propietario en esquema privado. No se publica en Comunidad.
Requiere conexión. Sin roles para personal de puerta, sin importaciones, sin ventas ni envíos automáticos.
No se ha añadido una restricción Pro a esta primera versión.

## Verificación

- `npm run typecheck`.
- `node tests/guestListsDatabase.cjs`: propiedad, accesos parciales, idempotencia, sincronización QR,
  cupos, homónimos, edición concurrente, entradas ordinarias y eliminación aislada por sesión.
- `tests/browser/guests.cjs`: menú, selector, formulario, +3, acceso parcial, deshacer, editar, buscar,
  confirmar homónimo, eliminar y estado sin sesiones. Datos ficticios; sin escrituras de usuarios reales.
- Migraciones aplicadas al proyecto Supabase y permisos comprobados.
- Revisión React: hooks estables, claves por ID, lista virtualizada, bloqueo de doble envío, etiquetas accesibles,
  búsquedas y formularios sin llamadas de red por pulsación.

Los advisors no muestran advertencias nuevas de seguridad. El registro privado de idempotencia tiene RLS sin políticas
porque no se permite acceso directo: [referencia del aviso informativo](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
Los índices nuevos aún sin uso permanecen para las búsquedas y claves foráneas:
[referencia de índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
Las advertencias anteriores de Auth y otras tablas permanecen fuera de este cambio.

Pendiente de validación en iPhone/Android físico: teclado en el formulario, cierre del sheet y uso en puerta con dos dispositivos.
