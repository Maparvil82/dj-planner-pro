# Rendimiento — 10 de octubre de 2026

## Estado

La optimización de la app está preparada en el código local. No es una actualización publicada en App Store ni Google Play.

La migración `20261010090326_query_performance.sql` está **aplicada en Supabase de producción** con el nombre `query_performance`. La revisión automática rechazó el primer intento; el usuario autorizó explícitamente su aplicación el 10 de octubre y el segundo intento terminó correctamente. La app conserva compatibilidad con la consulta anterior.

## Cambios de la app

- Caché de consultas durante 30 segundos por defecto. Las pestañas reutilizan datos recientes; actualizar manualmente y las invalidaciones tras acciones siguen disponibles.
- Un solo observador actualiza el contador de notificaciones cada 60 segundos. La bandeja y las invitaciones solo consultan periódicamente cuando su pantalla está visible. La app nativa suspende los intervalos en segundo plano mediante el gestor de foco.
- Los contadores de sesiones de DJs y los indicadores de mixes guardados se consultan en grupos estables de 20. Añadir una página no vuelve a consultar todos los elementos anteriores. Las claves incluyen el usuario para separar sus datos.
- Listas virtualizadas en DJs, actividad, sesiones adicionales, carruseles y notificaciones. Se conserva la paginación y un solo reproductor activo en la actividad.
- El calendario semanal agrupa las sesiones una vez por fecha, en lugar de filtrar todo el historial para cada día mostrado.
- Agenda de colaboraciones por rango de fechas y páginas de 1.000. La compatibilidad con el servidor anterior solo se activa si falta la función, nunca ante un error de permisos o red.
- Se eliminaron nodos de texto sueltos en los pies de lista que generaban avisos de React Native y tapaban botones durante el desarrollo.

## Cambios activados en la base de datos

- Índice compuesto de sesiones por propietario, fecha e identificador y los índices de claves relacionadas que faltaban.
- Evaluación de identidad una vez por consulta en las políticas de propietario, manteniendo la comprobación de propietario al leer y escribir. Se eliminan únicamente tres políticas de perfil duplicadas conocidas. No se desactiva la seguridad por fila.
- Consulta de agenda de invitaciones aceptadas, limitada a la identidad autenticada, con rango de fechas, paginación y proyección sin importes ni datos financieros privados. La función anterior se conserva para versiones anteriores de la app.
- No se borran datos ni índices existentes.

## Verificación

- 123 pruebas unitarias aprobadas.
- Comprobación de tipos y revisión de espacios del diff aprobadas.
- Prueba de base de datos aislada con 100.003 sesiones: mismas sesiones visibles antes y después, índice compuesto utilizado y evaluación de identidad mediante InitPlan. Se comprueban acceso anónimo, identidad ajena, escritura y agenda aceptada sin datos financieros. Una consulta del escenario aislado pasó de aproximadamente 7 ms a 0,2 ms; este resultado no es una medida de capacidad de producción.
- Prueba de interfaz con servicios simulados: 80 DJs paginados, cuatro consultas de contadores de 20 sin repetir identificadores, retorno a una pestaña reciente sin volver a consultar sus páginas y menos tarjetas montadas que datos cargados. También verifica paginación virtualizada de 80 notificaciones.
- Prueba funcional de Comunidad a 320 px aprobada: filtros, seguir/dejar de seguir, actividad, guardar y recuperar mixes, reproducción y navegación del menú.
- Producción: 209 sesiones antes y después; índice compuesto válido y tres políticas de perfil sin duplicados. Con el rol autenticado, una cuenta ve las 47 sesiones esperadas y cero de otros propietarios; el rol anónimo ve cero. La nueva consulta de agenda se ejecuta correctamente y no admite ejecución anónima. El escenario real comprobado no tenía invitaciones aceptadas, por lo que la proyección con datos se verifica en la base aislada.
- El asesor de rendimiento ya no informa de claves relacionadas sin índice, evaluaciones repetidas de identidad ni políticas permisivas duplicadas. Solo informa de índices aún sin uso registrado: se conservan porque varias funciones son nuevas y el volumen actual es pequeño. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- La revisión de seguridad no añade avisos nuevos. Sigue pendiente la protección contra contraseñas filtradas, ya desactivada antes de esta migración: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Las tablas de esquemas privados sin políticas permanecen cerradas deliberadamente al acceso directo.

## Pendientes y límites

- Verificación final en dispositivos iOS y Android y distribución de la nueva versión.
- Medir carga concurrente sobre una copia representativa y con un objetivo concreto de usuarios activos. Los tests aislados y servicios simulados no garantizan capacidad para una cifra de visitas.
- Las listas de seguimiento aún cargan los identificadores seguidos por páginas. La búsqueda social y algunas consultas usan paginación por desplazamiento; si su volumen crece considerablemente, medirlas y migrar a cursores donde sea necesario.

No se despliega una versión web ni se configura Vercel para estos cambios.
