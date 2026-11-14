# Carteles: formato y galerías — 28 octubre 2026

Solicitud del propietario: retirar la descripción libre de la creación, mostrar todos los carteles creados en Explorar y solo los propios en Mis carteles.

## Resultado

- Paso 3: formato, resumen de sesión/fotos y coste. Eliminados el campo y el estado `creationText`; una creación envía instrucciones vacías. Las instrucciones para editar un cartel propio se mantienen.
- Explorar: todos los trabajos terminados que tienen imagen, independientemente de `is_published`, incluida la historia existente. Los fallidos y los que siguen generándose quedan fuera. La respuesta contiene solo ID, formulario del cartel e imagen temporal; no instrucciones, uso, ID del creador ni datos de compra. El paso de creación avisa de que el resultado aparecerá en ambas galerías.
- Mis carteles: el servidor filtra siempre por el usuario del token, en cada página. Obtener o modificar otro trabajo sigue rechazado. Al cambiar de cuenta se limpia la galería, la vista previa y el saldo antes de pintar; una generación iniciada en la cuenta anterior no puede actualizar la cuenta nueva.
- Carga de ambas galerías independiente: un fallo de Explorar no impide actualizar los propios carteles.
- Páginas de 30, cursor validado por fecha e ID y botón «Ver más carteles». Orden estable incluso con fechas idénticas; los nuevos carteles no desplazan las páginas ya recorridas. Firma de imágenes de Explorar en una sola petición por página.

## Publicación y evidencia

Migración `20261027234855_poster_gallery_all_completed.sql` aplicada: índice parcial para trabajos terminados con imagen. RLS, privilegios y bucket privado conservados.

`poster-ai` v32 ACTIVE, JWT obligatorio. Leídos después del despliegue los 27 archivos: coincidencia exacta con lo enviado. La base de datos contiene 17 imágenes terminadas de 2 cuentas; antes solo 1 estaba marcada como publicada manualmente. No se alteraron los trabajos ni se generaron imágenes para esta corrección.

273 pruebas correctas, incluidas 15 del manejador: galería conjunta, respuesta sin campos privados, exclusión de fallos/sin imagen, autenticación, aislamiento por cuenta en todas las páginas, rechazo de identificadores ajenos, 75 resultados con fechas iguales e inserción entre páginas, cursores malformados. TypeScript, Deno y JSX correctos. Compilación de Expo para iOS correcta (25.672.932 bytes). La revisión visual autenticada no se hizo: el navegador local abrió la pantalla de inicio de sesión; no se inició sesión ni se generaron carteles. Pendiente comprobar visualmente en el iPhone tras recargar Expo Go.

Asesor de seguridad sin avisos nuevos respecto al inicio. Los avisos existentes sobre `admin_dashboard_snapshot` y protección de contraseñas quedan fuera de este cambio.

Respaldos y comprobaciones en `outputs/carteles-galerias/` del espacio padre. Precios, regalos y presupuesto de generación conservados.
