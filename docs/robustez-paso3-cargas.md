# Robustez: paso 3 — carga de Inicio, Historial y Estadísticas

28 de octubre de 2026. Autorización del propietario: «sigamos» y «sigue».

## Cambio preparado

Estas tres pantallas dejan de descargar todas las sesiones históricas al abrirse. El backend está desplegado; el cambio de interfaz está disponible en el proyecto de Expo. La versión de App Store lo incorporará con la próxima publicación.

- Inicio consulta el mes actual, las semanas próximas a la que se está viendo y las siguientes 30 sesiones. La presencia de una sesión en directo y la comprobación de series al borrar también usan consultas limitadas.
- Historial consulta páginas de 50 sesiones y dibuja solo las tarjetas cercanas a la pantalla. La búsqueda y los filtros se aplican antes de paginar, incluyendo fechas finales inclusivas, títulos traducidos e importes. El calendario recibe sus marcas por separado para que no desaparezcan días con sesiones que todavía no se han cargado. El aviso al bloquear un día contempla la noche anterior y sigue funcionando con filtros activos.
- Estadísticas consulta el periodo seleccionado, su comparación y las ventanas necesarias para las gráficas. Las primeras visitas a lugares, monedas y cobros antiguos pendientes se resumen en el servidor. La próxima sesión se busca incluso si está a años de distancia; se ordena por su instante real cuando hay distintas zonas horarias. Los gastos vinculados se incluyen aunque su fecha quede fuera del periodo de la sesión.
- Las tarjetas comparten resúmenes de gastos y tareas en lotes de hasta 50 identificadores. El detalle consulta únicamente los gastos de esa sesión. Se mantiene la invalidación de caché después de editar tareas, sesiones o gastos, y se separa la caché por cuenta.
- Los errores de conexión se distinguen de una agenda vacía. La búsqueda conserva el campo abierto mientras carga y las actualizaciones periódicas de Estadísticas no sustituyen toda la pantalla por un indicador de carga. Las páginas de un detalle de cobros comparten un instante de referencia.

Las pantallas independientes de todas las tareas y todos los gastos conservan su funcionamiento anterior; su optimización adicional queda fuera de esta iteración.

## Backend y compatibilidad

Migraciones aplicadas y sincronizadas con los nombres locales:

- `20261028105317_session_screen_queries.sql`.
- `20261028105909_session_card_rounding.sql`: conserva el redondeo a céntimos que hacía el cliente para cada gasto, también con más de dos decimales.

Se añaden seis funciones públicas de lectura, todas `SECURITY INVOKER`, estables, con `search_path` vacío y ejecución denegada a anónimos. Los auxiliares privados que necesitan leer invitaciones comprueban la identidad del token y que la cuenta siga activa. Solo incluyen invitaciones aceptadas cuyo propietario coincide con el invitador. Su proyección excluye notas, pagos, acuerdos económicos y otros campos privados. Los parámetros de usuario no se interpolan en SQL.

Se reutilizan los índices existentes. Las funciones antiguas siguen disponibles para las versiones instaladas. La comparación antes y después confirma idénticos contenidos de las 230 sesiones, 6 gastos y 4 tareas presentes en ese momento; tampoco cambian las políticas RLS ni la función anterior de agenda. Las advertencias de seguridad preexistentes siguen siendo las mismas: [función administrativa con permiso de ejecución](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) y [protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Evidencia

- 294 pruebas generales correctas y TypeScript correcto.
- Prueba de base de datos con 1.928 sesiones visibles: páginas sin pérdidas ni duplicados, filtros, marcas del calendario, privacidad de invitados, aislamiento de cuentas, denegación a anónimos y cuentas en eliminación, cobros por antigüedad y gastos vinculados. Los cálculos de Estadísticas coinciden con la carga completa anterior para meses actuales, años y periodos históricos. Incluye el redondeo de un gasto de 1,005.
- Cinco pruebas de cliente cubren paginación, errores, lotes de tarjetas, reutilización de caché, cambio de cuenta y una próxima sesión lejana en zonas horarias diferentes.
- PostgreSQL nativo de Supabase, en un contenedor temporal aislado: 110.000 sesiones y 110.000 gastos. Primera página alrededor de 4 ms; resumen estadístico de una cuenta con 11.000 sesiones alrededor de 208 ms. Ocho lectores simultáneos de cuentas distintas terminan correctamente y sin mezclar datos, en unos 350 ms incluyendo los procesos del banco de pruebas. Estas medidas locales no equivalen a una garantía de capacidad ni al tiempo total de carga en un iPhone.
- Backend real: una cuenta conserva las mismas 47 sesiones y recuentos; otra coincide en resúmenes de tareas y gastos. Las seis funciones rechazan llamadas anónimas a través de la API real con HTTP 401 y código 42501.
- Expo compila el paquete iOS. La comprobación visual con una cuenta iniciada en un iPhone queda pendiente del propietario.

Pruebas reproducibles: `npm test`, `npm run typecheck` y `TZ=Europe/Madrid node tests/sessionScreensDatabase.cjs`. Evidencias adicionales y copia de los archivos anteriores: `outputs/robustez-paso3-cargas/` en el espacio padre del repositorio.

## Comprobación en Expo Go

1. Recargar el proyecto. En Inicio, cambiar de semana y comprobar los importes del mes y las próximas sesiones.
2. En Historial, buscar una sesión antigua; alternar calendario y lista y probar los filtros. Con más de 50 resultados, seguir bajando para cargar la siguiente página.
3. En Estadísticas, alternar mes y año, consultar un periodo anterior y comprobar ingresos, gastos y cobros pendientes. Revisar también una tarjeta con tareas o gastos y confirmar que se actualiza después de editarlos.

No pasar al siguiente arreglo hasta recoger esta comprobación visual. Para volver atrás, restaurar únicamente los archivos de este paso desde la copia previa; las funciones nuevas pueden quedar sin utilizar. No restaurar todo Git ni revertir datos: existen numerosos cambios anteriores ajenos a esta iteración.


## Corrección tras la prueba del propietario: Calendario y Lugares

El propietario informó de pantalla blanca y retorno a Sesiones al abrir Historial/Calendario y Lugares. Se reprodujo la redirección con las funciones reales de navegación del Expo Router 58.0.27 instalado: `href: null` se convierte en `hidden: true`, y el navegador redirige una ruta así oculta a la primera pestaña accesible. No era un fallo de la consulta de sesiones o lugares.

Se mantienen registradas las rutas `history`, `venues` y el acceso secundario `account`, ocultando únicamente el botón y su espacio en la barra inferior. Documentos sigue desactivado y se mantiene el acceso condicionado al inicio de sesión. No se modifican datos, permisos del backend ni dependencias.

Cinco pruebas de regresión verifican la configuración de la app contra el procesador y el control de rutas del SDK instalado. Antes del cambio fallan los tres accesos secundarios; después pasan los cinco casos. Pasan las 299 pruebas generales, TypeScript y la compilación iOS. Copia previa de la navegación y evidencias: `antes-navegacion/`, `tests-navegacion.txt` y `typecheck-navegacion.txt` en la carpeta de evidencias de este paso. La comprobación final en el iPhone del propietario sigue pendiente.
