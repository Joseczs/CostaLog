// test/formato.mjs — Prueba de aceptación de `public/js/formato.js` (bloque 4a).
// Corre en Node, sin red y sin navegador:
//     node test/formato.mjs
// Fuera del deploy, igual que test/pruebas.mjs y test/bloque3.mjs.

import assert from 'node:assert/strict';
import {
  formatearColones,
  formatearNumero,
  formatearHoras,
  formatearPorcentaje,
  formatearFecha,
  SIN_DATO,
} from '../public/js/formato.js';

const NBSP = '\u00A0';

let pasadas = 0;
const prueba = (nombre, fn) => {
  try {
    fn();
    pasadas++;
    console.log(`  ✓ ${nombre}`);
  } catch (err) {
    console.error(`  ✗ ${nombre}\n    ${err.message}`);
    process.exitCode = 1;
  }
};

console.log('\nBloque 4a — formato.js\n');

// ── Moneda: la mudanza no cambió el comportamiento ─────────────────────

prueba('₡640 y ₡15 000, los dos números de la especificación', () => {
  assert.equal(formatearColones(640), '₡640');
  assert.equal(formatearColones(15000), `₡15${NBSP}000`);
});

prueba('₡498 480 — el bono del caso UNA UNIDEPRO', () => {
  assert.equal(formatearColones(498480), `₡498${NBSP}480`);
});

prueba('el separador de miles es espacio duro, no coma', () => {
  assert.ok(formatearColones(1000).includes(NBSP));
  assert.ok(!formatearColones(1000).includes(','));
});

prueba('un número no finito NO se pinta como cero', () => {
  assert.equal(formatearColones(NaN), SIN_DATO);
  assert.equal(formatearColones(undefined), SIN_DATO);
  assert.equal(formatearColones(Infinity), SIN_DATO);
  assert.equal(formatearNumero(NaN), SIN_DATO);
});

prueba('el cero sí se pinta: es un dato, no un faltante', () => {
  assert.equal(formatearColones(0), '₡0');
});

prueba('negativo con el menos tipográfico', () => {
  assert.equal(formatearColones(-1500), `−₡1${NBSP}500`);
});

prueba('decimales con coma, y suprimidos cuando son cero', () => {
  assert.equal(formatearColones(1234.5), `₡1${NBSP}234,5`);
  assert.equal(formatearColones(1234.0), `₡1${NBSP}234`);
});

prueba('formatearNumero es lo mismo sin el símbolo', () => {
  assert.equal(formatearNumero(3600), `3${NBSP}600`);
  assert.equal(formatearNumero(20), '20');
});

// ── Horas: dos decimales SIEMPRE ───────────────────────────────────────

prueba('los dos totales de aceptación: 2 697,10 y 1 092,25', () => {
  assert.equal(formatearHoras(2697.1), `2${NBSP}697,10${NBSP}HH`);
  assert.equal(formatearHoras(1092.25), `1${NBSP}092,25${NBSP}HH`);
});

prueba('las horas NO suprimen los decimales en cero', () => {
  assert.equal(formatearHoras(147), `147,00${NBSP}HH`);
  assert.equal(formatearHoras(704), `704,00${NBSP}HH`);
});

prueba('un déficit de horas se ve negativo (D-01 muestra el déficit)', () => {
  assert.equal(formatearHoras(-52.5), `−52,50${NBSP}HH`);
});

prueba('el sufijo se puede quitar para ponerlo en el encabezado', () => {
  assert.equal(formatearHoras(388.25, { conSufijo: false }), '388,25');
});

prueba('sin horas, "—" y no "0,00 HH"', () => {
  assert.equal(formatearHoras(null), SIN_DATO);
  assert.equal(formatearHoras(NaN), SIN_DATO);
});

// ── Porcentaje: la escala la pone quien llama ──────────────────────────

prueba('el indicador 0.3555 se pinta 35,55 % — multiplicando afuera', () => {
  assert.equal(formatearPorcentaje(0.3555 * 100), `35,55${NBSP}%`);
});

prueba('no adivina la escala: 0.3555 crudo da 0,36 %', () => {
  assert.equal(formatearPorcentaje(0.3555), `0,36${NBSP}%`);
});

prueba('los decimales se pueden ajustar', () => {
  assert.equal(formatearPorcentaje(100, { decimales: 0 }), `100${NBSP}%`);
});

// ── Fechas: formato del libro, sin corrimiento de día ──────────────────

prueba('formato del Excel: 21.07.2026', () => {
  assert.equal(formatearFecha(new Date(2026, 6, 21)), '21.07.2026');
});

prueba('día y mes de un dígito llevan cero adelante', () => {
  assert.equal(formatearFecha(new Date(2026, 0, 5)), '05.01.2026');
});

prueba('la cadena YYYY-MM-DD no se corre un día por la zona horaria', () => {
  // new Date('2026-07-21') es medianoche UTC; en Costa Rica sería el día 20.
  // Un día de corrimiento acá vale ₡250 000 (D-05).
  assert.equal(formatearFecha('2026-07-21'), '21.07.2026');
});

prueba('acepta un Timestamp de Firestore por si alguno se escapa del repo', () => {
  const falso = { toDate: () => new Date(2026, 4, 26) };
  assert.equal(formatearFecha(falso), '26.05.2026');
});

prueba('sin fecha, "—" y nunca "Invalid Date"', () => {
  assert.equal(formatearFecha(null), SIN_DATO);
  assert.equal(formatearFecha(undefined), SIN_DATO);
  assert.equal(formatearFecha(''), SIN_DATO);
  assert.equal(formatearFecha('no es una fecha'), SIN_DATO);
  assert.equal(formatearFecha(new Date('x')), SIN_DATO);
});

// ── El módulo es puro ──────────────────────────────────────────────────

prueba('las cuatro fechas del fixture UNA UNIDEPRO', () => {
  assert.equal(formatearFecha(new Date('2026-05-26T00:00:00')), '26.05.2026');
  assert.equal(formatearFecha(new Date('2026-07-21T00:00:00')), '21.07.2026');
  assert.equal(formatearFecha(new Date('2026-06-16T00:00:00')), '16.06.2026');
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
