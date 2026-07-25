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

  /** @returns {Promise<Object[]>} activos, ordenados por nombre. */
  async function listar() {
    const snap = await getDocs(col());
    return snap.docs
      .map(desdeSnap)
      .filter(esActivo)
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
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

  return { listar, obtener, crear, actualizar, actualizarReglas, desactivar };
}
