// repos/hitosRepo.js
// Bloque 1 — capa de datos. `proyectos/{id}/metas/{id}/hitos`.
//

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  writeBatch,
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
  if (!valor) throw new Error(`hitosRepo: falta ${nombre}`);
  return valor;
};

const TIPOS = ['lista', 'extra', 'credito', 'miscelaneo'];
const LIMITE_LOTE = 500; // tope duro de writeBatch en Firestore

function exigirAvance(valor, nombre) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`hitosRepo: ${nombre} debe estar entre 0 y 100, llegó "${valor}"`);
  }
  return n;
}

// ── Repositorio ─────────────────────────────────────────────────────────────

export function crearHitosRepo(db) {
  const col = (proyectoId, metaId) =>
    collection(db, 'proyectos', exigir(proyectoId, 'proyectoId'),
      'metas', exigir(metaId, 'metaId'), 'hitos');

  const ref = (proyectoId, metaId, hitoId) =>
    doc(db, 'proyectos', exigir(proyectoId, 'proyectoId'),
      'metas', exigir(metaId, 'metaId'),
      'hitos', exigir(hitoId, 'hitoId'));

  /**
   * Los ~50 hitos de la meta en una sola consulta, como exige la restricción
   * arquitectónica del plan. Sin `where`, sin `orderBy`: se filtra y se ordena
   * en memoria, y así no hace falta ni un índice compuesto.
   * @returns {Promise<Object[]>} activos, ordenados por `orden`.
   */
  async function listar(proyectoId, metaId) {
    const snap = await getDocs(col(proyectoId, metaId));
    return snap.docs
      .map(desdeSnap)
      .filter(esActivo)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  async function obtener(proyectoId, metaId, hitoId, { incluirInactivos = false } = {}) {
    const snap = await getDoc(ref(proyectoId, metaId, hitoId));
    if (!snap.exists()) return null;
    const hito = desdeSnap(snap);
    if (!incluirInactivos && !esActivo(hito)) return null;
    return hito;
  }

  function normalizar(datos) {
    if (datos.tipo && !TIPOS.includes(datos.tipo)) {
      throw new Error(`hitosRepo: tipo inválido "${datos.tipo}"`);
    }
    return {
      tipo: 'lista',
      avancePct: 0,
      avancePropuesto: null,
      propuestoPor: null,
      propuestoEn: null,
      aprobadoPor: null,
      aprobadoEn: null,
      ...datos,
      activo: true,
    };
  }

  /** @returns {Promise<string>} id del hito creado. */
  async function crear(proyectoId, metaId, datos) {
    const nuevo = await addDoc(col(proyectoId, metaId), {
      ...normalizar(datos),
      createdAt: serverTimestamp(),
    });
    return nuevo.id;
  }

  /**
   * Alta masiva — los 47 hitos del fixture UNA UNIDEPRO entran de un viaje.
   * Se parte en lotes de 500 porque es el tope de `writeBatch`.
   * @returns {Promise<string[]>} ids en el mismo orden que la lista de entrada.
   */
  async function crearVarios(proyectoId, metaId, lista) {
    if (!Array.isArray(lista) || lista.length === 0) return [];
    const coleccion = col(proyectoId, metaId);
    const ids = [];
    for (let i = 0; i < lista.length; i += LIMITE_LOTE) {
      const lote = writeBatch(db);
      for (const datos of lista.slice(i, i + LIMITE_LOTE)) {
        const nuevo = doc(coleccion);
        lote.set(nuevo, { ...normalizar(datos), createdAt: serverTimestamp() });
        ids.push(nuevo.id);
      }
      await lote.commit();
    }
    return ids;
  }

  async function actualizar(proyectoId, metaId, hitoId, cambios) {
    if (cambios.tipo && !TIPOS.includes(cambios.tipo)) {
      throw new Error(`hitosRepo: tipo inválido "${cambios.tipo}"`);
    }
    await updateDoc(ref(proyectoId, metaId, hitoId), { ...cambios });
  }

  /**
   * D-11: el supervisor PROPONE. No toca `avancePct`, que es el que cuenta
   * para el motor de cálculo.
   */
  async function proponerAvance(proyectoId, metaId, hitoId, avancePropuesto, uid) {
    exigir(uid, 'uid');
    await updateDoc(ref(proyectoId, metaId, hitoId), {
      avancePropuesto: exigirAvance(avancePropuesto, 'avancePropuesto'),
      propuestoPor: uid,
      propuestoEn: serverTimestamp(),
    });
  }

  /**
   * D-11: el ingeniero APRUEBA. La propuesta pasa a `avancePct` y se limpia,
   * para que en la tabla no queden dos cifras iguales — si se ven iguales, el
   * control no sirve de nada.
   *
   * `avanceAprobado` permite aprobar un número distinto al propuesto, que es
   * lo que pasa cuando el ingeniero recorre el sitio y no coincide.
   * @returns {Promise<number>} el avance que quedó aprobado.
   */
  async function aprobarAvance(proyectoId, metaId, hitoId, uid, { avanceAprobado } = {}) {
    exigir(uid, 'uid');
    let valor = avanceAprobado;
    if (valor === undefined) {
      const hito = await obtener(proyectoId, metaId, hitoId);
      if (!hito) throw new Error('hitosRepo: el hito no existe o está desactivado');
      if (hito.avancePropuesto === null || hito.avancePropuesto === undefined) {
        throw new Error('hitosRepo: no hay avance propuesto que aprobar');
      }
      valor = hito.avancePropuesto;
    }
    const aprobado = exigirAvance(valor, 'avanceAprobado');
    await updateDoc(ref(proyectoId, metaId, hitoId), {
      avancePct: aprobado,
      avancePropuesto: null,
      aprobadoPor: uid,
      aprobadoEn: serverTimestamp(),
    });
    return aprobado;
  }

  async function desactivar(proyectoId, metaId, hitoId) {
    await updateDoc(ref(proyectoId, metaId, hitoId), { activo: false });
  }

  /**
   * Siguiente código libre de una familia: `siguienteCodigo(p, m, 'EXTRA')`
   * devuelve 'EXTRA.03' si ya existen 01 y 02. Mira también los desactivados,
   * para no reciclar un código que ya aparece en un histórico.
   * @returns {Promise<string>}
   */
  async function siguienteCodigo(proyectoId, metaId, prefijo) {
    exigir(prefijo, 'prefijo');
    const snap = await getDocs(col(proyectoId, metaId));
    const maximo = snap.docs.reduce((max, d) => {
      const codigo = d.data().codigo ?? '';
      if (!codigo.startsWith(`${prefijo}.`)) return max;
      const n = parseInt(codigo.slice(prefijo.length + 1), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    return `${prefijo}.${String(maximo + 1).padStart(2, '0')}`;
  }

  return {
    listar,
    obtener,
    crear,
    crearVarios,
    actualizar,
    proponerAvance,
    aprobarAvance,
    desactivar,
    siguienteCodigo,
  };
}

// ── Nota de alcance ─────────────────────────────────────────────────────────
// La validación de signo de los créditos (crédito ⇒ cantidad < 0) NO está acá:
// el plan se la asigna al bloque 6. El repo solo valida `tipo` y el rango del
// avance, que es donde un dedazo se convierte en plata mal pagada.
//
// `MIC.01` (misceláneos) no se persiste: §4-bis dice que se genera en memoria
// dentro del motor, marcado como sintético. Este repo nunca lo va a devolver.
