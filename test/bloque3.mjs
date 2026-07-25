// test/bloque3.mjs — Prueba de aceptación del bloque 3.
// Corre en Node, sin red y sin navegador:
//     node test/bloque3.mjs
// Fuera del deploy, igual que test/pruebas.mjs y harness.html del bloque 1.

import assert from 'node:assert/strict';
import {
  CAMPOS_NUMERICOS,
  reglasDesdeValores,
  textoTarifas,
  prepararGuardado,
  formatearColones,
} from '../public/supervisor/config-proyecto-controller.js';

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

// Valores del proyecto de referencia (UNA UNIDEPRO), tal como llegarían del
// formulario: strings, que es lo que devuelve un <input>.
const BASE = {
  costoPromHH: '3200',
  costoDiarioAdmin: '50000',
  pctBonoHoraProductividad: '20',
  pctBonoEntregaAnticipada: '30',
  pctBonoMO: '100',
  pctBonoING: '0',
  horasJornada: '11',
  hhMiscelaneosPorDia: '7',
  factorRetoBP: '0.9',
  tarifaBPporHH: '200',
};

console.log('\nBloque 3 — configuración del proyecto\n');

// ── Criterio 1: la tarifa cambia con el costo HH, sin recargar ─────────

prueba('con los defaults, la tarifa es ₡640 por HH economizada', () => {
  const t = textoTarifas(reglasDesdeValores(BASE));
  assert.equal(t.hora, '₡640');
  assert.ok(t.horaValida);
});

prueba('costo HH 3200 → 3600 ⇒ la tarifa pasa de ₡640 a ₡720', () => {
  const antes = textoTarifas(reglasDesdeValores(BASE));
  const despues = textoTarifas(reglasDesdeValores({ ...BASE, costoPromHH: '3600' }));
  assert.equal(antes.hora, '₡640');
  assert.equal(despues.hora, '₡720');
});

prueba('la fórmula muestra de dónde sale el número', () => {
  const t = textoTarifas(reglasDesdeValores({ ...BASE, costoPromHH: '3600' }));
  assert.equal(t.formulaHora, '3\u00A0600 × 20 % = ₡720');
});

prueba('la tarifa por día anticipado da ₡15 000', () => {
  const t = textoTarifas(reglasDesdeValores(BASE));
  assert.equal(t.dia, '₡15\u00A0000');
  assert.equal(t.formulaDia, '50\u00A0000 × 30 % = ₡15\u00A0000');
});

prueba('el 30 % NO se comporta como tope: multiplica el costo diario', () => {
  const t = textoTarifas(reglasDesdeValores({ ...BASE, costoDiarioAdmin: '80000' }));
  assert.equal(t.dia, '₡24\u00A0000');
});

// ── Criterio 2: pctBonoMO + pctBonoING = 120 se rechaza ────────────────

prueba('reparto 100 + 0 ⇒ se guarda', () => {
  const r = prepararGuardado(BASE);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errores, []);
});

prueba('reparto 100 + 20 = 120 ⇒ se rechaza con mensaje', () => {
  const r = prepararGuardado({ ...BASE, pctBonoING: '20' });
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('100')), r.errores.join(' | '));
});

prueba('reparto 60 + 40 = 100 ⇒ se acepta (el límite es superar 100)', () => {
  const r = prepararGuardado({ ...BASE, pctBonoMO: '60', pctBonoING: '40' });
  assert.equal(r.ok, true);
});

// ── Guardas del formulario ─────────────────────────────────────────────

prueba('un campo vacío NO se guarda como cero: se rechaza', () => {
  const r = prepararGuardado({ ...BASE, costoPromHH: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('costoPromHH')));
});

prueba('un valor negativo se rechaza', () => {
  const r = prepararGuardado({ ...BASE, tarifaBPporHH: '-1' });
  assert.equal(r.ok, false);
});

prueba('factorRetoBP mayor que 1 se rechaza', () => {
  const r = prepararGuardado({ ...BASE, factorRetoBP: '1.2' });
  assert.equal(r.ok, false);
});

prueba('misceláneos por día no puede superar la jornada', () => {
  const r = prepararGuardado({ ...BASE, hhMiscelaneosPorDia: '12' });
  assert.equal(r.ok, false);
});

prueba('el mapa guardado va completo, con los booleanos de política', () => {
  const { reglas } = prepararGuardado(BASE);
  assert.equal(reglas.permitirBonoNegativo, false);
  assert.equal(reglas.permitirDiasAtrasoNegativos, false);
  assert.equal(Object.keys(reglas).length, 12);
});

prueba('los 10 campos editables son los numéricos, ni uno más', () => {
  assert.equal(CAMPOS_NUMERICOS.length, 10);
  assert.ok(!CAMPOS_NUMERICOS.includes('permitirBonoNegativo'));
});

prueba('formato de moneda con separador de miles', () => {
  assert.equal(formatearColones(498480), '₡498\u00A0480');
  assert.equal(formatearColones(640), '₡640');
  assert.equal(formatearColones(NaN), '—');
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
