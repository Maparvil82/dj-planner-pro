# Carteles: prueba privada dentro de la app oficial

Por autorización expresa del propietario, se sustituye el laboratorio independiente por una integración en dj-planner-pro. No publicar ni abrir a todos sin nueva autorización.

Acceso: cuenta confirmada maparvil@gmail.com, UUID d5d17646-f273-4fda-b094-ea8a97cb3ad1 verificado en Auth. El menú + y la ruta /carteles requieren usePosterPreviewAccess, que valida el usuario contra Auth.getUser. Fallo de validación o cuenta distinta: sin acceso.

Sesiones: se utiliza useAllSessionsQuery y se seleccionan solo las propias. Lectura mediante los servicios y políticas existentes. No se escribe en sesiones ni se publica contenido comunitario. Explorar sigue siendo una galería ficticia identificada. Borradores solo en memoria, fotos locales y API IA desconectada.

Este control restringe la interfaz estándar; no vuelve secreto el código incluido en la app. Antes de implementar generación, créditos, guardado o compartición se debe aplicar autorización equivalente en servidor/RLS a cada operación. No habilitar una API de pago protegida solo por el cliente.

Expo: abrir el proyecto oficial, no puertos 8095/8096 de los laboratorios anteriores. No se ha publicado una build ni desplegado cambios de base de datos.

## Alcance beta
Solo sesiones propias guardadas, no canceladas y con inicio futuro según su zona horaria. Se revalida al continuar y crear vista previa. Crear desde cero queda deshabilitado con Próximamente. No se seleccionan ni muestran fotos de DJs; se usan sus nombres. La beta sigue restringida a la cuenta del propietario y sin API de pago.
