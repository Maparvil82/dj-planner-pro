# Encabezados al desplazarse

> **Decisión vigente (15 de noviembre de 2026): los encabezados y el menú inferior se quedan fijos.** La animación al desplazarse no era fluida y confundía, así que se retiró. `useScrollHeader` mantiene su interfaz (`progress`, `onScroll`, `onScrollBeginDrag`) para no tocar las pantallas, pero no anima nada, y ya ninguna pantalla usa `useTabBarScroll`. Las pruebas de `tests/scrollHeader.test.cjs` comprueban que el encabezado sigue expandido. Lo que sigue en este documento es el comportamiento anterior, conservado como historial.

Todos los encabezados de navegación, con o sin iconos, se ocultan completamente al primer movimiento hacia abajo y reaparecen completos al primer movimiento hacia arriba, incluso lejos del inicio de la pantalla. Los cambios usan una transición suave de 240 ms. El menú inferior responde a la misma dirección con una transición de 240 ms. Detener el scroll no cambia el estado de ninguno.

La detección compara los desplazamientos dentro de los límites actuales para no confundir la reducción del encabezado con un gesto. El rebote nativo al final tampoco muestra los menús: se ignora su recuperación hasta el inicio de un nuevo gesto. Cada ScrollView o FlatList conecta su inicio de arrastre y su inicio táctil a este controlador.

Los formularios emergentes tienen un controlador independiente. Las cabeceras que forman parte del contenido de una portada siguen desplazándose con ese contenido.

Validación: pruebas del controlador, pruebas de encabezados y comprobación en navegador de Sesiones a 320/390 px y Dashboard, incluyendo ocultación al primer píxel, parada, final y restauración al subir un píxel.

Las alturas y los desplazamientos se animan con Reanimated en el hilo de interfaz nativo. La curva acelera y frena progresivamente; el contenido del encabezado recorre solo 12 px para conservar su visibilidad durante la transición. El menú inferior recorre su altura real.

## Restauración del scroll — 24 octubre 2026

Los accesos superiores a lugares se muestran solo en Sesiones; se retiran de Comunidad y Dashboard. El acceso superior al calendario ya pertenece únicamente a Sesiones.

Se restaura el seguimiento compartido de dirección para cabecera y menú inferior: primer píxel hacia abajo oculta; primer píxel hacia arriba muestra. Se conserva la protección contra rebotes, cambios del rango visible y eventos de pantallas sin foco. La animación solo se reinicia al cambiar de dirección. Las páginas sin recorrido mantienen la navegación visible.

Validación: 10 pruebas de dirección, primer píxel, rebote y foco correctas; comprobación TypeScript correcta.

Comprobación visual en Chrome con datos ficticios correcta: Sesiones a 320 y 390 px, temas claro/oscuro y Dashboard. Se verifica primer píxel en ambos sentidos, animación intermedia, pausa, final de lista y navegación a Lugares. Dashboard sin acceso superior a Lugares. Las fechas de las sesiones de prueba ahora se calculan para el día siguiente y evitan caducar.
