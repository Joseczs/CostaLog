# CONTRATOS — COSTACON

**Este archivo es el punto de entrada de cada sesión de desarrollo.**
Se lee completo al empezar. Se actualiza al terminar. Nada más se lee salvo los
archivos que el bloque en curso vaya a tocar.

Si una firma cambia, se actualiza aquí **en el mismo commit**. Un contrato
desactualizado es peor que no tenerlo.

---

## Estado de bloques

| # | Bloque | Estado | Verificación |
|---|---|---|---|
| 0 | Reglas + motor de cálculo | ✅ hecho | 99/99 tests |
| 1 | Capa de datos (repositorios) | ✅ hecho | 50/50 tests + harness |
| 2 | Roles + reglas Firestore | ✅ hecho | matriz + login manual 2 roles |
| 3 | Configuración del proyecto | ✅ hecho | 15/15 tests + checklist visual |
| 4a | Fundaciones + lista de metas | ✅ hecho | 22/22 + 15/15 + checklist visual |
| 4b | Detalle de meta e hitos | ⬜ | decisiones cerradas, sin código |
| 4c | Propuesta de avance (móvil) | ⬜ | — |
| 5 | Resumen y proyección de bono | ⬜ | — |
| 6 | Extras, créditos y evaluaciones | ⬜ | — |
| 7 | Tareas BP + migración de pesos | ⬜ | — |
| 8 | Pagos y exportación Excel | ⬜ | — |

---

## Bloque 0 — `reglasBono.config.js` ✅

```js
REGLAS_BONO_DEFAULT            // objeto congelado con 13 campos
tarifaHoraEconomizada(reglas)  // → number   (₡640 con los defaults)
tarifaDiaAnticipado(reglas)    // → number   (₡15 000 con los defaults)
validarReglasBono(reglas)      // → string[] (vacío = válido)
normalizarReglas(parciales)    // → objeto completo
```

## Bloque 0 — `calculoMeta.js` ✅

```js
// Fechas
aFecha(v)                                  // Date | Timestamp | ISO → Date
diffDias(hasta, desde)                     // → number (días calendario)

// Hitos
hhEstimadasHito(hito)                      // → number
hhGanadasHito(hito)                         // → number

// Bloques de la meta
diasAnticipados(meta, reglas)              // → number ≥ 0
hhMiscelaneos(meta, reglas, diasAntic)     // → number ≥ 0
aplicaBonoBase(meta)                       // → boolean
calcularFactorCalidad(evaluaciones)        // → number 0–1

// HH de producción: asistencia vs. planilla (D-12)
hhConsumidasEstimadas(asistencias, reglas)          // → number (sin ponderar por rol)
hhProduccion(meta, asistencias, reglas)             // → { valor, hhReal, hhEstimada,
                                                    //     origen, diasEstimados, esDefinitivo }
compararEstimadoVsPlanilla(est, real, tol = 0.1)    // → { desviacion, desviacionPct, alerta }

// Cálculo principal
calcularBonoMeta(meta, hitos, evaluaciones, reglas, asistencias = []) // → ResultadoBono

// Bono por Productividad
calcularTareaBP(tarea, reglas)             // → { hhEstimadas, hhAsignadas, montoBP, bpGanado }
validarDistribucionBP(cuadrilla)           // → string[]
repartirEnteros(total, fracciones)         // → number[] (suma exacta)
repartirBP(montoBP, cuadrilla)             // → cuadrilla con .monto
pesosAPorcentajes(cuadrilla)               // → cuadrilla con .pctBP
repartirPorPesosLegado(montoBP, cuadrilla) // solo para verificar migración
```

**`ResultadoBono`** — todo en números, sin formato:

```js
{
  hhEstimadasTotal, hhGanadasTotal, hhMiscelaneos,
  hhPlanilla,                   // cifra usada, venga de donde venga
  produccion,                   // { valor, hhReal, hhEstimada, origen, diasEstimados, esDefinitivo }
  hhEconomizadas,
  indicador,                    // fracción, no porcentaje (0.3555)
  diasAnticipados,
  tarifaHoraEconomizada, tarifaDiaAnticipado,
  bonoBase, bonoBaseSePerdio,   // boolean para avisar en la UI
  bonoAnticipada,
  bonoProductividad,            // con piso en 0 (D-01)
  bonoProductividadSinPiso,     // para mostrar el déficit
  bonoTotalBruto, factorCalidad,
  bonoING, bonoMO,
}
```

**Invariantes que no se rompen:**

- Ambos módulos son **puros**: sin Firestore, sin DOM, sin red, sin `Date.now()`.
- `indicador` es fracción, no porcentaje. Multiplicar por 100 solo al pintar.
- Un hito con `activo: false` no entra en ningún total.
- Un hito de tipo `credito` trae `cantidad` negativa y resta solo.
- `repartirEnteros` garantiza que las partes suman exactamente el total.
- **La asistencia NO se pondera por rol.** Un ayudante en obra 11 horas consumió
  11 HH, igual que un operario. Los pesos 1.0 / 0.5 nunca tuvieron que ver con
  horas consumidas.
- `asistencias` es opcional: sin ella, `calcularBonoMeta` se comporta exactamente
  como antes y usa solo `meta.hhPlanilla`. El caso del Excel no cambia.

---

## Bloque 1 — capa de datos ✅

Cuatro archivos en `public/js/repos/`. Cada uno exporta **una fábrica** que
recibe `db` y devuelve el repositorio:

```js
import { db } from '../js/firebase-config.js';
import { crearProyectosRepo } from '../js/repos/proyectosRepo.js';
const proyectosRepo = crearProyectosRepo(db);
```

Los repos importan las primitivas de Firestore desde `../firebase-config.js`,
igual que los controladores. Así la versión del SDK vive en un solo lugar: si
dos archivos importaran versiones distintas del CDN, habría dos instancias de
Firestore en memoria y los síntomas serían incomprensibles.

Requiere agregar `writeBatch` a los re-exports de `firebase-config.js` — es el
único archivo fuera del bloque 1 que se toca, y el cambio es aditivo.

### `proyectosRepo.js`

```js
crearProyectosRepo(db)                               // → repo

listar()                                             // → Proyecto[]  activos, por nombre
obtener(proyectoId, { incluirInactivos = false })    // → Proyecto | null
crear(datos)                                         // → string  (id)
actualizar(proyectoId, cambios)                      // → void
actualizarReglas(proyectoId, reglasBono)             // → void   mapa completo
desactivar(proyectoId)                               // → void   activo: false
```

### `metasRepo.js`

```js
crearMetasRepo(db)                                   // → repo

listar(proyectoId)                                   // → Meta[]  activas, numero desc
obtener(proyectoId, metaId, { incluirInactivos })    // → Meta | null
siguienteNumero(proyectoId)                          // → number  cuenta también las borradas
crear(proyectoId, datos)                             // → string  (id)
actualizar(proyectoId, metaId, cambios)              // → void
desactivar(proyectoId, metaId)                       // → void
guardarTotales(proyectoId, metaId, totales)          // → void   solo para LISTAS
congelarSnapshot(proyectoId, metaId, reglas)         // → void   D-10
actualizarSnapshot(proyectoId, metaId, reglas, uid)  // → void   D-10, auditado

// Subcolección evaluaciones (ornato / SO)
listarEvaluaciones(proyectoId, metaId)               // → Evaluacion[]  fecha asc
crearEvaluacion(proyectoId, metaId, datos)           // → string  (id)
actualizarEvaluacion(proyectoId, metaId, evalId, c)  // → void
desactivarEvaluacion(proyectoId, metaId, evalId)     // → void
```

`crear()` rellena por omisión: `estado: 'abierta'`, `hhPlanilla: 0`,
`ajusteDiasHabiles: 0`, `fechaEntrega: null`, `hhPlanillaAlCorte: null`,
`reglasSnapshot: null`, `activo: true`, `createdAt`.

`congelarSnapshot` **no cambia el `estado`**: eso lo decide el controlador.
`actualizarSnapshot(…, null, uid)` devuelve la meta a la configuración viva del
proyecto y deja `snapshotActualizadoPor` / `snapshotActualizadoEn`.

### `hitosRepo.js`

```js
crearHitosRepo(db)                                   // → repo

listar(proyectoId, metaId)                           // → Hito[]  activos, por `orden`
obtener(proyectoId, metaId, hitoId, { incluir… })    // → Hito | null
crear(proyectoId, metaId, datos)                     // → string  (id)
crearVarios(proyectoId, metaId, lista)               // → string[]  lotes de 500
actualizar(proyectoId, metaId, hitoId, cambios)      // → void
proponerAvance(pId, mId, hId, avance, uid)           // → void    D-11, no toca avancePct
aprobarAvance(pId, mId, hId, uid, { avanceAprobado })// → number  D-11, limpia la propuesta
desactivar(proyectoId, metaId, hitoId)               // → void
siguienteCodigo(proyectoId, metaId, prefijo)         // → string  'EXTRA.03'
```

`aprobarAvance` sin `avanceAprobado` toma el valor propuesto; con él, aprueba
otro número (el ingeniero recorrió el sitio y no coincidió). En los dos casos
deja `avancePropuesto: null`, para que en la tabla no queden dos cifras iguales.

Ambas funciones de avance rechazan cualquier valor fuera de 0–100.

### `tareasRepo.js`

```js
crearTareasRepo(db)                                  // → repo

listar(proyectoId)                                   // → Tarea[]  horaInicio desc
listarPorMeta(proyectoId, metaId)                    // → Tarea[]
listarDeTodosLosProyectos()                          // → Tarea[]  + proyectoId, proyectoNombre
obtener(proyectoId, tareaId, { incluirInactivos })   // → Tarea | null
crear(proyectoId, datos)                             // → string  (id)
actualizar(proyectoId, tareaId, cambios)             // → void
guardarCuadrilla(proyectoId, tareaId, cuadrilla)     // → void   arreglo completo
cerrar(pId, tId, { horaFin, hhRealCuadrilla, bpGanado })  // → void
desactivar(proyectoId, tareaId)                      // → void
```

`cerrar()` exige `bpGanado` booleano: el BP es binario y no acepta ambigüedad.
El repo **no decide plata** — `bpGanado` se calcula con `calcularTareaBP()` y
llega ya resuelto.

`listarDeTodosLosProyectos()` es el reemplazo de `collectionGroup('tareas')`:
itera `proyectos → tareas` con consultas normales. Cuesta 1 + N lecturas de
colección. Si algún día pesa, se cachea la lista de proyectos; no se vuelve a
`collectionGroup`.

---

**Invariantes que no se rompen:**

- **Cero `collectionGroup`.** Siempre `proyectos → subcolección`.
- **Cero índices compuestos.** Ninguna consulta lleva `where` ni `orderBy`: se
  trae la colección y se filtra y ordena en memoria. Es lo que hace falta para
  cumplir las dos reglas a la vez — `where('activo','==',true)` combinado con
  `orderBy('orden')` exige un índice compuesto, y además dejaría fuera todo
  documento viejo que no tenga el campo `activo`.
- **Activo por omisión.** `activo !== false`. Un documento sin el campo cuenta
  como activo; si no, la migración escondería media base.
- **Nada de tipos de Firestore afuera.** Todo `Timestamp` sale como `Date`,
  incluidos los que están anidados dentro de mapas y arreglos.
- **Todo documento sale con `id`.** Nunca un `DocumentSnapshot`.
- **Todo borrado es `activo: false`.** El histórico de bonos cuelga de esto.
- Las funciones de listado devuelven `[]`, no `null`. Las de obtener devuelven
  `null`, no lanzan.
- Los repos no validan reglas de negocio. Solo estructura: ids presentes,
  `estado` y `tipo` dentro de sus valores, avance en 0–100, `bpGanado` booleano.

**Fuera de alcance, declarado:**

- `asistencias` (D-12) — bloque 7b, como extensión de `metasRepo.js`.
- `proyectos/{id}/pagos` (§4) — el bloque 8 no tiene repo asignado. Hay que
  decidir dónde viven antes de abrirlo.
- Validación de signo de créditos (`credito ⇒ cantidad < 0`) — bloque 6.

**Verificación:** `test/pruebas.mjs`, 50 casos contra un Firestore en memoria
(50/50), más `harness.html` contra la base real. Los dos quedan fuera del deploy.

---

## Bloque 2 — Roles y reglas de Firestore ✅

### Los dos roles

| id en Firestore | Persona | Directorio de páginas |
|---|---|---|
| `ingeniero` | Ingeniero Residente | `/supervisor/*` ⚠️ nombre viejo |
| `supervisor` | Maestro de Obras ≡ Jefe de Cuadrilla (D-04) | `/jefe/*` ⚠️ nombre viejo |

`jefe_cuadrilla` y `admin` **ya no existen**. Ningún otro valor concede permiso.

**El string `supervisor` cambió de significado.** Antes era la oficina; ahora es
el campo. Un documento de usuario anterior a la migración con `rol: 'supervisor'`
es un **ingeniero**. El desempate es `rolMigradoEn`: si está presente, el valor
de `rol` ya es del modelo nuevo.

### `public/js/roles.js`

Único lugar donde se escribe un identificador de rol. Ningún archivo vuelve a
poner el string a mano.

```js
ROL_INGENIERO   // 'ingeniero'
ROL_SUPERVISOR  // 'supervisor'
ROLES           // ['ingeniero', 'supervisor']  congelado
ETIQUETA_ROL    // { ingeniero: 'Ingeniero Residente', supervisor: 'Maestro de Obras' }
HOME_POR_ROL    // { ingeniero: '/supervisor/dashboard.html', supervisor: '/jefe/mis-tareas.html' }
esIngeniero(perfil) · esSupervisor(perfil) · esRolValido(rol)
```

### `auth.js` — sin cambio de firma

```js
protegerPagina(rolesPermitidos, callback)   // ahora recibe constantes de roles.js
rutaHomePorRol(rol)                          // rol inválido → home del supervisor
```

`rutaHomePorRol` degrada al rol de **menos** alcance ante un valor desconocido,
nunca al de más. `renderSidebar` hace lo mismo con el menú.

### Matriz de permisos vigente

Fila = documento. `≡uid` = solo sobre el suyo. `∅` = borrado duro prohibido en
toda la base; el histórico de bonos cuelga del soft-delete.

| Documento | read | create | update | delete |
|---|---|---|---|---|
| `usuarios/{uid}` | autenticado | ≡uid | ≡uid · ingeniero | ∅ |
| `usuarios/{uid}/empleados/{id}` | ambos | ingeniero | ingeniero · supervisor≡uid solo `disponible` | ∅ |
| `proyectos/{id}` | ambos | ingeniero | ingeniero | ∅ |
| `proyectos/../metas/{id}` | ambos | ingeniero | ingeniero | ∅ |
| `../metas/../hitos/{id}` | ambos | ingeniero | ingeniero · supervisor solo `avancePropuesto`,`propuestoPor`,`propuestoEn` | ∅ |
| `../metas/../evaluaciones/{id}` | ambos | ingeniero | ingeniero | ∅ |
| `../metas/../asistencias/{fecha}` | ambos | ambos | ambos | ∅ |
| `proyectos/../tareas/{id}` | ambos | ingeniero | ingeniero · supervisor si `jefeCuadrillaId == uid` | ∅ |
| `../tareas/../registrosHoras/{empId}` | ambos | ingeniero · supervisor asignado a esa tarea (write) | ∅ |
| `proyectos/../pagos/{id}` | ambos | ingeniero | ingeniero | ∅ |

**Invariantes que no se rompen:**

- **D-11 se aplica en el servidor, no en la interfaz.** `avancePct` — el número
  que el motor convierte en dinero — es inescribible para el rol que cobra el
  `bonoMO`. El supervisor solo alcanza `avancePropuesto`. Si algún día el paso
  de aprobación resulta burocrático y se elimina, se elimina *aquí* primero.
- **`activo` y `disponible` los escriben roles distintos.** `activo` es alta y
  soft-delete del ingeniero; `disponible` es la asistencia del día y la marca el
  supervisor sobre su propio roster. La regla usa `hasOnly(['disponible'])`.
- **`activo` ausente cuenta como activo**, igual que en los repos. Una regla que
  exigiera el campo escondería media base.
- **Cero borrado duro.** `deleteDoc` se re-exporta en `firebase-config.js` pero
  no se invoca en ningún archivo, y las reglas lo niegan en los 9 documentos.
- El campo `jefeCuadrillaId` de `tareas` **conserva su nombre**. Renombrarlo es
  migración de datos y pertenece al bloque 7. Hoy guarda el uid del supervisor.
- `metas`, `hitos`, `evaluaciones` y `pagos` ya tienen reglas aunque sus
  pantallas no existan: evita repetir el deploy en los bloques 3–8.
  `asistencias` (D-12) queda escrita para el bloque 7b, sin consumidores.

### `scripts/migrar-roles.js`

```
node scripts/migrar-roles.js              # simulación, no escribe
node scripts/migrar-roles.js --escribir   # aplica
```

Requiere `npm install firebase-admin` y `serviceAccountKey.json` en la raíz
(**agregarlo a `.gitignore` antes de descargarlo** — da acceso total sin reglas).

Mapa: `supervisor→ingeniero`, `jefe_cuadrilla→supervisor`, `jefeCuadrilla→supervisor`,
`admin→ingeniero`. Escribe `rolAnterior` y `rolMigradoEn`; `rolAnterior` no se borra.

Aborta sin escribir nada si aparece un rol fuera del mapa, o si el resultado
dejaría **cero ingenieros** (nadie podría crear proyectos ni metas). Backup a
JSON siempre, incluso en simulación. Idempotente: se puede correr dos veces.

### Deuda declarada — no es olvido

1. **El registro público no valida el rol.** `allow create: if esElMismoUsuario(uid)`
   no mira el campo `rol`. Cualquier cuenta autenticada puede crearse a sí misma
   como `ingeniero` desde la consola del navegador y quedar habilitada para
   aprobar su propio avance y cerrar metas. **Mientras esto siga abierto, el
   contrapeso de D-11 es de interfaz, no de seguridad.** Diferido por decisión
   explícita; conviene que no llegue a producción con obra real.
2. **El supervisor ve todos los proyectos, no "solo los suyos"** (§6). No existe
   el campo que ate un proyecto a sus supervisores. Requiere `supervisorIds:
   string[]` en el documento del proyecto — candidato natural para el bloque 3.
3. **Los directorios `/supervisor/` y `/jefe/` quedaron con el nombre invertido.**
   Renombrarlos durante un intercambio de roles duplicaba el radio de impacto.
   `/supervisor/*` es del ingeniero, `/jefe/*` del supervisor.
4. `tarea-detalle` quedó solo para `ingeniero`. La matriz §6 da al supervisor
   asignar cuadrilla y reportar HH; su camino hoy es `/jefe/horas.html`. El
   bloque 7 reescribe esa pantalla y ahí se decide si se unifican.

**Verificación — hecha en producción, no en teoría:**

- 3 usuarios migrados: 2 a `ingeniero`, 1 a `supervisor`. Cero problemas.
- Reglas compiladas y desplegadas con `firebase deploy --only firestore`.
- Cuenta `ingeniero`: entra al dashboard, crea proyecto, persiste.
- Cuenta `supervisor`: entra a sus tareas, **el toggle de `disponible` funciona**
  — el pendiente que arrastraba desde varias sesiones queda cerrado —, y
  `/supervisor/dashboard.html` escrito a mano la rebota.

Ese rebote prueba el guardia de **interfaz**. El del **servidor** son las reglas,
y quedó probado indirectamente: si estuvieran mal, la creación del proyecto o el
toggle habrían fallado. Un usuario decidido salta el JavaScript, no las reglas.

---

## Bloque 2 — la trampa que costó la sesión entera

**El repositorio tenía dos historias sin ancestro común.** `git merge-base main master`
devolvía vacío: `master` no se bifurcó de `main`, nació aparte. Netlify publicaba
`main`; todo el desarrollo vivía en `master`.

Consecuencia: **ningún push llegó nunca al sitio.** Ni el bloque 0, ni el 1, ni el 2.
No se notó antes porque los bloques 0 y 1 son módulos puros y repositorios que
ninguna pantalla carga todavía — faltar no rompe nada. El bloque 2 fue el primero
que tocó archivos que el navegador sí pide, y ahí explotó.

**El síntoma engañoso:** `roles.js` daba 404 y devolvía `index.html` por el redirect
de `netlify.toml`. El navegador rechazaba el módulo por MIME type. Parecía que
Netlify no copiaba archivos nuevos. No era eso: Netlify construía otra rama.

**El dato que lo delataba estaba a la vista desde el principio:** la lista de deploys
decía `main@8834586`. La rama y el hash no eran los del push.

> **Regla para la próxima.** Cuando un deploy no refleje un push, lo primero es
> verificar **qué commit construyó el proveedor**, antes de teorizar sobre caché,
> archivos nuevos o configuración. Un hash que no cambia es el diagnóstico entero.

**Segundo hallazgo, del mismo origen.** Ya con la rama corregida, el dashboard
seguía muerto: faltaba `public/js/reglasBono.config.js`, borrado por un commit de
limpieza anterior en `master` y que solo sobrevivía en `main`. Se restauró con
`git checkout origin/main -- public/js/reglasBono.config.js`. Mismo síntoma exacto
—404 → HTML → MIME type— y por eso el error de consola es tan reconocible.

**Estado del repositorio al cerrar:**

- Rama única: `master`. `main` borrada; sus 30 commits conservados en el tag
  `archivo-main` por si alguna vez hacen falta.
- Rama por defecto de GitHub y rama de producción de Netlify: ambas `master`.
- `package.json` sin `netlify-cli` (incompatible con Node v26). El script
  `npm run deploy` ya no corre; se publica por push, que es el flujo real.
- **No volver a subir archivos por la interfaz web de GitHub.** Los 30 commits de
  `main` eran "Add files via upload" / "Delete public directory", y esa mecánica
  fue el origen de la historia paralela.

---

## Bloque 3 — configuración del proyecto ✅

Dos archivos, ambos nuevos, ninguno de otro bloque tocado:
`public/supervisor/config-proyecto.html` · `public/supervisor/config-proyecto-controller.js`

Pantalla de `reglasBono` por proyecto. Solo rol `ingeniero`
(`protegerPagina([ROL_INGENIERO], …)`). Es la que evita que alguien vuelva a
tratar los ₡640 como una constante caída del cielo.

### El controlador está partido en dos mitades

**Arriba, funciones puras** — sin DOM, sin Firestore, sin red. Se importan desde
Node para la prueba de aceptación:

```js
CAMPOS_NUMERICOS            // 10 strings congelados, en orden de pintado
formatearColones(n)         // 640 → "₡640" · 15000 → "₡15 000" · NaN → "—"
formatearNumero(n)          // igual, sin el símbolo
reglasDesdeValores(valores) // {campo: string} → objeto de reglas completo
textoTarifas(reglas)        // → { hora, dia, horaValida, diaValida,
                            //     formulaHora, formulaDia }  ya formateado
prepararGuardado(valores)   // → { ok, errores, reglas }  puerta única al guardado
```

**Abajo, el arranque del navegador**, dentro de
`if (typeof document !== 'undefined' && document.getElementById('form-reglas'))`.
Firebase se importa **de forma diferida** (`await import`) dentro de esa mitad.
Con imports estáticos, importar el archivo en Node intentaría bajar el SDK del
CDN y no habría prueba ejecutable. Es el precio de mantener el bloque en dos
archivos, y está pagado a propósito.

### Invariantes que no se rompen

- **El controlador no valida por su cuenta.** Toda la regla de negocio es
  `validarReglasBono()` del bloque 0. `prepararGuardado()` arma el objeto y
  pregunta; no tiene un solo `if` de negocio propio.
- **Un campo vacío entra como `NaN`, nunca como `0`.** Silenciarlo con `|| 0`
  guardaría un cero que nadie escribió, y un cero acá es dinero. El validador lo
  rechaza con el nombre del campo.
- **Nada se escribe al abrir.** Un proyecto sin el mapa `reglasBono` —hoy son
  todos— pinta `normalizarReglas({})` y muestra el aviso *"nunca ha guardado sus
  reglas"*. La escritura ocurre solo con el botón Guardar.
- **El mapa va completo a `actualizarReglas()`**, con sus 12 campos, normalizado.
  Nunca campo por campo: el contrato del repo lo exige y a medias quedan mapas
  rotos.
- **Las dos tarifas son solo lectura.** No hay input que las escriba, y no se
  guardan en Firestore: se derivan en cada tecla. Cada una muestra su fórmula
  debajo (`3 600 × 20 % = ₡720`), que es el punto entero de la pantalla.
- **Los dos booleanos de política no se editan.** `permitirBonoNegativo` (D-01) y
  `permitirDiasAtrasoNegativos` (D-06) son decisiones de empresa, no de proyecto;
  la sección 5.3 de la especificación dice explícitamente que el segundo no se
  expone. Se muestran como texto en la tarjeta "Políticas cerradas" y salen de
  `REGLAS_BONO_DEFAULT` al guardar.

### Navegación

`config-proyecto.html?proyecto=<id>` preselecciona; sin el parámetro, el propio
selector lista `proyectosRepo.listar()`. Al elegir, la URL se actualiza con
`history.replaceState` para que el enlace se pueda compartir. Un id que no esté
en la lista se ignora en silencio.

**La pantalla no tiene entrada de menú.** Agregarla exige tocar `js/sidebar.js`,
que es del bloque 2. Se llega por URL hasta el bloque 4. Ver deuda 6.

### Guardado explícito, no autoguardado — y por qué

Las tarifas se recalculan en memoria en cada tecla (3.65 µs, medido en el bloque
0); a Firestore se escribe solo al pulsar Guardar. Es deliberado: `reglasBono`
mueve todos los montos del proyecto a la vez, y un autoguardado con debounce
persistiría estados intermedios de un número a medio digitar — `320` en el
camino de `3200` a `3600` es un mapa válido que el validador acepta.

Si algún día se quisiera autoguardar, el punto de cambio es uno solo: el
`submit` del formulario llama `prepararGuardado()` y luego
`actualizarReglas()`. Mover esas dos líneas al `input` con debounce es todo el
cambio; nada más depende de que el guardado sea manual.

### Deuda declarada — no es olvido

5. **`formato.js` no existe todavía.** El plan lo pide "desde el bloque 3", pero
   sería un tercer archivo y el bloque son dos. `formatearColones` y
   `formatearNumero` viven por ahora dentro del controlador, marcados en el
   código. **Se mudan en el bloque 4**, antes de que aparezca la segunda
   pantalla que escribe ₡498 480 — que es exactamente cuando empiezan a
   divergir.
6. **Sin entrada de menú.** El ítem entra a `sidebar.js` cuando el bloque 4 abra
   la lista de metas y haya que tocar ese archivo de todos modos.
7. **`supervisorIds` sigue pendiente** (deuda 2 del bloque 2). El plan lo marcaba
   como candidato natural de este bloque, y se dejó fuera a propósito: no es
   parte de `reglasBono` y atar un proyecto a sus supervisores exige cambiar
   `firestore.rules`, que es del bloque 2. Necesita bloque propio, con su deploy
   de reglas. **Mientras siga abierta, el supervisor ve todos los proyectos.**

**Verificación:** `test/bloque3.mjs`, 15 casos en Node sin red (15/15). Cubre los
dos criterios del plan —₡3 600 ⇒ ₡720 sin recargar, y 100 + 20 = 120 rechazado—
más las guardas del formulario. Fuera del deploy, igual que `test/pruebas.mjs`.

---

## Fixture UNA UNIDEPRO — cargado en Firestore

`scripts/cargar-fixture-unidepro.js` — andamio, fuera del deploy.

```
node scripts/cargar-fixture-unidepro.js              # simulación
node scripts/cargar-fixture-unidepro.js --escribir   # aplica (idempotente)
node scripts/cargar-fixture-unidepro.js --borrar --escribir
```

Escribe el caso de aceptación §5.6, que hasta ahora solo existía en memoria
dentro de `public/js/core/fixtures/meta-unidepro-1.js`. Sin esto, la prueba del
bloque 4b no tiene qué leer.

```
proyectos/fixture-unidepro          ← esFixture: true · reglasBono completo
└── metas/meta-1                    ← estado 'evaluada', reglasSnapshot null
    ├── hitos/h-000 … h-051         ← 47 de lista + 5 extras
    └── evaluaciones/eval-000
```

**Ids fijos, nunca autogenerados.** Todo se escribe con `set(..., {merge:true})`
sobre ids conocidos, así que correrlo dos veces deja el mismo estado. Verificado:
la segunda pasada deja 52 hitos, no 104.

**Antes de escribir, verifica.** El script corre `calcularBonoMeta()` con los
datos ya transformados y aborta si no da 2 697.10 / 1 092.25 / ₡498 480. Si eso
falla, el problema está en el fixture o en el motor — no en Firestore, y no en la
pantalla.

**Guarda contra colisión de id:** si `proyectos/fixture-unidepro` existe sin
`esFixture: true`, aborta sin escribir. `--borrar` hace soft-delete, nunca
`deleteDoc`.

### Tres cosas que el script agrega y el fixture no trae

1. **`codigo` en los 5 extras**, que vienen en blanco → `EXTRA.01` … `EXTRA.05`,
   en orden de aparición. Es el único dato inventado.
2. **`orden`** = posición en el arreglo, que es el orden del Excel.
3. **`activo: true`** en los 52, más los campos de D-11 explícitos en `null`
   (`avancePropuesto`, `propuestoPor/En`, `aprobadoPor/En`). El fixture trae el
   avance ya **aprobado** en `avancePct`, sin propuesta pendiente.

### Invariantes que no se rompen

- **`codigo` NO es clave única.** `A.35` está **duplicado** en el fixture: dos
  renglones distintos con el mismo código. Está así en el Excel y no se corrige
  — los totales de aceptación dependen de estos datos exactos. Cualquier pantalla
  que lea hitos usa el id del documento o `orden`, nunca `codigo`.
- **El proyecto se llama `⚠ FIXTURE — UNA UNIDEPRO` y lleva `esFixture: true`.**
  Convive con los proyectos reales en la misma base y en la misma lista. Que se
  note a simple vista es deliberado; no se le quita el ⚠.
- **Los 147 HH de misceláneos NO están en Firestore.** `MIC.01` es sintético: el
  motor lo genera en memoria (§4-bis). Los 2 697.10 no salen de sumar los 52
  documentos — salen de sumarlos *más* los misceláneos. Decisión abierta para el
  bloque 4b: si la tabla de hitos pinta ese renglón calculado, y cómo se marca
  para que nadie intente editarlo.

---

## Bloque 4a — fundaciones y lista de metas ✅

Cinco archivos, dos nuevos de código, uno nuevo de prueba, dos editados:

```
public/js/formato.js                        ← nuevo   (deuda 5 pagada)
public/js/sidebar.js                        ← editado (deuda 6 pagada)
public/supervisor/metas.html                ← nuevo
public/supervisor/metas-controller.js       ← nuevo
public/supervisor/config-proyecto-controller.js  ← editado, EXCEPCIÓN declarada
test/formato.mjs                            ← nuevo, fuera del deploy y del conteo
```

El quinto es la **única excepción autorizada** a "un bloque nunca modifica los
archivos de otro". Se tocó exclusivamente para pagar una deuda que ese mismo
bloque dejó anotada: se retiraron las dos funciones de formato y se importan de
`formato.js`. Ni una línea más de ese archivo se movió.

### `public/js/formato.js`

Módulo puro. Sin DOM, sin Firestore, sin red, sin `Date.now()`.

```js
SIN_DATO                              // '—'  la constante, no el carácter suelto
formatearColones(n)                   // 640 → "₡640" · 498480 → "₡498 480" · NaN → "—"
formatearNumero(n)                    // igual, sin el símbolo
formatearHoras(n, { conSufijo = true })  // 2697.1 → "2 697,10 HH"
formatearPorcentaje(n, { decimales = 2 })// 35.55 → "35,55 %"   (escala 0–100)
formatearFecha(v)                     // Date | Timestamp | ISO → "21.07.2026"
```

**Invariantes que no se rompen:**

- **`formatearColones` y `formatearNumero` se mudaron BYTE A BYTE.** La deuda 5
  era una mudanza, no una reforma. Se evaluó redondear la moneda a colón entero
  y se descartó: cambiar comportamiento y de archivo en el mismo movimiento deja
  sin saber cuál de los dos rompió algo.
- **`config-proyecto-controller.js` las RE-EXPORTA.** `test/bloque3.mjs` las
  importa desde ahí y no es archivo de este bloque. La mudanza no le costó una
  línea a la prueba de un bloque ya cerrado. Sigue dando 15/15.
- **Las horas llevan dos decimales SIEMPRE**, la moneda los suprime en cero. En
  una columna de horas, `147` y `147,00` alineados se leen como precisiones
  distintas, y acá todas tienen la misma.
- **`formatearPorcentaje` NO adivina la escala.** `ResultadoBono.indicador` es
  fracción (0.3555); multiplicar por 100 es de quien pinta y queda a la vista en
  la llamada. Si adivinara, un día pintaría 0,36 % donde van 35,55 %.
- **Un no-finito se pinta `—`, nunca `0`.** Un cero acá es una cifra falsa con
  cara de cifra buena.
- **`formatearFecha` parsea `YYYY-MM-DD` por componentes**, no con
  `new Date(cadena)`: eso es medianoche UTC y en Costa Rica (UTC−6) da el día
  anterior. Un día de corrimiento vale ₡250 000 (D-05).
- **Acá NO hay aritmética de fechas.** Se leen componentes y se pintan; sumar,
  restar y comparar sigue siendo exclusivo de `calculoMeta.js`. Principio 8
  intacto.
- Formato costarricense: separador de miles **espacio duro** (U+00A0), decimal
  **coma**, negativo con el **menos tipográfico** (U+2212), no el guion.

### `public/js/sidebar.js` — deuda 6 pagada

Dos entradas nuevas en el grupo **Gestión**, ambas solo del `ingeniero`. El menú
del `supervisor` no cambió.

```
Proyectos · 🎯 Metas · Tareas · Colaboradores · ⚙️ Configuración
```

`Configuración` se llegaba solo por URL escrita a mano desde el bloque 3.

### `public/supervisor/metas.html` + `metas-controller.js`

Lista de metas por proyecto. `protegerPagina([ROL_INGENIERO], …)`. Mismo patrón
de dos mitades del bloque 3: arriba funciones puras, abajo el arranque del
navegador con imports diferidos.

```js
ESTADO_META        // mapa estado → { etiqueta, clase }  congelado
pintarEstado(estado)   // → { etiqueta, clase }  un estado desconocido se pinta tal cual
textoBono(totales)     // → { texto, detalle, calculado }
filaDeMeta(meta)       // → objeto de fila, ya en texto. Sin DOM.
```

**Invariantes que no se rompen:**

- **Es solo lectura.** No crea metas, no escribe `totales`, no recalcula nada.
  Crear metas es un formulario entero (fechas, `bonoBase`, `hhPlanilla`,
  `siguienteNumero()`) y se come el bloque; `totales` lo escribe el detalle del
  4b, que es donde el cálculo ya está en pantalla. Una lista que escribe
  mientras la mirás es una lista en la que no se puede confiar.
- **`totales: null` se pinta `—` con la leyenda "sin calcular", nunca ₡0.**
  Ese es hoy el caso de TODAS las metas, incluida la del fixture. Un cero acá
  diría "esta meta no generó bono" cuando lo que pasa es que nadie lo calculó.
  Al pie de la tabla se explica que la cifra es el mapa guardado, no un cálculo
  en vivo, y que el detalle manda.
- **Se leen las clases `badge-*` de `css/styles.css`, no se redefinen.** Ese
  archivo es de otro bloque y no se toca. El mapeo no calza uno a uno con los
  estados y está bien: `evaluada → badge-progreso`, `cerrada → badge-terminada`.
  El día que `styles.css` se abra por otra razón, se les da nombre propio.
- **Una entrega posterior al límite se marca `tarde` en la lista.** Por D-05 esa
  meta pierde el bono base completo; enterarse al abrir el detalle es tarde.
- **`fechaEntrega: null` se pinta "sin entregar", no `—`.** No es un dato que
  falte: es una meta que aún no se ha entregado. Son cosas distintas y la
  pantalla las distingue.
- **La URL es la memoria, no `localStorage`.** `metas.html?proyecto=<id>` con
  `history.replaceState`, igual que el bloque 3; un id que no esté en la lista
  se ignora en silencio. Con **un solo** proyecto activo se abre solo — elegir
  entre uno no es una decisión. Con dos o más se pregunta: un proyecto recordado
  en silencio es el que se abre creyendo que se está mirando otro.
- **Guarda contra carrera:** si se cambió de proyecto mientras la consulta
  respondía, lo que llegó se descarta. Sin eso, dos clics rápidos pintan las
  metas del proyecto anterior bajo el nombre del nuevo.
- **Todo lo que viene de Firestore se escapa** con `textContent` antes de entrar
  al `innerHTML`.
- **No hay enlace al detalle todavía.** `meta-detalle.html` es del 4b; un enlace
  muerto es peor que ningún enlace. Entra con esa pantalla.

**Verificación:**

- `test/formato.mjs` — 22 casos en Node, sin red (22/22). Cubre los dos totales
  de aceptación (2 697,10 / 1 092,25), ₡498 480, el corrimiento de zona horaria
  y las tres fechas del fixture.
- `test/bloque3.mjs` — **15/15 después de la mudanza**, sin tocarle una línea.
  Era el criterio que decidía si la deuda 5 estaba bien pagada.
- Checklist visual de la lista, con la Meta 1 del fixture (`Evaluada`, planilla
  704,00 HH, bono `—`), una `Abierta` sin entregar y una `Cerrada` entregada
  tarde con su bono calculado.

### Deuda declarada — no es olvido

8. **Los tres estilos de tabla de la app siguen sin unificarse.**
   `metas.html` define los suyos localmente, igual que hizo el bloque 3, porque
   `css/styles.css` es de otro bloque. Cuando el 4b abra la tabla de hitos habrá
   dos pantallas con tablas casi iguales: ese es el momento de subirlas a
   `styles.css` de una vez, no antes.
9. **La lista no dice si una meta tiene avances propuestos sin aprobar** (D-11).
   Es el contrapeso del modelo y hoy solo se ve entrando al detalle. Necesita un
   contador que hoy no existe en ningún lado: contarlo exige leer los hitos de
   cada meta, que es justo lo que esta pantalla evita. Candidato natural: que el
   4b lo escriba dentro de `totales` cuando guarde.
10. **`supervisorIds` sigue pendiente** (deuda 2 y 7, arrastrada desde el bloque
    2). Mientras siga abierta, el supervisor ve todos los proyectos. Sigue
    necesitando bloque propio con su deploy de reglas.

### Deudas cerradas en este bloque

- **Deuda 5 — `formato.js` no existía.** Cerrada.
- **Deuda 6 — Configuración sin entrada de menú.** Cerrada.

---

## Bloque 4b — decisiones cerradas ANTES del código ⬜

Esta sección se escribió sin tocar una línea de código. El contrato se escribe
antes que el código; si algo de acá resulta mal, se corrige **acá primero**.

### Alcance — 5 archivos

```
public/supervisor/meta-detalle.html            ← nuevo
public/supervisor/meta-detalle-controller.js   ← nuevo
public/supervisor/hitos-tabla.js               ← nuevo
public/css/styles.css                          ← EXCEPCIÓN declarada, ver D-4b-06
public/supervisor/metas-controller.js          ← EXCEPCIÓN, solo el enlace al detalle
```

Los dos últimos son excepciones a "un bloque nunca modifica los archivos de
otro", declaradas por adelantado y acotadas: en `metas-controller.js` se toca
**solo** la fila para que enlace al detalle, que es la deuda que el 4a dejó
anotada por no querer pintar un enlace muerto.

### D-4b-01 — El 4b es SOLO del rol `ingeniero`

`protegerPagina([ROL_INGENIERO], …)`. De D-11 entra la mitad de **aprobar**; la
mitad de **proponer** se va a un bloque propio, **4c, diseñado primero para
teléfono**.

El motivo es de diseño, no de alcance: la guía es explícita en que las pantallas
del Maestro de Obras se diseñan primero para móvil y no se adaptan después. Una
tabla de 52 renglones nace en escritorio; meter ahí la propuesta de avance es
exactamente la adaptación que la guía prohíbe.

Consecuencia buena: el 4b aprueba propuestas **desde el día uno**, aunque
todavía no exista la pantalla que las crea. El flujo se prueba escribiendo
`avancePropuesto` a mano en el fixture, sin esperar al 4c.

### D-4b-02 — Forma del mapa `totales`

Plano, sin anidar. Es lo único que la lista del 4a puede leer sin abrir los
hitos de cada meta.

```js
{
  hhEstimadasTotal, hhGanadasTotal, hhEconomizadas, indicador,  // indicador = fracción
  bonoTotalBruto, factorCalidad, bonoMO, bonoING,
  bonoBaseSePerdio,     // bool — el aviso de D-05 en la lista
  produccionOrigen,     // 'planilla' | 'estimado' | 'mixto' | 'sin_datos'
  esDefinitivo,         // bool
  calculadoEn,          // Timestamp
  calculadoPor,         // uid
}
```

`produccionOrigen` y `esDefinitivo` **no son opcionales**: son lo que le permite
a la lista cumplir D-12 sin leer nada más. Una cifra estimada no se puede ver
igual que una definitiva, y sin esos dos campos el mapa obliga a pintar el
número pelado — que es justo lo que D-12 prohíbe.

`calculadoEn` / `calculadoPor` porque cerrar la meta es uno de los cinco
momentos donde el sistema se rompe, y todos llevan autor y fecha.

### D-4b-03 — `totales` NO lleva contador de avances pendientes

Se evaluó y se descartó. Por las reglas del bloque 2, el documento `metas` solo
lo escribe el `ingeniero`: un supervisor proponiendo tres avances **no puede
tocar ese contador**. Quedaría en 0 justo cuando hay trabajo esperando
aprobación — un control que miente en la dirección que esconde, y que nadie
sabría que está mintiendo.

El **detalle** sí lo muestra en vivo: ya lee los hitos, le sale gratis.

Para que la **lista** lo muestre hace falta abrir `firestore.rules` y darle al
supervisor un `hasOnly(['avancesPendientes'])` sobre el documento de la meta.
Eso es territorio del bloque 2 y necesita su propio deploy de reglas. Ver
deuda 11.

### D-4b-04 — `MIC.01` se pinta

Al final de la tabla, con fondo distinto, sin `id`, sin ningún campo editable y
con la fórmula a la vista (`días × hhMiscelaneosPorDia`).

Si no se pinta, los 2 697,10 del pie no cuadran con la suma de los 52 renglones
de arriba y alguien va a "arreglar" un total que está bien. Un renglón calculado
que **se ve** calculado explica la diferencia solo.

Sigue sin persistirse: el motor lo genera en memoria (§4-bis). Se pinta, no se
guarda.

### D-4b-05 — Cuándo se escribe a Firestore

El cálculo corre en memoria en cada tecla (3,65 µs con 52 hitos, medido en el
bloque 0). A Firestore se escribe:

1. el hito, **al salir del campo** — no por tecla;
2. `totales` inmediatamente después, en una segunda escritura.

Si la segunda falla, los totales quedan viejos. Es tolerable y ya está
declarado: la lista del 4a dice al pie que ahí se lee el mapa guardado, no un
cálculo en vivo, y que el detalle manda. La pantalla que recalcula siempre es la
que tiene la razón.

### D-4b-06 — Los estilos de tabla suben a `css/styles.css`

Segunda excepción declarada, con el mismo criterio que la primera (la deuda 5
del 4a): hay dos pantallas con tablas casi iguales y este es el momento exacto
en que empiezan a divergir. Sube ahora o no sube nunca. Cierra la deuda 8.

### Prueba de aceptación — sin cambios

Cargar los 52 hitos del fixture UNA UNIDEPRO y que la tabla dé **2 697,10** y
**1 092,25**, con los misceláneos incluidos. Es el mismo criterio del bloque 0,
ahora atravesando Firestore y la UI.

### Deuda que este bloque abre

11. **El contador de avances pendientes no llega a la lista de metas** (ver
    D-4b-03). Hoy el contrapeso de D-11 solo se ve entrando al detalle de cada
    meta. Cerrarlo exige `firestore.rules` y por tanto bloque propio con deploy.
    Mientras siga abierta, la lista no avisa que hay trabajo esperando.

### Deuda que este bloque cierra

- **Deuda 8 — tablas sin unificar.** La cierra D-4b-06.
- **El enlace muerto al detalle**, que el 4a dejó a propósito sin pintar.

### Plantilla de arranque

```
Bloque 4b: detalle de meta e hitos.
Leé CONTRATOS.md y estos archivos:
  public/js/repos/hitosRepo.js
  public/js/repos/metasRepo.js
  public/js/core/calculoMeta.js
  public/js/formato.js
  public/supervisor/metas-controller.js
Las decisiones D-4b-01 a D-4b-06 ya están cerradas en CONTRATOS.md.
No toques ningún otro archivo.
Al terminar, corré la prueba de aceptación y actualizá CONTRATOS.md.
```
