// test/bloque5.mjs — Prueba de aceptación del bloque 5.
//     node test/bloque5.mjs
//
// El criterio del plan: con el fixture cargado, la pantalla muestra
// ₡498 480 para el Maestro de Obras y ₡0 para el Ingeniero, y la
// proyección se mueve al cambiar un avance.

import assert from 'node:assert/strict';
import { calcularBonoMeta } from '../public/js/core/calculoMeta.js';
import { normalizarReglas } from '../public/js/core/reglasBono.config.js';
import {
  META_UNIDEPRO_1 as META,
  HITOS_UNIDEPRO_1 as HITOS,
  EVALUACIONES_UNIDEPRO_1 as EVALS,
} from '../public/js/core/fixtures/meta-unidepro-1.js';
import {
  filasCascada,
  verificarCascada,
  comparativa,
  filasHoras,
} from '../public/ingeniero/bono-resumen.js';

const REGLAS = normalizarReglas(META.reglasBono ?? {});
const R = calcularBonoMeta(META, HITOS, EVALS, REGLAS, []);

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

const NBSP = '\u00A0';
console.log('\nBloque 5 — resumen y proyección de bono\n');

// ── El criterio del plan ───────────────────────────────────────────────

prueba('₡498 480 al Maestro de Obras y ₡0 al Ingeniero', () => {
  const filas = filasCascada(R, REGLAS);
  const mo = filas.find((f) => f.clave === 'mo');
  const ing = filas.find((f) => f.clave === 'ing');
  assert.equal(mo.montoTexto, `₡498${NBSP}480`);
  assert.equal(ing.montoTexto, '₡0');
});

prueba('la proyección se mueve al cambiar un avance', () => {
  // El hito 1 está al 70 %. Subirlo tiene que mover el monto.
  const subido = HITOS.map((h, i) => (i === 1 ? { ...h, avancePct: 100 } : h));
  const R2 = calcularBonoMeta(META, subido, EVALS, REGLAS, []);
  assert.ok(R2.bonoMO > R.bonoMO, 'más avance debería dar más bono');
});

// ── El orden del Excel ─────────────────────────────────────────────────

prueba('la cascada va en el orden del libro, sin saltarse renglones', () => {
  const claves = filasCascada(R, REGLAS).map((f) => f.clave);
  assert.deepEqual(claves, ['base', 'anticipada', 'productividad', 'bruto', 'factor', 'ing', 'mo']);
});

prueba('el factor va DENTRO de la cascada, no en otra tarjeta', () => {
  const factor = filasCascada(R, REGLAS).find((f) => f.clave === 'factor');
  assert.ok(factor, 'el factor tiene que ser un renglón de la cascada');
  assert.equal(factor.tipo, 'factor');
  assert.equal(factor.montoTexto, '× 1.00');
});

prueba('cada renglón explica de dónde sale, no solo cuánto vale', () => {
  for (const f of filasCascada(R, REGLAS)) {
    assert.ok(f.nota && f.nota.length > 0, `el renglón ${f.clave} no explica nada`);
  }
});

// ── La cascada se audita a sí misma ────────────────────────────────────

prueba('la cascada cuadra con el fixture', () => {
  const c = verificarCascada(R, REGLAS);
  assert.equal(c.ok, true, c.errores.join(' · '));
});

prueba('un bruto que no es la suma de sus componentes se detecta', () => {
  const roto = { ...R, bonoTotalBruto: R.bonoTotalBruto + 1000 };
  assert.equal(verificarCascada(roto, REGLAS).ok, false);
});

prueba('un reparto que no cuadra con el factor se detecta', () => {
  const roto = { ...R, bonoMO: R.bonoMO + 1000 };
  assert.equal(verificarCascada(roto, REGLAS).ok, false);
});

prueba('repartir más de 100 % entre los dos roles se detecta', () => {
  const reglasMalas = { ...REGLAS, pctBonoMO: 100, pctBonoING: 40 };
  const r2 = calcularBonoMeta(META, HITOS, EVALS, reglasMalas, []);
  assert.equal(verificarCascada(r2, reglasMalas).ok, false);
});

// ── D-01 y D-05: los renglones que avisan ──────────────────────────────

prueba('el déficit se muestra aunque el monto tenga piso en ₡0', () => {
  const conDeficit = { ...R, bonoProductividad: 0, bonoProductividadSinPiso: -50000, hhEconomizadas: -78.13 };
  const fila = filasCascada(conDeficit, REGLAS).find((f) => f.clave === 'productividad');
  assert.equal(fila.montoTexto, '₡0');
  assert.match(fila.nota, /déficit/);
  assert.equal(fila.alerta, true);
});

prueba('el bono base perdido dice POR QUÉ vale ₡0', () => {
  const perdido = { ...R, bonoBase: 0, bonoBaseSePerdio: true };
  const fila = filasCascada(perdido, REGLAS).find((f) => f.clave === 'base');
  assert.match(fila.nota, /fecha límite/);
  assert.equal(fila.alerta, true);
});

prueba('un factor menor a 1 se marca como alerta', () => {
  const castigado = { ...R, factorCalidad: 0.7 };
  const fila = filasCascada(castigado, REGLAS).find((f) => f.clave === 'factor');
  assert.equal(fila.alerta, true);
  assert.match(fila.nota, /70/);
});

prueba('sin evaluaciones, el factor 1.00 se explica en vez de callarse', () => {
  const fila = filasCascada(R, REGLAS).find((f) => f.clave === 'factor');
  assert.match(fila.nota, /sin castigo/);
  assert.equal(fila.alerta, false);
});

// ── D-5-02: las dos cifras ─────────────────────────────────────────────

prueba('sin propuestas, las dos cifras son la misma', () => {
  const c = comparativa(R, R);
  assert.equal(c.hayDiferencia, false);
  assert.equal(c.aprobadoTexto, c.propuestoTexto);
});

prueba('con propuestas, se ve la diferencia y su signo', () => {
  const c = comparativa({ bonoMO: 100000 }, { bonoMO: 130000 });
  assert.equal(c.hayDiferencia, true);
  assert.equal(c.sube, true);
  assert.equal(c.diferencia, 30000);
  const baja = comparativa({ bonoMO: 130000 }, { bonoMO: 100000 });
  assert.equal(baja.sube, false);
  assert.equal(baja.diferenciaTexto, `₡30${NBSP}000`, 'el texto va en absoluto, el signo lo pone la UI');
});

// ── Las horas ──────────────────────────────────────────────────────────

prueba('las horas del fixture: 2 697,10 estimadas y 1 092,25 ganadas', () => {
  const filas = filasHoras(R);
  assert.equal(filas[0].valor, `2${NBSP}697,10${NBSP}HH`);
  assert.equal(filas[1].valor, `1${NBSP}092,25${NBSP}HH`);
});

prueba('el indicador se pinta en porcentaje: 35,55 %', () => {
  const ind = filasHoras(R).find((f) => f.etiqueta.startsWith('Indicador'));
  assert.equal(ind.valor, `35,55${NBSP}%`);
});

prueba('los misceláneos aparecen como renglón propio', () => {
  const misc = filasHoras(R).find((f) => f.etiqueta.startsWith('Misceláneos'));
  assert.equal(misc.valor, `147,00${NBSP}HH`);
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
