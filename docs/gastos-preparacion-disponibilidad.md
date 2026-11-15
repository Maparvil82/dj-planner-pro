# Gastos, preparación y días bloqueados

## Recorridos

- **+ → Gastos → sesión → Añadir gasto**. Sesiones propias futuras, pasadas o canceladas. Concepto, importe, fecha del gasto y foto opcional. Editar y eliminar con confirmación. Búsqueda por nombre, lugar o fecha.
- **+ → Preparación → sesión próxima o en curso → Añadir tarea**. Casillas para completar y contador de progreso. No se ofrecen sesiones terminadas ni canceladas para crear preparación; su lista sigue consultable desde el detalle.
- **Sesiones → calendario superior → seleccionar día → Bloquear día**. Desbloquear desde el mismo botón. Los bloqueos se ven en el calendario; no cancelan actuaciones existentes. Crear o cambiar fechas/horas comprueba días bloqueados y pide confirmación para continuar, incluyendo cada fecha de una serie y las sesiones que cruzan medianoche.
- Accesos a Gastos y Preparación desde el detalle propio de una sesión.
- Ninguna de estas funciones requiere Pro ni cuenta como una sesión adicional.

## Cuentas

- Moneda heredada de la sesión; no se mezclan monedas ni se convierten tipos de cambio. Los gastos antiguos siguen siendo EUR.
- Un gasto se imputa al periodo de **su fecha**, aunque esté asociado a una sesión de otro mes. El total de gastos de una sesión muestra sus gastos completos independientemente de fechas.
- El dashboard resta los gastos personales registrados en ese periodo. No es una contabilidad fiscal ni una integración bancaria: el usuario introduce los datos.
- En sesiones con acuerdo: **Ya descontado en el acuerdo** conserva el gasto y la factura, pero evita volver a descontarlo del balance. No se deduce automáticamente a partir de un nombre parecido; el usuario indica si es el mismo gasto. No registrar como propio un coste que paga la sala.
- Borrar una sesión **conserva sus gastos** como gastos sin sesión, consultables en Todos los gastos. La preparación desaparece con esa sesión. Bloquear un día no cambia pagos, aforos, listas ni acuerdos.
- Una sesión con gastos no puede cambiar de moneda para evitar reinterpretar cantidades existentes.

## Facturas

- Una foto por gasto; cámara o galería. Se conserva toda la imagen, sin recorte obligatorio.
- JPEG con lado largo máximo 1600 px. Compresión progresiva y rechazo si supera **600 KiB**. El bucket también impone ese límite y solo admite JPEG.
- Bucket privado `expense-receipts`. Carpeta por usuario. Lectura/subida/borrado por propietario mediante RLS. Visualización con enlace firmado de 5 minutos, nunca URL pública.
- Se usa el archivo redimensionado para los bytes de subida. Los archivos temporales generados en dispositivos nativos se eliminan tras leerlos.
- Sustituir/eliminar factura borra el objeto anterior tras guardar correctamente el gasto. Si falla el borrado del objeto, se avisa; puede quedar una foto privada huérfana que requiere limpieza. No se presenta el fallo como pérdida del gasto.
- No hay OCR, PDFs adjuntos, correo ni acceso de terceros.

## Persistencia

Migraciones aplicadas al proyecto Supabase `voyurnwckmateohuzbab`:

1. `session_expenses_preparation_blocked_days`: vínculo de gastos, moneda, ruta privada; tablas `session_tasks` y `blocked_days`; bucket y permisos.
2. `expense_agreement_accounting`: marca de gasto ya descontado.
3. `expense_owner_index_and_policies`: índice de consulta por usuario/fecha y políticas de gastos con propietario y roles explícitos.

Verificado en el proyecto real: columnas, RLS, permisos, bucket privado y máximo de 614400 bytes. No se han creado datos ficticios en cuentas reales.

## Verificación

- `npm run typecheck`.
- Exportación de producción completada para web, iOS y Android (Hermes).
- `node tests/sessionToolsDatabase.cjs`: PostgreSQL aislado, permisos entre usuarios/anon, gastos de sesiones pasadas, restricciones de moneda e importe, tareas futuras, objetos privados y borrado aislado.
- `node --test tests/blockedDays.test.cjs tests/dashboardMetrics.test.cjs`: recurrencias, medianoche, monedas, periodos y descuentos duplicados.
- `tests/browser/sessionTools.cjs`: ocho accesos, gasto en sesión pasada, edición decimal, tarea y progreso, bloquear/desbloquear día, subida real de una imagen de prueba redimensionada, respuesta de guardado perdida sin borrar su factura y confirmación de una sesión en un día bloqueado. Peticiones de Supabase interceptadas; no se modifican usuarios reales.
- Foto de prueba 3000 × 2000 → 1600 × 1067; JPEG enviado de 21607 bytes.
- Revisión visual a 390 px. Cámara física, teclado iOS/Android y encuadre de fotos reales deben comprobarse en dispositivo. Expo es desarrollo; los permisos de cámara/galería están configurados también para las apps de producción.
- Asesores Supabase: sin nuevas advertencias de seguridad. Índices nuevos aún sin uso esperado antes de tráfico real; avisos heredados de otras tablas siguen fuera de este cambio. Referencia: [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
