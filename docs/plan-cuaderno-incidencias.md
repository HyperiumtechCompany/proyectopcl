# Plan de integración: Costos + Cuaderno de Incidencias OECE

Fecha: 6 de octubre de 2026. Estado: conector local y bandeja de fase 2 implementados; validación autenticada del piloto pendiente.

## 1. Objetivo y diagnóstico

Desde cada proyecto de Costos se podrá vincular su cuaderno oficial, consultar y filtrar asientos, descargar sus PDF y adjuntos, preparar borradores, enlazar asientos y registrar el contenido revisado por el usuario autorizado. También se podrán asociar asientos con documentos de costos y valorizaciones como sustento.

La integración necesita lectura y escritura autenticadas. El scraping por sí solo cubre extracción; registrar asientos requiere controlar un flujo transaccional y verificar su resultado oficial.

El repositorio actual usa Laravel 12, PHP 8.3, Inertia v2 y React 19. Ya existen:

- `app/Models/CostoProject.php`: proyecto, propietario, CUI y nombre de base de datos.
- `app/Models/CostoProjectModule.php`: módulos habilitados y configuración.
- `app/Services/CostoDatabaseService.php`: bases de datos separadas por proyecto.
- `app/Http/Controllers/CostoProjectController.php`: acceso actualmente restringido al propietario.
- `resources/js/pages/costos/Show.tsx`: entrada al proyecto.
- Rutas de Costos en `routes/web.php`, colas Laravel y disco privado configurado.

Las capturas muestran acceso con usuario y contraseña, segundo factor/dispositivo de confianza, aceptación de términos, selección de cuaderno y rol, bandeja, formulario, ubicación y descargas. Una cuenta puede acceder a varios cuadernos: cuenta y proyecto deben modelarse por separado.

**Recomendación:** comenzar con un proyecto piloto y acceso asistido por su titular. Automatizar primero consulta y descarga; después borradores y registro confirmado. La conexión no recupera una contraseña perdida: requiere el proceso oficial de recuperación y permite reducir posteriores ingresos mientras la sesión sea válida.

## 2. Hechos, supuestos y decisiones pendientes

| Tema | Evidencia o situación | Acción necesaria |
| --- | --- | --- |
| Segundo factor | OECE anunció 2FA con ID Perú o código por correo; la captura muestra dispositivo reconocido | Probar ingreso nuevo, confianza y vencimiento; el titular completa el desafío |
| Términos | Aparecen antes de seleccionar el cuaderno | El titular los lee y acepta; registrar versión/fecha cuando sea posible |
| Ubicación | La captura de registro muestra ubicación denegada | Verificar cuándo es obligatoria y cómo conservar la ubicación real del usuario |
| Campos y archivos | La captura muestra descripción de 2000 caracteres y archivos de hasta 100 MB | Confirmar límites, formatos y reglas en el flujo vigente antes de programar validaciones |
| API oficial | No se encontró una API pública documentada en la búsqueda realizada | Consultar a OECE; no deducir que una petición interna del portal es una API pública |
| Automatización | No se verificó autorización para automatizar el portal; la página de términos no pudo recuperarse con la herramienta web | Revisar términos completos y condiciones de acceso en fase 0 |
| Estados oficiales | Se observan borrador y definitivo en las capturas | Inventariar estados, permisos y posibles transiciones; conservar valor original |
| Entorno de prueba | No se confirmó un sandbox oficial | Usar consulta real autorizada y simulaciones locales; no publicar asientos ficticios en producción |

Los límites observados son evidencia de las capturas, no un contrato técnico confirmado.

## 3. Arquitectura propuesta

```text
Proyecto de Costos → Pantalla Cuaderno (React/Inertia)
                         ↓
                Laravel: permisos, validación y auditoría
                         ↓
                 Cola de operaciones de integración
                         ↓
                   Adaptador de acceso OECE
                     ↙                 ↘
           API oficial autorizada    Navegador asistido
                         ↓
                Cuaderno seleccionado y verificado
                         ↓
              Asientos locales + PDF/adjuntos privados
```

Laravel seguirá siendo el backend principal. El adaptador permite cambiar el mecanismo externo sin cambiar las pantallas ni las rutas públicas existentes. Las rutas nuevas serán adicionales y pasarán por la autorización del proyecto.

Si OECE ofrece una API autorizada que cubra los flujos, utilizar el cliente HTTP de Laravel. Si no la ofrece y permite automatización, evaluar un ejecutor de navegador separado. Playwright sería una opción por validar, no una dependencia aprobada: las restricciones actuales prohíben agregar librerías sin aprobación. Este plan no instala ninguna.

Para el piloto de navegador, preferir un ejecutor local con navegador visible del titular, ligado de forma autenticada a Costos. Si Costos está en un servidor, hará falta diseñar el canal seguro con ese ejecutor: tareas con identificador, autorización, caducidad y resultados verificables; no exponer un puerto local sin autenticación. No asumir que el navegador del servidor puede reutilizar la sesión del navegador personal.

Un navegador remoto centralizado queda condicionado a resolver ingreso interactivo, aislamiento y ubicación real. No inventar coordenadas ni usar automáticamente las coordenadas de la obra o del servidor. Si el canal no satisface el requisito de ubicación, realizar el registro en el navegador local oficial y conciliar el resultado.

La web de Costos no puede leer cookies ni controlar directamente la página de OECE por pertenecer a otro dominio. No basar la solución en un iframe o en llamadas directas desde React con credenciales. Las sesiones del ejecutor requieren su propio ciclo de autenticación.

## 4. Vinculación de cada proyecto

1. Abrir el proyecto y entrar en **Cuaderno de incidencias → Vincular**.
2. Seleccionar o conectar una cuenta OECE propia; elegir el tipo de ingreso adecuado.
3. El titular completa contraseña, 2FA y aceptación de términos en el flujo oficial.
4. Obtener los cuadernos disponibles para esa cuenta.
5. Mostrar entidad, obra/contrato, CUI cuando exista, rol y estado del cuaderno.
6. Comparar con el proyecto de Costos. Usar CUI como ayuda, nunca como identificador único del cuaderno: una inversión puede tener varios contratos/cuadernos.
7. El usuario confirma la vinculación exacta; guardar identificador externo estable, metadatos y rol. Si no existe identificador observable estable, resolverlo en fase 0; no usar posición de una fila.
8. Sincronizar la bandeja y comprobar cantidades, números y una muestra de detalles/PDF contra el portal.
9. Mostrar cuaderno vinculado, identidad/rol, última sincronización y estado de conexión.

Para el MVP: un cuaderno principal activo por proyecto. Mantener historial de cambios de vinculación sin mezclar sus asientos. Una cuenta podrá vincular varios proyectos, pero cada usuario operará con su propia identidad y permisos oficiales; no compartir automáticamente la cuenta del supervisor con otros usuarios de Costos.

Antes de cada lectura, descarga o escritura, verificar que el navegador conserva el cuaderno y rol esperados. Si una sesión comparte cuenta y cambia de cuaderno, serializar sus operaciones o usar contextos aislados cuyo comportamiento se haya comprobado.

## 5. Modelo de datos propuesto

Diseño preliminar; inspeccionar el esquema real con Boost antes de crear migraciones. Para el MVP, proponer tablas de integración en la base central, todas las consultas de contenido delimitadas por proyecto/vinculación. Esto evita repetir autenticación en cada base de costos. Las relaciones con documentos de una base de proyecto se validarán a través de su servicio de conexión, sin asumir claves foráneas entre bases distintas.

| Entidad propuesta | Datos principales |
| --- | --- |
| `CuadernoCuenta` | Propietario de Costos, usuario externo, modalidad de ingreso, referencia al ejecutor/sesión protegida, estado y vigencia observada |
| `CuadernoVinculo` | `costo_project_id`, cuenta, ID externo del cuaderno, entidad, contrato/obra, CUI, rol, estado e historial de activación |
| `CuadernoAsiento` | Vinculación, ID externo, número, título, tipo, contenido si está accesible, autor/rol, fecha oficial, estado oficial, huella y fecha de sincronización |
| `CuadernoBorrador` | Vinculación, autor local, título, tipo, descripción, referencias, adjuntos, revisión y estado de envío |
| `CuadernoReferencia` | Origen y destino de una referencia; distinguir enlace oficial entre asientos de asociación local con costos |
| `CuadernoArchivo` | Asiento/borrador, ID externo si existe, nombre, MIME, tamaño, ruta privada, hash SHA-256 y estado de descarga |
| `CuadernoOperacion` | UUID, usuario, proyecto, acción, estado, intento, tiempos, versión del contenido aprobado y resultado externo |
| `CuadernoAuditoria` | Actor, proyecto/cuaderno, acción, transición, fecha y evidencia mínima sin secretos |

Unicidad de asientos por vinculación + ID externo; si solo hay número estable, validar su alcance antes de usarlo como clave. No deduplicar por título. Unicidad de cada envío local por UUID y bloqueo transaccional de la operación; no asumir soporte remoto de claves de idempotencia.

Guardar fecha oficial original y zona/offset si están disponibles; presentar fechas en `America/Lima`. No sustituir la fecha oficial por la fecha de importación.

Credenciales opcionales y cifradas solo si el mecanismo elegido las necesita y su almacenamiento está autorizado. Preferir ingreso interactivo sin persistir contraseña. Proteger también cookies, perfiles de navegador y tokens, que equivalen a acceso a la cuenta. Nunca ponerlos en `config` de módulos, props de Inertia, repositorio, logs o almacenamiento público.

## 6. Estados y comportamiento visible

Mantener separados estado del proyecto, estado oficial del cuaderno/asiento y estado técnico de integración. La sincronización no modificará automáticamente `CostoProject.status` ni aprobará valorizaciones.

| Ámbito | Estados locales propuestos | Comportamiento |
| --- | --- | --- |
| Vinculación | Sin vincular, vinculada, revocada | Permite saber qué cuaderno corresponde al proyecto |
| Conexión | Desconectada, autenticando, requiere intervención, conectada, sesión vencida, error | Indica si necesita contraseña, 2FA, términos, ubicación o recuperación |
| Sincronización | Pendiente, ejecutando, parcial, completa, fallida | Muestra progreso, errores y última actualización completa |
| Borrador/envío | Local, revisado, enviando, confirmado, resultado incierto, rechazado | Impide mostrar éxito antes de comprobar el resultado oficial |
| Archivo | Pendiente, descargando, disponible, fallido | Permite reintentar la descarga sin duplicar el asiento |

El borrador local no es un borrador oficial de OECE. Mostrar ambos por separado y guardar el ID externo cuando se confirme que el borrador existe allí.

## 7. Fases y criterios de cierre

### Fase 0 — Viabilidad y recorrido oficial

- Revisar manual vigente, términos completos, autorización de automatización y disponibilidad de API/sandbox con OECE.
- Recorrer con una cuenta autorizada: login, 2FA, términos, selección de cuaderno, paginación, filtros, detalle, PDF, adjuntos, borrador y confirmación final.
- Identificar IDs estables, permisos por rol, límites, ubicación, vencimiento de sesión y cambios de estado.
- Inspeccionar tráfico solo en la sesión autorizada para comprender el flujo; no convertir endpoints internos en una API contractual.
- Elegir canal de acceso y documentar cómo el titular interviene. Si no es viable automatizar, conservar una alternativa de importación de exportaciones/PDF y acceso oficial manual.

**Cierre:** recorrido validado, mecanismo permitido elegido y prueba de lectura de un cuaderno. Si falta autorización o no se resuelve la ubicación, no habilitar registro automático.

### Fase 1 — Vinculación y acceso por proyecto

- Crear tablas, autorización y configuración del conector con función desactivada por defecto.
- Agregar entrada Cuaderno al proyecto sin alterar los módulos existentes.
- Implementar selección/confirmación de cuaderno y reconexión asistida.
- Mostrar estado de conexión, rol, última actividad y desvinculación/revocación.

**Cierre:** dos proyectos pueden vincularse a sus cuadernos correctos; un usuario ajeno recibe 403 y nunca ve credenciales, sesiones o documentos del otro.

### Fase 2 — Listado, búsqueda, filtros y sincronización

- Importar todas las páginas de asientos autorizados con progreso y checkpoints.
- Obtener detalles cuando la bandeja no incluya el contenido; respetar permisos.
- Ofrecer filtros observados: número, título, tipo, autor, rol, estado, rango de fechas y referencia, según datos accesibles.
- Consultar la copia local para búsquedas rápidas y mostrar su antigüedad.
- Ejecutar sincronización incremental con solapamiento; releer borradores/elementos mutables y hacer conciliaciones completas periódicas. No asumir que todo lo anterior al último número permanece igual.
- Registrar última sincronización completa separada de último intento; una carga parcial no se presenta como completa.

**Cierre:** listado conciliado con el portal para el alcance autorizado, sin duplicados tras repetir la importación; búsquedas y filtros correctos sobre datos conocidos.

### Fase 3 — PDF y adjuntos

- Descargar el PDF oficial y los adjuntos disponibles, bajo demanda o en una cola de respaldo.
- Verificar MIME, firma de archivo, tamaño y hash; detectar respuestas HTML de login recibidas como descarga.
- Guardar en disco privado y entregar mediante una ruta con autorización por proyecto.
- Permitir vista previa/descarga y mostrar archivos pendientes o fallidos.
- Definir retención y respaldo; los PDF originales no se regeneran como si fueran emitidos por OECE.

**Cierre:** PDF y adjuntos de la muestra coinciden con los oficiales; acceso ajeno bloqueado, fallos recuperables y ninguna URL pública expone documentos.

### Fase 4 — Borradores y enlaces

- Crear y editar borradores locales con campos y límites confirmados en fase 0.
- Seleccionar asientos del mismo cuaderno para referencias oficiales, conforme a lo permitido por OECE.
- Adjuntar documentos existentes de costos mediante selección explícita del usuario, sin publicar automáticamente todos los archivos del proyecto.
- Enviar a borrador oficial si el rol/flujo lo admite y confirmar el ID externo.
- Permitir asociaciones locales con valorizaciones, informes y documentos como sustento.

**Cierre:** borrador local conservado ante sesión vencida; borrador oficial y referencias recuperables al consultar nuevamente el portal.

### Fase 5 — Registro oficial confirmado

1. Validar identidad, rol, cuaderno, permisos, ubicación y archivos.
2. Mostrar una revisión final con proyecto, cuaderno, título, contenido, referencias y adjuntos.
3. El titular confirma el envío de esa versión exacta; cambios posteriores requieren nueva revisión.
4. Bloquear doble clic y ejecución concurrente del mismo envío.
5. Registrar mediante el canal autorizado; detenerse ante cualquier desafío del portal.
6. Comprobar número/ID y estado oficial, recuperar detalle y descargar PDF cuando esté disponible.
7. Mostrar confirmación solamente después de conciliar el resultado externo.

Si el portal recibió el asiento pero la respuesta se perdió, marcar **resultado incierto**. Consultar el cuaderno y comparar contenido, autor, referencias, tiempo y archivos antes de decidir. Sin evidencia inequívoca, exigir conciliación por el titular; nunca repetir automáticamente el registro. No presumir que un asiento definitivo se puede modificar o eliminar.

**Cierre:** registro real autorizado conciliado con su ID y detalle, sin duplicación ante doble clic, corte de red o repetición de tarea. Usar simulaciones para fallos y un asiento legítimo aprobado para la validación final si no hay sandbox.

### Fase 6 — Relación con costos y operación estable

- Presentar asientos vinculados como sustento de valorizaciones/metrados y permitir navegar desde el documento al asiento.
- Agregar agenda de sincronización configurable, respetando vigencia de sesión y límites del portal.
- Mostrar tareas pendientes, sesión vencida, archivos fallidos y cambios del conector.
- Incorporar alertas dentro del sistema, respaldo privado y procedimiento de reconexión.
- Ampliar del piloto a varios proyectos después de validar aislamiento y recuperación.

**Cierre:** operación con varios proyectos sin cruces de cuaderno, historial auditable y recuperación probada de sesiones, colas y archivos.

## 8. Ejecución dentro de este repositorio

Archivos nuevos propuestos, sujetos a convenciones vecinas al implementar:

- `app/Models/Cuaderno*.php`: entidades de integración.
- `app/Services/Cuaderno/`: adaptador, sincronización, descargas y conciliación.
- `app/Jobs/Cuaderno/`: operaciones de lectura/descarga y escritura controlada.
- `app/Http/Controllers/Cuaderno/`, `app/Http/Requests/Cuaderno/` y políticas: endpoints, validaciones y autorización.
- `database/migrations/`: tablas centrales, índices y referencias.
- `config/cuaderno.php`: parámetros del conector sin credenciales en texto plano.
- `resources/js/pages/costos/cuaderno/`: vinculación, bandeja, detalle y borradores.
- `tests/Feature/Cuaderno/`: aislamiento, sincronización y registro simulado.

Cambios localizados previstos: entrada en `resources/js/pages/costos/Show.tsx`, rutas adicionales en `routes/web.php` y relaciones necesarias en `CostoProject`. Si se incorpora como módulo habilitable, revisar conjuntamente la constante de tipos, validación y selección de módulos; no agregarlo solo a la constante. No cambiar aún esas piezas durante esta etapa de planificación.

Antes de cada implementación: diagnóstico y plan corto, esquema con Boost cuando corresponda, documentación Boost para los patrones modificados y skills de Inertia/Wayfinder/Pest/Tailwind según el cambio. Mantener la autorización actual del propietario; colaboración entre usuarios requeriría un alcance posterior explícito.

No instalar un ejecutor de navegador ni otras dependencias sin aprobación. El acceso asistido puede requerir infraestructura adicional; su instalación/despliegue será una decisión concreta tras la fase 0.

## 9. Concurrencia, recuperación y seguridad operativa

- Bloquear operaciones por sesión/cuenta cuando compartan contexto y por envío cuando escriban. Si un job usa base de proyecto, establecer y limpiar la conexión explícitamente: un worker puede procesar proyectos consecutivos.
- Reintentar lecturas/descargas con espera progresiva y límite; detenerse ante sesión vencida, bloqueo, 429 o cambio de página incompatible.
- Evitar descargas masivas simultáneas; acordar frecuencia y presupuesto de solicitudes en el piloto.
- No eludir 2FA, CAPTCHA ni la ubicación. Conservar intervención del titular para recuperación, nuevos términos y confirmación de registro.
- Cifrar sesiones en reposo, restringir archivos/perfiles del ejecutor y permitir revocación. Nunca reutilizar identidad oficial de otro usuario para registrar.
- Limitar destinos a dominios oficiales y redirecciones validadas; no descargar URLs arbitrarias enviadas por el cliente.
- Auditar actor local y autor oficial, cuaderno, operación y evidencia; eliminar secretos de logs y capturas de error.
- Al desvincular, revocar la sesión que corresponda y conservar el historial conforme a la política de retención. No borrar automáticamente el respaldo ni alterar el cuaderno oficial.

## 10. Validación mínima de cada entrega

Pruebas deterministas con adaptador simulado y datos ficticios; las pruebas habituales no dependerán de credenciales reales ni escribirán en OECE.

| Caso | Resultado esperado |
| --- | --- |
| Usuario accede a proyecto ajeno | 403 también en archivos y operaciones |
| Cuenta con varios cuadernos | Todas las acciones verifican el ID de la vinculación |
| Sincronización repetida/paginada | Sin duplicados; cambios y páginas pendientes conciliados |
| Sesión vence a mitad de importación | Estado parcial, checkpoint y reconexión; copia local disponible |
| PDF devuelve login HTML | Archivo rechazado; solicita reconexión |
| Borrador cambia después de revisión | No publica una versión distinta de la confirmada |
| Doble clic/dos workers | Una sola operación de envío activa |
| Corte de red tras envío | Resultado incierto y conciliación sin reenvío automático |
| Ubicación denegada o rol insuficiente | Registro detenido con acción clara para el titular |
| Cambio incompatible del portal | Conector detenido; datos locales preservados |

Comandos previstos al implementar: `php artisan test --compact` con archivo/filtro específico, `npm run types`, `npm run build` para pantallas modificadas y `npm test` con la suite relevante si se agrega lógica frontend. Si se toca PHP, ejecutar `vendor/bin/pint --dirty --format agent`.

La entrega inicial fue únicamente de planificación. Las verificaciones de implementación se registran en los avances de la sección 11; la compilación local no acredita que el conector autenticado funcione.

## 11. Orden de trabajo y seguimiento

Primera entrega útil: fases 0 a 3, **vincular + listar/buscar + descargar PDF**, con acceso asistido y estados claros. Segunda entrega: borradores/enlaces. Tercera entrega: registro oficial confirmado. Después, integración como sustento de costos y ampliación a varios proyectos.

No fijar plazos hasta completar la prueba de acceso y medir paginación, detalles y descargas. El comportamiento del portal, el mecanismo autorizado y la infraestructura del ejecutor determinan el esfuerzo.

| Fase | Estado inicial | Evidencia requerida para cerrar |
| --- | --- | --- |
| 0. Viabilidad | En curso: diagnóstico público implementado | Canal permitido, recorrido y lectura piloto |
| 1. Vinculación | Conector local, credenciales transitorias y selección implementados; piloto autenticado pendiente | Dos proyectos aislados y reconexión |
| 2. Bandeja | Scraping en segundo plano con progreso, búsqueda en vivo y exportación CSV implementados; conciliación real pendiente | Conciliación de páginas, filtros y ausencia de duplicados |
| 3. PDF/adjuntos | Pendiente | Archivos oficiales privados y recuperables |
| 4. Borradores/enlaces | Notas internas y enlaces locales entre asientos implementados; borradores pendientes | Borrador conservado y referencias verificadas |
| 5. Registro | Pendiente | Resultado oficial confirmado y prevención de duplicados |
| 6. Operación | Pendiente | Varios proyectos, respaldo y recuperación |

Actualizar esta tabla al terminar cada fase con fecha, pruebas ejecutadas y bloqueos concretos. Para iniciar la fase 0 se necesitan: un proyecto piloto elegido, acceso propio válido con su método 2FA, ubicación del futuro sistema (local o servidor) y revisión de las condiciones del portal. No enviar contraseñas por chat ni incorporarlas a este documento.

### Avance de fase 0 — 6 de octubre de 2026

- Se verificó con PowerShell que la página pública de ingreso responde HTTP 200 y `text/html`. Contiene scripts de una interfaz JavaScript; esto no demuestra acceso al cuaderno ni revisión de los términos.
- Se agregó `scripts/diagnose-cuaderno.mjs`, ejecutable con `node scripts/diagnose-cuaderno.mjs`. Consulta únicamente login y términos mediante GET, sin credenciales ni seguimiento de redirecciones. Devuelve metadatos y pendientes en JSON, sin guardar páginas, cookies o perfiles.
- Código de salida 0 significa que las dos páginas públicas responden HTML; no significa que la fase esté terminada. Código 1 indica fallo de conectividad/respuesta pública.
- Verificación independiente del portal: `node --test scripts/diagnose-cuaderno.test.mjs` cubre páginas públicas, redirecciones, errores HTTP y fallos de red.
- Proyecto piloto confirmado por el usuario: `id=1`, I.E. Nº 32004 "San Pedro" – Huánuco, CUI `2458710`. Se asume ejecución local para el piloto; el despliegue de producción se definirá posteriormente.
- Pendiente: revisar términos completos y completar el recorrido autenticado con el titular. No se han verificado IDs del cuaderno/asientos, permisos oficiales, PDF ni ubicación. Las capturas corresponden a otra obra/CUI: no se han usado para vincular automáticamente el proyecto piloto.
- No hay herramienta de navegador interactivo conectada en esta sesión. El diagnóstico HTTP no permite completar 2FA ni seleccionar el cuaderno.
- El diagnóstico Node devolvió `network_or_timeout` para ambas páginas en este entorno, incluso al ejecutarse fuera del sandbox. PowerShell sí pudo acceder al login público. La conectividad del proceso ejecutor necesita validación independiente y no se interpreta ese fallo como caída de OECE.
- No se agregaron dependencias. Las fases 2 a 6 siguen pendientes.

### Base de fase 1 — Vinculación local

Implementado:

- Pantalla **Cuaderno de incidencias** accesible desde el proyecto de Costos.
- Alta manual de metadatos de cuaderno: entidad, obra, contrato, CUI, rol indicado e identificador externo opcional.
- Toda alta queda en `pendiente_verificacion`. No autentica una cuenta, no valida el rol oficial y no permite consultar/publicar asientos todavía.
- Confirmación del proyecto en el formulario. Reemplazo y archivo conservan las vinculaciones anteriores en la base central.
- Una vinculación vigente por proyecto mediante índice único y transacción con bloqueo del proyecto.
- Autorización del propietario en lectura, alta y archivo; datos de un proyecto no aparecen en otro.
- Función desactivada por defecto mediante `config/cuaderno.php` y `CUADERNO_ENABLED=false` en `.env.example`. Se habilitó únicamente la configuración local con `CUADERNO_ENABLED=true`.
- Migración local aplicada mediante `php artisan migrate --path=database/migrations/2026_10_06_000001_create_cuaderno_vinculos_table.php --no-interaction`; no se ejecutaron otras migraciones pendientes.

Archivos principales: `app/Models/CuadernoVinculo.php`, `app/Http/Controllers/Cuaderno/CuadernoVinculoController.php`, `app/Http/Requests/Cuaderno/StoreCuadernoVinculoRequest.php`, `app/Http/Middleware/EnsureCuadernoEnabled.php`, `resources/js/pages/costos/cuaderno/Show.tsx`, la migración indicada y `tests/Feature/Cuaderno/CuadernoVinculoTest.php`. Se agregaron rutas y entrada al proyecto siguiendo Wayfinder; el estado y los módulos de costos conservan su comportamiento.

Verificación realizada: 15 pruebas Pest con 116 aserciones, cuatro pruebas del diagnóstico Node, `npm.cmd run types` y `npm.cmd run build`. La compilación pasó con advertencias de bundles grandes. El primer intento falló al regenerar Wayfinder por un directorio que desapareció; el segundo regeneró rutas y compiló correctamente. Se ejecutó Pint y se formatearon los archivos nuevos JavaScript/TypeScript. En Windows se usa `npm.cmd` porque la política de PowerShell bloquea `npm.ps1`.

Este avance describía la primera entrega de metadatos. La entrega siguiente incorpora el conector descrito a continuación; el cierre de las fases todavía requiere comprobar el recorrido con la cuenta del titular.

### Conector local y bandeja — 6 de octubre de 2026

Se eliminó el enlace al portal como acción principal. Ahora Costos permite ingresar usuario/contraseña, conectar, actualizar la conexión, elegir un cuaderno de la cuenta, detectar sus metadatos oficiales, confirmarlos e importar la bandeja.

El ejecutor `scripts/cuaderno-runner.mjs` utiliza Chrome o Edge y el protocolo de depuración del navegador mediante el WebSocket nativo de Node 24. No se agregaron librerías ni dependencias. Laravel se comunica con el ejecutor únicamente en `127.0.0.1`, mediante un token privado generado para el equipo local. El token no se envía a React ni se incorpora al repositorio.

La cuenta se autentica en un perfil propio del conector, distinto del navegador personal que aparece en las capturas. La contraseña pasa por Laravel y el ejecutor durante el ingreso; no se guarda en la base de datos, no se devuelve en props y se limpia del formulario al terminar la petición. El perfil desactiva el guardado de contraseñas. La clave de sesión local se guarda cifrada y oculta en Eloquent; las cookies del navegador permanecen en un perfil privado. No se reutiliza automáticamente una pestaña personal ya autenticada.

**Uso del piloto:**

1. Abrir `/costos/1/cuaderno` y conservar o preparar la vinculación existente.
2. Rellenar **Usuario OECE** y **Contraseña OECE** y pulsar **Conectar cuenta**.
3. Si el portal solicita segundo factor, reconocimiento del dispositivo o términos, completarlos en la ventana del conector. Costos no los acepta ni los elude automáticamente.
4. Volver a Costos y pulsar **Actualizar conexión**. Si aparecen varios cuadernos, elegir el correspondiente desde la lista local.
5. Pulsar **Detectar cuaderno**, revisar entidad/obra/CUI y confirmar los datos detectados. Si difieren del CUI del proyecto, la pantalla muestra ambos antes de la confirmación; no se cambia el proyecto de Costos automáticamente.
6. Pulsar **Importar / sincronizar asientos**. Se limpian los filtros de la bandeja oficial y se intenta recorrer desde la primera hasta la última página.
7. Buscar y filtrar la copia local por número/título/usuario, tipo y estado.

El conector ya se inició para esta sesión de trabajo. Después de reiniciar el equipo o cerrar el proceso, ejecutarlo desde la raíz del proyecto con `npm.cmd run cuaderno:runner`. Requiere Node 24 y Chrome/Edge instalados. `CUADERNO_BROWSER_PATH` permite indicar otro ejecutable compatible. La configuración local contiene `CUADERNO_RUNNER_PORT` y `CUADERNO_RUNNER_TOKEN`; `.env.example` deja el token vacío y la función desactivada para otros entornos. No es todavía una configuración de producción para un servidor remoto.

La tabla `cuaderno_asientos` conserva número, título, tipo, fecha oficial original, usuario, rol y estado. Cada número es único dentro de su vinculación; una nueva lectura actualiza la fila sin duplicarla. Antes de importar se comprueban entidad, obra y CUI contra la vinculación. No se mezclan los datos al cambiar de cuaderno: si ya hay asientos o una vinculación verificada, debe desconectarse y crearse otra vinculación para conservar el historial.

La importación solo se marca completa cuando se concilian las filas distintas con el total oficial. Una paginación desconocida, timeout o número incompleto produce error o importación parcial. No se modifica la fecha de la última sincronización completa ante un resultado parcial. Para reemplazar/archivar una vinculación con sesión, primero se debe desconectar el ejecutor.

**Verificación de esta entrega:**

- `php artisan test --compact tests/Feature/Cuaderno`: 31 pruebas, 240 aserciones. Incluyen credenciales no persistidas, cifrado/ocultación de sesión, aislamiento por propietario/proyecto, deduplicación, filtros, confirmación explícita, cambio de cuaderno y conteos parciales.
- `node scripts/cuaderno-smoke.mjs`: prueba de Chrome con páginas ficticias interceptadas; ingreso, selección, identidad, filas, paginación y protección del origen correctos.
- `node scripts/cuaderno-public-check.mjs`: los controles del ingreso público real coinciden; no se rellenaron credenciales ni se inició sesión.
- Salud del ejecutor: petición autorizada correcta; petición sin token rechazada con HTTP 403.
- `npm.cmd run types` y `npm.cmd run build`: correctos. Vite mostró las advertencias de bundles grandes. Pint y Prettier ejecutados.
- Migración local aplicada: `2026_10_06_000002_add_cuaderno_connection_and_asientos.php`. No se ejecutaron otras migraciones pendientes.

**Pendiente para cerrar el piloto:** autenticarse con la cuenta propia, verificar selección y bandeja reales y conciliar los 231 asientos observados en las capturas, si ese es el cuaderno elegido. Los selectores de la tabla proceden del JavaScript público, pero la paginación autenticada no se ha comprobado con datos reales. Los identificadores oficiales estables del cuaderno/asiento siguen por verificar; el número de asiento se usa como clave dentro de la vinculación, no como ID global.

Esta entrega importa la bandeja. La descripción completa de cada asiento, PDF, adjuntos, borradores y registro definitivo siguen pendientes en las fases posteriores. La revisión de términos completos/canal permitido de la fase 0 también sigue pendiente; solo el titular puede completar las pantallas oficiales de aceptación.

Referencias técnicas del mecanismo sin dependencias: [WebSocket nativo de Node](https://nodejs.org/docs/latest-v24.x/api/globals.html#class-websocket), [Chrome DevTools Runtime](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/) y [Chrome DevTools Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/).

### Fase A: experiencia de uso y arreglos (6 de octubre de 2026)

Objetivo: usar el cuaderno desde Costos con menos pasos que en el portal.

**Flujo nuevo (3 pasos, un botón principal por estado):**

1. **Conectar**: usuario y contraseña. Ya no se llena antes el formulario de entidad/obra/rol; la vinculación se crea al conectar y sus datos salen del cuaderno oficial. El usuario se recuerda en el navegador; la contraseña, no.
2. **Verificación**: si OECE pide 2FA o términos, la pantalla espera y consulta sola cada 4 s (hasta 5 min). No hace falta volver a pulsar "Actualizar".
3. **Elegir cuaderno**: tarjetas en las que se pulsa una vez; se resalta la que coincide con el CUI del proyecto. El rol se toma de la opción elegida.
4. **Confirmar**: los datos se detectan sin otro clic y **"Sí, vincular e importar asientos"** confirma e inicia la importación.
5. **Bandeja**: la importación corre en segundo plano en el conector, con barra de progreso (página y asientos de total). Se eliminó el tope de 35 s que dejaba incompletos los cuadernos grandes.

**Otros cambios:**

- Estado del conector visible y **"Iniciar conector"** desde Costos (`CUADERNO_RUNNER_AUTOSTART=true`, solo local). Si está apagado, la página vuelve a comprobarlo cada 5 s.
- Bandeja: búsqueda en vivo (número, título, usuario o nota), filtro por tipo con un clic y descarga CSV para Excel.
- Detalle por asiento: nota interna, enlaces locales entre asientos en ambos sentidos y "Copiar cita". Las notas y los enlaces se conservan al volver a importar y nunca se envían a OECE.
- Formulario manual, archivo e historial pasan a "Opciones avanzadas".
- **Capturar estructura de la página abierta**: guarda en `storage/app/private/cuaderno/diagnostico/{vinculo}/` botones, campos, columnas y encabezados de la pantalla abierta en el conector, sin valores de los campos. Se usa para programar las fases B y C con selectores reales.

**Arreglos:**

- Tras pulsar "Ingresar", el conector espera la respuesta real de OECE; antes podía leer el login todavía visible y reportar credenciales incorrectas.
- El mensaje de OECE (por ejemplo, clave incorrecta) se muestra al usuario.
- Importar sin cuaderno confirmado devuelve un mensaje claro; antes fallaba al comparar con una entidad vacía.
- Después del 2FA o de elegir el cuaderno, si el portal queda en una página interna, el conector abre la bandeja. Se usa una heurística: hay "Cerrar sesión" y no hay campo de código.

Migración local aplicada: `2026_10_06_000003_add_cuaderno_notes_and_references.php` (entidad/obra/rol pasan a nullable, `nota_local` y `cuaderno_referencias`). Rutas nuevas: `capture`, `conector/iniciar`, `exportar`, `asientos/{asiento}` (nota) y `asientos/{asiento}/referencias`.

**Verificación:** 44 pruebas Pest, 345 aserciones (`tests/Feature/Cuaderno`); smoke de Chrome con páginas ficticias, que cubre el mensaje de login, la detección de 2FA/sesión y la captura; 4 pruebas del diagnóstico Node; `npm run types`, ESLint, `npm run build`, Pint y Prettier. El arranque automático se probó en este equipo: el conector anterior se detuvo y el nuevo quedó activo. **No se probó contra el portal autenticado real**; los selectores del 2FA, la heurística "Cerrar sesión" y la paginación siguen sin confirmar.

### Conector invisible y control desde Costos (6 de octubre de 2026)

- El navegador del conector es **invisible (headless)**: ya no aparece una ventana que el usuario pueda cerrar sin querer. `CUADERNO_BROWSER_HEADLESS=false` lo vuelve a mostrar para depurar.
- **Bajo consumo:** un solo proceso de renderizado, sin GPU, extensiones ni servicios de fondo. No descarga imágenes, fuentes ni videos del portal; reCAPTCHA no se bloquea. Medido en este equipo sobre el ingreso público de OECE: unos **314 MB** de memoria privada, frente a 479 MB del headless estándar.
- **Apagado por inactividad:** tras `CUADERNO_BROWSER_IDLE_MINUTES` (10) sin uso se cierra y libera la RAM. La siguiente acción lo reabre con el mismo perfil privado (cookies y dispositivo de confianza). También se reabre si el conector se reinicia.
- **Vista remota** (`screen` / `interact`): cuando OECE pide código, términos o reconocer el dispositivo, Costos muestra los campos y botones de esa pantalla como formulario propio y los envía al portal. "Ver pantalla" muestra una captura en vivo que reenvía clics, texto y Enter, para pantallas no previstas o de otro dominio, como ID Perú. No se leen los valores escritos en los campos del portal.
- La pantalla real que aparece tras el 2FA (`/cuaderno-obra/bandeja`, con el enlace "Lista de asientos") se tomó de una captura de la sesión del titular.

**PCs antiguas:** la mejor opción es ejecutar el conector en el **servidor**. Cada PC solo abre Costos y no lanza ningún navegador propio. El conector ya es invisible, admite rutas de Chrome/Chromium en Linux y se controla por completo desde la web. Antes de desplegarlo hay que verificar que OECE acepte el ingreso desde la IP del VPS, que el 2FA confíe en el dispositivo del servidor y qué pasa con la ubicación (el navegador sin ventana la deniega, igual que en la captura original). También falta definir el aislamiento por usuario (un perfil por vinculación ya existe).

Verificación: 47 pruebas Pest (363 aserciones); smoke de Chrome invisible de bajo consumo, con formulario remoto, botón que se habilita tras escribir, captura y tecleo; `npm run types`, ESLint, Pint y `npm run build`.

### Fase B: detalle y PDF oficial (6 de octubre de 2026)

Estructura real observada con la sesión del titular (solo lectura):

- **Bandeja** `/bandeja-asientos`: las 231 filas en una sola página (elementos `mat-row`, sin paginación). Columna `mat-column-acciones` con tres botones por fila: `fa-eye` ("Ver detalle"), `fa-file-pdf` y `fa-paperclip` (adjuntos). Tiene "Nuevo asiento", "Exportar" y un filtro por "asiento de referencia" (`numAsiCuobRef`).
- **PDF**: el botón hace una petición XHR a `eap.oece.gob.pe/soec-codi/1.0/documento-download/{uuid}` y guarda un blob como `{uuid}.pdf`. Verificado: `%PDF-1.5` de 35 KB.
- **Detalle** `/operaciones/detalle-asiento/{uuid}` (UUID oficial estable del asiento): `utils-info-row` con Título, Tipo, Descripción completa, Asiento de referencia, Fecha y hora, Usuario, Rol, Latitud y Longitud.
- **Sesión expirada**: el portal conserva la página y muestra el modal "Tu sesión ha expirado — Vuelva a iniciar sesión"; la lista queda vacía. Ahora se detecta como `login` y Costos pide reconectar.

Implementado:

- Acción `asiento` del conector: pulsa el botón PDF de la fila (descarga capturada con `Browser.setDownloadBehavior`), abre el detalle, lo lee y vuelve a la bandeja.
- Laravel valida la identidad (entidad/obra) y que el título coincida con el asiento importado. Rechaza archivos que no empiezan con `%PDF-` y rutas fuera de la carpeta de la sesión. Guarda en `storage/app/private/cuaderno/pdf/{vinculo}/asiento-{n}.pdf` con SHA-256 y tamaño, y lo entrega solo al propietario (`asientos/{id}/pdf`, en línea o `?descargar=1`).
- Migración `2026_10_06_000004`: `external_id`, `descripcion`, `referencia`, `latitud`, `longitud`, `detalle_at`, `pdf_*`.
- Interfaz: "Documento oficial" en el detalle (descripción completa, Ver/Descargar PDF, Actualizar desde OECE), insignia PDF por fila, descarga masiva con progreso y botón Detener (se detiene ante una sesión expirada) y página a ancho completo con columnas adaptables.
- Capturas guiadas desde el menú ⋯: "Nuevo asiento" (sin enviar) y "Adjuntos". Registran método y URL de cada petición para confirmar que no se envía nada.

Verificación: 53 pruebas Pest (396 aserciones); smoke con descarga real de PDF desde un botón de fila, lectura de detalle y modal de sesión expirada; `npm run types`, ESLint y Pint. Build no ejecutado porque `npm run dev` estaba activo.

**Sesión caducada sin aviso (hallazgo real):** al reabrir el navegador, el portal restaura `/bandeja-asientos` con el token vencido. Se ve la cabecera, "Nuevo asiento" y "Filtros", pero sin lista ni total, sin formulario de filtros y sin modal. Al navegar a Inicio, el portal redirige a `/login`. Ahora `inspectPortal` la marca `stale`, `openInbox` pasa por Inicio para que el portal compruebe la sesión y devuelve `login` si caducó. Durante "Conectar", si el perfil restauró una sesión muerta, se vuelve a ingresar con las credenciales recién escritas.

**Descargas por bloques (pensado para cuadernos de más de 1000 asientos):** centro de descargas con alcance Todos / Rango por número / Seleccionados (casillas por fila que se mantienen entre páginas) y "solo los que faltan", siempre en orden de numeración. "Traer de OECE" en modo **solo PDF** (rápido: se queda en la bandeja) u opcionalmente con la descripción completa. "Bajar a mi computadora" entrega un **ZIP** de los PDF ya guardados, con nombres `0007 - Título.pdf` (ruta `pdfs`), sin necesidad de conexión con OECE.

**Cambiar de obra:** acción `switch` (enlace oficial "Cambiar a otra obra") → selección → si el cuaderno detectado es otro, "¿Cambiar el cuaderno de este proyecto?". `confirm` con `reemplazar`: archiva la vinculación anterior con sus asientos, PDF y notas, y crea una nueva a la que pasa la sesión del navegador.

**Copia local siempre disponible:** con la conexión caída, el paso de ingreso pasa a "Reconectar con OECE" y la bandeja local sigue permitiendo buscar, ver PDF ya descargados, enlazar y anotar.

Verificación: 57 pruebas Pest (419 aserciones), con reemplazo de obra, `switch`, solo PDF y ZIP ordenado; smoke con bandeja a medio cargar y "Cambiar a otra obra"; `npm run types`, ESLint y Pint.

**Pendiente:** adjuntos y "Nuevo asiento"/responder. La sesión expiró antes de poder abrirlos; requieren reconectar y usar las capturas guiadas.

### Producción: conector en la PC del titular (modo `agent`), 6 de octubre de 2026

**Motivo:** desde el VPS (IP de un datacenter de Hostinger), RENIEC muestra "Actividad no autorizada ha sido detectada" al ingresar. No se evade: el ingreso debe salir del equipo y la red de quien usa la cuenta.

**Arquitectura:**

```text
Usuario ─► ingenieros.tech (Costos)  ◄── HTTPS (pull cada 1–3 s) ── Conector en su PC (Perú)
               crea tareas y espera            ejecuta con Chrome/Edge invisible y responde
```

- `scripts/cuaderno/engine.mjs`: motor común (portal, sesiones, sync, PDF, vista remota). Lo usan `cuaderno-runner.mjs` (modo `local`, 127.0.0.1) y `cuaderno-agent.mjs` (modo `agent`).
- `CUADERNO_MODE=agent`: `CuadernoRunner::execute` no cambia su lógica. `CuadernoAgentBridge` convierte cada operación en una fila `cuaderno_tareas` y espera hasta 45 s (`CUADERNO_AGENT_TIMEOUT`) a que la PC la tome y la responda. El payload, que puede incluir la contraseña, va cifrado y se borra al tomarlo; las tareas respondidas se eliminan.
- Una conexión queda ligada a la PC donde se hizo (`cuaderno_vinculos.cuaderno_agente_id`), porque ahí vive su perfil de navegador. Si esa PC está apagada, se avisa en vez de esperar.
- **Enlace:** "Instalar conector en esta PC" genera un código de un solo uso (15 min) y un `instalar-conector-costos.cmd`. Este instala en `%LOCALAPPDATA%\CostosCuaderno`, sin permisos de administrador: baja Node portátil v24.4.1 (una vez), descarga el conector (`/api/cuaderno-agente/paquete`), lo enlaza (token propio; en el servidor solo se guarda su SHA-256) y lo deja iniciándose con Windows en segundo plano. Requiere Windows 10/11 de 64 bits con Chrome o Edge.
- **Autoactualización:** la versión es un hash de los archivos del conector; tras cada deploy, el conector se actualiza solo cuando está inactivo.
- **Desvincular** una PC revoca su token y termina las conexiones que vivían en ella; los datos importados se conservan.
- La API (`routes/api.php`, `/api/cuaderno-agente/*`) no tiene sesión ni CSRF. Se excluye de `TrimStrings`/`ConvertEmptyStringsToNull` para que los campos vacíos de OECE lleguen intactos.

**Servidor:** con `CUADERNO_MODE=agent` el VPS ya no necesita Chrome ni el programa `pcl-cuaderno` de Supervisor. Cada operación en curso ocupa un proceso PHP-FPM mientras espera (hasta 45 s): revisar `pm.max_children`. La subida de PDF requiere `client_max_body_size` ≥ 110 MB en Nginx.

Verificación: 64 pruebas Pest del módulo (474 aserciones): enlace de un solo uso, tarea entregada una vez con la contraseña borrada, PDF solo dentro de la carpeta de la sesión, campos vacíos intactos, conexión completa a través del puente, PC apagada y revocación. `cuaderno-agent-smoke.mjs` ejecuta el conector real contra un servidor falso (enlace, tarea, respuesta, instancia única). El smoke del navegador y el conector local siguen funcionando tras separar el motor; el instalador PowerShell se validó sintácticamente. Suite completa: los 7 fallos restantes son preexistentes y ajenos al módulo (constante de módulos en `CostoProjectTest`, DIALux). **Pendiente:** instalación real en una PC con Windows y conexión a OECE desde producción.

### Asistente del Cuaderno: extensión de Chrome/Edge (camino principal), 6 de octubre de 2026

**Motivo:** el personal usa sus propias laptops y PC, en la oficina o en casa, y no tiene conocimientos técnicos. Instalar un programa es una barrera; una extensión desde la tienda oficial es un clic conocido. Además usa el navegador que ya tienen abierto (sin RAM extra) y su propia sesión de OECE (la contraseña nunca pasa por Costos).

**Cómo funciona:**

- `extension/cuaderno/` (Manifest V3): `costos-bridge.js` (en las páginas de Costos: marca la página, enlaza y mantiene despierto el service worker), `background.js` (toma tareas de `/api/cuaderno-agente` con `tipo=extension`, sube PDF y responde) y `executor.js` (mismos pasos que `engine.mjs`, pero con `chrome.scripting` sobre la pestaña de OECE del usuario). `dom.js` es la misma copia de `scripts/cuaderno/dom.mjs`.
- **Enlace automático:** si la extensión está instalada, la página pide un código y se lo entrega; no hay nada que escribir.
- **"Conectar"** abre o usa la pestaña de OECE. Si no hay sesión, el usuario entra ahí como siempre y Costos lo detecta cada 3 s. Con la extensión en línea, la validación ya no exige usuario ni contraseña.
- **PDF oficial:** mientras Costos lo pide, se toma el Blob que arma el propio portal (`URL.createObjectURL`), así el archivo no cae en la carpeta Descargas. Hay una red de seguridad con `chrome.downloads`.
- El conector de PC queda como alternativa ("¿No puedes usar extensiones?").

**Distribución:**

- Piloto: "Descargar asistente (versión de prueba)" en el Cuaderno (`/costos/{p}/cuaderno/agente/extension`, con el sitio actual en el manifiesto) → `chrome://extensions` → Modo de desarrollador → Cargar descomprimida.
- Tiendas: `php artisan cuaderno:extension --origin=https://ingenieros.tech` genera el zip; después se define `CUADERNO_EXTENSION_URL` y la pantalla muestra "Agregar a Chrome o Edge". Falta para publicar: cuentas de desarrollador (Chrome USD 5 único, Edge gratis), iconos, capturas y política de privacidad.

Verificación: 67 pruebas Pest del módulo (493 aserciones), con enlace `tipo=extension`, conexión sin credenciales, credenciales todavía exigidas con un conector de PC y zip con el sitio en el manifiesto. `cuaderno-extension-smoke.mjs` ejecuta el `executor.js` real sobre Chrome invisible con un shim mínimo de `chrome.*`: conectar, ingreso en la pestaña del usuario, sincronización, captura del PDF, detalle, solo PDF y cambio de obra (tres corridas seguidas). Edge cargó la extensión empaquetada y su service worker arrancó. **Pendiente:** prueba real en Chrome/Edge del usuario contra OECE.

### Próximas fases

| Fase | Alcance | Qué necesita del titular |
| --- | --- | --- |
| B. Detalle, PDF y adjuntos (fase 3) | Leer la descripción completa de cada asiento, descargar el PDF oficial y los adjuntos al disco privado y mostrarlos en el detalle | Abrir un asiento y su PDF en la ventana del conector y pulsar "Capturar estructura" en cada pantalla |
| C. Borradores y registro (fases 4–5) | Preparar el asiento en Costos (tipo, título, descripción, referencias, adjuntos), enviarlo a borrador oficial y registrarlo con revisión final y conciliación | Capturar la pantalla de nuevo asiento y su confirmación sin enviar nada; luego una prueba con un asiento legítimo |
| D. Sustento de costos (fase 6) | Enlazar asientos con valorizaciones y metrados; sincronización programada | Elegir qué documentos de Costos se enlazan |

## 12. Referencias oficiales y alcance de la investigación

- [Manual vigente del Cuaderno de Incidencias CDI, publicación de versión 1.4](https://www.gob.pe/institucion/oece/informes-publicaciones/8074763-manual-de-usuario-del-cuaderno-de-incidencias-cdi-vigente). La publicación se encontró en la búsqueda; no se revisó el PDF completo.
- [Aviso oficial de implementación de 2FA](https://www.gob.pe/institucion/oece/noticias/1226584-aviso-implementacion-del-doble-factor-de-autenticacion-2fa-en-el-cuaderno-de-incidencias-de-obras-del-seace). Sustenta la necesidad de intervención para autenticación facial u OTP.
- [Acceso oficial al cuaderno](https://www.gob.pe/10601-acceder-al-cuaderno-de-obra-digital). La información indexada señala aceptación de términos para continuar.
- [Términos y condiciones del portal](https://apps.oece.gob.pe/cuaderno-obra/terminos-y-condiciones). No se logró recuperar el contenido completo con la herramienta web; revisión pendiente en fase 0.

Las pantallas aportadas por el usuario sustentan la secuencia y los campos observados. No se inició sesión, no se usaron credenciales, no se extrajeron datos privados y no se crearon asientos durante la elaboración del plan.
