// repos/proyectosRepo.js
// Bloque 1 — capa de datos. Colección raíz `proyectos`.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from '../firebase-config.js';

// ── Helpers internos ────────────────────────────────────────────────────────
// Se repiten en los cuatro repos a propósito: el bloque 1 son cuatro archivos,
// no cinco. Si algún día son cinco, esto sube a `repos/_base.js` de una vez.

/** Timestamp → Date, en profundidad. Fuera del repo no circulan tipos de Firestore. */
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

/** Activo salvo que diga explícitamente `activo: false`. Un doc viejo sin el
 *  campo cuenta como activo: si no, la migración borraría media base. */
const esActivo = (o) => o.activo !== false;

const exigir = (valor, nombre) => {
  if (!valor) throw new Error(`proyectosRepo: falta ${nombre}`);
  return valor;
};

// ── Repositorio ─────────────────────────────────────────────────────────────

export function crearProyectosRepo(db) {
  const col = () => collection(db, 'proyectos');
  const ref = (proyectoId) => doc(db, 'proyectos', exigir(proyectoId, 'proyectoId'));

  /**
   * @param {{ soloDe?: string|null }} [opciones] — `soloDe` es el uid de un
   *        supervisor: devuelve solo los proyectos donde está asignado.
   *        Sin él, devuelve todos (es lo que corresponde al ingeniero).
   * @returns {Promise<Object[]>} activos, ordenados por nombre.
   *
   * ── Por qué acá SÍ hay un `where`, y por qué no rompe el principio 2
   * ──────────────────────────────────────────────────────────────────
   * El principio dice "cero índices compuestos", y la forma de cumplirlo era
   * no llevar `where` ni `orderBy`. Pero lo que exige un índice compuesto es
   * la COMBINACIÓN de los dos: un `array-contains` solo usa el índice de un
   * campo, que Firestore crea automáticamente. Por eso el orden se sigue
   * haciendo en memoria — agregarle un `orderBy` sí pediría índice compuesto.
   *
   * Y hace falta un `where`, no se puede evitar: Firestore NO filtra los
   * documentos de una consulta según las reglas. Evalúa si la consulta
   * COMPLETA es segura, y si un solo documento no pasara, falla entera. Una
   * consulta sin filtro hecha por un supervisor no devolvería menos
   * proyectos: devolvería "Missing or insufficient permissions". El filtro
   * del cliente es lo que hace que la consulta sea demostrablemente segura;
   * el guardia de verdad sigue siendo la regla del servidor.
   */
  async function listar({ soloDe = null } = {}) {
    const consulta = soloDe
      ? query(col(), where('supervisorIds', 'array-contains', soloDe))
      : col();
    const snap = await getDocs(consulta);
    return snap.docs
      .map(desdeSnap)
      .filter(esActivo)
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  }

  /**
   * Reemplaza la lista completa de supervisores asignados al proyecto.
   *
   * Arreglo completo, nunca `arrayUnion`/`arrayRemove`: la lista es una
   * decisión del ingeniero sobre quién entra y quién sale, y una operación
   * atómica parcial dejaría estados que nadie decidió. Mismo criterio que
   * `actualizarReglas` con el mapa de `reglasBono`.
   */
  async function asignarSupervisores(proyectoId, supervisorIds) {
    if (!Array.isArray(supervisorIds)) {
      throw new Error('proyectosRepo: supervisorIds tiene que ser un arreglo');
    }
    // Sin duplicados y sin vacíos: un uid repetido no da más permiso, pero
    // sí ensucia cualquier conteo que se haga después sobre el arreglo.
    const limpio = [...new Set(supervisorIds.filter(Boolean))];
    await updateDoc(ref(proyectoId), { supervisorIds: limpio });
  }

  /** @returns {Promise<Object|null>} null si no existe o si está desactivado. */
  async function obtener(proyectoId, { incluirInactivos = false } = {}) {
    const snap = await getDoc(ref(proyectoId));
    if (!snap.exists()) return null;
    const proyecto = desdeSnap(snap);
    if (!incluirInactivos && !esActivo(proyecto)) return null;
    return proyecto;
  }

  /** @returns {Promise<string>} id del proyecto creado. */
  async function crear(datos) {
    const nuevo = await addDoc(col(), {
      // `supervisorIds` va ANTES del spread para que `datos` lo pueda
      // sobrescribir si el llamador ya trae asignaciones. Pero nunca puede
      // faltar: un proyecto sin el campo es invisible para todo supervisor,
      // y eso tiene que ser una decisión, no un olvido del formulario.
      supervisorIds: [],
      ...datos,
      activo: true,
      createdAt: serverTimestamp(),
    });
    return nuevo.id;
  }

  async function actualizar(proyectoId, cambios) {
    await updateDoc(ref(proyectoId), { ...cambios });
  }

  /**
   * Reemplaza el mapa `reglasBono` completo. Se pasa entero, ya normalizado
   * con `normalizarReglas()` — nunca campo por campo, o quedan mapas a medias.
   */
  async function actualizarReglas(proyectoId, reglasBono) {
    exigir(reglasBono, 'reglasBono');
    await updateDoc(ref(proyectoId), { reglasBono });
  }

  /** Soft-delete. Nunca se borra: el histórico de bonos cuelga de acá. */
  async function desactivar(proyectoId) {
    await updateDoc(ref(proyectoId), { activo: false });
  }

  return {
    listar, obtener, crear, actualizar, actualizarReglas,
    asignarSupervisores, desactivar,
  };
}
