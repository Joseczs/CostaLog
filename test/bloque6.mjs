// test/bloque6.mjs — Prueba de aceptación del bloque 6.
//     node test/bloque6.mjs
//
// Las funciones se IMPORTAN de los controladores reales, no se reimplementan:
// la mitad de navegador de cada uno solo arranca si existe su elemento ancla
// (`#tabla-actividades`, `#tabla-evaluaciones`), que en Node no existe.
//
// `esEditable` se importa encadenado desde `meta-detalle-controller.js` —lo
// mismo que hacen los dos controladores reales— así que esta prueba también
// confirma que esa cadena de imports no se rompe en Node.

import assert from 'node:assert/strict';

import {
  siguientePrefijo,
  siguienteOrden,
  prepararActividad,
  filaActividad,
  resumenActividades,
  impactoActividad,
} from '../public/ingeniero/actividades-fuera-lista-controller.js';

import {
  fechaDesdeInput,
  validarEvaluacion,
  filaEvaluacion,
  notaFactor,
  factorProyectado,
  impactoEnBono,
} from '../public/ingeniero/evaluaciones-controller.js';

import { esEditable } from '../public/ingeniero/meta-detalle-controller.js';

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

console.log('\nBloque 6 — extras, créditos y evaluaciones\n');

/* ══════════════════════════════════════════════════════════════════════
   Datos comunes: una meta chica, dos hitos de lista, reglas por defecto.
   No es el fixture de 52 hitos — acá lo que importa es el DELTA de agregar
   un borrador, no reproducir el total de aceptación del bloque 0.
   ══════════════════════════════════════════════════════════════════════ */

const REGLAS = {
  costoPromHH: 3200,
  costoDiarioAdmin: 50000,
  pctBonoEntregaAnticipada: 30,
  pctBonoHoraProductividad: 20,
  pctBonoMO: 100,
  pctBonoING: 0,
  horasJornada: 11,
  hhMiscelaneosPorDia: 7,
  permitirBonoNegativo: false,
  permitirDiasAtrasoNegativos: false,
};

const META = {
  numero: 1,
  fechaInicio: new Date(2026, 5, 1),
  fechaLimite: new Date(2026, 6, 1),
  fechaEvaluacion: new Date(2026, 5, 1),   // mismo día que el inicio: 0 misceláneos
  fechaEntrega: null,
  hhPlanilla: 100,
  bonoBase: 0,
  estado: 'abierta',
};

const HITOS = [
  { id: 'h1', tipo: 'lista', cantidad: 10, hhUnidad: 20, avancePct: 100, orden: 1, activo: true }, // 200 HH
  { id: 'h2', tipo: 'lista', cantidad: 5, hhUnidad: 10, avancePct: 50, orden: 2, activo: true },   // 25 de 50 HH
];

/* ── siguientePrefijo / siguienteOrden ──────────────────────────────── */

prueba('extra usa el prefijo EXTRA, crédito usa CREDT', () => {
  assert.equal(siguientePrefijo('extra'), 'EXTRA');
  assert.equal(siguientePrefijo('credito'), 'CREDT');
});

prueba('un tipo desconocido lanza, no adivina un prefijo', () => {
  assert.throws(() => siguientePrefijo('lista'));
  assert.throws(() => siguientePrefijo(undefined));
});

prueba('el siguiente orden nace después del máximo, sobre TODOS los hitos', () => {
  assert.equal(siguienteOrden(HITOS), 3);
  assert.equal(siguienteOrden([]), 1);
});

/* ── prepararActividad: el signo se decide, no se valida a mano ──────── */

prueba('un extra queda con cantidad POSITIVA', () => {
  const r = prepararActividad({
    tipo: 'extra', descripcion: 'Muro adicional', unidad: 'm²', magnitud: '12', hhUnidad: '3',
  });
  assert.equal(r.ok, true);
  assert.equal(r.datos.cantidad, 12);
});

prueba('un crédito queda con cantidad NEGATIVA, aunque la magnitud sea positiva', () => {
  const r = prepararActividad({
    tipo: 'credito', descripcion: 'Escalera que no se hace', unidad: 'un', magnitud: '40', hhUnidad: '1',
  });
  assert.equal(r.ok, true);
  assert.equal(r.datos.cantidad, -40);
});

prueba('la magnitud acepta coma decimal, como el resto de la app', () => {
  const r = prepararActividad({
    tipo: 'extra', descripcion: 'X', unidad: 'ml', magnitud: '12,5', hhUnidad: '2,5',
  });
  assert.equal(r.ok, true);
  assert.equal(r.datos.cantidad, 12.5);
  assert.equal(r.datos.hhUnidad, 2.5);
});

prueba('sin tipo, sin descripción, sin unidad: tres errores, no uno', () => {
  const r = prepararActividad({ tipo: '', descripcion: '  ', unidad: '', magnitud: '5', hhUnidad: '1' });
  assert.equal(r.ok, false);
  assert.equal(r.errores.length, 3);
});

prueba('magnitud cero o negativa se rechaza para los dos tipos', () => {
  assert.equal(prepararActividad({ tipo: 'extra', descripcion: 'x', unidad: 'x', magnitud: '0', hhUnidad: '1' }).ok, false);
  assert.equal(prepararActividad({ tipo: 'credito', descripcion: 'x', unidad: 'x', magnitud: '-5', hhUnidad: '1' }).ok, false);
});

prueba('hhUnidad cero o negativo se rechaza', () => {
  assert.equal(prepararActividad({ tipo: 'extra', descripcion: 'x', unidad: 'x', magnitud: '5', hhUnidad: '0' }).ok, false);
});

prueba('un tipo inválido se rechaza sin adivinar signo', () => {
  const r = prepararActividad({ tipo: 'lista', descripcion: 'x', unidad: 'x', magnitud: '5', hhUnidad: '1' });
  assert.equal(r.ok, false);
});

/* ── filaActividad / resumenActividades ──────────────────────────────── */

prueba('filaActividad marca negativo un crédito, no un extra', () => {
  const extra = filaActividad({ id: 'e1', tipo: 'extra', codigo: 'EXTRA.01', cantidad: 12, hhUnidad: 3, avancePct: 0 });
  const credito = filaActividad({ id: 'c1', tipo: 'credito', codigo: 'CREDT.01', cantidad: -40, hhUnidad: 1, avancePct: 0 });
  assert.equal(extra.negativo, false);
  assert.equal(credito.negativo, true);
});

prueba('el resumen cuenta extras y créditos por separado', () => {
  const filas = [
    filaActividad({ id: '1', tipo: 'extra', cantidad: 5, hhUnidad: 1, avancePct: 0 }),
    filaActividad({ id: '2', tipo: 'extra', cantidad: 5, hhUnidad: 1, avancePct: 0 }),
    filaActividad({ id: '3', tipo: 'credito', cantidad: -5, hhUnidad: 1, avancePct: 0 }),
  ];
  assert.match(resumenActividades(filas), /2 extras/);
  assert.match(resumenActividades(filas), /1 crédito\b/);
});

prueba('sin nada registrado, el resumen lo dice y no queda vacío', () => {
  assert.match(resumenActividades([]), /Sin extras ni créditos/);
});

/* ── impactoActividad: el criterio de aceptación del plan ────────────── */

prueba('un crédito de −40 HH baja el total ESTIMADO en 40, con avance en 0', () => {
  // 40 HH de crédito ⇒ magnitud 40, hhUnidad 1, cantidad -40 en el borrador.
  const r = impactoActividad(META, HITOS, [], REGLAS, { tipo: 'credito', cantidad: -40, hhUnidad: 1 });
  assert.equal(Math.round(r.deltaHHEstimadas * 100) / 100, -40);
  // Nace con avancePct 0 (mismo default de hitosRepo.crear): nada ganado todavía.
  assert.equal(r.deltaHHGanadas, 0);
});

prueba('un extra de +30 HH sube el total estimado en 30', () => {
  const r = impactoActividad(META, HITOS, [], REGLAS, { tipo: 'extra', cantidad: 30, hhUnidad: 1 });
  assert.equal(Math.round(r.deltaHHEstimadas * 100) / 100, 30);
});

prueba('sin borrador, actual y proyectado son el mismo objeto de valores', () => {
  const r = impactoActividad(META, HITOS, [], REGLAS, null);
  assert.equal(r.deltaHHEstimadas, 0);
  assert.equal(r.deltaHHGanadas, 0);
  assert.equal(r.deltaBonoMO, 0);
  assert.equal(r.actual.bonoTotalBruto, r.proyectado.bonoTotalBruto);
});

prueba('un borrador con avancePct explícito se respeta, no se pisa con 0', () => {
  const r = impactoActividad(META, HITOS, [], REGLAS, { tipo: 'extra', cantidad: 20, hhUnidad: 1, avancePct: 100 });
  assert.equal(Math.round(r.deltaHHGanadas * 100) / 100, 20);
});

/* ══════════════════════════════════════════════════════════════════════
   Evaluaciones
   ══════════════════════════════════════════════════════════════════════ */

/* ── fechaDesdeInput: el mismo problema de zona horaria que formato.js ── */

prueba('una fecha YYYY-MM-DD se parsea por componentes, sin corrimiento UTC', () => {
  const f = fechaDesdeInput('2026-07-21');
  assert.equal(f.getFullYear(), 2026);
  assert.equal(f.getMonth(), 6); // julio = índice 6
  assert.equal(f.getDate(), 21);
});

prueba('una cadena inválida devuelve null, no "Invalid Date"', () => {
  assert.equal(fechaDesdeInput('no-es-fecha'), null);
  assert.equal(fechaDesdeInput(''), null);
  assert.equal(fechaDesdeInput(undefined), null);
});

/* ── validarEvaluacion ────────────────────────────────────────────────── */

prueba('una evaluación válida pasa, con coma decimal aceptada', () => {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const iso = ayer.toISOString().slice(0, 10);
  const r = validarEvaluacion({ fecha: iso, ornato: '85,5', so: '90' });
  assert.equal(r.ok, true);
  assert.equal(r.datos.ornato, 85.5);
  assert.equal(r.datos.so, 90);
});

prueba('sin fecha, se rechaza', () => {
  assert.equal(validarEvaluacion({ fecha: '', ornato: '80', so: '80' }).ok, false);
});

prueba('una fecha futura se rechaza: no se califica lo que no pasó', () => {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const iso = manana.toISOString().slice(0, 10);
  const r = validarEvaluacion({ fecha: iso, ornato: '80', so: '80' });
  assert.equal(r.ok, false);
  assert.match(r.errores.join(' '), /futura/);
});

prueba('ornato y so fuera de 0–100 se rechazan cada uno por su lado', () => {
  const hoy = new Date().toISOString().slice(0, 10);
  assert.equal(validarEvaluacion({ fecha: hoy, ornato: '110', so: '50' }).ok, false);
  assert.equal(validarEvaluacion({ fecha: hoy, ornato: '50', so: '-1' }).ok, false);
});

/* ── filaEvaluacion / notaFactor ──────────────────────────────────────── */

prueba('filaEvaluacion calcula el promedio de ornato y SO', () => {
  const f = filaEvaluacion({ id: 'e1', fecha: new Date(2026, 6, 1), ornato: 80, so: 60, notas: '' });
  assert.match(f.promedioTexto, /70/);
});

prueba('sin evaluaciones, la nota dice "sin castigo"; con una, cuenta cuántas', () => {
  assert.match(notaFactor([]), /sin castigo/);
  assert.match(notaFactor([{ activo: true }]), /1 evaluación\b/);
  assert.match(notaFactor([{ activo: true }, { activo: true }]), /2 evaluaciones/);
});

/* ── factorProyectado / impactoEnBono ─────────────────────────────────── */

prueba('factorProyectado con un borrador da lo mismo que calcularFactorCalidad con la lista completa', () => {
  const activas = [{ ornato: 100, so: 100, activo: true }];
  const draft = { ornato: 60, so: 40, activo: true };
  // (100+100)/2/100 y (60+40)/2/100 promediados a mano: ornato prom 80, so prom 70 → 0.75
  assert.equal(factorProyectado(activas, draft), 0.75);
});

prueba('sin borrador, factorProyectado es el factor actual', () => {
  const activas = [{ ornato: 80, so: 60, activo: true }];
  assert.equal(factorProyectado(activas, null), factorProyectado(activas, undefined));
});

prueba('una evaluación baja SUBE el bono nunca — el signo del impacto es coherente', () => {
  // Con evaluaciones vacías el factor es 1 (sin castigo). Cualquier borrador
  // con promedio < 100 solo puede bajar o mantener el bono, nunca subirlo.
  const r = impactoEnBono(META, HITOS, [], REGLAS, { ornato: 50, so: 50, activo: true });
  assert.ok(r.deltaBonoMO <= 0, `esperaba una baja o ningún cambio, dio ${r.deltaBonoMO}`);
  assert.ok(r.deltaBonoMO < 0, 'con promedio 50 tiene que bajar, no quedar igual');
});

prueba('sin borrador, impactoEnBono no mueve nada', () => {
  const r = impactoEnBono(META, HITOS, [], REGLAS, null);
  assert.equal(r.deltaBonoMO, 0);
  assert.equal(r.actual.bonoMO, r.proyectado.bonoMO);
});

/* ══════════════════════════════════════════════════════════════════════
   El hueco cerrado: esEditable() reusado, no reescrito
   ══════════════════════════════════════════════════════════════════════ */

prueba('esEditable() se importa de meta-detalle-controller.js sin romper la cadena', () => {
  assert.equal(typeof esEditable, 'function');
  assert.equal(esEditable({ estado: 'abierta' }), true);
  assert.equal(esEditable({ estado: 'evaluada' }), true);
  assert.equal(esEditable({ estado: 'cerrada' }), false);
  assert.equal(esEditable({ estado: 'pagada' }), false);
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
