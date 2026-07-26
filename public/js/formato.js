// ═══════════════════════════════════════════════════════════════════════
// formato.js — Único módulo de formato de la aplicación.
//
// Paga la deuda 5 del bloque 3: `formatearColones` y `formatearNumero`
// vivían dentro de `config-proyecto-controller.js` porque ese bloque eran
// dos archivos. Se mudan acá ANTES de que aparezca la segunda pantalla que
// escribe ₡498 480 — que es exactamente cuando empiezan a divergir.
//
// ── Invariantes ───────────────────────────────────────────────────────
// • Módulo PURO: sin DOM, sin Firestore, sin red, sin `Date.now()`.
//   Se importa desde Node sin ceremonia (`test/formato.mjs`).
// • `formatearColones` y `formatearNumero` se mudaron BYTE A BYTE. La
//   deuda era una mudanza, no una reforma: `test/bloque3.mjs` tiene que
//   seguir dando 15/15 sin tocarle una línea.
// • Acá NO hay aritmética de fechas. `formatearFecha` lee componentes y
//   los pinta; sumar, restar y comparar fechas sigue siendo exclusivo de
//   `calculoMeta.js` (`aFecha`, `diffDias`). Principio 8, intacto.
// • El separador de miles es un ESPACIO DURO (U+00A0), no una coma: así
//   se escribe en Costa Rica y así lo esperan las pruebas.
// • El signo negativo es el menos tipográfico (U+2212), no el guion.
// ═══════════════════════════════════════════════════════════════════════

/** Espacio duro. Separador de miles. */
const NBSP = '\u00A0';

/** Lo que se pinta cuando no hay un número que pintar. Nunca un 0. */
export const SIN_DATO = '—';

/* ══════════════════════════════════════════════════════════════════════
   MONEDA Y NÚMEROS
   ══════════════════════════════════════════════════════════════════════ */

/**
 * ₡ con separador de miles: 640 → "₡640" · 15000 → "₡15 000" · NaN → "—".
 * Redondea a 2 decimales y suprime los decimales cuando son cero.
 * @param {number} n
 * @returns {string}
 */
export function formatearColones(n) {
  if (!Number.isFinite(n)) return SIN_DATO;
  const redondeado = Math.round(n * 100) / 100;
  const [entero, decimales] = String(Math.abs(redondeado)).split('.');
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${redondeado < 0 ? '−' : ''}₡${agrupado}${decimales ? ',' + decimales : ''}`;
}

/**
 * Número simple con la misma agrupación, para las fórmulas.
 * @param {number} n
 * @returns {string}
 */
export function formatearNumero(n) {
  if (!Number.isFinite(n)) return SIN_DATO;
  const redondeado = Math.round(n * 100) / 100;
  const [entero, decimales] = String(Math.abs(redondeado)).split('.');
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${redondeado < 0 ? '−' : ''}${agrupado}${decimales ? ',' + decimales : ''}`;
}

/**
 * Horas-hombre con DOS decimales SIEMPRE: 1092.25 → "1 092,25 HH".
 *
 * A diferencia de `formatearNumero`, no suprime los decimales en cero:
 * 147 → "147,00 HH". Es deliberado. En una columna de horas, "147" y
 * "147,00" alineados uno encima del otro se leen como precisiones
 * distintas, y acá todas las cifras tienen la misma. Los totales de
 * aceptación se escriben 2 697,10 y 1 092,25, no 2 697,1.
 *
 * @param {number} n
 * @param {{ conSufijo?: boolean }} [opciones] — `false` para pintar la
 *        unidad aparte (en un `<th>`, por ejemplo).
 * @returns {string}
 */
export function formatearHoras(n, { conSufijo = true } = {}) {
  if (!Number.isFinite(n)) return SIN_DATO;
  const [entero, decimales] = Math.abs(n).toFixed(2).split('.');
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const signo = n < 0 ? '−' : '';
  return `${signo}${agrupado},${decimales}${conSufijo ? `${NBSP}HH` : ''}`;
}

/**
 * Porcentaje: 35.55 → "35,55 %". Recibe el número YA en escala 0–100.
 *
 * ⚠️ `ResultadoBono.indicador` es una FRACCIÓN (0.3555), no un
 * porcentaje. Multiplicar por 100 es responsabilidad de quien pinta, y
 * queda a la vista en la llamada. Esta función no adivina la escala:
 * si adivinara, un día pintaría 0,36 % donde van 35,55 %.
 *
 * @param {number} n
 * @param {{ decimales?: number }} [opciones]
 * @returns {string}
 */
export function formatearPorcentaje(n, { decimales = 2 } = {}) {
  if (!Number.isFinite(n)) return SIN_DATO;
  const [entero, dec] = Math.abs(n).toFixed(decimales).split('.');
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const signo = n < 0 ? '−' : '';
  return `${signo}${agrupado}${dec ? ',' + dec : ''}${NBSP}%`;
}

/* ══════════════════════════════════════════════════════════════════════
   FECHAS
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Normaliza a `Date` lo que llegue, o `null` si no hay fecha válida.
 *
 * Los repositorios ya devuelven `Date` (convierten los `Timestamp` al
 * salir), así que en la práctica el primer caso cubre todo. Los demás
 * están para que un valor crudo no pinte "Invalid Date" en pantalla.
 *
 * El caso de la cadena `YYYY-MM-DD` se parsea por componentes a propósito:
 * `new Date('2026-07-21')` es medianoche UTC, que en Costa Rica (UTC−6)
 * es el 20 de julio. Un día de corrimiento acá vale ₡250 000 (D-05).
 *
 * @param {Date|string|number|{toDate:Function}|null|undefined} valor
 * @returns {Date|null}
 */
function aDate(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor.toDate === 'function') return aDate(valor.toDate());
  if (typeof valor === 'number') return aDate(new Date(valor));
  if (typeof valor === 'string') {
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (soloFecha) {
      const [, a, m, d] = soloFecha;
      return aDate(new Date(Number(a), Number(m) - 1, Number(d)));
    }
    return aDate(new Date(valor));
  }
  return null;
}

/**
 * Fecha corta, formato del libro de Excel: 21.07.2026. Sin fecha → "—".
 *
 * Se conserva el formato del Excel a propósito: es el que el Ingeniero
 * lleva años leyendo, y ordena de un vistazo cuando va en una columna.
 *
 * @param {Date|string|number|{toDate:Function}|null} valor
 * @returns {string}
 */
export function formatearFecha(valor) {
  const d = aDate(valor);
  if (!d) return SIN_DATO;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}.${mes}.${d.getFullYear()}`;
}
