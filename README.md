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
