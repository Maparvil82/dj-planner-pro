# Imágenes de Comunidad · 16 de octubre de 2026

Cambios locales, disponibles en Expo Go y pendientes de publicación.

- Descubrir DJs y listar DJs seguidos inicia la preparación de avatar y portada de las primeras seis tarjetas antes de devolver los datos a la vista, sin bloquear la lista.
- Se solicitan enlaces temporales en un lote por bucket y se comparten las solicitudes pendientes con las tarjetas. Las descargas nativas empiezan al recibir los enlaces.
- Los componentes usan inmediatamente los enlaces válidos de memoria. No montan una imagen nativa vacía mientras esperan la firma.
- Caché limitada a 300 enlaces, reutilización durante cuatro minutos para enlaces de cinco minutos, limpieza al cambiar de cuenta y rechazo de respuestas de la cuenta anterior.
- Se mantiene la autorización existente de Storage. No se modifican permisos ni archivos de usuarios. Las imágenes externas conservan su URL original.

Validación: 184 pruebas aprobadas, incluidas agrupación, duplicados concurrentes, caducidad, aislamiento de cuentas, recuperación de fallos y precarga limitada a seis tarjetas. Comprobación de tipos correcta. Falta comparar el tiempo total desde entrar en Comunidad hasta ver avatar y portada en un iPhone con red real; los tiempos de descarga aislados no miden ese recorrido. No se garantiza una carga instantánea ni se da por confirmado el origen completo de la demora original.
