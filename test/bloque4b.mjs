// test/bloque4b.mjs — Prueba de aceptación del bloque 4b.
//     node test/bloque4b.mjs
//
// Corre contra el MISMO fixture UNA UNIDEPRO que está cargado en Firestore,
// pero en memoria y sin red: `public/js/core/fixtures/meta-unidepro-1.js`.
// Lo que se verifica es que la TABLA —no el motor— pinte 2 697,10 y 1 092,25,
// misceláneos incluidos. El motor ya lo probó el bloque 0; lo que puede
// romperse acá es el modelo de la tabla.

import assert from 'node:assert/strict';
import { calcularBonoMeta } from '../public/js/core/calculoMeta.js';
import { normalizarReglas } from '../public/js/core/reglasBono.config.js';
import * as fixture from '../public/js/core/fixtures/meta-unidepro-1.js';
import { modeloTabla, filaDeHito, hitoMiscelaneos, ID_MISCELANEOS } from '../public/supervisor/hitos-tabla.js';
import {
  totalesDesdeResultado,
  textoProcedencia,
  validarAvance,
  esEditable,
} from '../public/supervisor/meta-detalle-controller.js';

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

console.log('\nBloque 4b — detalle de meta e hitos\n');

const META = fixture.META_UNIDEPRO_1;
const HITOS = fixture.HITOS_UNIDEPRO_1;
const EVALS = fixture.EVALUACIONES_UNIDEPRO_1;
const REGLAS = normalizarReglas(META.reglasBono ?? {});

prueba('el fixture se pudo leer', () => {
  assert.ok(META, 'no se encontró la meta en el fixture');
  assert.ok(Array.isArray(HITOS) && HITOS.length > 0, 'no se encontraron hitos');
});

const resultado = calcularBonoMeta(META, HITOS, EVALS, REGLAS, []);
const modelo = modeloTabla(HITOS, resultado, REGLAS, { editable: true });

// ── LA prueba de aceptación ────────────────────────────────────────────

prueba('el pie de la tabla da 2 697,10 y 1 092,25', () => {
  assert.equal(Number(resultado.hhEstimadasTotal.toFixed(2)), 2697.10);
  assert.equal(Number(resultado.hhGanadasTotal.toFixed(2)), 1092.25);
  assert.equal(modelo.pie.hhEstimadasTexto, '2\u00A0697,10');
  assert.equal(modelo.pie.hhGanadasTexto, '1\u00A0092,25');
});

prueba('los totales del pie salen del motor, no de sumar las filas', () => {
  assert.equal(modelo.pie.hhEstimadasTotal, resultado.hhEstimadasTotal);
  assert.equal(modelo.pie.hhGanadasTotal, resultado.hhGanadasTotal);
});

// ── D-4b-04: el renglón sintético ──────────────────────────────────────

prueba('MIC.01 se pinta al final y NO es editable', () => {
  const ultima = modelo.filas[modelo.filas.length - 1];
  assert.equal(ultima.codigo, 'MIC.01');
  assert.equal(ultima.sintetico, true);
  assert.equal(ultima.editable, false);
  assert.equal(ultima.avancePct, 100);
});

prueba('MIC.01 lleva las horas de misceláneos del motor', () => {
  const ultima = modelo.filas[modelo.filas.length - 1];
  assert.equal(ultima.hhEstimadas, resultado.hhMiscelaneos);
  assert.equal(ultima.hhGanadas, resultado.hhMiscelaneos);
});

prueba('la tabla tiene una fila más que hitos hay en la base', () => {
  assert.equal(modelo.filas.length, HITOS.length + 1);
});

prueba('sin misceláneos, no se agrega el renglón sintético', () => {
  const sinMisc = modeloTabla(HITOS, { ...resultado, hhMiscelaneos: 0 }, REGLAS);
  assert.equal(sinMisc.filas.length, HITOS.length);
});

prueba('el sintético lleva un id imposible de confundir con un documento', () => {
  const sint = hitoMiscelaneos(147, REGLAS);
  assert.equal(sint.id, ID_MISCELANEOS);
  assert.ok(!HITOS.some((h) => h.id === ID_MISCELANEOS));
});

// ── El delta en horas ──────────────────────────────────────────────────

prueba('cada fila dice cuánto vale UN punto de avance en horas', () => {
  const f = filaDeHito({ id: 'x', cantidad: 840, hhUnidad: 0.3, avancePct: 50 });
  assert.equal(f.hhEstimadas, 252);
  assert.equal(f.hhGanadas, 126);
  assert.equal(f.porPunto, 2.52);
  assert.equal(f.porPuntoTexto, '2,52');
});

prueba('un crédito se marca negativo', () => {
  const f = filaDeHito({ id: 'c', tipo: 'credito', cantidad: -40, hhUnidad: 1, avancePct: 100 });
  assert.equal(f.negativo, true);
  assert.equal(f.hhGanadas, -40);
});

// ── D-11: la propuesta se ve distinta del valor aprobado ───────────────

prueba('una propuesta pendiente trae su delta en horas, con signo', () => {
  const f = filaDeHito({ id: 'p', cantidad: 100, hhUnidad: 1, avancePct: 60, avancePropuesto: 80 });
  assert.ok(f.propuesta);
  assert.equal(f.propuesta.valor, 80);
  assert.equal(f.propuesta.delta, 20);
  assert.equal(f.propuesta.sube, true);
});

prueba('una propuesta que BAJA el avance también se ve', () => {
  const f = filaDeHito({ id: 'p', cantidad: 100, hhUnidad: 1, avancePct: 80, avancePropuesto: 60 });
  assert.equal(f.propuesta.delta, -20);
  assert.equal(f.propuesta.sube, false);
});

prueba('sin propuesta, la fila no inventa una', () => {
  assert.equal(filaDeHito({ id: 'a', cantidad: 1, hhUnidad: 1, avancePct: 0 }).propuesta, null);
  assert.equal(filaDeHito({ id: 'b', cantidad: 1, hhUnidad: 1, avancePropuesto: null }).propuesta, null);
});

prueba('el fixture viene con el avance ya aprobado, sin propuestas pendientes', () => {
  assert.equal(modelo.pendientes, 0);
});

prueba('una propuesta de 0 % NO se confunde con "sin propuesta"', () => {
  const f = filaDeHito({ id: 'z', cantidad: 10, hhUnidad: 1, avancePct: 50, avancePropuesto: 0 });
  assert.ok(f.propuesta, '0 es un valor propuesto, no la ausencia de uno');
  assert.equal(f.propuesta.valor, 0);
});

// ── D-4b-02: el mapa `totales` ─────────────────────────────────────────

prueba('totales lleva los 12 campos del contrato, planos', () => {
  const t = totalesDesdeResultado(resultado, 'uid-ing');
  for (const campo of [
    'hhEstimadasTotal', 'hhGanadasTotal', 'hhEconomizadas', 'indicador',
    'bonoTotalBruto', 'factorCalidad', 'bonoMO', 'bonoING',
    'bonoBaseSePerdio', 'produccionOrigen', 'esDefinitivo',
    'calculadoEn', 'calculadoPor',
  ]) {
    assert.ok(campo in t, `falta ${campo}`);
    assert.ok(typeof t[campo] !== 'object' || t[campo] instanceof Date, `${campo} no es plano`);
  }
  assert.equal(t.calculadoPor, 'uid-ing');
});

prueba('el bonoMO guardado es el ₡498 480 de la aceptación', () => {
  const t = totalesDesdeResultado(resultado, 'uid');
  assert.equal(Math.round(t.bonoMO), 498480);
  assert.equal(Math.round(t.bonoING), 0);
});

prueba('el indicador se guarda como fracción, no como porcentaje', () => {
  const t = totalesDesdeResultado(resultado, 'uid');
  assert.ok(t.indicador < 1, 'debe ser 0.3555, no 35.55');
  assert.equal(Number((t.indicador * 100).toFixed(2)), 35.55);
});

// ── D-12: la procedencia nunca falta ───────────────────────────────────

prueba('la procedencia dice si la cifra es definitiva', () => {
  assert.match(textoProcedencia({ origen: 'planilla', esDefinitivo: true }, {}), /definitiva/);
  assert.match(textoProcedencia({ origen: 'estimado', diasEstimados: 3 }, {}), /no definitivo/);
  assert.match(textoProcedencia({ origen: 'mixto', diasEstimados: 4 }, {}), /4 días estimados/);
});

prueba('sin datos de producción se dice, no se pinta un cero elegante', () => {
  assert.match(textoProcedencia({ origen: 'sin_datos' }, {}), /sin datos/);
  assert.match(textoProcedencia(null, {}), /sin datos/);
});

// ── Guardas de edición ─────────────────────────────────────────────────

prueba('una meta cerrada o pagada no se edita', () => {
  assert.equal(esEditable({ estado: 'abierta' }), true);
  assert.equal(esEditable({ estado: 'evaluada' }), true);
  assert.equal(esEditable({ estado: 'cerrada' }), false);
  assert.equal(esEditable({ estado: 'pagada' }), false);
});

prueba('el avance fuera de 0–100 se rechaza, no se corrige en silencio', () => {
  assert.equal(validarAvance(101).ok, false);
  assert.equal(validarAvance(-1).ok, false);
  assert.equal(validarAvance('').ok, false);
  assert.equal(validarAvance('abc').ok, false);
  assert.equal(validarAvance(0).ok, true);
  assert.equal(validarAvance(100).ok, true);
});

prueba('acepta coma decimal, que es como se digita acá', () => {
  const r = validarAvance('35,5');
  assert.equal(r.ok, true);
  assert.equal(r.valor, 35.5);
});

prueba('una meta cerrada pinta la tabla sin campos editables', () => {
  const m = modeloTabla(HITOS, resultado, REGLAS, { editable: false });
  assert.ok(m.filas.every((f) => f.editable === false));
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
