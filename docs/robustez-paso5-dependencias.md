# Robustez: paso 5 — dependencia vulnerable de las herramientas Expo

28 de octubre de 2026. Corresponde al punto 10 de la auditoría original.

## Cambio

Se fija Zod 4.6.7 únicamente como dependencia de `@expo/cli`, mediante `overrides`. Se mantienen Expo 58.0.20 y CLI 58.1.16. El archivo de bloqueo cambia exclusivamente la entrada de Zod: ninguna otra dependencia actualizada ni eliminada.

Expo CLI solicitaba Zod ^3.25.76. El override cruza una versión principal, por lo que se comprueban los módulos consumidores reales instalados: descriptores de plugins, resultados y esquemas de comandos de DevTools/MCP. Aceptan los tipos previstos y rechazan comandos, parámetros y resultados inválidos. No constituye garantía de compatibilidad con todos los plugins externos futuros; revisar el override al actualizar Expo.

La nueva versión rechaza una colección que excede su máximo antes de acumular un error por elemento. La prueba usa 100.000 elementos inválidos y comprueba un único error de tamaño. No se modifica el código de validación de Expo ni se ocultan avisos.

## Resultado y límites

- Antes: 3 avisos altos y 5 bajos.
- Después: 0 altos, 0 críticos y 7 bajos. Desaparece la cadena de Zod; Expo y CLI continúan como avisos bajos por la cadena distinta de deepmerge. No son siete problemas independientes.
- El aviso restante de deepmerge 4.3.1 no tiene parche publicado al comprobarlo. No se fuerza una regresión de Expo ni se elimina una dependencia necesaria para silenciarlo.
- 311 pruebas generales correctas, incluidos tres casos nuevos de compatibilidad y seguridad de la validación; TypeScript correcto; configuración de Expo correcta.
- Se reinicia Expo en modo online para cargar la dependencia nueva. La comprobación de distribución nativa en TestFlight sigue pendiente del 1 de noviembre.

No modifica datos de usuarios, compras ni configuración de Supabase. Copias previas de package.json, package-lock.json y auditoría en `../outputs/robustez-paso5-dependencias/`. Para revertir, retirar únicamente este override y recuperar la entrada anterior de Zod en el bloqueo, conservando el resto del trabajo.

Referencias oficiales de los avisos:

- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://github.com/advisories/GHSA-gcqx-w48m-w2h4
