# Live

El acceso aparece en la cabecera de Sesiones, junto a Lugares, mientras exista una sesión propia en curso. Se excluyen sesiones canceladas y participaciones como invitado. Se utiliza la zona horaria de la sesión y se contempla el final después de medianoche: 22:00–04:00 sigue en directo al día siguiente hasta las 04:00.

## Información mostrada

- Entradas registradas: contador de QR únicos y accesos manuales.
- Invitados admitidos: personas admitidas, incluyendo acompañantes, sobre el total de la lista.
- Invitados pendientes y lista con búsqueda por nombre.
- Selector cuando hay varias sesiones en curso.
- Accesos a Entradas e Invitados para registrar personas desde los formularios existentes.

Los contadores no se suman: una persona puede figurar en los dos sistemas. Son accesos registrados, no ocupación actual, porque no se registran salidas. La app no verifica la validez de entradas de plataformas externas.

## Actualización y permisos

Se reutilizan `event_entry_count` y `event_guest_list`, con los permisos de propietario ya existentes. No se añaden tablas, datos públicos ni permisos nuevos. El propietario puede crear invitaciones desde «Acceso a puerta». El personal opera desde un modo limitado sin registro y escribe en los mismos contadores. Véase `acceso-puerta.md`.

Las consultas comparten caché con Entradas e Invitados y se actualizan cada 10 segundos mientras Live está visible y la app en primer plano. La actualización automática no muestra el indicador de actualización manual. La fecha de actualización indica la consulta más antigua de los dos recuentos. Ante un fallo se muestra un aviso y el recuento afectado pasa a «—».

Al finalizar la sesión desaparece el acceso de la cabecera. Abrir Live sin una sesión vigente muestra un estado vacío. Los límites de inicio y fin se revisan con temporizadores y al regresar a la app.

## Verificación

- TypeScript y comprobación de espacios del diff.
- Pruebas de horario: sesión nocturna, inicio inclusive, fin exclusive, propietario, invitación y cancelación.
- Prueba de interfaz con respuestas simuladas: posición del acceso junto a Lugares, actualización automática, búsqueda, recuentos separados y ocultación al terminar.

La prueba de interfaz no sustituye una comprobación con dos dispositivos reales, uno registrando accesos y otro consultando Live.
