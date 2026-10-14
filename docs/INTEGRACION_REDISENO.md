# Integración conciliada del rediseño de Interagrovial

La versión conciliada conserva el portal vigente y aplica una capa visual compartida a las seis aplicaciones. Se prepara en una rama independiente; no modifica ni publica `main`.

## Versiones revisadas

| Referencia | Commit | Resultado de la revisión |
| --- | --- | --- |
| `main` al 14/10/2026 | `faa906368d868016e92c2ae0b1067d4cb0782767` | Portal de septiembre con seis aplicaciones, fotos, buscador, contador y estado sin resultados. |
| [PR #1](https://github.com/gera1991823-design/Datos-Analisis/pull/1), `design/interfaz-empresarial` | `5400d87f9932d151a273708bfa0c5267458b82cd` | Rediseño de siete pantallas y hoja compartida de 2.421 líneas; borrador con conflicto. |
| Ancestro común | `3cc0f9ef25310d2f69a1fae45badabd2326aa405` | Base del rediseño de agosto. |

Las ramas divergen: el PR tiene 29 commits propios y `main` tiene cinco posteriores. La sustitución del portal en septiembre suma 989 líneas agregadas/eliminadas. La diferencia directa entre las puntas actuales de `index.html` suma 1.016 líneas. Son comparaciones distintas, no cifras contradictorias.

El merge de prueba detectó un conflicto textual en `index.html`. Carpetas se integra automáticamente por Git, pero requiere revisión funcional: el PR cambia su tabla de 17 columnas a siete bloques, sus renderizadores y parte del guardado. Los tres commits de Carpetas de septiembre terminan con el mismo blob `ca568164…` que el ancestro común; los cambios intermedios fueron revertidos. Se preserva el contenido final de `main`, no una de las revisiones intermedias.

## Decisiones por pantalla

| Pantalla | Conservado de `main` | Recuperado y adaptado del PR |
| --- | --- | --- |
| Portal | Hero, logo y fotos embebidas, seis tarjetas, nombres, rutas, orden, búsqueda normalizada, contador y estado vacío. | Tipografía, foco accesible y hoja visual compartida. El buscador pasa a ser visible y operable en celular mediante CSS. |
| Carpetas | Tabla de 17 columnas, filtros en fila desplazable, formularios, indicadores, notificaciones, auditoría, guardado, packing y adjuntos. | Marca lateral, Inicio, colores, panel de contexto, tarjetas y estilos de campos/botones. Campana visible en el encabezado blanco. |
| Reservas | Secciones pendientes/cumplidas, contadores, autenticación anónima, CRUD y exportación. | Inicio en la navegación existente, formulario adaptable y colores compartidos. |
| Reclamos | Campos, estados, fechas, importación/exportación XLSX y CRUD. | Navegación lateral, títulos y formularios alineados; tabla desplazable dentro de un contenedor. |
| Solicitudes MD | Personas y dependencias centro/sucursal/nombre/responsable, opciones guardadas, fechas, CRUD y XLSX. | Navegación lateral, foco y formularios adaptables; tabla contenida. Se corrige el texto «Solicitar camión» sin cambiar su valor almacenado. |
| Stock por centro | Importador CSV, centro por nombre de archivo, clasificación, edición, selección, eliminación y XLSX. | Navegación lateral, filtros, campos y botones. El texto de carga describe la selección de archivos que realmente existe. |
| Actualizador de facturas | OCR, normalización, equivalencias de división, coincidencias, selección, actualización y auditoría. | Inicio accesible también en celular, colores, panel de contexto y campos. |

No se traslada la portada antigua, el CSS de grilla del portal antiguo, la tabla agrupada de Carpetas ni sus cambios de JavaScript. La hoja compartida se reescribe en reglas acotadas a clases de página, sin selectores que supongan siete columnas. Se respetan los tamaños, puntos de corte y controladores de las barras existentes.

Los accesos a Inicio usan enlaces HTML; la capa visual no añade JavaScript de producción. Se mantienen los scripts completos, incluyendo imports y configuración Firebase, bibliotecas, eventos, selectores y plantillas dinámicas. Los rótulos estáticos de formularios se vinculan a sus controles mediante `for` y se conservan los 191 IDs, valores y opciones funcionales. Los avisos agregados por el diseño antiguo que afirmaban «Datos sincronizados» se sustituyen por rótulos descriptivos; no se presenta un estado de conexión sin comprobarlo.

## Validación reproducible

Desde la raíz del repositorio:

```bash
python3 tests/verify-integration.py
npm ci
npx playwright install chromium
npm test
```

Si Chromium ya está instalado, se puede indicar su ejecutable:

```bash
CHROMIUM_EXECUTABLE_PATH=/ruta/a/chromium npm run test:ui
```

`verify-integration.py` compara contra el SHA fijo de `main`: scripts y estilos originales byte por byte, IDs, controles, valores de opciones, columnas, rutas y sintaxis de todos los scripts. No necesita paquetes Python externos. `test:ui` usa los scripts reales de las páginas con Firebase y Storage simulados e intercepta todas las solicitudes externas. No escribe datos en el proyecto real. Los informes JSON, capturas y exportaciones de prueba se generan en `test-results/` y quedan fuera del código de producción.

La revisión cubre las siete pantallas a 1440, 1024, 768, 390 y 320 píxeles: búsqueda del portal, navegación a Inicio, menús móviles, ausencia de desbordamiento global, filtros, formularios, edición/cancelación/guardado y lectura de los XLSX exportados. También comprueba carga CSV, importación XLSX de Reclamos, selecciones dependientes de Solicitudes, creación de registros, packing, adjuntos, notificaciones de Carpetas y actualización selectiva de facturas. Las capturas usan datos de prueba y fuentes de respaldo del navegador.

## Límites y problemas anteriores

- En Solicitudes MD, `draw()` y `rowsForExport()` usan `view.length ? view : cache`. Una búsqueda sin coincidencias muestra/exporta todos los registros. Es un problema anterior, presente en ambas ramas. La prueba lo registra explícitamente; este cambio visual conserva los scripts y no lo oculta como una corrección realizada.
- Carpetas inicializa dos veces `flatpickr("#fDepositoRange", …)`. Se mantiene la lógica vigente; las reglas nuevas no fuerzan tamaños de mes/año ni cambian la interpretación de fechas.
- Las reglas, permisos, latencia real, sesiones, índices de Firestore y servicios de Storage requieren validación en un entorno autorizado. Los mocks verifican los caminos de la interfaz, no certifican esos servicios.
- El motor OCR y sus recursos externos se conservan por identidad de código; no se mide la precisión del reconocimiento ni se descarga un modelo durante las pruebas.

## Revisión e integración posterior

La rama de conciliación se prepara como un merge resuelto con ambos commits de origen como padres, conservando la historia. Su comparación con `main` contiene únicamente la adaptación visual, documentación y pruebas. El PR original se deja intacto. Revisar el nuevo PR o aplicar su parche es una decisión posterior; esta entrega no fusiona, despliega ni cambia `main`.

Para revisar localmente la versión, servir la raíz con `python3 -m http.server 8000` y abrir `http://localhost:8000/index.html`. Fuera de las pruebas automatizadas, las aplicaciones usan su Firebase real: revisar con permisos adecuados y datos de prueba antes de cualquier despliegue.
