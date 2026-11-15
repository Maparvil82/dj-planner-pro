# Auditoría original — 27 de octubre de 2026

Recuperada de la conversación «Planifica campaña de valoraciones». Conserva el diagnóstico y prioridades de aquella fecha; consultar `auditoria-robustez-seguimiento.md` para el estado actual.

**Mi valoración actual es 7/10.** La app conserva una base sólida de la auditoría anterior, pero las funciones nuevas han añadido algunos puntos que conviene resolver antes de aumentar mucho el número de usuarios.

**No he modificado código, configuración ni datos.** He revisado el frontend local, el backend real de Supabase, las funciones desplegadas, los avisos de seguridad y rendimiento y las pruebas existentes. La nota corresponde a ese conjunto; no he probado físicamente la versión instalada desde App Store.

| Área | Nota | Valoración |
|---|---:|---|
| Backend e integridad de datos | 8/10 | Buenos permisos y controles para operaciones simultáneas. |
| Seguridad y privacidad | 7/10 | Base protegida, con imágenes públicas y un ajuste de contraseñas pendiente. |
| Frontend y rendimiento | 7/10 | Hay caché y optimizaciones, pero algunas pantallas crecen demasiado con el historial. |
| Preparación para muchos usuarios | 6/10 | Buena base técnica; falta demostrar capacidad concurrente. |
| Recuperación y detección de fallos | 6/10 | Algunos fallos requieren intervención y falta visibilidad desde los dispositivos. |

La nota es un juicio técnico orientativo, no una certificación.

He comprobado que:

- **Pasan las 252 pruebas automatizadas** y la comprobación de tipos.
- Pasan las cinco baterías adicionales de base de datos: comunidad, eliminación de cuenta, almacenamiento, rendimiento y acceso de puerta.
- La prueba aislada con **100.003 sesiones** utiliza correctamente el índice previsto y conserva los permisos.
- Las **36 tablas públicas revisadas tienen protección por filas**.
- El asesor de rendimiento solo informa de índices sin uso registrado; actualmente no señala índices de relaciones que falten.
- La función administrativa que genera un aviso comprueba explícitamente la identidad del propietario. Ese aviso, por sí solo, no demuestra acceso indebido.
- Los registros de peticiones consultados de las últimas 24 horas muestran respuestas satisfactorias. Es una muestra de uso reducido.

Estos son los cambios que recomiendo, **en orden de importancia**. Los tres primeros deberían resolverse antes de ampliar el uso comercial de Carteles.

1. **Alta — Corregir la incompatibilidad entre los carteles generados y su almacenamiento.**

   **Comprobado en producción:** el generador acepta JPEG o PNG de hasta **10 MB**, pero después copia la imagen al depósito de sesiones, que solo admite **JPEG de hasta 1 MB**.

   Una imagen válida para el generador puede ser rechazada al guardarse, después de consumir la generación. Habría que preparar una copia compatible para la sesión y conservar el original por separado. No significa que todos los carteles estén fallando: los 16 trabajos completados consultados terminaron correctamente. El fallo depende del formato y del tamaño de la salida.

   Evidencia: [subida del cartel generado](/Users/manuelparravillar/.codex/.chatgpt-projects/g-p-69374a95d1c0819191f1e3b3484da212/dj-planner-pro/supabase/functions/poster-ai/index.ts:79).

2. **Alta — Completar la protección de las imágenes privadas.**

   **Comprobado en producción:** los depósitos de avatares, sesiones y lugares siguen siendo públicos. Quien obtiene un enlace público puede abrir la imagen, aunque la pantalla de la app exija iniciar sesión. Ese es el comportamiento de los [depósitos públicos de Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals).

   La transición ya estaba preparada, pero quedó pendiente por compatibilidad con versiones antiguas. Hay que publicar y comprobar primero la app que utiliza enlaces firmados y después cerrar los depósitos. Facturas y documentos ya son privados.

   Evidencia: [plan de almacenamiento y compatibilidad](/Users/manuelparravillar/.codex/.chatgpt-projects/g-p-69374a95d1c0819191f1e3b3484da212/dj-planner-pro/docs/almacenamiento.md).

3. **Alta — Añadir recuperación de generaciones interrumpidas.**

   El sistema impide generar otro cartel mientras existe uno en estado «en curso» o «resultado incierto». Es una protección útil contra cobros duplicados, pero **no he encontrado un proceso automático de reconciliación** que resuelva un trabajo abandonado.

   Una interrupción del servidor o un fallo al guardar puede dejar la cuenta bloqueada para nuevas generaciones. Habría que comprobar los trabajos antiguos, recuperar resultados existentes y resolver las reservas sin repetir ciegamente la llamada al proveedor. Actualmente no había trabajos bloqueados en los datos consultados.

   Evidencia: [bloqueo de nuevas generaciones](/Users/manuelparravillar/.codex/.chatgpt-projects/g-p-69374a95d1c0819191f1e3b3484da212/dj-planner-pro/supabase/migrations/20261023112033_poster_commerce_private.sql:233).

4. **Alta — Evitar descargar todo el historial para tareas habituales.**

   Inicio, Historial y Estadísticas utilizan consultas que pueden recuperar todas las sesiones. También hay cargas completas de gastos y de estados de tareas.

   Existe paginación técnica para superar el límite de cada petición, pero finalmente **todo termina en la memoria del teléfono**. Cuanto más tiempo lleve un usuario utilizando la app, mayor será el trabajo y la transferencia de datos.

   Recomiendo consultar por periodos, calcular los resúmenes en el servidor y cargar el historial progresivamente. Es la mejora principal para mantener la rapidez con cuentas grandes.

   Evidencia: [carga completa de sesiones](/Users/manuelparravillar/.codex/.chatgpt-projects/g-p-69374a95d1c0819191f1e3b3484da212/dj-planner-pro/src/services/sessions.ts:183).

5. **Media-alta — Hacer que Historial monte únicamente las tarjetas visibles.**

   La vista de lista construye todas las tarjetas dentro de una pantalla de desplazamiento. Con cientos o miles de sesiones puede consumir mucha memoria y provocar tirones.

   Habría que aplicar la virtualización que ya se utiliza en otras partes de la app. Esto complementa el punto anterior: reducir descargas y reducir elementos dibujados resuelven problemas distintos.

   Evidencia: [renderizado del Historial](/Users/manuelparravillar/.codex/.chatgpt-projects/g-p-69374a95d1c0819191f1e3b3484da212/dj-planner-pro/app/(tabs)/history.tsx:348).

6. **Media — Diferenciar claramente un fallo de conexión de una agenda vacía.**

   En Inicio e Historial hay caminos donde una consulta fallida sin datos puede acabar mostrando que no existen sesiones.

   Aunque no borre información, puede hacer pensar al usuario que ha perdido su agenda. Hay que mostrar un error explícito, permitir reintentar y conservar los últimos datos disponibles cuando sea posible.

   Evidencia: [estado vacío de Inicio](/Users/manuelparravillar/.codex/.chatgpt-projects/g-p-69374a95d1c0819191f1e3b3484da212/dj-planner-pro/app/(tabs)/home.tsx:313).

7. **Media — Incorporar detección de fallos y medidas de rendimiento de los iPhone.**

   Hay registros del servidor y mensajes de diagnóstico, pero no he encontrado una integración de seguimiento de errores y rendimiento desde los dispositivos.

   Necesitamos saber cuándo una pantalla falla, cuánto tarda en abrirse y en qué versión ocurre. También conviene alertar sobre generaciones atascadas y errores de compras. Con muchos usuarios, depender de que alguien escriba al soporte retrasa la detección.

8. **Media — Ampliar las comprobaciones antes de publicar.**

   Las pruebas actuales son valiosas, pero la automatización revisada no ejecuta los flujos completos en iPhone. Además, la comprobación de tipos excluye las funciones del backend y los archivos JavaScript del laboratorio de carteles.

   Recomiendo comprobar de extremo a extremo: crear y editar sesiones, compras y restauración, generar y aplicar carteles, escanear entradas y cambiar de cuenta. El desajuste del punto 1 es un ejemplo de lo que puede escapar a pruebas separadas.

   Evidencia: [comprobaciones automáticas actuales](/Users/manuelparravillar/.codex/.chatgpt-projects/g-p-69374a95d1c0819191f1e3b3484da212/dj-planner-pro/.github/workflows/checks.yml:17).

9. **Media — Activar la protección contra contraseñas filtradas.**

   El asesor de producción confirma que continúa desactivada. Ayudaría a evitar que las cuentas utilicen contraseñas conocidas por filtraciones. Su disponibilidad debe comprobarse en el plan contratado; no he cambiado el plan ni los ajustes. [Referencia de Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

10. **Media — Resolver el aviso actual de dependencias.**

    La auditoría devuelve **tres avisos altos que proceden de una misma cadena de dependencias**, relacionada con Zod y las herramientas de Expo. No son tres vulnerabilidades independientes de los datos de la app.

    El riesgo documentado es agotamiento de memoria al validar determinadas colecciones. Conviene corregirlo con una actualización compatible y verificar la compilación; la solución automática propuesta incluye un cambio de versión de Expo que no debe aplicarse sin revisión. [Aviso consultado](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

Sobre **cuántos usuarios puede soportar**, todavía no hay una cifra defendible. Producción contiene aproximadamente 51 perfiles y 230 sesiones: permite comprobar funcionamiento, pero no capacidad a gran escala. La prueba con 100.003 sesiones valida una consulta e índices, no miles de personas usando toda la app simultáneamente.

Antes de una campaña grande haría una prueba gradual sobre un entorno separado, midiendo tiempos de respuesta, errores, memoria y consumo con actividad simultánea. También queda por verificar la configuración de copias de seguridad y realizar una restauración de prueba; **no he comprobado esa capacidad de recuperación en esta auditoría**.

**Mantendría el envío del 1 de noviembre pendiente de revisar, como mínimo, los puntos 1 y 3, y de concretar la transición del punto 2.** La base anterior sigue funcionando bien; estos son los puntos que ahora limitan la robustez del conjunto.
