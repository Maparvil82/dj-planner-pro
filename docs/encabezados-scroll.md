# Encabezados al desplazarse

Todos los encabezados de navegación, con o sin iconos, se ocultan completamente al primer movimiento hacia abajo y reaparecen completos al primer movimiento hacia arriba, incluso lejos del inicio de la pantalla. Los cambios usan una transición suave de 240 ms. El menú inferior responde a la misma dirección con una transición de 240 ms. Detener el scroll no cambia el estado de ninguno.

La detección compara los desplazamientos dentro de los límites actuales para no confundir la reducción del encabezado con un gesto. El rebote nativo al final tampoco muestra los menús: se ignora su recuperación hasta el inicio de un nuevo gesto. Cada ScrollView o FlatList conecta su inicio de arrastre y su inicio táctil a este controlador.

Los formularios emergentes tienen un controlador independiente. Las cabeceras que forman parte del contenido de una portada siguen desplazándose con ese contenido.

Validación: pruebas del controlador, pruebas de encabezados y comprobación en navegador de Sesiones a 320/390 px y Dashboard, incluyendo ocultación al primer píxel, parada, final y restauración al subir un píxel.

Las alturas y los desplazamientos se animan con Reanimated en el hilo de interfaz nativo. La curva acelera y frena progresivamente; el contenido del encabezado recorre solo 12 px para conservar su visibilidad durante la transición. El menú inferior recorre su altura real.
