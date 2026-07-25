// repos/metasRepo.js
// Bloque 1 — capa de datos. `proyectos/{id}/metas` y su subcolección
// `evaluaciones` (ver nota de alcance al final del archivo).
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
  if (!valor) throw new Error(`metasRepo: falta ${nombre}`);
  return valor;
};

const ESTADOS = ['abierta', 'evaluada', 'cerrada', 'pagada'];

// ── Repositorio ─────────────────────────────────────────────────────────────

export function crearMetasRepo(db) {
  const col = (proyectoId) =>
    collection(db, 'proyectos', exigir(proyectoId, 'proyectoId'), 'metas');

  const ref = (proyectoId, metaId) =>
    doc(db, 'proyectos', exigir(proyectoId, 'proyectoId'), 'metas', exigir(metaId, 'metaId'));

  const colEval = (proyectoId, metaId) =>
    collection(db, 'proyectos', exigir(proyectoId, 'proyectoId'),
      'metas', exigir(metaId, 'metaId'), 'evaluaciones');

  const refEval = (proyectoId, metaId, evaluacionId) =>
    doc(db, 'proyectos', exigir(proyectoId, 'proyectoId'),
      'metas', exigir(metaId, 'metaId'),
      'evaluaciones', exigir(evaluacionId, 'evaluacionId'));

  // ── Metas ─────────────────────────────────────────────────────────────────

  /** @returns {Promise<Object[]>} activas, de la más reciente a la más vieja. */
  async function listar(proyectoId) {
    const snap = await getDocs(col(proyectoId));
    return snap.docs
      .map(desdeSnap)
      .filter(esActivo)
      .sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0));
  }

  async function obtener(proyectoId, metaId, { incluirInactivos = false } = {}) {
    const snap = await getDoc(ref(proyectoId, metaId));
    if (!snap.exists()) return null;
    const meta = desdeSnap(snap);
    if (!incluirInactivos && !esActivo(meta)) return null;
    return meta;
  }

  /**
   * El consecutivo se calcula sobre TODAS las metas, incluidas las
   * desactivadas: si se reusan números, el histórico deja de ser trazable.
   * @returns {Promise<number>}
   */
  async function siguienteNumero(proyectoId) {
    const snap = await getDocs(col(proyectoId));
    const maximo = snap.docs.reduce((max, d) => Math.max(max, d.data().numero ?? 0), 0);
    return maximo + 1;
  }

  /** @returns {Promise<string>} id de la meta creada. */
  async function crear(proyectoId, datos) {
    if (datos.estado && !ESTADOS.includes(datos.estado)) {
      throw new Error(`metasRepo: estado inválido "${datos.estado}"`);
    }
    const nueva = await addDoc(col(proyectoId), {
      estado: 'abierta',
      hhPlanilla: 0,
      ajusteDiasHabiles: 0,
      fechaEntrega: null,
      hhPlanillaAlCorte: null,
      reglasSnapshot: null,
      ...datos,
      activo: true,
      createdAt: serverTimestamp(),
    });
    return nueva.id;
  }

  async function actualizar(proyectoId, metaId, cambios) {
    if (cambios.estado && !ESTADOS.includes(cambios.estado)) {
      throw new Error(`metasRepo: estado inválido "${cambios.estado}"`);
    }
    await updateDoc(ref(proyectoId, metaId), { ...cambios });
  }

  async function desactivar(proyectoId, metaId) {
    await updateDoc(ref(proyectoId, metaId), { activo: false });
  }

  /**
   * Totales denormalizados. Solo para pintar LISTAS. La pantalla de detalle
   * recalcula siempre en vivo — nunca lee esto.
   */
  async function guardarTotales(proyectoId, metaId, totales) {
    exigir(totales, 'totales');
    await updateDoc(ref(proyectoId, metaId), { totales });
  }

  /**
   * Congela las reglas dentro de la meta (D-10). A partir de acá el motor
   * calcula con esta copia, no con la configuración viva del proyecto.
   * No cambia el `estado`: eso lo decide el controlador.
   */
  async function congelarSnapshot(proyectoId, metaId, reglas) {
    exigir(reglas, 'reglas');
    await updateDoc(ref(proyectoId, metaId), {
      reglasSnapshot: reglas,
      snapshotCongeladoEn: serverTimestamp(),
    });
  }

  /**
   * "Actualizar reglas de esta meta" (D-10): acción explícita, auditada y solo
   * del rol `ingeniero`. Reabrir una meta NO llama a esto — reabrir conserva
   * el snapshot. Se pasa `reglas: null` para volver a la configuración viva.
   */
  async function actualizarSnapshot(proyectoId, metaId, reglas, uid) {
    exigir(uid, 'uid');
    await updateDoc(ref(proyectoId, metaId), {
      reglasSnapshot: reglas ?? null,
      snapshotActualizadoEn: serverTimestamp(),
      snapshotActualizadoPor: uid,
    });
  }

  // ── Evaluaciones bisemanales (ornato / SO) ────────────────────────────────

  /** @returns {Promise<Object[]>} activas, de la más vieja a la más reciente. */
  async function listarEvaluaciones(proyectoId, metaId) {
    const snap = await getDocs(colEval(proyectoId, metaId));
    return snap.docs
      .map(desdeSnap)
      .filter(esActivo)
      .sort((a, b) => (a.fecha?.getTime() ?? 0) - (b.fecha?.getTime() ?? 0));
  }

  async function crearEvaluacion(proyectoId, metaId, datos) {
    const nueva = await addDoc(colEval(proyectoId, metaId), {
      notas: '',
      ...datos,
      activo: true,
      createdAt: serverTimestamp(),
    });
    return nueva.id;
  }

  async function actualizarEvaluacion(proyectoId, metaId, evaluacionId, cambios) {
    await updateDoc(refEval(proyectoId, metaId, evaluacionId), { ...cambios });
  }

  async function desactivarEvaluacion(proyectoId, metaId, evaluacionId) {
    await updateDoc(refEval(proyectoId, metaId, evaluacionId), { activo: false });
  }

  return {
    listar,
    obtener,
    siguienteNumero,
    crear,
    actualizar,
    desactivar,
    guardarTotales,
    congelarSnapshot,
    actualizarSnapshot,
    listarEvaluaciones,
    crearEvaluacion,
    actualizarEvaluacion,
    desactivarEvaluacion,
  };
}

// ── Nota de alcance ─────────────────────────────────────────────────────────
// `evaluaciones` cuelga de la meta y ningún bloque posterior tiene un archivo
// de repositorio asignado: el bloque 5 (bono-resumen) las necesita para
// `calcularFactorCalidad()` y sus archivos son solo la vista. Por eso viven
// acá y no en un quinto repo.
//
// Pendientes declarados, NO implementados en el bloque 1:
//   • `asistencias` (D-12) — el plan las asigna explícitamente al bloque 7b
//     como "extensión de metasRepo.js".
//   • `proyectos/{id}/pagos` (§4) — el bloque 8 no tiene repo asignado.
//     Hay que decidir si van acá o en proyectosRepo antes de abrir ese bloque.
