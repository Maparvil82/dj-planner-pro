# Resumen plegable en tarjetas de sesión

Las tarjetas de sesión tienen un acordeón bajo la información principal. Se mantiene desplegado inicialmente para conservar la vista existente. Ocultar detalles pliega importes parciales, gastos, preparación, invitados y acceso; Mostrar detalles los recupera. La variante de tarjeta sin cartel incluye en el bloque el resumen que ya estaba bajo su separador.

La cabecera de la tarjeta conserva la navegación y la pulsación larga. El botón del acordeón es independiente, tiene 52 px de altura mínima y expone el estado expandido. No abre el detalle. El contenido plegado se oculta a lectores de pantalla, pero sus consultas permanecen montadas para recibir actualizaciones. El control siempre se muestra, sin depender de mediciones de contenido: flecha de 22 px dentro de un círculo de 36 px. Cada tarjeta mantiene su propio estado.

Las etiquetas están traducidas en los siete idiomas de la app. No se cambian importes ni datos de sesión.

Verificación: acordeón, reducción/recuperación de altura, navegación y actualización de accesos al volver en Chrome a 390 px oscuro y 320 px claro. Se comprueba con importes, gastos, preparación, invitados y entradas. Seis pruebas de resúmenes e idiomas correctas; auditoría de 1852 claves coincidente en siete idiomas. TypeScript correcto.
