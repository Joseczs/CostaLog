// repos/tareasRepo.js
// Bloque 1 — capa de datos. `proyectos/{id}/tareas` (Bono por Productividad).
//

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from '../firebase-config.js';

// ── Helpers internos ────────────────────────────────────────────────────────

function aPlano(valor) {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor.toDate === 'function') return valor.toDate();
  if (Array.isArray(valor)) return valor.map(aPlano);
  if (typeof valor === 'object' && valor.constructor === Object) {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) salida[k] = aPlano(v);
    return salida;
  }
  return valor;
}

const desdeSnap = (snap) => ({ id: snap.id, ...aPlano(snap.data()) });
const esActivo = (o) => o.activo !== false;

const exigir = (valor, nombre) => {
  if (!valor) throw new Error(`tareasRepo: falta ${nombre}`);
  return valor;
};

/** Más reciente primero. `horaInicio` y `createdAt` ya vienen como Date. */
const porFechaDesc = (a, b) =>
  (b.horaInicio?.getTime() ?? b.createdAt?.getTime() ?? 0) -
  (a.horaInicio?.getTime() ?? a.createdAt?.getTime() ?? 0);

// ── Repositorio ─────────────────────────────────────────────────────────────

export function crearTareasRepo(db) {
  const col = (proyectoId) =>
    collection(db, 'proyectos', exigir(proyectoId, 'proyectoId'), 'tareas');

  const ref = (proyectoId, tareaId) =>
    doc(db, 'proyectos', exigir(proyectoId, 'proyectoId'), 'tareas', exigir(tareaId, 'tareaId'));

  /** @returns {Promise<Object[]>} activas de un proyecto, más reciente primero. */
  async function listar(proyectoId) {
    const snap = await getDocs(col(proyectoId));
    return snap.docs.map(desdeSnap).filter(esActivo).sort(porFechaDesc);
  }

  /** Tareas atadas a una meta, para el corte del período. */
  async function listarPorMeta(proyectoId, metaId) {
    exigir(metaId, 'metaId');
    const todas = await listar(proyectoId);
    return todas.filter((t) => t.metaId === metaId);
  }

  /**
   * Reemplazo de `collectionGroup('tareas')`. Itera `proyectos → tareas` con
   * consultas normales de colección.
   *
   * Esto no es una preferencia de estilo: `collectionGroup` deniega la consulta
   * ENTERA si existe un solo documento huérfano en una ruta que las reglas no
   * cubren — y esos huérfanos existen, quedaron de proyectos borrados desde la
   * consola, que no elimina subcolecciones. Iterando, los huérfanos
   * simplemente no aparecen porque nadie los enumera.
   *
   * Cuesta 1 + N lecturas de colección. Con la cantidad de proyectos de esta
   * empresa no es un problema; si algún día lo fuera, se cachea la lista de
   * proyectos, no se vuelve a `collectionGroup`.
   *
   * @returns {Promise<Object[]>} cada tarea con `proyectoId` y `proyectoNombre`.
   */
  async function listarDeTodosLosProyectos() {
    const proyectos = (await getDocs(collection(db, 'proyectos')))
      .docs.map(desdeSnap).filter(esActivo);

    const porProyecto = await Promise.all(
      proyectos.map(async (proyecto) => {
        const tareas = await listar(proyecto.id);
        return tareas.map((t) => ({
          ...t,
          proyectoId: proyecto.id,
          proyectoNombre: proyecto.nombre ?? null,
        }));
      }),
    );

    return porProyecto.flat().sort(porFechaDesc);
  }

  async function obtener(proyectoId, tareaId, { incluirInactivos = false } = {}) {
    const snap = await getDoc(ref(proyectoId, tareaId));
    if (!snap.exists()) return null;
    const tarea = desdeSnap(snap);
    if (!incluirInactivos && !esActivo(tarea)) return null;
    return tarea;
  }

  /** @returns {Promise<string>} id de la tarea creada. */
  async function crear(proyectoId, datos) {
    const nueva = await addDoc(col(proyectoId), {
      cuadrilla: [],
      metaId: null,
      horaFin: null,
      hhRealCuadrilla: null,
      bpGanado: false,
      ...datos,
      activo: true,
      createdAt: serverTimestamp(),
    });
    return nueva.id;
  }

  async function actualizar(proyectoId, tareaId, cambios) {
    await updateDoc(ref(proyectoId, tareaId), { ...cambios });
  }

  /**
   * Reemplaza el arreglo `cuadrilla` completo. Se pasa entero: Firestore no
   * sabe editar un elemento de un arreglo, y media cuadrilla escrita es peor
   * que ninguna.
   */
  async function guardarCuadrilla(proyectoId, tareaId, cuadrilla) {
    if (!Array.isArray(cuadrilla)) throw new Error('tareasRepo: cuadrilla debe ser un arreglo');
    await updateDoc(ref(proyectoId, tareaId), { cuadrilla });
  }

  /**
   * Cierre de la tarea: el momento en que se decide si la cuadrilla cobra.
   * `bpGanado` lo calcula `calcularTareaBP()` y se pasa ya resuelto — el repo
   * no decide plata, solo la guarda.
   */
  async function cerrar(proyectoId, tareaId, { horaFin, hhRealCuadrilla, bpGanado }) {
    if (!Number.isFinite(Number(hhRealCuadrilla))) {
      throw new Error('tareasRepo: hhRealCuadrilla debe ser numérico');
    }
    if (typeof bpGanado !== 'boolean') {
      throw new Error('tareasRepo: bpGanado debe ser booleano (el BP es binario)');
    }
    await updateDoc(ref(proyectoId, tareaId), {
      horaFin: horaFin ?? new Date(),
      hhRealCuadrilla: Number(hhRealCuadrilla),
      bpGanado,
      cerradaEn: serverTimestamp(),
    });
  }

  async function desactivar(proyectoId, tareaId) {
    await updateDoc(ref(proyectoId, tareaId), { activo: false });
  }

  return {
    listar,
    listarPorMeta,
    listarDeTodosLosProyectos,
    obtener,
    crear,
    actualizar,
    guardarCuadrilla,
    cerrar,
    desactivar,
  };
}

// ── Nota de alcance ─────────────────────────────────────────────────────────
// Esta colección YA tiene datos en producción, con el esquema viejo de pesos
// (Operario 1.0 / Ayudante 0.5). El repo no asume `pctBP` ni lo exige: devuelve
// la cuadrilla tal como está guardada. La migración a porcentaje manual es del
// bloque 7 (D-09) y hasta que corra van a convivir los dos esquemas.
