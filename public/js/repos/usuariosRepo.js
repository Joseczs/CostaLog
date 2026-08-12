// repos/usuariosRepo.js
// Bloque 5b-2 — capa de datos. Colección raíz `usuarios`.
//
// ── Por qué nace este repo, y por qué nace con UN solo consumidor ──────────
// El principio 5 dice que todo acceso a Firestore vive en `repos/`. Tres
// archivos ya consultan `usuarios` directo —`ingeniero/gestionar-empleados-
// controller.js`, `ingeniero/nueva-tarea-controller.js` y `js/importarExcel.js`—
// y migrarlos acá sumaría tres archivos de otros bloques a un bloque que ya
// usa cuatro. Se declara como deuda: el repo existe desde hoy, y cada uno de
// esos tres se pasa el día que se abra por su propia razón.
//
// Mismo criterio con que `formato.js` nació en el bloque 4a sin reescribir a
// todos sus futuros clientes de una vez.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '../firebase-config.js';

import { ROL_MAESTRO } from '../roles.js';

// ── Helpers internos ────────────────────────────────────────────────────────
// Repetidos a propósito, igual que en los otros cuatro repos: el día que sean
// cinco copias, esto sube a `repos/_base.js` de una vez y no antes.

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

/** Activo salvo que diga explícitamente `activo: false`. Principio 4. */
const esActivo = (o) => o.activo !== false;

// ── Repositorio ─────────────────────────────────────────────────────────────

export function crearUsuariosRepo(db) {
  const col = () => collection(db, 'usuarios');

  /**
   * Los Maestros de Obra dados de alta, activos, ordenados por nombre.
   *
   * ── Por qué el `where` va en la consulta y el `activo` en memoria ────────
   * Es la misma cuenta del bloque 5b: lo prohibido son los ÍNDICES
   * COMPUESTOS, y lo que los exige es la combinación de dos condiciones.
   * `where('rol','==',…)` solo usa el índice de un campo, que Firestore crea
   * automáticamente. Sumarle `where('activo','==',true)` pediría índice
   * compuesto Y dejaría fuera todo documento viejo que no tenga el campo —
   * que es exactamente lo que el principio 4 existe para evitar.
   *
   * El rol sale de `roles.js`, nunca escrito a mano. Es la invariante del
   * bloque 5c: ningún archivo fuera de ese pone un identificador de rol.
   *
   * @returns {Promise<Object[]>} activos, ordenados por nombre.
   */
  async function listarMaestros() {
    const snap = await getDocs(query(col(), where('rol', '==', ROL_MAESTRO)));
    return snap.docs
      .map(desdeSnap)
      .filter(esActivo)
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  }

  /**
   * Un usuario por su uid. Devuelve `null` si no existe — nunca lanza.
   *
   * Se usa para poner nombre a un uid que aparece en `supervisorIds` pero ya
   * no figura entre los maestros activos (promovido, desactivado o borrado).
   * Sin esto, esa fila de la pantalla de asignación diría solo el uid crudo.
   *
   * A diferencia de los otros repos, acá NO se filtra por `activo`: el punto
   * de la llamada es justamente mirar a alguien que puede estar desactivado.
   */
  async function obtener(uid) {
    if (!uid) return null;
    const snap = await getDoc(doc(db, 'usuarios', uid));
    return snap.exists() ? desdeSnap(snap) : null;
  }

  return { listarMaestros, obtener };
}
