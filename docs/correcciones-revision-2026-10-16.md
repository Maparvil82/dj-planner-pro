# Correcciones de la revisión del 16 de octubre de 2026

## Cambios

- La navegación raíz espera tanto la restauración de la sesión como la hidratación del almacenamiento antes de montar las pantallas. Así, las comprobaciones de acceso no envían prematuramente al login al abrir o recargar el detalle, la creación o la edición de sesiones. Los usuarios sin sesión siguen pasando por el acceso.
- El destino validado de un perfil compartido (`dj`, UUID) se conserva en el acceso, recuperación, enlace de correo, reintento de un enlace caducado y retorno tras cambiar la contraseña. Al consumir un enlace de recuperación se eliminan sus credenciales del historial y solo se conserva el destino validado.
- La etiqueta de zona horaria obtiene el desplazamiento de los componentes numéricos de la fecha en la zona elegida. Ya no depende de `shortOffset`, que mostraba GMT sin desplazamiento en el simulador. Contempla cambios de horario estacional y desplazamientos con fracciones de hora.
- Los formularios de creación/edición y el detalle reservan espacio para el teclado de iOS. El campo de notas desplaza el contenido para dejar visible todo el campo al enfocar, abrir el teclado o cambiar la selección. Compensa la posición de la vista bajo la cabecera y la zona segura; las suscripciones y animaciones pendientes se limpian al desmontar.
- El menú de cuenta toma los márgenes seguros del contenedor principal y los aplica explícitamente dentro del modal. El cierre queda por debajo de la barra de estado y el pie conserva el margen inferior.

## Verificación

- `npm run typecheck`: correcto.
- `npm test`: 181 pruebas correctas.
- `tests/timezoneOffset.test.cjs`: Madrid antes/después de cambios estacionales, UTC, Nueva York, India, Nepal, Terranova, Auckland/Chatham y borradores inválidos.
- `tests/browser/navigationRecovery.cjs`: apertura directa y recarga de detalle/creación/edición a 320 y 390 px; acceso sin sesión protegido; conservación del perfil compartido en recuperación, correo, vuelta, reintento y cambio de contraseña simulado; limpieza de credenciales de la URL.
- Regresión de notas y de cuenta/ajustes: correctas a 320/390 px y en los temas e idiomas cubiertos por sus recorridos.
- Perfil ficticio: bienvenida, cancelación de configuración incompleta, publicación explícita, edición de ciudad y regreso al perfil; correcto. Se actualizaron los selectores antiguos y el estado de consentimiento de la cuenta de prueba. Esta comprobación se centró en publicación/edición, sin repetir la reproducción de todos los proveedores de mixes.
- Simulador iPhone 16 Pro, iOS 18.5, Expo Go: Madrid muestra GMT+2 para el 16/10/2026; la cuarta línea y el cursor de notas permanecen por encima del teclado; el botón de cierre del menú queda debajo de los iconos del sistema.

Las pruebas de recuperación usan servicios simulados: no envían correos ni cambian contraseñas reales. Las comprobaciones nativas usan un borrador sin guardar. No hay cambios de base de datos ni de suscripción.

Las capturas están en `../outputs/DJPlannerPro/fixed-ios-notes-keyboard.png` y `../outputs/DJPlannerPro/fixed-ios-account-close.png`, relativas a la raíz del repositorio.
