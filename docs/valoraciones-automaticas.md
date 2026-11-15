# Valoraciones automáticas en iPhone

27 de octubre de 2026.

Se añade expo-store-review y una petición nativa sin mensaje previo. El enlace manual de Ajustes mantiene el ID real 6760347919 corregido anteriormente.

Condiciones conservadoras: 7 días desde el primer uso registrado en este dispositivo y cuenta, actividad en 3 fechas locales distintas, al menos 2 eventos propios no cancelados (una serie recurrente cuenta como uno), y un guardado correcto durante el último minuto. La petición se intenta tras dos segundos en Inicio; se cancela al salir, pasar a segundo plano o abrir los paneles de ingresos. No se solicita mientras hay un evento en curso. Guardar desde edición también habilita el intento si después se vuelve a Inicio dentro del minuto.

El estado se almacena por cuenta en el dispositivo. No se reconstruye actividad histórica: el seguimiento empieza con esta versión. El plazo mínimo entre intentos es de 120 días y se exige un guardado posterior al intento anterior. Se registra el intento antes de llamar a Apple, incluso si Apple decide no mostrar la ventana. Los fallos de almacenamiento o del módulo no interrumpen el guardado del evento.

Verificación automatizada: tests/appReview.test.cjs cubre umbrales, guardado reciente, enfriamiento, aislamiento por cuenta, fechas sin duplicados, cancelación y solicitudes concurrentes. TypeScript comprueba la integración. La interfaz nativa requiere verificación en compilación de desarrollo en iPhone; no se muestra en TestFlight. La nueva dependencia nativa requiere una nueva compilación iOS y distribución para llegar a usuarios de App Store.
