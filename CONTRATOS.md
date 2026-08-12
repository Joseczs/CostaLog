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
| 4b | Detalle de meta e hitos | ✅ hecho | 24/24 + checklist visual |
| 4c | Propuesta de avance (móvil) | ✅ hecho | 19/19 + checklist visual |
| 5 | Resumen y proyección de bono | ✅ hecho | 18/18 + checklist visual |
| 5b | Alcance por supervisor (supervisorIds) | ✅ hecho | 16/16 + verificación en producción |
| 5b-2 | Pantalla de asignación de supervisores | ✅ hecho | 20/20 + checklist visual |
| 5c/A | Reglas tolerantes (dos valores) | ✅ hecho | desplegada |
| 5c/B | Datos: rol supervisor → maestro | ✅ hecho | 1 usuario migrado |
| 5c/C | Código: roles.js + auth.js | ✅ hecho | 15/15 |
| 5c/C-bis | El registro escribe el rol vigente | ✅ hecho | 21/21 |
| 5c/textos | Un nombre por rol en la interfaz | ✅ hecho | 7/7 |
| 5c/D | Reglas estrictas (solo maestro) | ✅ hecho | 13/13 + 4/4 en producción |
| 5c/E | Directorios y rutas | ✅ hecho | 13/13 + checklist en producción |
| 5d | Registro no asigna rol (deuda 1) | ✅ hecho | 25/25 + 8/8 en producción |
| 6 | Extras, créditos y evaluaciones | ✅ hecho | 30/30 + checklist visual |
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

---

## Bloque 4b — detalle de meta e hitos ✅

```
public/supervisor/meta-detalle.html            ← nuevo
public/supervisor/meta-detalle-controller.js   ← nuevo
public/supervisor/hitos-tabla.js               ← nuevo
public/supervisor/metas-controller.js          ← EXCEPCIÓN, solo el enlace al detalle
test/bloque4b.mjs                              ← nuevo, fuera del deploy y del conteo
```

### ⚠️ Corrección del contrato: D-4b-06 no se cumplió, y el motivo

**`css/styles.css` NO se tocó.** La decisión D-4b-06 decía subir ahí los estilos
de tabla. Al ir a ejecutarla apareció la cuenta que no se había hecho: unificar
exige tocar `styles.css` **y** `metas.html` —que tiene los suyos locales— y con
los tres archivos nuevos más `metas-controller.js` eso da **seis**. El máximo
son cinco, y pasarse significa que el bloque estaba mal cortado.

Se corrige acá, explícitamente y no de contrabando, como manda el método:
**D-4b-06 queda revocada.** `meta-detalle.html` lleva sus estilos locales, igual
que el bloque 3 y el 4a. La unificación es su propio bloque —dos archivos, riesgo
bajo— y la deuda 8 sigue abierta con la cuenta ya hecha.

### `hitos-tabla.js`

Dos mitades: modelo puro arriba, pintado abajo. La prueba de aceptación corre
contra el modelo, no contra el navegador.

```js
ID_MISCELANEOS                                  // '__mic01__'
hitoMiscelaneos(hhMisc, reglas)                 // → el hito sintético
filaDeHito(hito, { editable })                  // → modelo de fila, ya en texto
modeloTabla(hitos, resultado, reglas, opciones) // → { filas, pendientes, pie }
pintarTabla(tbody, modelo, manejadores)         // DOM
```

### `meta-detalle-controller.js`

```js
ESTADOS_SOLO_LECTURA                  // ['cerrada', 'pagada']  congelado
esEditable(meta)                      // → boolean
textoProcedencia(produccion, meta)    // → string   D-12, nunca vacío
totalesDesdeResultado(resultado, uid) // → el mapa de D-4b-02
validarAvance(valor)                  // → { ok, valor } | { ok:false, error }
```

**Invariantes que no se rompen:**

- **Los totales del pie se leen del motor, NO de sumar las filas.** El motor es
  la única fuente. Si un día no coincidieran, el que tiene razón es él.
- **`MIC.01` se pinta y no se edita** (D-4b-04). Sin `id` de documento, con la
  marca "calculado" y fondo distinto. Los 2 697,10 lo incluyen: por eso no
  cuadran con la suma a mano de los 52 renglones, y el pie de la pantalla lo
  dice con todas las letras.
- **El ingeniero escribe `avancePct` por la vía de `aprobarAvance`**, no de
  `actualizar`. Así queda `aprobadoPor` y `aprobadoEn`. Digitar el avance es uno
  de los cinco momentos donde el sistema se rompe y todos llevan autor y fecha.
- **Se escribe al `change`, nunca al `input`.** Con `input`, el "3" que va camino
  de "35" sería un avance guardado.
- **Un avance inválido se rechaza con el motivo y el campo vuelve al valor
  bueno.** Nunca se corrige en silencio: un 700 % recortado a 100 % es plata
  inventada sin que nadie se entere. Se acepta la coma decimal, que es como se
  digita acá.
- **Una propuesta de `0` NO es "sin propuesta".** El cero es un valor propuesto
  —bajar un hito a cero— y la fila lo distingue de `null`. Tiene prueba propia.
- **La propuesta pendiente se ve distinta del valor aprobado** (D-11): fila con
  fondo, la cifra propuesta en otro color, y **el delta en horas con signo**. Si
  las dos cifras se vieran iguales, el control no serviría de nada.
- **Debajo de cada campo va lo que vale UN punto de avance en horas.** Es la
  relación que convierte el porcentaje en una decisión y no en un número que se
  llena.
- **El bono nunca se pinta pelado** (D-12): siempre con su procedencia al lado, y
  en otro color cuando no es definitivo. El **factor de calidad va junto al
  monto**, no en otra pestaña: es el freno del sistema y esconderlo lo desactiva.
- **Una meta `cerrada` o `pagada` es de solo lectura.** Tiene el snapshot
  congelado y montos liquidados; reabrirla es una acción explícita y auditada
  (D-10), no un clic distraído sobre una celda.
- **Las reglas salen de `reglasSnapshot` si existe**, y solo si no, de la
  configuración viva del proyecto (D-10). Al abrir un histórico no pueden
  aparecer montos que nunca se pagaron.
- **Los hitos se cargan una vez y se recalcula en memoria.** 3,65 µs con 52
  hitos: volver a Firestore por cada tecla sería pagar red por algo gratis.
- **Si falla la escritura de `totales`, se avisa en pantalla y no se reintenta
  solo.** Unos totales viejos son un problema visible; un reintento en silencio
  que también falle, no.

### Verificación

- `test/bloque4b.mjs` — **24/24** en Node, sin red. Incluye LA prueba de
  aceptación: el pie de la tabla da **2 697,10** y **1 092,25** con los
  misceláneos incluidos, y el `totales` guardado lleva **₡498 480** de `bonoMO`
  y **₡0** de `bonoING`.
- `test/formato.mjs` 22/22 y `test/bloque3.mjs` 15/15, intactos.

### Deuda

- **8 — tablas sin unificar.** SIGUE ABIERTA, con la cuenta hecha: son
  `css/styles.css` + `metas.html` + `meta-detalle.html`, tres archivos, bloque
  propio de riesgo bajo. Ahora hay tres pantallas con tablas casi iguales.
- **11 — el contador de pendientes no llega a la lista de metas.** El detalle
  sí lo muestra ("N avances propuestos sin aprobar"); la lista no puede sin
  abrir `firestore.rules`. Ver D-4b-03.
- **12 — nadie propone avances todavía.** La mitad de PROPONER de D-11 es el
  bloque 4c, móvil primero. Mientras tanto, la columna de propuestas de esta
  pantalla se prueba escribiendo `avancePropuesto` a mano en el fixture. El 4b
  aprueba desde el día uno.

---

## Bloque 4c — reportar avance, móvil primero ✅

```
public/jefe/avance.html             ← nuevo
public/jefe/avance-controller.js    ← nuevo
public/js/sidebar.js                ← EXCEPCIÓN, una entrada en el menú del supervisor
test/bloque4c.mjs                   ← nuevo, fuera del deploy y del conteo
```

Tres archivos. La mitad de **PROPONER** de D-11, que el 4b dejó sin quién la
alimentara (deuda 12, ahora cerrada). Rol `supervisor`.

**Sin deploy de reglas.** La matriz del bloque 2 ya le da al supervisor
`avancePropuesto`, `propuestoPor` y `propuestoEn` sobre `hitos`. Si al probar
apareciera "Missing or insufficient permissions", esa regla no está desplegada y
el problema es del bloque 2, no de este.

### `avance-controller.js`

```js
ESTADOS_REPORTABLES              // ['abierta', 'evaluada']  congelado
hitosConPropuestas(hitos)        // → copia con avancePropuesto aplicado
ordenarPorPendiente(hitos)       // → copia ordenada por horas que faltan
tarjetaDeHito(hito)              // → modelo de tarjeta, ya en texto
proyeccion(resAprobado, resPropuesto)  // → las DOS cifras y su diferencia
validarAvance(valor)             // → { ok, valor } | { ok:false, error }
```

**Invariantes que no se rompen:**

- **Las DOS cifras, siempre.** Es la restricción arquitectónica del plan y el
  corazón del bloque: se muestra el bono con los avances **aprobados** y el bono
  con los **propuestos**, nunca solo el segundo. Un bono que solo enseña el
  escenario con propuestas es una promesa que nadie firmó.
- **`hitosConPropuestas` NO muta.** Si mutara, la primera cifra dejaría de ser
  calculable y la pantalla mostraría dos veces el mismo número sin que se note.
  Tiene prueba propia.
- **Una propuesta de `0` se aplica.** Bajar un hito a cero es un reporte válido;
  tratarlo como falsy lo perdería. Vale igual acá que en el 4b.
- **Este rol NO escribe `totales`.** Ese mapa es del ingeniero (4b). Acá no se
  llama `guardarTotales`: fallaría por reglas, y con razón. Consecuencia: la
  lista de metas no refleja lo propuesto hasta que el ingeniero entre al detalle.
  Es correcto — la lista muestra lo aprobado.
- **Un gesto por reporte.** Se toca `+5`, `−5` o `100 %`, o se escribe y se sale
  del campo. No hay botón "guardar" que se pueda olvidar con el teléfono en el
  bolsillo.
- **Objetivos de toque de 48 px.** Manos sucias, sol de frente, a veces guantes.
- **Un fallo de red NO es silencioso.** La tarjeta queda en rojo, "sin enviar —
  tocá para reintentar", y abajo una barra fija con la cuenta de cambios sin
  enviar. Un fallo callado en obra es un dato inventado.
- **Al enviar se repinta SOLO la proyección, no la lista.** Repintar todo
  reordenaría las tarjetas bajo el dedo, y en obra eso es perder el dato.
- **La lista se ordena por horas pendientes.** Arriba está lo que más mueve el
  bono: es la decisión de la mañana —dónde poner a la gente— que hoy se toma de
  memoria.
- **Debajo de cada campo, lo que vale un punto en horas** y el avance ya
  aprobado. El delta contra lo aprobado va con signo.
- **Móvil primero de verdad:** las medias queries del HTML solo **agrandan** para
  escritorio. No hay ninguna que achique.
- **Solo metas `abierta` o `evaluada`.** Sobre una cerrada no hay nada que
  proponer.

### La prueba que falló, y por qué el código tenía razón

La segunda prueba —"con una propuesta, la cifra aprobada no se mueve"— falló en
la primera corrida. Antes de tocar el código se miró el dato crudo: usaba el
hito 0 del fixture, que **ya está al 100 %**, así que proponerle 100 no movía
nada. El código estaba bien; la expectativa no. Se cambió al hito 1 (70 %) y se
agregó la prueba que faltaba: proponer lo mismo que ya está aprobado no genera
diferencia. Es el caso que el método advierte — cuando una expectativa choca con
el código, primero se verifica la especificación.

### Verificación

- `test/bloque4c.mjs` — **19/19** en Node, sin red.
- Las otras tres suites intactas: `formato` 22/22, `bloque3` 15/15,
  `bloque4b` 24/24.
- Checklist visual a ancho de teléfono: panel con las dos cifras, tarjetas con
  botones de 48 px, estado "enviado ✓" y estado "sin enviar" con reintento.

### Deuda

- **12 — cerrada.** Ya hay quién proponga avances.
- **2 — el supervisor ve TODOS los proyectos.** Acá pica más que en ninguna otra
  pantalla: es un selector largo, en un teléfono, en obra. Es el primer lugar
  donde alguien va a reportar sobre el proyecto equivocado. `supervisorIds`
  sigue necesitando su bloque con deploy de reglas, y ahora tiene urgencia.
- **13 — no hay persistencia sin red de verdad.** Lo que hay es un estado
  visible por tarjeta con reintento manual, que es honesto pero no resuelve una
  jornada entera sin señal. La persistencia offline del SDK se habilita en
  `firebase-config.js`, que es de otro bloque. Candidato a bloque propio corto.
- **3 — los directorios siguen invertidos.** Esta pantalla vive en `/jefe/`, que
  es del supervisor. Correcto según el contrato, confuso al leerlo.

---

## Bloque 5 — resumen y proyección de bono ✅

```
public/supervisor/bono-resumen.html   ← nuevo
public/supervisor/bono-resumen.js     ← nuevo
public/js/sidebar.js                  ← EXCEPCIÓN, una entrada en CADA menú
test/bloque5.mjs                      ← nuevo, fuera del deploy y del conteo
```

Tres archivos. Sin deploy de reglas: solo lee.

### Decisiones cerradas

| # | Decisión | Resolución |
|---|---|---|
| D-5-01 | ¿Quién ve el resumen? | **Los dos roles**, con la misma cascada y los mismos números. El Maestro de Obras ya veía su monto en el teléfono, pero sin explicación: *"se lo dicen, no lo verifica"*. Una pantalla que muestra el monto y esconde de dónde sale es el Excel otra vez, en digital. |
| D-5-02 | ¿Una cifra o dos? | **Dos**: la cascada con los avances aprobados y, al lado, el total con las propuestas pendientes. Nunca solo la segunda. |
| D-5-03 | ¿Dónde va el factor de calidad? | **Dentro de la cascada**, en su renglón, no en una tarjeta aparte. Es el freno del sistema; en el Excel está en la misma columna. |
| D-5-04 | ¿Se edita algo? | **Nada.** Ni siquiera `totales`. Los avances son del 4b; la planilla y el cierre, de otros bloques. |

**Sobre la carpeta:** el archivo vive en `/supervisor/` y lo abren los dos roles.
No es contradicción: la carpeta **no es una frontera de permisos** —el guardia es
`protegerPagina`, y esta pantalla admite ambos—. Es la deuda 3 mostrando su
incomodidad otra vez.

### `bono-resumen.js`

```js
filasCascada(resultado, reglas)   // → 7 renglones en el orden del Excel
verificarCascada(resultado, reglas, tolerancia = 0.01)  // → { ok, errores }
comparativa(rAprobado, rPropuesto)                      // → las dos cifras
filasHoras(resultado)                                   // → las 6 líneas de HH
```

**Invariantes que no se rompen:**

- **El orden es el del libro**, sin saltarse renglones:
  `base → anticipada → productividad → bruto → factor → ING → MO`. Tiene prueba
  que compara el arreglo de claves completo: si alguien reordena, falla.
- **Cada renglón explica de dónde sale**, no solo cuánto vale. Hay una prueba que
  recorre los siete y exige que ninguno venga con la nota vacía. Un monto sin su
  fórmula al lado es lo que hacía el Excel.
- **El piso de D-01 no se aplica en silencio.** Si hubo déficit, el renglón dice
  cuántas horas faltaron aunque el monto sea ₡0.
- **El bono base perdido dice POR QUÉ vale ₡0** (D-05), no solo que vale ₡0.
- **El factor 1.00 se explica** ("sin evaluaciones: se paga completo, sin
  castigo") en vez de aparecer como un multiplicador mudo.
- **La pantalla se audita a sí misma.** `verificarCascada` comprueba que el bruto
  sea la suma de sus componentes, que los dos repartos cuadren con el bruto por
  el factor, y que `pctBonoMO + pctBonoING` no pase de 100. Si algo no cierra,
  sale una franja roja arriba. No es paranoia: si el motor cambiara y el bruto
  dejara de cuadrar, esta pantalla lo seguiría pintando como si nada hasta que
  alguien cuadrara a mano contra el Excel — es decir, pagando.
- **`textoProcedencia` se IMPORTA del bloque 4b, no se copia.** Importar no es
  modificar. Duplicar ese texto garantizaría que un día las dos pantallas digan
  cosas distintas del mismo dato. El import es seguro porque la mitad de
  navegador de ese archivo solo arranca si existe `#tabla-hitos`, que acá no
  existe.
- **D-10 respetado:** si la meta tiene `reglasSnapshot`, la cascada calcula con
  el snapshot, y la cabecera dice cuál de las dos fuentes se usó.

### Verificación

- `test/bloque5.mjs` — **18/18** en Node, sin red. Incluye el criterio del plan:
  **₡498 480** para el Maestro de Obras y **₡0** para el Ingeniero con el fixture,
  y que la proyección se mueve al cambiar un avance. Tres pruebas rompen la
  cascada a propósito para confirmar que `verificarCascada` las atrapa.
- Las otras cuatro suites intactas: 22/22, 15/15, 24/24, 19/19.
- Checklist visual: cascada de siete renglones con el factor adentro, panel de
  las dos cifras y la lista de horas.

### Deuda

- **14 — el resumen no se enlaza desde la meta.** Se llega por menú y se eligen
  proyecto y meta a mano. Enlazarlo desde `meta-detalle.html` o desde la lista
  exigía tocar archivos del 4a/4b y el bloque ya usaba su excepción en
  `sidebar.js`. Entra con el bloque de unificación de tablas (deuda 8), que ya
  va a tocar esas dos pantallas.
- **15 — el supervisor ve el resumen de CUALQUIER meta de CUALQUIER proyecto,**
  incluido el bono de metas que no son suyas. Es la deuda 2 otra vez, ahora
  sobre plata ajena y no solo sobre una lista larga. Sube de prioridad.

---

## Bloque 5b — alcance por supervisor ⬜ · PRIORIDAD

**Se adelanta al bloque 6 por decisión explícita del 26.07.2026.** Es la deuda 2,
abierta desde el bloque 2, que fue creciendo con cada pantalla:

| Bloque | Cómo se manifestaba | Gravedad |
|---|---|---|
| 2 | el supervisor lee todos los proyectos | teórica: no había pantallas |
| 4a | ve la lista de metas de cualquier proyecto | molesta |
| 4c | selector largo, en un teléfono, en obra | **puede reportar sobre el proyecto equivocado** |
| 5 | ve la cascada de bono de metas que no son suyas | **ve plata ajena** |

**La asimetría es deliberada y así se implementa:** el `ingeniero` ve todo y debe
verlo —define el alcance de todos los frentes—. El `supervisor` ve solo lo suyo.
No es una regla simétrica de privacidad: es que el bono de otro Maestro de Obras
no es asunto suyo.

### Alcance previsto

```
firestore.rules                       ← el guardia de verdad
public/js/repos/proyectosRepo.js      ← listar() filtra por rol
public/supervisor/dashboard-controller.js  ← asignar supervisores al proyecto
scripts/migrar-supervisor-ids.js      ← rellenar los proyectos existentes
```

### Decisiones a cerrar ANTES de escribir código

1. **Forma del campo.** `supervisorIds: string[]` en el documento del proyecto —
   arreglo, no campo único: la §6.2 dice que un supervisor puede tener varios
   frentes, y nada impide que un frente tenga dos supervisores.
2. **Qué hacer con los proyectos que no tengan el campo.** Es la decisión de
   fondo. "Ausente = lo ve todo el mundo" repite el problema y no cierra nada;
   "ausente = no lo ve nadie" deja al supervisor sin pantallas hasta que migre.
   La migración es obligatoria en cualquier caso, y el script tiene que correr
   **antes** del deploy de reglas, no después.
3. **Si la regla filtra la lectura o solo la lista.** Firestore no filtra
   documentos dentro de una consulta de colección: o la consulta pasa entera o
   falla entera. Con `allow read` por documento, `listar()` **falla completa** en
   vez de devolver menos. Probablemente haya que leer por ids conocidos, y eso
   cambia la firma de `proyectosRepo.listar()` — que es contrato del bloque 1.
4. **Dónde se asignan los supervisores.** El dashboard del ingeniero es lo
   natural, pero es archivo de otro bloque.

⚠️ **Este bloque SÍ lleva `firebase deploy --only firestore`, y va antes de la
UI que depende de él.** Es el segundo bloque que toca reglas después del 2.

---

## Bloque 5c — renombrado de directorios ⬜

La deuda 3, que ya cobró factura una vez: en el bloque 4c los archivos se
subieron a `/supervisor/` en vez de `/jefe/` y la pantalla daba 404 → login, un
síntoma que parecía cierre de sesión.

**Estado actual, invertido:**

```
/supervisor/*  →  lo usa el INGENIERO
/jefe/*        →  lo usa el SUPERVISOR (Maestro de Obras)
```

**Destino:** `/ingeniero/*` y `/maestro/*`. Nombres que dicen lo que son, en el
vocabulario del dominio y no en el del modelo viejo de tres roles.

### Medición hecha, no estimada

**49 ocurrencias de las rutas en 19 archivos.** Los dos archivos que concentran
el riesgo son `js/roles.js` (`HOME_POR_ROL`) y `js/sidebar.js` (todo el menú); el
resto son enlaces sueltos entre pantallas.

### Por qué va DESPUÉS del 5b, y no antes

El 5b toca reglas y datos; el 5c toca solo rutas. Si se hacen juntos y algo
falla, no se sabe cuál de los dos lo rompió. Y el 5b protege plata, así que va
primero.

### Riesgos, ya identificados

1. **`git mv` de directorio completo en Windows**, con el antecedente de la
   historia paralela. Se hace con `git mv`, nunca por el explorador, y se
   verifica con `git ls-files` antes de commitear.
2. **Enlaces viejos guardados** en marcadores o pegados en WhatsApp quedan
   muertos. Se resuelve con dos redirects en `netlify.toml` —`/supervisor/*` →
   `/ingeniero/:splat` y `/jefe/*` → `/maestro/:splat`— **antes** de que las
   rutas nuevas existan.
3. **`bono-resumen.html` lo abren los dos roles** y vive en `/supervisor/`. Con
   los nombres nuevos, `/ingeniero/bono-resumen.html` abierto por un Maestro de
   Obras se vería mal aunque funcione bien. Decisión a cerrar: o se mueve a un
   tercer directorio `/comun/`, o se acepta que la carpeta no es frontera de
   permisos y se documenta.
4. **El campo `jefeCuadrillaId` de `tareas` conserva su nombre.** Renombrarlo es
   migración de datos, no de rutas, y pertenece al bloque 7. No se mezcla acá.

### Prueba de aceptación

Cero ocurrencias de `/supervisor/` y `/jefe/` fuera de `netlify.toml`, las cinco
suites siguen pasando, y las dos cuentas navegan el menú completo sin un solo
404.

---

## Bloque 5b — alcance por supervisor ✅

```
firestore.rules                          ← ⚠️ fragmento, ver abajo
public/js/repos/proyectosRepo.js         ← EXCEPCIÓN declarada (bloque 1)
public/jefe/avance-controller.js         ← EXCEPCIÓN declarada (bloque 4c)
public/supervisor/bono-resumen.js        ← EXCEPCIÓN declarada (bloque 5)
scripts/migrar-supervisor-ids.js         ← nuevo
test/bloque5b.mjs                        ← nuevo, fuera del deploy y del conteo
```

Cinco archivos, tres de ellos de otros bloques. Es el radio real del cambio y
está declarado: el alcance no se puede compartimentalizar más, igual que los
roles del bloque 2. Toca el repositorio, sus dos consumidores del lado del
supervisor, y las reglas.

### Las cuatro decisiones, cerradas

**1 · Forma del campo — `supervisorIds: string[]`.** Arreglo, no campo único: la
§6.2 dice que un supervisor puede tener varios frentes, y nada impide que un
frente tenga dos supervisores. Las dos direcciones tienen prueba.

**2 · Proyectos sin el campo — FAIL-CLOSED: no los ve ningún supervisor.**

Es una **divergencia consciente con el principio 4** ("activo por omisión"). Ese
principio existe porque un campo `activo` ausente escondería media base: el
riesgo era ocultar de más. Acá el riesgo es exactamente el contrario — un campo
ausente que **da acceso a plata ajena**. Un supervisor que no ve un proyecto se
queja el mismo día; uno que ve el bono de otro no se queja nunca.

La migración es obligatoria y **corre ANTES del deploy de reglas**, no después.
El script rellena con arreglo vacío, no con todos los supervisores: que falte
asignar un proyecto tiene que notarse, no resolverse solo.

**3 · ¿La regla filtra la lectura o la lista? — Hace falta un `where` en el
cliente, y no es cosmético.**

Firestore **no filtra los documentos de una consulta según las reglas.** Evalúa
si la consulta completa es segura; si un solo documento no pasara, falla entera.
Una consulta sin filtro hecha por un supervisor no devolvería menos proyectos:
devolvería `Missing or insufficient permissions`. Por eso `listar()` cambia de
firma y el cliente filtra con `array-contains`.

**Esto amplía el principio 2, y la ampliación es la correcta:** lo prohibido son
los **índices compuestos**, y la forma de evitarlos era no llevar `where` ni
`orderBy`. Un `array-contains` solo usa el índice de un campo, que Firestore crea
automáticamente. El orden sigue haciéndose en memoria — agregarle un `orderBy` sí
pediría índice compuesto. La consulta pasa a tener `where`; sigue sin haber ni un
índice compuesto en toda la base.

**4 · Dónde se asignan — por script en el 5b, por pantalla en el 5b-2.** Meter la
pantalla acá daba seis archivos, y el máximo son cinco. El corte es además el
correcto: **5b es el guardia, 5b-2 es la herramienta.** Aislar el deploy de
reglas en un bloque que no trae UI nueva es exactamente lo que se quiere cuando
se tocan permisos.

### `proyectosRepo.js` — firma nueva

```js
listar({ soloDe = null })              // soloDe = uid ⇒ solo sus proyectos
asignarSupervisores(proyectoId, uids)  // arreglo COMPLETO, nunca arrayUnion
crear(datos)                           // nace con supervisorIds: []
```

`listar()` sin argumentos sigue funcionando y devuelve todo: es lo que
corresponde al ingeniero, y por eso `metas-controller.js` y
`config-proyecto-controller.js` —los dos ingeniero-only— **no se tocaron**.

`asignarSupervisores` escribe el arreglo entero, nunca `arrayUnion`/`arrayRemove`:
la lista es una decisión sobre quién entra y quién sale, y una operación parcial
dejaría estados que nadie decidió. Mismo criterio que `actualizarReglas`.

### `firestore.rules` — archivo completo, nueve cambios quirúrgicos

Se aplicaron sobre el archivo real, no sobre una reconstrucción: las reglas
llegaron aparte después de que el `.rar` las trajera en 0 bytes. Cada cambio se
verificó que calzara **exactamente una vez** antes de aplicarse; ninguno tocó
nada fuera de su renglón.

```
182 líneas → 244.  Diff efectivo (sin comentarios):
  + 3 funciones nuevas
  ~ 8 allow read   : esUsuario() → puedeVerProyecto(proyectoId)
  ~ 3 allow update : se les suma puedeVerProyecto(proyectoId)
  ~ 1 allow read   : pagos, esUsuario() → esIngeniero()
```

Tres helpers nuevos: `estaEnLaLista(datos)`, `puedeVerEsteProyecto()` —para el
documento del proyecto, donde `resource` ya es el proyecto— y
`puedeVerProyecto(proyectoId)` —para las subcolecciones, que van a buscar el
padre con `get()`—.

El único `esUsuario()` que sobrevive es el `read` de
`usuarios/{uid}/empleados/{id}`, y es correcto: el roster cuelga del usuario, no
del proyecto, y cada supervisor ya escribe solo el suyo por `esElMismoUsuario`.

**Las cinco subcolecciones cambian también.** Sin eso el guardia sería de
interfaz: un supervisor con la URL de una meta ajena leería su bono igual. La
función `puedeVerProyecto()` hace un `get()` sobre el proyecto padre — cuesta una
lectura facturada por evaluación, y ese es el precio de que la protección sea
real. Firestore cachea el `get()` dentro de una misma solicitud, así que leer 52
hitos no son 52 lecturas extra.

**Los `pagos` NO se abren al supervisor ni estando asignado.** El libro incluye el
monto del Ingeniero y el de los trabajadores. Ver su propio bono es el bloque 5;
ver el reparto completo de la obra es otra cosa.

### Orden de despliegue — importa

```
1. node scripts/migrar-supervisor-ids.js --listar          ← ver los uid
2. node scripts/migrar-supervisor-ids.js                   ← simulación
3. node scripts/migrar-supervisor-ids.js --asignar <proyecto> <uid> --escribir
4. node scripts/migrar-supervisor-ids.js --listar          ← verificar
5. integrar el fragmento en firestore.rules
6. firebase deploy --only firestore                        ← desde cmd
7. git push                                                ← recién ahora la UI
```

Invertir 6 y 7 deja a los supervisores con una UI que pide un permiso que aún no
existe. Invertir 3 y 6 los deja sin ningún proyecto visible.

### Verificación

- `test/bloque5b.mjs` — **16/16** en Node, sin red. Las reglas NO se prueban acá:
  eso se verifica con dos cuentas en producción.
- Las cinco suites anteriores intactas: 22, 15, 24, 19, 18.
- **Verificado en producción, 26.07.2026.** Cuatro pruebas en el Simulador de
  reglas de la consola, con el uid real del Maestro de Obras:

  | Prueba | Resultado |
  |---|---|
  | `get /proyectos/{ajeno}` como supervisor | denegado ✓ |
  | `get /proyectos/{asignado}` como supervisor | permitido ✓ |
  | `get /proyectos/{ajeno}` como ingeniero | permitido ✓ |
  | `get /proyectos/{ajeno}/metas/{id}` como supervisor | denegado ✓ |

  La cuarta es la que cierra el bloque: confirma que `puedeVerProyecto()` protege
  las subcolecciones y no solo el documento del proyecto. Ahí está el bono.

### Por qué la prueba desde la barra de direcciones NO servía

El primer intento fue pegar `bono-resumen.html?proyecto=<ajeno>` en el navegador.
Redirigió al fixture y pareció un fallo del alcance. No lo era: el controlador
valida el parámetro **contra la lista que ya cargó** —mismo patrón del bloque 3—
y un id que no está se ignora en silencio. El navegador nunca llegó a pedirle ese
proyecto a Firestore, así que las reglas no se ejercitaron.

**Un guardia de servidor no se prueba desde una interfaz que filtra antes.** Va
al simulador, o a `curl` contra la API REST. Aplica a cualquier prueba de reglas
que se escriba de acá en adelante.

### Dos cosas que aparecieron durante el despliegue

**1 · `initializeApp({ cert: ... })` cuelga en silencio.** La forma correcta es
`{ credential: cert(...) }`. Con la primera, el SDK ignora la clave, no encuentra
credencial, cae a las credenciales por defecto y —si no existen— se queda
reintentando contra el servidor de metadatos de Google Cloud. **No falla: se
cuelga**, después de imprimir el encabezado y antes de la primera lectura.

> **Regla para la próxima.** Un script nuevo que hable con Firestore **copia el
> arranque de uno que ya corre**, no lo escribe de nuevo. `migrar-roles.js` y
> `cargar-fixture-unidepro.js` tenían la forma correcta a la vista.

**2 · Cuatro proyectos con `activo: false` de sesiones anteriores.** Al ver dos
proyectos donde el script listaba seis, el primer sospechoso fue el alcance. No
podía serlo, y el propio síntoma lo decía: **Firestore nunca devuelve resultados
parciales por reglas** — o la consulta pasa entera o falla entera. Si de seis
vinieran dos por permisos, no se verían dos: se vería un error.

Eran soft-deletes viejos que la app filtra en memoria y el script de listado no.
Queda como deuda 17.

### Deuda

- **2 — CERRADA.** El supervisor ya no ve todos los proyectos.
- **15 — CERRADA.** Ya no ve el bono de metas ajenas.
- **16 — la asignación es por script.** Hasta el 5b-2, asignar un supervisor
  exige `serviceAccountKey.json` y línea de comandos. Funciona para dos o tres
  proyectos; no escala a una obra real.
- **17 — `--listar` no distingue los proyectos desactivados.** Muestra los seis
  cuando la app muestra dos, y eso mandó un rato a buscar un problema de permisos
  que no existía. Un flag `activo` en la salida del script lo cierra.
- **18 — cuatro archivos leen `proyectos` sin pasar por el repositorio.** Todos
  del ingeniero, así que hoy no rompen. Pero el próximo cambio de contrato en
  `proyectosRepo` los va a dejar atrás otra vez, y el síntoma va a volver a
  parecer un problema de permisos.
- **1 — sigue abierta y ahora es lo más grave que queda.** El registro público no
  valida el campo `rol`: cualquier cuenta autenticada puede crearse como
  `ingeniero` desde la consola del navegador y saltarse **todo** lo de este
  bloque. El 5b cierra el alcance entre roles legítimos; no cierra la puerta de
  entrada. **Candidata a ser el próximo bloque, antes del 6.**

---

## Bloque 5b-2 — pantalla de asignación de Maestros de Obra ✅

Cierra la **deuda 16**, abierta desde el 5b: asignar un maestro a un
proyecto exigía `serviceAccountKey.json` y
`node scripts/migrar-supervisor-ids.js --asignar <proyecto> <uid> --escribir`.
Funciona para dos o tres proyectos; no escala a una obra real.

```
public/ingeniero/asignar-supervisores.html            ← nuevo
public/ingeniero/asignar-supervisores-controller.js   ← nuevo
public/js/repos/usuariosRepo.js                       ← nuevo
public/js/sidebar.js       ← EXCEPCIÓN declarada (bloque 2): una entrada de menú
test/bloque5b2.mjs         ← nuevo, fuera del deploy y del conteo
```

**Cuatro archivos contados.** `proyectosRepo.js` **no se tocó** —ya traía
`asignarSupervisores()` del 5b— y `firestore.rules` **tampoco**: el guardia
es del 5b y está verificado en producción. **5b es el guardia, 5b-2 es la
herramienta.**

La excepción de `sidebar.js` es la misma que ya usaron el 4a, el 4c y el 5:
una entrada sin lógica. Sin ella la pantalla se llega por URL escrita a
mano, que es la deuda 6 otra vez. De paso se corrigió el comentario de
cabecera de ese archivo, que seguía diciendo que los directorios conservan
el nombre invertido — mentira desde el 5c/E.

---

### Lo que dijeron los archivos reales, y que cambió el plan

**`dashboard.html` ya estaba lleno.** 143 líneas: dos tarjetas, dos
modales, una tabla de 15 columnas con scroll, tres tabs, cuatro filtros y
tres módulos JS. `dashboard-controller.js`, 420 líneas con seis
responsabilidades. Eso decidió D-5b2-01 sin discusión.

**Hallazgo nuevo, no anotado antes:** `ingeniero/dashboard-controller.js:78`
e `importarExcel.js:137` crean proyectos con `addDoc` directo, **sin
`supervisorIds`**. `proyectosRepo.crear()` sí lo pone; esos dos se saltan el
repo (deuda 18). Con el fail-closed del 5b, **todo proyecto nacido del
dashboard o de una importación de Excel es invisible para todos los
maestros** hasta que alguien lo asigne. No es un agujero —falla cerrado,
que es lo correcto— pero es la razón operativa por la que la deuda 16 picaba
hoy. Y **no obliga a tocar esos dos archivos**: `asignarSupervisores` usa
`updateDoc`, que crea el campo aunque no exista, así que la pantalla sana
cada proyecto en su primer guardado.

---

### Las cinco decisiones, cerradas antes del código

**D-5b2-01 · Pantalla propia, no una sección del dashboard.**
La asignación no es una acción por fila del proyecto: es una pantalla con
dos listas cruzadas. No cabe en la columna "Acciones", y una tercera tarjeta
con su propia tabla y su propio botón de guardar en ese HTML es exactamente
cómo `dashboard-controller.js` llegó a 420 líneas.

**D-5b2-02 · La deuda 23 (promover a `ingeniero`) NO entra.**
Comparten la *forma* de la interfaz y nada más: son dos colecciones
(`proyectos` vs `usuarios`) y dos permisos distintos. Asignar un maestro
reparte visibilidad; promover a ingeniero **crea otro aprobador de avance**,
que es el contrapeso entero de D-11. Esa escritura merece su propio bloque
con su propio caso en `scripts/probar-reglas.js` —que ya tiene el patrón—,
no ser el segundo botón de una pantalla que hace otra cosa. **Deuda 23 sigue
abierta, ahora con bloque asignado.**

**D-5b2-03 · Nace `usuariosRepo.js`, con un solo consumidor.**
El principio 5 no admite que una pantalla nueva consulte Firestore directo.
Pero tres archivos ya lo hacen —`ingeniero/gestionar-empleados-controller.js:25`,
`ingeniero/nueva-tarea-controller.js:38`, `js/importarExcel.js:92`— y
migrarlos daría **siete** archivos. Entonces: el repo existe desde hoy, esta
pantalla lo usa, y cada uno de los tres se pasa el día que se abra por su
propia razón. Mismo criterio con que `formato.js` nació en el 4a sin
reescribir a todos sus futuros clientes. **Deuda 24.**

```js
crearUsuariosRepo(db)
listarMaestros()   // → Usuario[]  rol == 'maestro', activos, por nombre
obtener(uid)       // → Usuario | null   sin filtrar por `activo`
```

`where('rol','==',ROL_MAESTRO)` en la consulta y `activo !== false` **en
memoria**: es la cuenta del 5b otra vez. Lo prohibido son los índices
compuestos y lo que los exige es la combinación de dos condiciones. Sumar
`where('activo','==',true)` pediría índice compuesto **y** dejaría fuera
todo documento viejo sin el campo, que es justo lo que el principio 4 existe
para evitar.

`obtener()` es el único que **no** filtra por `activo`: su razón de ser es
mirar a alguien que puede estar desactivado.

**D-5b2-04 · Multi-select con botón Guardar, con tres guardas.**
Un proyecto arriba, casilla por maestro, un botón que junta lo marcado y
llama `asignarSupervisores` **una sola vez**. Nunca una escritura por casilla
tocada.

- El botón se habilita solo si el conjunto **difiere** del cargado.
  Comparación de conjuntos, no de longitudes: cambiar un maestro por otro
  deja el mismo largo y es un cambio real. Tiene prueba propia.
- Guarda contra carrera con token de generación, mismo patrón del 4a. Acá
  pesa más que allá: sin ella, dos clics rápidos pintan la asignación de un
  proyecto bajo el nombre de otro **y el botón la guarda**.
- Después de guardar, la confirmación se **relee desde Firestore**, no desde
  la memoria de la pantalla. Lo que se muestra tiene que ser lo que quedó
  escrito, no lo que se creía estar escribiendo.

**D-5b2-05 · La pantalla filtra `activo !== false` de entrada.**
No es decisión nueva: es el principio 4. Cierra la **deuda 17 del lado de la
interfaz**. El script `migrar-supervisor-ids.js` queda como está —tocarlo
sería abrir un archivo de otro bloque sin necesidad— y la deuda 17 sigue
abierta ahí, ahora sin consecuencias para el uso diario.

---

### Los uid huérfanos: la decisión que apareció escribiendo

`supervisorIds` puede contener el uid de alguien que ya no es Maestro de
Obras: promovido, desactivado o borrado. Tres salidas, dos malas:

- **Construir el arreglo solo con las casillas visibles** lo desasigna sin
  que nadie lo haya decidido. `asignarSupervisores` manda el arreglo
  completo: lo que no está marcado, no se guarda.
- **Conservarlo por debajo** lo vuelve invisible — un permiso vivo que
  ninguna pantalla muestra es exactamente lo que este bloque viene a
  terminar.
- **Pintarlo como una fila más, marcada, con la advertencia al lado.**

Se hace la tercera. Con nombre si el documento existe, con el uid crudo si
no, y con un aviso distinto en cada caso. El ingeniero lo ve, y si lo
desmarca es porque lo decidió. Mismo criterio que el 4b con un avance
inválido: **nunca se corrige en silencio.** Cuatro pruebas.

---

### Invariantes que no se rompen

- **Una sola escritura por guardado, con el arreglo completo.** Nunca
  `arrayUnion`, nunca una por casilla.
- **Sin cambios no se puede guardar.** Una escritura vacía es una escritura
  que nadie puede explicar después.
- **Vaciar la lista se puede, pero se pregunta.** Dejar un proyecto sin
  nadie asignado es válido y a veces correcto; también lo vuelve invisible
  para todo el campo. Se advierte una vez, no se impide.
- **El rol sale de `roles.js`.** `usuariosRepo` importa `ROL_MAESTRO`; no hay
  un solo literal de rol en los tres archivos nuevos.
- **Todo lo que viene de Firestore entra por `textContent`**, nunca por
  `innerHTML`. Acá la tabla se construye con `createElement`, así que no hay
  ni un `innerHTML` con datos.
- **El manejador se ata al crear cada casilla**, no con un
  `querySelectorAll` posterior: no hay forma de pintar un control sin su
  manejador. Lección del 5c/C-bis.
- **La URL es la memoria**, no `localStorage`:
  `asignar-supervisores.html?proyecto=<id>` con `history.replaceState`. Un id
  que no esté en la lista se ignora en silencio. Con un solo proyecto activo
  se abre solo.
- **Un cambio sin guardar avisa al salir** (`beforeunload`).

---

### Verificación

- `test/bloque5b2.mjs` — **20/20** en Node, sin red. Importa las funciones
  del controlador real, no las reimplementa: la mitad de navegador solo
  arranca si existe `#tabla-maestros`, que en Node no existe.
- Las doce suites anteriores intactas:
  15 · 24 · 19 · 18 · 16 · 21 · 7 · 13 · 13 · 13 · 25 · 22.
- **Sin corrida del simulador**: este bloque no toca reglas. El guardia es
  del 5b y ya está verificado en producción.

#### Checklist visual — en producción, con la cuenta de ingeniero

1. El menú **Gestión** muestra "Asignar maestros" y la pantalla abre.
2. Con un proyecto elegido: la tabla lista los maestros y el botón está
   **apagado**.
3. Marcar dos, guardar. En la consola de Firestore, `supervisorIds` tiene
   **exactamente** esos dos uid.
4. Desmarcar uno, guardar. Queda **uno solo** — confirma arreglo completo y
   no `arrayUnion`.
5. Un proyecto creado desde el Dashboard (sin el campo) aparece con "0 de N
   asignados" y al guardar queda con el arreglo escrito.
6. Guardar sin cambiar nada: imposible, el botón no se habilita.
7. Con la cuenta de maestro: ve el proyecto recién asignado y **no** ve
   los otros.

---

### Deuda

- **16 — CERRADA.** Asignar un Maestro de Obras ya no necesita
  `serviceAccountKey.json` ni línea de comandos.
- **17 — abierta solo del lado del script.** `--listar` de
  `migrar-supervisor-ids.js` sigue sin distinguir proyectos desactivados. La
  pantalla sí los filtra, así que ya no tiene consecuencias diarias.
- **18 — sigue abierta, y ahora se sabe qué cuesta.** Cuatro archivos leen
  `proyectos` sin pasar por el repo; dos de ellos —`dashboard-controller.js`
  e `importarExcel.js`— **crean proyectos sin `supervisorIds`**. Cada
  proyecto nuevo nace invisible hasta que se abra esta pantalla. No rompe
  nada y falla cerrado, pero es un paso manual permanente que una línea en
  cada archivo eliminaría.
- **23 — sigue abierta, con bloque asignado.** Promover a `ingeniero` no
  tiene pantalla: es consola o script. Bloque corto propio, con su caso en
  `probar-reglas.js`.
- **24 — nueva.** Tres archivos consultan `usuarios` sin pasar por
  `usuariosRepo`, que ya existe:
  `ingeniero/gestionar-empleados-controller.js:25`,
  `ingeniero/nueva-tarea-controller.js:38`, `js/importarExcel.js:92`.
  Cada uno se pasa el día que se abra por su propia razón.
- **8 y 11 — sin cambios.** No son de este bloque.

---

## Bloque 6 — extras, créditos y evaluaciones ✅

```
public/ingeniero/actividades-fuera-lista.html            ← nuevo
public/ingeniero/actividades-fuera-lista-controller.js   ← nuevo
public/ingeniero/evaluaciones.html                        ← nuevo
public/ingeniero/evaluaciones-controller.js               ← nuevo
public/ingeniero/meta-detalle.html   ← EXCEPCIÓN declarada: dos enlaces nuevos
test/bloque6.mjs                     ← nuevo, fuera del deploy y del conteo
```

**Cinco archivos contados.** `hitosRepo.js` y `metasRepo.js` **no se
tocaron** — ya traían todo lo necesario desde el bloque 1
(`crear`/`desactivar`/`siguienteCodigo` para hitos;
`crearEvaluacion`/`desactivarEvaluacion`/`listarEvaluaciones` para
evaluaciones). `firestore.rules` **tampoco**: `esIngeniero()` ya cubre
`create`/`update` de `hitos` y `evaluaciones`, verificado leyendo el
archivo real antes de escribir código.

La excepción de `meta-detalle.html` son **dos enlaces**, resueltos con un
`<script>` inline que lee `?proyecto&meta` de la URL actual — no toca
`meta-detalle-controller.js`. Sin ella, las dos pantallas nuevas se llegan
solo por URL escrita a mano, y "un enlace muerto es peor que ningún
enlace" ya se decidió en el bloque 4a.

---

### El signo, resuelto por construcción

El plan pedía "validación de signo, sin excepción" (crédito ⇒ cantidad
negativa). La decisión: **no se valida un número que alguien ya escribió
con el signo equivocado — no se deja escribir el signo.** El formulario
pide una magnitud siempre positiva; el selector de tipo (Extra / Crédito)
decide el signo. `prepararActividad()` igual valida como defensa en
profundidad, pero el error que el plan quería evitar ya no tiene por dónde
entrar. Ocho pruebas cubren esto, incluida la de que un tipo desconocido
**lanza**, no adivina un signo por omisión.

---

### El hueco que apareció leyendo el código, y que este bloque cierra

`meta-detalle.html` (bloque 4b) vuelve la tabla de hitos de solo lectura
cuando la meta está `cerrada`/`pagada` (`ESTADOS_SOLO_LECTURA`,
`esEditable()`). Pero `metasRepo.listarEvaluaciones()` no filtra por
estado, y **nada impedía agregar una evaluación a una meta ya cerrada** —
cambiando en silencio el `factorCalidad`, y con él el `bonoMO`, de un
período que se suponía liquidado con sus `reglasSnapshot` congeladas.
`reglasSnapshot` congela las **tarifas**; nada congelaba las
**evaluaciones**.

Las dos pantallas nuevas reusan `esEditable(meta)` —**ya exportada** por el
4b, cero cambios en ese archivo— para bloquear el formulario cuando la meta
no es editable. Mismo argumento que ya usó `bono-resumen.js` en el bloque 5
para importar `textoProcedencia` del mismo archivo: la mitad de navegador
de `meta-detalle-controller.js` solo arranca si existe `#tabla-hitos`, que
en estas dos pantallas no existe, así que el import es seguro.

---

### Las decisiones, cerradas antes del código

**D-6-01 · Esta pantalla NO edita el `% avance` de lo que crea.**
`meta-detalle.html` ya edita el avance de cualquier hito —lista, extra o
crédito— con su propio momento de escritura (D-4b-05, al salir del campo) y
su propia auditoría (`aprobarAvance`). Repetir ese campo acá sería un
segundo lugar donde se escribe el mismo dato, con dos rutas para el mismo
error.

**D-6-02 · No se edita una actividad ni una evaluación ya creada.** Un
typo se corrige desactivando y creando de nuevo — dos acciones explícitas y
auditables, en vez de un `update` silencioso sobre un dato que ya pudo
haber entrado al cálculo. `hitosRepo.siguienteCodigo()` ya mira los
desactivados para no reciclar un código que aparece en un histórico, así
que el rastro queda completo.

**D-6-03 · Vista previa en vivo, con el motor real — no una cuenta
paralela.** Las dos pantallas cargan proyecto, meta, **todos** los hitos
(no solo extras/créditos) y evaluaciones, y llaman `calcularBonoMeta()` dos
veces: una con lo que ya existe, otra con el borrador agregado. Es la misma
pregunta que `bono-resumen.js` le hace al motor con la proyección de
avances, aplicada acá a un extra, un crédito o una evaluación todavía sin
guardar. Cero escritura mientras se escribe: se recalcula en memoria en
cada tecla, el mismo costo de 3,65 µs medido en el bloque 0.

Esto reveló el criterio de aceptación del propio plan casi de regalo: un
crédito de −40 HH baja el total **estimado** en 40 de inmediato, aunque su
avance nazca en 0 — porque `hhEstimadasHito()` no depende del avance y
`hhGanadasHito()` sí. Con avance en 0, nada queda "ganado" todavía. Tiene
tres pruebas, incluida la que fija exactamente ese número.

**D-6-04 · La frecuencia bisemanal (D-08) no se valida por fecha.** El plan
la describe como cadencia operativa, no como regla dura, y el Excel original
solo tenía la etiqueta mal puesta ("promedio semanal" en vez de bisemanal).
Inventar una validación de espaciado entre fechas sería una regla de
negocio que no está en la especificación. La única validación de fecha es
que no sea futura: no se califica algo que todavía no pasó.

**D-6-05 · `notaFactor()` se duplica, no se importa.** Dice lo mismo que ya
pinta `meta-detalle-controller.js` inline ("sin evaluaciones registradas: se
calcula al 100 %, sin castigo" / "promedio de N evaluaciones"). Extraerla
como export nuevo exigía tocar un archivo de otro bloque solo para dos
líneas de texto; el riesgo de que diverjan es bajo porque no encierra
lógica de negocio, solo una frase. Mismo criterio que ya aceptó el 4b al
revocar D-4b-06 cuando unificar costaba un sexto archivo.

---

### Invariantes que no se rompen

- **El repo no decide plata.** `hitosRepo.crear()` sigue siendo el único
  punto de escritura; esta pantalla nunca llama `actualizar()` sobre
  `avancePct`.
- **Todo lo que viene de Firestore entra por `textContent`**, nunca por
  `innerHTML`. Las dos tablas se construyen con `escapar()` en cada celda
  de datos, igual que `hitos-tabla.js`.
- **Lo que se pinta después de guardar se relee desde Firestore**, no se
  arma a mano con lo que se creía haber mandado. Mismo criterio del 5b-2.
- **Cero `collectionGroup`, cero índice compuesto.** No se agregó ninguna
  consulta nueva: las dos pantallas reusan `listar()`/`listarEvaluaciones()`
  del bloque 1 tal cual.
- **El cálculo de vista previa es el mismo motor**, nunca una copia local
  de la fórmula. Si `calcularBonoMeta()` cambiara mañana, las dos pantallas
  heredan el cambio sin tocarles una línea.

---

### Verificación

- `test/bloque6.mjs` — **30/30** en Node, sin red. Importa las funciones de
  los dos controladores reales, más `esEditable` encadenado desde
  `meta-detalle-controller.js` — confirma que esa cadena de imports no se
  rompe en Node, no solo en el navegador.
- Las trece suites anteriores intactas:
  15 · 24 · 19 · 18 · 16 · 20 · 21 · 7 · 13 · 13 · 13 · 25 · 22.
- Sintaxis verificada en los dos JS nuevos y balance de tags confirmado en
  `meta-detalle.html` (25 `<div>` abiertos, 25 cerrados).
- **Sin corrida del simulador**: este bloque no toca reglas.

#### Checklist visual — en producción, con la cuenta de ingeniero

1. Desde el detalle de una meta abierta: los enlaces "➕ Extras y créditos"
   y "⭐ Evaluaciones" llevan `?proyecto&meta` de la meta que se estaba
   mirando, no a una pantalla en blanco.
2. En **Extras y créditos**: elegir "Crédito", escribir magnitud 40 y
   HH/u 1 → la caja de impacto muestra `−40,00 HH` en estimadas antes de
   guardar, `0,00` en ganadas.
3. Guardar ese crédito. Vuelve a `meta-detalle.html` y el total estimado de
   la meta bajó exactamente 40 HH. El renglón aparece con el badge
   **crédito** y la cantidad en rojo.
4. Desactivar esa actividad. Desaparece de la lista; el total vuelve a
   subir 40 HH.
5. En **Evaluaciones**: registrar ornato 80 / SO 60 con fecha de hoy → la
   caja de impacto muestra el factor bajando de 1.00 y el bono del Maestro
   de Obras bajando en colones, antes de guardar.
6. Guardar. El factor de calidad en `meta-detalle.html` refleja el nuevo
   promedio sin recargar manualmente el dato (se recalcula al volver a
   cargar esa pantalla).
7. Con una meta en estado `cerrada`: los dos formularios nuevos aparecen
   apagados con el aviso de solo lectura — confirma que el hueco quedó
   cerrado.
8. Intentar una fecha de evaluación futura: se rechaza con el mensaje
   correspondiente.

---

### Deuda

Sin deuda nueva. El bloque cierra el hueco de evaluaciones en metas
cerradas que no estaba declarado en ningún lado — se encontró y se cerró
en el mismo bloque, no se dejó anotado para después.

- **8 y 11 — sin cambios.** No son de este bloque.

---

## Bloque 5c — de 'supervisor' a 'maestro' en toda la aplicación

El identificador del rol pasa a llamarse como la persona: **Maestro de Obras**.
El de `ingeniero` ya era correcto y no se toca.

**Por qué no se dejó para después.** La deuda 3 —los directorios invertidos— se
difirió dos veces y cobró factura en el bloque 4c: dos archivos subidos a
`/supervisor/` en vez de `/jefe/` dieron 404 → login, un síntoma que parecía
cierre de sesión y costó una tarde. Un nombre que miente no envejece bien.

**Por qué son cinco fases y no un bloque.** Datos, reglas y código no pueden
cambiar juntos. Si las reglas exigen `'maestro'` y un documento todavía dice
`'supervisor'`, esa cuenta queda sin acceso a nada; al revés, igual. Entre A y D
las reglas aceptan los dos valores, y esa tolerancia deliberada es lo que hace
que no exista un solo instante en que alguien no pueda entrar.

| Fase | Qué cambia | Archivos | Estado durante |
|---|---|---|---|
| A | Reglas tolerantes: `'supervisor'` **y** `'maestro'` | `firestore.rules` | todo funciona |
| B | Datos: script migra `usuarios` | 1 script nuevo | todo funciona |
| C | Código: `roles.js` + 11 consumidores | ~12 | todo funciona |
| D | Reglas estrictas: solo `'maestro'` | `firestore.rules` | queda cerrado |
| E | Directorios `/ingeniero/` y `/maestro/` + 49 rutas | ~19 | redirects cubren lo viejo |

**Las fases C y E se pasan de los cinco archivos, y se declara.** La regla existe
para que la superficie de decisión de un bloque sea chica; acá es **una sola
decisión aplicada 25 veces**, verificable con un conteo de ocurrencias. Es
distinto de cinco archivos de lógica nueva.

### Fase A ✅ — reglas tolerantes

`firestore.rules`, un solo cambio de función:

```
function esMaestro()      // 'maestro' O 'supervisor'  ← el nuevo
function esSupervisor()   // alias → esMaestro()       ← compatibilidad
```

El alias existe para que la fase A sea **un cambio de una función y no de once
llamadas**. Las fases C y E lo retiran. No se le agregan llamadas nuevas.

Esto **no reabre roles viejos**: acepta dos nombres del mismo rol, no dos roles.
`jefe_cuadrilla` y `admin` siguen sin conceder nada.

⚠️ `esMaestro()` **se estrecha en la fase D**. Si alguien lee esta función con la
fase D ya cerrada y todavía acepta `'supervisor'`, es que el bloque quedó a
medias.

### Corrección del 5b aparecida durante la fase A

`public/jefe/mis-tareas-controller.js` rompió con
`Missing or insufficient permissions` en una pantalla que nadie había tocado.
**No era la fase A: era el 5b, y habría fallado igual sin ella.**

La causa: ese archivo leía `collection(db, 'proyectos')` **directo**, saltándose
el repositorio. Cuando se buscaron los consumidores del cambio de alcance, se
buscaron llamadas a `proyectosRepo.listar()` — y este no aparecía porque no usa
el repositorio. Una consulta sin filtro hecha por un Maestro de Obras falla
entera; Firestore no devuelve menos documentos cuando las reglas no alcanzan.

> **Lección.** Saltarse la capa de datos no es un atajo: es un archivo que **no
> se entera de los cambios de contrato**. Y al medir el radio de un cambio en un
> repositorio, buscar sus llamadas no alcanza — hay que buscar también a quienes
> hacen el mismo trabajo por su cuenta.

Mapa completo de los que leen `proyectos` sin pasar por el repo:

| Archivo | Rol | Estado |
|---|---|---|
| `jefe/mis-tareas-controller.js` | maestro | **corregido**, ahora usa el repo |
| `supervisor/dashboard-controller.js` | ingeniero | pasa: su rama no mira `supervisorIds` |
| `supervisor/nueva-tarea-controller.js` | ingeniero | pasa |
| `js/exportarExcel.js` · `js/importarExcel.js` | ingeniero (solo desde el dashboard) | pasa |

Los del ingeniero no rompen hoy. Quedan como **deuda 18**.

### Fase B ⬜ — `scripts/migrar-rol-maestro.js`

```
node scripts/migrar-rol-maestro.js              # simulación
node scripts/migrar-rol-maestro.js --escribir   # aplica
```

**No se hace a mano aunque sea un solo usuario.** El script deja constancia,
verifica después de escribir y es idempotente. Dentro de seis meses, cuando
alguien pregunte por qué un documento dice `maestro`, la respuesta va a estar en
el documento y no en la memoria de nadie.

**Campos con nombre propio:** `rolAnteriorMaestro` y `rolMaestroEn`. Los del
bloque 2 —`rolAnterior`, `rolMigradoEn`— **no se tocan**: sobrescribirlos
borraría la única evidencia de qué era cada cuenta en el modelo de tres roles.

**Guardas:** aborta si aparece un rol fuera de los tres conocidos, y si el
resultado dejara cero ingenieros. Backup siempre, incluso en simulación.

⚠️ **No correrlo si la fase A no está desplegada.** Las reglas viejas solo
reconocen `'supervisor'`.

### Fase C ✅ — `roles.js` + `auth.js`

**Dos archivos, no doce.** Los once consumidores importan `ROL_SUPERVISOR` de
`roles.js`; convirtiéndolo en alias de `ROL_MAESTRO`, siguen funcionando sin
tocarlos. Su renombrado es cosmético y se junta con la fase E, que ya los abre a
todos de todos modos.

```js
ROL_MAESTRO       // 'maestro'
ROL_SUPERVISOR    // @deprecated → ROL_MAESTRO. Se retira en la fase E.
ROLES             // ['ingeniero', 'maestro']  congelado
normalizarRol(r)  // 'supervisor' → 'maestro'; lo demás, tal cual
esMaestro(perfil) · esSupervisor (alias) · esIngeniero · esRolValido
```

`auth.js` normaliza en **un solo punto**, dentro de `obtenerPerfilUsuario()`. De
ahí para abajo ningún archivo vuelve a ver `'supervisor'`: el perfil que circula
por toda la app ya trae `'maestro'`.

### El error de diseño de la fase B, y la corrección

La tabla de fases decía que entre B y C **"todo funciona"**. Era falso, y se vio
al aplicar la fase B: Test 1 quedó migrado a `'maestro'`, las reglas lo
aceptaban, y aun así no podía entrar a ninguna pantalla — sin un solo error en
consola, porque el código hacía exactamente lo que estaba escrito.

La causa: **`protegerPagina()` compara el rol en JavaScript, contra `ROLES`.**
Las reglas del servidor no son el único guardia. `'maestro'` no estaba en esa
lista, así que el guardia de interfaz rebotaba a quien el servidor dejaba pasar.

> **Lección.** La tolerancia durante una migración tiene que estar en **todos**
> los guardias, no solo en el del servidor. Un cambio de identificador toca
> reglas *y* código de autorización, y los dos necesitan aceptar los dos valores
> durante la ventana. `roles.js` debió volverse tolerante en la fase A, junto con
> las reglas — no una fase después.

Ahora sí lo es: `normalizarRol()` hace que una cuenta migrada y una sin migrar se
comporten idéntico, y eso tiene prueba propia.

### Verificación de la fase C

`test/bloque5c.mjs` — **15/15** en Node. La prueba que importa es que los perfiles
`{rol:'supervisor'}` y `{rol:'maestro'}` dan el mismo resultado en los cuatro
predicados. También comprueba que la tolerancia **no reabre roles muertos**:
`jefe_cuadrilla` y `admin` siguen sin conceder nada. Es un rol con dos nombres,
no dos roles.

Las seis suites anteriores intactas: 22, 15, 24, 19, 18, 16.


---

## Bloque 5c/C-bis — el registro deja de escribir el rol viejo ✅

```
public/js/roles.js              ← EXCEPCIÓN, mismo bloque 5c: rolParaGuardar()
public/js/auth.js               ← EXCEPCIÓN, mismo bloque 5c
public/index.html               ← nuevo en el alcance del 5c
public/js/login-controller.js   ← nuevo en el alcance del 5c
test/bloque5c-bis.mjs           ← nuevo, fuera del deploy y del conteo
```

### Lo que estaba roto

`public/index.html` tenía el identificador de rol escrito a mano:

```html
<button class="rol-btn" data-rol="supervisor">
  <span>Maestro de Obras</span>      <!-- etiqueta nueva, valor viejo -->
```

**La fase B migró un usuario mientras el formulario seguía fabricando más
con el valor viejo.** Una migración que corre contra un grifo abierto no
termina nunca — y la fase D, que exige cero documentos con `'supervisor'`,
habría dejado sin acceso a cada cuenta registrada desde entonces.

Era además el único archivo que se saltaba el principio de que ningún
archivo escribe un identificador de rol salvo `roles.js`. Se saltó porque
es HTML y no puede importar: por eso el selector ahora lo pinta el
controlador.

### `roles.js` — una función nueva

```js
rolParaGuardar(rol)   // → rol vigente · LANZA si no es uno de los dos
```

**Espejo de `normalizarRol()`:** uno traduce al leer, el otro al escribir.
Con la lectura sola alcanzaba mientras nadie escribiera; el formulario
escribía.

**No devuelve un rol por defecto ante basura, lanza.** Un registro con el
rol equivocado es una cuenta con permisos que nadie decidió. Eso falla
ruidosamente o no falla nunca. Es distinto de `rutaHomePorRol()`, que sí
degrada al rol de menos alcance: ahí se elige a dónde mandar a alguien que
ya existe; acá se decide qué queda escrito en la base.

### Invariantes que no se rompen

- **`auth.js` escribe el rol SOLO por `rolParaGuardar()`.** Los dos caminos
  de registro —correo y SMS— pasan por `crearDocumentoUsuario`, que es el
  único punto que toca `usuarios/{uid}`.
- **El HTML no sabe cómo se llama un rol.** `index.html` deja un contenedor
  vacío; `login-controller.js` pinta un botón por cada valor de `ROLES`,
  con su `ETIQUETA_ROL`. Identificador y etiqueta salen de la misma fuente,
  así que no pueden volver a desincronizarse.
- **El ícono NO vive en `roles.js`.** Ese archivo guarda identidad, no
  decoración. Un rol sin ícono se pinta sin ícono y sigue funcionando.
- **Agregar un rol futuro no toca el HTML.** Sale solo en el selector.

### La prueba que falló, y por qué el código tenía razón

Tres pruebas fallaron en la primera corrida: `index.html` y
`login-controller.js` "todavía contenían" el valor viejo. El dato crudo
mostró que las tres ocurrencias estaban **dentro de los comentarios que
explican el arreglo**. Cero código ejecutable.

La invariante es que ningún archivo **ejecuta** un rol literal, no que
ninguno lo **menciona**. Se corrigió la prueba —`leerSinComentarios()`— y
no la documentación: quien grepee `supervisor` dentro de seis meses merece
encontrar el motivo y no un archivo mudo.

Es el mismo caso del bloque 4c: cuando una expectativa choca con el código,
primero se verifica la especificación.

### Verificación

- `test/bloque5c-bis.mjs` — **21/21** en Node, sin red.
- Las siete suites anteriores intactas: 22, 15, 24, 19, 18, 16, 15.
- Sintaxis verificada en los tres JS tocados.

### El fallo en producción, y la lección

La primera versión hacía `getElementById('rol-selector').appendChild(…)` y
reventó apenas se desplegó:

```
TypeError: can't access property "appendChild", contenedorRoles is null
```

El JS nuevo llegó a producción y el `index.html` nuevo no. **Dos archivos
que tienen que viajar juntos terminan viajando separados alguna vez**, y el
controlador no tenía por qué depender de un `id` que vive en otro archivo.

Lo grave no era el síntoma sino el radio: en un ES Module un error corta el
archivo ENTERO, así que no se registró **ningún** otro manejador. Los tabs,
el toggle correo/teléfono y los dos formularios de login quedaron muertos.
La página se veía bien y no respondía a nada — el mismo modo de falla que un
import roto, ya anotado en este documento.

Corregido con tres cambios:

- `contenedorDeRoles()` usa el contenedor si existe y lo **fabrica** si no,
  avisando por consola. El desfase sigue siendo un problema; ya no rompe la
  página.
- Pintar el selector va dentro de un `try`. Un registro roto es un problema;
  una pantalla de ingreso muerta deja afuera a todo el mundo.
- El manejador se ata **al crear cada botón**, no con un `querySelectorAll`
  posterior: así no hay forma de pintar un botón sin su manejador.
- `replaceChildren()` antes de pintar: repintar no duplica.

> **Regla para la próxima.** Un controlador no depende de un `id` que vive
> en otro archivo sin una guarda. Y todo arranque de módulo que pueda fallar
> se aísla, porque en ES Modules el fallo no es local: es total.

### ⚠️ Deuda 19 — PRODUCCIÓN ESTÁ ADELANTE DEL REPO

**`firestore.rules` en el repo es ANTERIOR a la fase A.** No contiene
`esMaestro()` ni acepta `'maestro'` en ningún lado; las reglas desplegadas
en Firebase sí. La fase A se desplegó sin commitear el archivo.

**Consecuencia inmediata: `firebase deploy --only firestore` desde este
repo revierte la tolerancia** y deja sin acceso a toda cuenta con
`rol: 'maestro'` —hoy Test 1, y desde este bloque, cada cuenta nueva que se
registre como Maestro de Obras—. Sin error visible: pasa el guardia de
interfaz y la rebotan las reglas.

**Es lo primero que hay que cerrar, antes que la fase D.** Traer las reglas
desplegadas al repo, verificar que el único delta contra este archivo sea
la fase A, y commitear. Un archivo de reglas que no es la fuente de verdad
es peor que no tenerlo — mismo criterio que el encabezado de este documento
aplica a los contratos.

### Deuda 20 — `scripts/migrar-rol-maestro.js` no está en el repo

La fase B lo dio por hecho y el archivo no existe acá. La fase D lo necesita
para verificar su precondición —cero documentos con el rol viejo—, así que
hay que recuperarlo o reescribirlo antes.


---

## Bloque 5c/textos — un nombre por rol en la interfaz ✅

```
public/supervisor/dashboard.html                  ← "Panel del Ingeniero Residente"
public/supervisor/gestionar-empleados.html        ← "Seleccionar Maestro de Obras"
public/supervisor/gestionar-empleados-controller.js
public/supervisor/nueva-tarea.html
public/jefe/mis-tareas.html                       ← "Tareas asignadas a mi cuadrilla"
public/jefe/mi-cuadrilla.html                     ← el que asigna es el INGENIERO
test/bloque5c-textos.mjs                          ← nuevo, fuera del deploy
```

**Seis archivos, y se declara.** Se apoya en la excepción que este documento
ya reconoce para la fase E: un renombrado mecánico medido es **una sola
decisión aplicada muchas veces**, no seis decisiones de diseño. Cada cambio
se verificó que calzara exactamente una vez antes de aplicarse.

### El vocabulario, cerrado

| Rol | Identificador | Etiqueta única |
|---|---|---|
| Tope | `ingeniero` | **Ingeniero Residente** |
| Campo | `maestro` | **Maestro de Obras** |

**"Jefe de Cuadrilla" se retira de la interfaz.** D-04 dice que es la misma
persona que el Maestro de Obras; dos nombres para un rol es exactamente la
incoherencia que este bloque cierra.

**"Supervisor" no nombra a nadie.** En `mi-cuadrilla.html` decía que el
Supervisor asigna el equipo — y según la matriz del bloque 2, crear
empleados es del **ingeniero**. El texto no solo usaba el nombre viejo:
señalaba al rol equivocado.

### EXCEPCIÓN declarada — la columna de Excel NO se renombra

`importarExcel.js` lee la columna **"Jefe de Cuadrilla"** de los archivos
que la obra ya tiene armados, y `exportarExcel.js` la escribe.
`dashboard.html` documenta esa misma columna en el modal de importación, así
que tiene que decir exactamente lo mismo o la instrucción miente.

Es un **contrato de intercambio de datos, no una etiqueta de pantalla.**
Renombrarlo rompe cada plantilla existente. Pertenece al bloque 8, junto con
el resto del libro de Excel.

`test/bloque5c-textos.mjs` tiene una prueba que **exige que esa columna
conserve su nombre**: si alguien la "arregla", falla acá y no en la obra.

### Verificación

`test/bloque5c-textos.mjs` — 7/7. Escanea todo `public/**.{html,js}`
descontando comentarios, así que el bloqueo es sobre lo que se lee en
pantalla y no sobre lo que un comentario explica.

---

## Bloque 5c/D — reglas estrictas ✅ (falta el simulador)

```
firestore.rules                       ← deuda 19 CERRADA + fase D
scripts/migrar-rol-maestro.js         ← nuevo, deuda 20 CERRADA
scripts/migrar-supervisor-ids.js      ← EXCEPCIÓN, una constante
scripts/migrar-roles.js               ← EXCEPCIÓN, guarda de retiro
test/bloque5cd.mjs                    ← nuevo, fuera del deploy
```

### Deuda 19 cerrada — el repo vuelve a ser la fuente de verdad

Las reglas desplegadas se compararon contra las del repo. **El único delta
era la fase A**: `esMaestro()` agregada y `esSupervisor()` convertida en
alias. Los 34 `allow` eran idénticos. Con eso confirmado, la fase D se
aplicó sobre el archivo real.

### El cambio

```
function esMaestro()      // ANTES: 'maestro' O 'supervisor'
                          // AHORA: solo 'maestro'
function esSupervisor()   // RETIRADA. 8 sitios de llamada → esMaestro()
```

**El alias se retira ahora y no en la fase E.** Un alias que no hace nada es
un renglón que el próximo lector interpreta como que sí hace algo. Son ocho
reemplazos mecánicos en un archivo que ya estaba abierto.

### Invariantes que no se rompen

- **Solo hay DOS comparaciones de rol en todo el archivo**, una por rol,
  dentro de sus helpers. Tiene prueba: si aparece una tercera, alguien
  escribió un rol a mano fuera de `esIngeniero()` / `esMaestro()`.
- **El alcance del bloque 5b quedó intacto**: `estaEnLaLista`,
  `puedeVerEsteProyecto` y `puedeVerProyecto` sin tocar, con su fail-closed.
- **D-11 sigue en el servidor.** `avancePct` es inescribible para quien
  cobra el `bonoMO`.
- **Los pagos siguen cerrados al maestro.** Tiene prueba propia.
- **Cero borrado duro**, en los mismos documentos.
- **`supervisorIds` conserva su nombre.** Renombrarlo es migración de datos
  y necesita bloque propio con script, reglas y código en pasos separados.

### Los dos scripts que la fase D dejaba rotos

**`migrar-supervisor-ids.js`** filtraba por `rol === 'supervisor'`. Con las
reglas estrictas habría listado **cero maestros** — y es hoy la única forma
de asignar proyectos (deuda 16). Una constante.

**`migrar-roles.js` queda RETIRADO con guarda.** Su mapa del bloque 2
convierte *hacia* `'supervisor'`, que ya no concede nada: correrlo hoy
dejaría cuentas sin acceso, sin error visible. No se borra porque documenta
el intercambio de significado del string —oficina → campo— que es la única
explicación de por qué `rolAnterior` y `rolMigradoEn` existen.

### ⚠️ Verificación PENDIENTE — no está cerrado hasta esto

`test/bloque5cd.mjs` — 13/13 — fija la **forma** del archivo, no su
comportamiento. Las reglas no se ejecutan en Node.

Falta, igual que en el bloque 5b, la verificación en el **Simulador de la
consola** con las cuentas reales. Y antes de eso, la precondición:

```
1. node scripts/migrar-rol-maestro.js            ← debe decir CERO rol viejo
2. si no da cero:  node scripts/migrar-rol-maestro.js --escribir
3. node scripts/migrar-rol-maestro.js            ← verificar de nuevo
4. firebase deploy --only firestore              ← desde cmd
5. Simulador: 4 pruebas con los uid reales
```

**Un guardia de servidor no se prueba desde una interfaz que filtra antes**
— la lección del 5b sigue vigente.

### Deuda

- **19 — CERRADA.** El repo vuelve a ser la fuente de verdad de las reglas.
- **20 — CERRADA.** `migrar-rol-maestro.js` existe.
- **22 — nueva** `scripts/probar-reglas.js`. Reemplaza el Simulador de la
  consola para probar reglas: fabrica sesiones reales con `firebase-admin`
  y lee con el SDK de cliente. Requiere `firebase` y `firebase-admin`
  declarados en `package.json` — antes ninguna dependencia estaba
  declarada, y eso fue lo que hizo que `npm install firebase --no-save` se
  llevara puesto `firebase-admin`. Reutilizable para el 5d.
- **21 — `roles.js` es MÁS tolerante que las reglas.** `normalizarRol()`
  sigue traduciendo `'supervisor'` → `'maestro'`, pero el servidor ya no le
  concede nada a ese valor. Un documento rezagado pasaría el guardia de
  interfaz y chocaría con permisos en cada pantalla. La precondición de la
  fase D es que no exista ninguno; retirar la tolerancia del código va con
  la fase E, que ya abre `roles.js` para el alias `ROL_SUPERVISOR`.
- **1 — sigue abierta, y ahora tiene bloque asignado (5d).** No cabía acá:
  exigir `rol == 'maestro'` al crear `usuarios/{uid}` rompe el formulario de
  registro, que **ofrece "Ingeniero Residente" como opción**. Son dos
  mitades —regla y UI— y tienen que desplegarse en orden: primero la UI que
  deja de ofrecerlo, después la regla. Mezclarlas en un bloque garantiza que
  alguien las despliegue juntas.
---

## Bloque 5d/0 — el arreglo del 5c/C-bis estaba en el archivo equivocado ✅

Antes de tocar nada del 5d apareció esto, y bloqueaba el bloque entero.

**`public/index.html` —el que Netlify publica— conservaba los dos botones de
rol escritos a mano, uno con `data-rol="supervisor"`.** Sin tocar desde el
bloque 2:

```
git log --oneline -- public/index.html
1c297e0 Bloque 2: restaurar dos roles (ingeniero/supervisor) + reglas Firestore
```

El archivo corregido existía, pero era `index.html` **en la raíz del repo**,
creado en el commit del 5c/D. `netlify.toml` dice `publish = "public"`: ese
archivo no se sirve nunca.

**Por qué producción no rompió.** `contenedorDeRoles()` no encontraba
`#rol-selector`, caía al `querySelector('.rol-selector')` —que sí existía en el
HTML viejo—, lo devolvía sin avisar por consola, y `replaceChildren()` borraba
los dos botones a mano antes de repintar desde `roles.js`. El registro escribía
`'maestro'` correctamente. **La guarda puesta para que un desfase no matara la
página estaba tapando exactamente el desfase que fue diseñada para sobrevivir.**
Funcionó como red, no como aviso.

`test/bloque5c-bis.mjs` lo decía desde el primer día: daba **18/21**, no 21/21,
y los tres fallos eran los tres que leen `public/index.html`.

**Corrección:** se copió el contenido bueno sobre `public/index.html` y se borró
`index.html` de la raíz con `git rm`. Dejar los dos garantizaba que la próxima
persona que abriera "index.html" volviera a editar el muerto.

> **Regla para la próxima.** Una guarda defensiva que se activa en silencio
> esconde la condición que la activó. Si `contenedorDeRoles()` hubiera fallado
> ruidosamente en vez de encontrar el contenedor viejo por casualidad, esto se
> habría visto el mismo día. Cuando una guarda tiene una rama de "esto no
> debería pasar", esa rama avisa.

> **Y la otra.** El único archivo que Netlify publica es el de `public/`. Un
> archivo de la raíz con el mismo nombre no es un respaldo: es un señuelo.

---

## Bloque 5d — el rol no se lo asigna uno mismo ✅

Cierra la **deuda 1**, abierta desde el bloque 2 y la más grave que quedaba.

```
public/index.html               ← 5d/0: portado el arreglo del 5c/C-bis
public/js/roles.js              ← EXCEPCIÓN declarada (bloque 2/5c): ROLES_REGISTRO
public/js/login-controller.js   ← pinta desde ROLES_REGISTRO, preselecciona
firestore.rules                 ← naceComoMaestro() + noToca() en create y update
scripts/probar-reglas.js        ← EXCEPCIÓN declarada (deuda 22): 4 casos nuevos
test/bloque5d.mjs               ← nuevo, fuera del deploy y del conteo
git rm index.html               ← borrado de un archivo creado por error
```

Cinco archivos. `roles.js` es excepción por el mismo criterio que en el
5c/C-bis: es la única fuente de identidad de rol y el cambio es aditivo.
`probar-reglas.js` se extiende, no se reemplaza — es lo que dice la deuda 22.

### Las decisiones, cerradas antes del código

**D-5d-01 · Una cuenta nace `'maestro'`, obligatorio.** El campo tiene que estar
presente y valer eso. Un documento sin `rol` obligaría a cada guardia a manejar
un tercer estado que hoy no existe; mismo criterio que `rutaHomePorRol` y
`renderSidebar`, que ante ambigüedad degradan al rol de **menos** alcance.

`activo` queda fuera del alcance de `create`, declarado: una cuenta que naciera
con `activo: false` solo se deja afuera a sí misma.

**D-5d-02 · Promueve un `ingeniero`, y hoy sin pantalla.** Es la rama
`esIngeniero()` del `update`. Hay 2 ingenieros vivos, así que no hay riesgo de
quedarse sin quién promueva. **Deuda 23.**

Consecuencia que conviene tener escrita antes de descubrirla un lunes: **en una
instalación nueva, sin ningún ingeniero, nadie puede llegar a serlo desde la
aplicación.** El primero se crea con el SDK admin, que no pasa por reglas.

**D-5d-03 · El `update` también, y con `activo` adentro.** La deuda estaba
redactada como si el agujero fuera el `create`. No lo era:
`allow update: if esElMismoUsuario(uid) || esIngeniero()` dejaba al propio
usuario reescribir su documento entero, `rol` incluido.

**Hoy ninguna pantalla hace `update` sobre `usuarios/{uid}`.** El único escritor
es el registro, en `auth.js`. Todo lo demás toca la subcolección `empleados`.
Con cero consumidores la tentación era `allow update: if esIngeniero()` a secas.
No se hizo: el día que aparezca "editar mi perfil", alguien va a reabrir esa
rama sin saber que `rol` tenía que quedar afuera — que es literalmente cómo
nació esta deuda. **La protección va escrita en el renglón, no en la ausencia
del renglón.**

`activo` entra junto con `rol` porque `habilitado()` lo mira: si el Ingeniero
desactiva una cuenta y su dueño puede reescribir `activo: true`, la
desactivación es decorativa. Mismo agujero, misma línea.

**D-5d-04 · Las cuentas existentes se verifican, no se tocan.** La regla nueva
no las alcanza. Línea base confirmada antes de desplegar con
`migrar-rol-maestro.js`: **2 ingenieros, 2 maestros, cero con el rol viejo.**
Si algún día aparece un tercer ingeniero, hay fecha desde la cual eso no debería
haber podido pasar.

**D-5d-05 · `ROLES_REGISTRO`, y la preselección.** `ROLES` no se podía tocar: lo
usan `protegerPagina`, `rutaHomePorRol` y el sidebar. Hace falta un concepto
distinto — `ROLES` es quién puede existir; `ROLES_REGISTRO` es quién puede darse
de alta solo. **El `ingeniero` sigue siendo un rol vigente; lo que deja de
existir es dárselo uno mismo.**

Con un solo rol elegible el botón se **preselecciona** y se sigue pintando: un
botón obligatorio de opción única es un paso que solo se puede hacer mal, pero
la persona tiene que saber con qué rol entra. El día que `ROLES_REGISTRO` vuelva
a tener dos, la preselección no se activa y el selector vuelve a pedir una
elección sin tocar una línea.

**D-5d-06 · Las escrituras se prueban contra un uid fabricado.** Los cuatro
casos del bloque escriben: el caso 6 da de alta un usuario y el 8 promueve a
alguien. Sobre una base con 4 cuentas eso no se hace. Los cuatro corren
**encadenados sobre `zz-prueba-reglas-5d`**, y ninguna cuenta real se escribe.

### Invariantes que no se rompen

- **`ROLES_REGISTRO` y `naceComoMaestro()` son espejo.** Si dejaran de coincidir,
  el formulario ofrecería un rol que el servidor rechaza — y el error le saldría
  a quien se registra, no a quien lo desincronizó. Tiene prueba que compara el
  literal de la regla contra `ROLES_REGISTRO[0]`.
- **Siguen habiendo solo DOS lecturas de rol del perfil** (`perfil().rol ==`),
  una por rol dentro de su helper. La comparación del 5d es distinta y no cuenta
  para esa invariante: no lee quién sos, lee qué estás escribiendo.
- **El literal de `create` vive dentro de un helper con nombre**, no suelto en el
  `allow`, igual que los dos de `esIngeniero()` y `esMaestro()`.
- **`noToca()` es el espejo de `soloCambia()`**: `hasAny` negado, no `hasOnly`.
- **El alcance del 5b quedó intacto** — `estaEnLaLista`, `puedeVerEsteProyecto`,
  `puedeVerProyecto` sin tocar, con su fail-closed.
- **Cero borrado duro**, en los mismos documentos. Con **una excepción declarada
  y acotada:** la limpieza de `probar-reglas.js` borra con el SDK admin el
  documento y la cuenta de Auth que la propia prueba fabricó. Nunca el
  histórico, y las reglas siguen negando `delete` a la aplicación en los nueve.
- **`signInWithCustomToken` con un uid inexistente CREA la cuenta en Auth.** Por
  eso la limpieza borra las dos cosas, corre al arrancar —por si una corrida
  anterior murió a la mitad— y va en un `finally`.

### Orden de despliegue — importa, y va al revés que siempre

```
0.  public/index.html al día + git rm index.html      →  git push
1.  ROLES_REGISTRO + selector                         →  git push
2.  node scripts/migrar-rol-maestro.js                →  2 / 2 / 0
3.  firebase deploy --only firestore                  →  desde cmd
4.  node scripts/probar-reglas.js                     →  8/8
```

**Los pasos 1 y 3 no se pueden invertir.** La regla rechazaría lo que el
formulario sigue ofreciendo, y el registro quedaría roto entre un despliegue y
el otro. Es la única vez que la UI va antes que las reglas: acá la UI se
restringe a sí misma, no pide un permiso nuevo.

### Verificación

- `test/bloque5d.mjs` — **25/25** en Node, sin red. Fija la **forma** de las
  reglas, no su comportamiento: las reglas no se ejecutan en Node.
- `scripts/probar-reglas.js` — **8/8** contra las reglas desplegadas, con
  sesiones reales. Los 4 casos de lectura del 5b/5c más los 4 de escritura:

  | Caso | Esperado |
  |---|---|
  | crearse a sí mismo como `ingeniero` | denegado |
  | crearse a sí mismo como `maestro` | permitido |
  | **promoverse a sí mismo con `update` de `rol`** | **denegado** |
  | un ingeniero promoviendo a otra cuenta | permitido |

- Las diez suites anteriores intactas: 22, 15, 24, 19, 18, 16, 15, **21**, 7, 13.
  La octava vuelve a 21/21 con el 5d/0; venía dando 18/21.

### La prueba que falló, y por qué el código tenía razón

`activo está protegido junto con rol` falló en la primera corrida. El dato crudo
mostró que la prueba buscaba la primera línea con `noToca(` y agarraba la
**definición** de la función, no la invocación del `allow`. Se corrigió la
prueba —busca `noToca([`— y no el código. Mismo caso del 4c y del 5c/C-bis:
cuando una expectativa choca con el código, primero se verifica la
especificación.

### Deuda

- **1 — CERRADA.** Era la más grave que quedaba abierta. El contrapeso de D-11
  vuelve a ser de seguridad y no de interfaz.
- **23 — nueva: promover a `ingeniero` no tiene pantalla.** Es consola o script.
  Candidata natural a juntarse con el **5b-2**, que ya es la pantalla de
  asignaciones y ya abre el territorio de "administrar cuentas".
- **22 — sigue vigente y ahora tiene precedente.** `probar-reglas.js` se
  extendió con modo escritura; el próximo caso de reglas se agrega ahí, no en un
  mecanismo nuevo.
- **21 — `roles.js` sigue siendo más tolerante que las reglas.** Va con la fase
  E, que ya abre el archivo para retirar `ROL_SUPERVISOR`.
- **Nota de proceso.** `scripts/probar-reglas.js` con los 4 casos de escritura
  quedó commiteado dentro de `5f0c40e` ("Cierre de commit pendiente del 5c/D"),
  no en el commit propio del 5d. El contenido es correcto y no afecta ningún
  resultado, pero es un bloque mezclado con otro en el historial — se declara
  en vez de dejarlo pasar.
---

## Bloque 5c/E — renombrado de directorios ✅

Cierra la deuda 3, abierta desde el bloque 2, y la deuda 21.

```
public/supervisor/ → public/ingeniero/   (git mv, 17 archivos)
public/jefe/        → public/maestro/    (git mv, 8 archivos)
netlify.toml                             ← dos redirects, antes del catch-all
public/js/roles.js                       ← ROL_SUPERVISOR y esSupervisor retirados,
                                            HOME_POR_ROL apunta a los nombres nuevos
scripts/renombrar-rutas-5ce.js           ← nuevo, simulación/escritura
test/bloque5ce.mjs                       ← nuevo, 13 pruebas

EXCEPCIONES declaradas, todas de otros bloques ya cerrados:
test/bloque5c.mjs        ← retira 3 pruebas obsoletas de la fase C
test/bloque5c-textos.mjs ← 3 rutas hardcodeadas sin barra inicial
test/bloque3.mjs, bloque4b.mjs, bloque4c.mjs, bloque5.mjs
                          ← imports de módulo actualizados a los directorios nuevos
```

Es "una sola decisión aplicada muchas veces", como dice el propio plan de
desarrollo — por eso no cuenta contra el máximo de cinco. La decisión es una:
`/supervisor/`→`/ingeniero/`, `/jefe/`→`/maestro/`, `ROL_SUPERVISOR`→`ROL_MAESTRO`.
Se aplicó con un script de simulación/escritura, no a mano, sobre **25 archivos
de contenido** dentro de `public/` (45 reemplazos) más **4 archivos de prueba**
(6 reemplazos) que importan módulos por ruta relativa.

### Las decisiones, cerradas antes del código

**D-5ce-01 · Dónde queda `bono-resumen.html`, que abren los dos roles.**

Se muda a `/ingeniero/` junto con el resto, sin tercer directorio. Mismo
criterio que ya declaró el bloque 5: **la carpeta no es frontera de
permisos, el guardia es `protegerPagina()`.** Crear `/comun/` habría agregado
una decisión de diseño nueva a un bloque que tenía que seguir siendo mecánico.

**D-5ce-02 · Todo en un solo push, no en dos deploys.**

El `git mv`, el renombrado de rutas internas y los redirects de `netlify.toml`
van en el mismo commit. Desplegar el redirect *antes* que el `git mv` real
habría dejado, por un instante, un redirect apuntando a una carpeta que
todavía no existe. El redirect tiene que estar vivo en el mismo momento en
que la ruta vieja deja de estarlo — nunca antes, nunca después.

**D-5ce-03 · El renombrado se aplica con script, no a mano.**

Con 25+ archivos de por medio, a mano es exactamente donde se cuela un error
de tipeo que nadie nota hasta el primer 404 en producción. El script sigue
el mismo patrón que `migrar-*.js`: simulación primero, conteo real,
escritura después.

### Lo que el script NO tocó, y por qué — el hallazgo real de este bloque

Un reemplazo ciego de `/supervisor/` y `/jefe/` en todo el repo habría
corrompido tres pruebas **sin ningún error de sintaxis que lo delatara**:

1. **`test/bloque5c-bis.mjs`** — dos líneas usan `/supervisor/i` como
   **delimitador de expresión regular** (verificar que la palabra
   "supervisor" no aparezca en ningún texto), no como ruta. Un reemplazo
   ciego las habría vuelto `/ingeniero/i` — cambiando qué verifica la
   prueba, calladamente. Excluido del script; cero rutas reales que perder.
2. **`test/bloque5cd.mjs`** — su `ROL_SUPERVISOR` es el nombre de una
   **variable local dentro de `scripts/migrar-supervisor-ids.js`** (bloque
   5c/D, ya cerrado), sin relación con el export de `roles.js` que se
   retira acá. Excluido del script.
3. **`test/bloque5c-textos.mjs`** — tres rutas construidas con
   `join(publico, 'supervisor/dashboard.html')`, sin barra inicial: el
   patrón del script (que exige barra antes Y después) no las alcanzaba.
   Se corrigieron a mano, con el contexto completo revisado primero.

> **Regla para la próxima.** Un script de renombrado mecánico necesita un
> barrido de verificación después, no solo un conteo antes/después que
> cuadre. `/supervisor/i` y `'supervisor/dashboard.html'` son dos formas
> de que el mismo string dejara de ser lo que el patrón asumía que era, y
> ninguna de las dos rompe la sintaxis al reemplazarse mal — rompen el
> *significado* de la prueba, que es más difícil de notar.

### `public/js/roles.js` — lo que cambió

`ROL_SUPERVISOR` y `esSupervisor` se retiran: cumplieron el plazo que su
propio comentario anunciaba desde la fase C ("se retira en la fase E"). Los
8 consumidores que los importaban (`ROL_MAESTRO` en su lugar) ya no
colisionan con ningún import existente — verificado antes de tocar nada:
ningún archivo importaba los dos a la vez.

`HOME_POR_ROL` pierde la nota de deuda y apunta a los nombres reales:

```js
export const HOME_POR_ROL = Object.freeze({
  [ROL_INGENIERO]: '/ingeniero/dashboard.html',
  [ROL_MAESTRO]: '/maestro/mis-tareas.html',
});
```

### `test/bloque5c.mjs` — tres pruebas retiradas, con excepción declarada

Tocar el archivo de prueba de un bloque cerrado (fase C) rompe la regla de
"un bloque nunca modifica los archivos de otro" — salvo que, como acá, el
propio bloque anunció su vencimiento desde el día en que se escribió. Se
retiraron:

- `'ROL_SUPERVISOR sobrevive como alias y apunta al nuevo'`
- `'esSupervisor sigue siendo el mismo predicado que esMaestro'`

Y se reescribió `'cada rol tiene su home, y los directorios siguen
invertidos'` → `'cada rol tiene su home, con los nombres del bloque 5c/E'`,
ya que la inversión que documentaba dejó de existir.

### netlify.toml — los dos redirects

```
[[redirects]]
  from = "/supervisor/*"
  to = "/ingeniero/:splat"
  status = 301

[[redirects]]
  from = "/jefe/*"
  to = "/maestro/:splat"
  status = 301

[[redirects]]              ← el catch-all sigue después, no antes
  from = "/*"
  to = "/index.html"
  status = 404
```

Netlify evalúa de arriba hacia abajo y se queda con la primera coincidencia:
si el catch-all fuera primero, se comería los dos redirects específicos.

### Invariantes que no se rompen

- **Cero `/supervisor/` o `/jefe/` fuera de `netlify.toml`** — ahí se
  conservan a propósito, como origen del redirect.
- **El campo `jefeCuadrillaId` de `tareas` conserva su nombre.** Es
  migración de datos, no de rutas; pertenece al bloque 7 y no se mezcló acá.
- **La columna de Excel "Jefe de Cuadrilla" sigue sin tocarse.** Contrato
  de intercambio con las plantillas de la obra; tiene su propia prueba en
  `bloque5c-textos.mjs` que exige que NO cambie.
- **Los dos roles siguen vigentes.** Esto no fue "eliminar el ingeniero" —
  fue renombrar dónde vive cada uno.

### Verificación

- `test/bloque5ce.mjs` — **13/13** en Node, sin red. Es la prueba de
  aceptación del plan, en código: cero ocurrencias de las rutas viejas
  fuera de `netlify.toml`, los redirects en el orden correcto, `roles.js`
  consistente.
- Las once suites anteriores intactas, con dos ajustadas por el motivo
  correcto (retiro de pruebas obsoletas, no un bug):
  22 · 15 · 24 · 19 · 18 · 16 · **13** (era 15, dos pruebas obsoletas
  retiradas) · 21 · 7 · 13 · 25.
- Checklist visual pendiente en producción: las dos cuentas navegan el
  menú completo sin un solo 404, y un enlace viejo a `/supervisor/dashboard.html`
  o `/jefe/mis-tareas.html` redirige en vez de romperse.

### Deuda

- **3 — CERRADA.** Los directorios ya no mienten: `/ingeniero/` es del
  Ingeniero Residente, `/maestro/` es del Maestro de Obras.
- **21 — CERRADA.** `roles.js` ya no es más tolerante que las reglas: el
  alias que sobrevivía solo en código se retiró.
