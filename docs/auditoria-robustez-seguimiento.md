# Seguimiento de la auditoría original

Actualizado el 28 de octubre de 2026. Prioridades recuperadas de la conversación «Planifica campaña de valoraciones», conservadas en `auditoria-robustez-original-2026-10-27.md`. La numeración de la lista original no coincide con los pasos de implementación: no intercambiarlas.

| Punto original | Mejora | Estado |
|---|---|---|
| 1 | Copia compatible del cartel generado | Corregido y comprobado por el propietario. Paso 1. |
| 2 | Privacidad de imágenes | Preparado; pendiente de nueva versión compatible y comprobaciones de TestFlight, y después transición de depósitos públicos. Recordatorio del 1 de noviembre a las 10:00 ampliado. No cerrar antes. |
| 3 | Recuperación de generaciones interrumpidas | Corregido y comprobado. Paso 2. |
| 4 | Consultar por periodos y paginar | Inicio, Historial y Estadísticas corregidos y comprobados. Paso 3. Tareas y gastos independientes conservan sus consultas anteriores. |
| 5 | Virtualización de Historial | Incluida en el paso 3. |
| 6 | Distinguir conexión fallida de agenda vacía | Incluido en el paso 3 para Inicio e Historial. |
| 7 | Detección de errores y rendimiento en iPhone | Cuenta Sentry gratuita creada en UE, JavaScript activo y recepción comprobada desde el iPhone en Expo Go. Pendiente mapas/símbolos, alertas recibidas y validación nativa en TestFlight el 1 de noviembre. Ver `robustez-paso6-monitorizacion.md`. |
| 8 | Ampliar verificaciones antes de publicar | Parcial: se ampliaron pruebas de servidor, recuperación, imágenes, navegación, paginación y seguridad. Faltan flujos completos en dispositivos y comprobar tipado del backend y JavaScript de Carteles. |
| 9 | Contraseñas filtradas | Aplazado por decisión del propietario: Supabase Free, sin contratar Pro. |
| 10 | Dependencias vulnerables | Corregida la cadena de avisos altos de Zod con override limitado a Expo CLI. Queda un aviso bajo de deepmerge sin parche publicado, propagado a siete paquetes. Ver `robustez-paso5-dependencias.md`. |

Además se reforzaron los límites de funciones privilegiadas en `robustez-paso4-seguridad.md`. La función administrativa ya comprobaba al propietario; se añadió la condición de cuenta activa y se separaron entradas públicas y auxiliares privados.

La auditoría original también dejaba pendientes demostrar capacidad concurrente de toda la app y verificar copias de seguridad con restauración de prueba. La prueba local de ocho lectores y 110.000 sesiones del paso 3 aporta evidencia acotada y no reemplaza estas verificaciones operativas.

Copia y recuperación local comprobadas el 28 de octubre: 92 tablas, 1.988 filas, 77 políticas y 83 archivos. Pendientes copia externa, custodia separada de clave y recuperación completa de servicios/configuración. Ver `robustez-paso7-copias.md`. La capacidad concurrente global continúa pendiente.
