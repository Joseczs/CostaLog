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
| 2 | Roles + reglas Firestore | ⬜ | — |
| 3 | Configuración del proyecto | ⬜ | — |
| 4 | Metas e hitos | ⬜ | — |
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
