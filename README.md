# DJ Planner Pro

Aplicación Expo / React Native para organizar sesiones, locales, ingresos y documentos de DJs.

## Desarrollo

```sh
npm ci
npm start
```

La conexión usa `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Estas variables son públicas en la aplicación; nunca deben contener una clave `service_role`.

El proyecto usa Expo SDK 57. Para probar en un móvil con Expo Go compatible, ejecutar `npx expo start --go --lan` y escanear el QR desde la misma Wi-Fi. Las compras reales requieren una compilación de desarrollo o de tienda; Expo Go utiliza el modo de previsualización de RevenueCat. Las compilaciones de desarrollo anteriores a esta actualización deben regenerarse.

```sh
npm run typecheck
npm test
npm run web
```

## Gestión de sesiones y cobros

- El soporte de anticipos y cobros está preparado en la base de datos. Sus nuevas secciones están ocultas en Inicio y en el detalle de sesión por decisión de producto. Una sesión pasada no implica que esté pagada.
- Los totales de Inicio se muestran por moneda, sin conversión automática.
- Al crear o editar sesiones se comprueban los horarios cruzados, incluidas madrugadas, sesiones del día anterior y repeticiones. El DJ puede continuar después de revisar el aviso. Es una comprobación previa al guardado, no un bloqueo de concurrencia en la base de datos.
- Las repeticiones mensuales conservan el día original o el último día disponible del mes. Las series se guardan en una única transacción, hasta 500 sesiones por operación.
- Cada sesión puede exportarse como `.ics`, con un aviso dos horas antes. La aplicación de calendario debe importar el archivo y respetar sus avisos. Se conserva el horario local introducido; todavía no hay zona horaria específica por local ni sincronización automática de cambios posteriores.

## Dashboard y documentos

- Dashboard permite navegar por mes o año y elegir moneda para los importes. La actividad incluye todas las monedas, sin sumarlas financieramente.
- Los ingresos corresponden a honorarios acordados de sesiones confirmadas, no a cobros. Los pendientes se muestran aparte y las cancelaciones se excluyen de ingresos y horas.
- Incluye horas programadas y realizadas, media de sesiones remuneradas, media por hora, estado de agenda, locales frecuentes y acceso a pendientes y próxima sesión.
- El balance es una previsión: honorarios confirmados menos gastos del periodo. Los gastos históricos no tienen moneda y se tratan como EUR, igual que en la interfaz anterior; en otras monedas no se calcula balance.
- Los próximos 30 días cuentan sesiones que empiezan desde ahora, separando confirmadas y pendientes. Los patrones del periodo incluyen duración media, días activos, cancelaciones, remuneradas/gratuitas y mejor tarifa media por hora.
- Los locales habituales se calculan usando una actuación confirmada que ya hubiera terminado antes de la sesión analizada. Las tarifas sin importe se distinguen de las sesiones gratuitas.
- Ciudades agrupa la ciudad actual de cada local asociado (ID o nombre único), normalizando espacios, mayúsculas y tildes. Los nombres ambiguos o las ciudades ausentes no se adivinan; se indica qué sesiones requieren completar el local. Cada ciudad permite desplegar sus sesiones.
- La comparación utiliza el periodo anterior completo. El gráfico muestra seis meses hasta el mes elegido, o los doce meses del año seleccionado.
- Documentos permanece conservado bajo `FEATURES.documents = false`: se ocultan su pestaña y los bloques de sesiones/locales, sus rutas redirigen a Inicio y no se consultan carpetas. No se borran datos ni archivos.

## Supabase

Proyecto: `voyurnwckmateohuzbab`.

Las migraciones de `supabase/migrations/` están aplicadas en ese proyecto y sus versiones coinciden con el historial remoto. Son cambios incrementales sobre la base de datos existente. Los SQL sueltos de la raíz son referencias históricas; no deben volver a ejecutarse indiscriminadamente.

El historial registra estas mejoras sobre el proyecto existente; todavía no contiene una migración inicial para un proyecto vacío. Antes de crear otro entorno debe prepararse y validarse esa migración inicial con acceso al esquema de origen.

Los carteles y fotos de locales conservan su lectura pública; las escrituras se restringen al directorio del propietario. Las funciones internas de triggers no tienen permisos de ejecución para clientes. La eliminación de cuenta conserva permisos para usuarios autenticados y verifica `auth.uid()`.

`tests/database.sql` comprueba series, cobros, aislamiento entre propietarios y permisos de imágenes dentro de una transacción que termina en `ROLLBACK`. Debe ejecutarse con el propietario de la base de datos.

## Verificación y publicación

Las pruebas cubren horarios nocturnos, límites de repetición, fechas de fin de mes, cobros parciales, monedas y formato del calendario. La compilación de Expo para iOS y Android comprueba los bundles; no sustituye la prueba en un dispositivo real.

Antes de publicar la siguiente versión en las tiendas, comprobar en iPhone y Android la importación del `.ics`, el teclado decimal, la restauración de sesión y el guardado de cobros. La política de privacidad de la ficha de App Store también necesita una URL real.

## Próximas mejoras de producto

1. Preparación del evento: contacto del promotor, dirección, notas, rider y lista de equipo.
2. Presupuestos y resumen de la sesión en PDF, con anticipos y saldo restante.
3. Respaldo/exportación de datos y un entorno de pruebas reproducible con migración inicial.
4. Finanzas del dashboard por moneda y gastos vinculados a cada sesión.
5. Revisión de documentos privados, rendimiento de políticas e índices y protección frente a contraseñas filtradas en Supabase Auth.

## Estados y formularios de sesiones

- La reserva se marca como pendiente de confirmar, confirmada o cancelada. Las sesiones nuevas empiezan pendientes y el DJ puede confirmarlas al crear; las existentes conservan su estado.
- «En curso» y «Finalizada» se calculan a partir del horario local para sesiones confirmadas. No certifican que la actuación se haya realizado ni que se haya cobrado. Inicio y Dashboard excluyen cancelaciones y separan honorarios confirmados de propuestas.
- Crear y editar comparten validación de fechas, horarios, importes positivos con hasta dos decimales y participantes de sesiones colectivas. La duración y el caché total se muestran antes de guardar; las madrugadas terminan al día siguiente.
- Editar permite guardar solo esta sesión o esta y las siguientes de su serie real. Cambiar la fecha solo afecta a la sesión elegida. El título no determina qué sesiones se modifican. Solo se guardan los campos cambiados y cada actualización se filtra por propietario.
- Editar no reinicia el formulario cuando llegan datos actualizados. Abrir el local conserva su vínculo; modificar su texto lo desvincula. Quitar un cartel no borra anticipadamente el archivo compartido por otras sesiones. Los archivos sin referencias quedan pendientes de una futura limpieza de almacenamiento.

## Detalle de lugares

- El alta y la edición de lugares siguen siendo manuales, sin integración con Google Places. El detalle utiliza las tarjetas y cabecera compartidas con los formularios de sesiones: datos, ubicación, cabina/aforo, valoraciones, notas y fotos.
- Los cambios válidos se guardan automáticamente después de un segundo. Solo se envían campos modificados; las respuestas y recargas de datos no sustituyen los cambios posteriores del usuario. Si falla el guardado se ofrece reintentar. El cierre desde la cabecera espera a guardar los cambios válidos.
- Aforo vacío y valoraciones desmarcadas se guardan como `null`. Aforo y cantidades de equipo se validan como enteros; las cantidades deben ser mayores que cero. Quitar fotos elimina su referencia al guardar, sin borrar archivos anticipadamente. Los archivos sin referencias quedan pendientes de limpieza futura.
