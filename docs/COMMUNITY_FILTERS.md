# Filtros de Comunidad

Se conservan las pestañas Sesiones, Siguiendo y DJs. Sesiones y DJs tienen selectores de ciudad y estilo, combinables, con búsqueda en sus opciones y limpieza de filtros. Cada pestaña conserva su selección mientras la pantalla permanece montada. Siguiendo conserva su comportamiento anterior.

## Qué se filtra

- Sesiones: ciudad de su lugar, obtenido mediante `venue_id`; no se usa la ciudad del perfil como sustituto. Una sesión sin ciudad de lugar aparece sin filtro de ciudad, pero no coincide con una ciudad seleccionada.
- Sesiones: estilos del DJ que publica o de los colaboradores aceptados con perfil público. No es un género propio del evento: las sesiones actualmente carecen de ese campo. El selector explica esta distinción.
- DJs: ciudad y estilos del perfil público. Se combinan con la búsqueda existente por nombre.
- Ciudades: opciones procedentes únicamente de perfiles públicos o de lugares de sesiones efectivamente compartidas, según la pestaña.
- Estilos: catálogo musical canónico más estilos públicos heredados. Coincidencia del token completo: House no incluye Deep House por substring.

## Datos y privacidad

Los nuevos RPC aplican los filtros antes de LIMIT/OFFSET; no se filtra solo la página ya descargada. Las claves de React Query incluyen ambos filtros y cada nueva combinación empieza en la primera página.

Se mantienen los RPC anteriores para compatibilidad. Los perfiles siguen protegidos por RLS; las sesiones usan la misma proyección explícita de Comunidad, con autenticación, publicación voluntaria, perfil público y sesión no cancelada. No se exponen cachés, acuerdos, cobros, contactos ni notas privadas.

Ciudades y estilos ignoran mayúsculas, espacios sobrantes y los acentos latinos habituales. No hay geolocalización ni proveedor de mapas.

## Verificación

- `node tests/communityFiltersDatabase.cjs`: PostgreSQL aislado; filtros combinados, tokens, acentos, colaboradores aceptados, paginación y privacidad.
- `tests/browser/communityFilters.cjs`: API simulada; selección, búsquedas, estado por pestaña, limpieza y pantalla de 320 px en modo oscuro.
- Typecheck y suite existente; textos en los siete idiomas.
