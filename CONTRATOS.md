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

**Verificación:** los 14 archivos parsean; cero ocurrencias de `jefe_cuadrilla`,
`admin` o `esAdmin` fuera de comentarios y del mapa de migración; reglas
balanceadas, sin funciones huérfanas, máximo 5 `get()` por evaluación (límite 10).
Login manual con una cuenta de cada rol — ver checklist del handoff.
