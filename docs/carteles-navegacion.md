# Carteles en la navegación principal

23 octubre 2026. Cambio de interfaz pendiente de una nueva compilación: la 1.0.4 (25) ya se había subido antes de estos ajustes.

- Carteles sustituye al avatar como quinta entrada del menú inferior. La ruta se mueve al grupo `(tabs)`, manteniendo `/carteles` para enlaces y notificaciones. No se duplica en el menú lateral; `/account` se conserva como ruta oculta.
- El avatar abre el menú lateral desde la cabecera, a la derecha de Lugares, en Sesiones, Estadísticas, Comunidad y Carteles. Muestra etiqueta PRO según el estado de suscripción existente. Comunidad conserva cabecera incluso con perfil incompleto o error de carga.
- Carteles usa la cabecera compartida, el área segura superior, márgenes y fondo del resto de pantallas principales. El campo de cambios se coloca por encima del menú inferior.
- Comunidad y Carteles usan el mismo `SegmentedTabs`, con los colores, tipografía, forma y selección de Comunidad. Se conservan Plantilla, Explorar y Mis carteles, las plantillas en dos columnas y los carteles propios en tres.
- La entrada y las muestras son visibles para todas las cuentas autenticadas. El permiso del servidor sigue controlando generar, editar, consultar carteles y comprar. Las cuentas sin permiso pueden ampliar las muestras y ven Próximamente en sus galerías; no se invocan endpoints restringidos ni se presentan compras simuladas a esas cuentas.

No se cambian interruptores de acceso público del servidor, compras, promociones, presupuestos ni proveedor de IA. No se despliega ningún cambio de servidor.

Validación: TypeScript y 240 pruebas automatizadas correctas; exportaciones web e iOS correctas; revisión local a 390 px con cuentas ficticias gratuita y Pro, sin compras ni generación de imágenes. Comparación en navegador confirma los mismos colores, relleno, radios, tipografía y selección en ambos selectores; avatar abre el menú y la barra permanece accesible al desplazar.

Intento de compilación iOS: EAS incrementó de 25 a 26 y recibió el archivo, pero rechazó crear el build por agotamiento de cuota gratuita iOS. No se ha creado submission para esta interfaz ni contratado plan alguno. La consulta posterior sigue mostrando 1.0.4 (25) como último build terminado; ese build no contiene estos cambios. Expo indicó reinicio de cuota el 1 de noviembre de 2026. El Mac dispone de Fastlane, CocoaPods y Xcode 16.4, insuficiente para los requisitos de subida actuales de Apple (Xcode 26 o posterior). La alternativa local exige actualizar Xcode; no se ha instalado ni aceptado ninguna licencia.

Referencia de Apple: https://developer.apple.com/news/upcoming-requirements/?id=04282026a
