/**
 * calculoMeta.test.js
 * Suite sin dependencias. Correr con:  node calculoMeta.test.js
 * Requiere "type": "module" en package.json (o renombrar los tres archivos a .mjs).
 *
 * El bloque 1 es el criterio de aceptación: reproduce exactamente el caso
 * UNA UNIDEPRO / Meta 1 del Excel original. Si falla, no se sigue construyendo.
 */

import { REGLAS_BONO_DEFAULT, normalizarReglas, validarReglasBono, tarifaHoraEconomizada, tarifaDiaAnticipado } from './reglasBono.config.js';
import {
  calcularBonoMeta, diffDias, hhMiscelaneos, diasAnticipados, aplicaBonoBase,
  calcularFactorCalidad, calcularTareaBP, validarDistribucionBP, repartirBP,
  pesosAPorcentajes, repartirPorPesosLegado,
  hhConsumidasEstimadas, hhProduccion, compararEstimadoVsPlanilla,
} from './calculoMeta.js';
import { META_UNIDEPRO_1, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1 } from './fixtures/meta-unidepro-1.js';

let pasados = 0, fallidos = 0;
const EPS = 0.005;

function ok(nombre, cond, detalle = '') {
  if (cond) { pasados++; console.log(`  ✓ ${nombre}`); }
  else { fallidos++; console.log(`  ✗ ${nombre}${detalle ? '  →  ' + detalle : ''}`); }
}
function casi(nombre, real, esperado, eps = EPS) {
  ok(nombre, Math.abs(real - esperado) < eps, `esperado ${esperado}, obtenido ${real}`);
}
function igual(nombre, real, esperado) {
  ok(nombre, real === esperado, `esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(real)}`);
}
const bloque = (t) => console.log(`\n${t}`);

/* ================================================================== */
bloque('1. ACEPTACIÓN — caso UNA UNIDEPRO / Meta 1 contra el Excel');
/* ================================================================== */

const reglas = normalizarReglas();
const r = calcularBonoMeta(META_UNIDEPRO_1, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1, reglas);

casi('hhEstimadasTotal = 2697.10', r.hhEstimadasTotal, 2697.1);
casi('hhGanadasTotal = 1092.25', r.hhGanadasTotal, 1092.25);
casi('hhMiscelaneos = 147', r.hhMiscelaneos, 147);
casi('hhPlanilla = 704', r.hhPlanilla, 704);
casi('hhEconomizadas = 388.25', r.hhEconomizadas, 388.25);
casi('indicador = 35.5459 %', r.indicador * 100, 35.5459, 0.001);
casi('tarifaHoraEconomizada = ₡640', r.tarifaHoraEconomizada, 640);
casi('tarifaDiaAnticipado = ₡15 000', r.tarifaDiaAnticipado, 15000);
casi('diasAnticipados = 0', r.diasAnticipados, 0);
casi('bonoBase = ₡250 000', r.bonoBase, 250000);
casi('bonoAnticipada = ₡0', r.bonoAnticipada, 0);
casi('bonoProductividad = ₡248 480', r.bonoProductividad, 248480);
casi('bonoTotalBruto = ₡498 480', r.bonoTotalBruto, 498480);
casi('factorCalidad = 1.00', r.factorCalidad, 1);
casi('bonoMO = ₡498 480', r.bonoMO, 498480);
casi('bonoING = ₡0', r.bonoING, 0);

/* ================================================================== */
bloque('2. Fechas y misceláneos');
/* ================================================================== */

igual('diffDias 26.05 → 16.06 = 21', diffDias(new Date('2026-06-16T00:00:00'), new Date('2026-05-26T00:00:00')), 21);
casi('misceláneos = 21 días x 7 HH', hhMiscelaneos(META_UNIDEPRO_1, reglas, 0), 147);
casi('misceláneos no pueden ser negativos', hhMiscelaneos({ ...META_UNIDEPRO_1, fechaEvaluacion: new Date('2026-05-01T00:00:00') }, reglas, 0), 0);
casi('misceláneos restan los días anticipados', hhMiscelaneos(META_UNIDEPRO_1, reglas, 5), 112);

/* ================================================================== */
bloque('3. Entrega anticipada y tardía (D-05, D-06)');
/* ================================================================== */

const antic = { ...META_UNIDEPRO_1, fechaEntrega: new Date('2026-07-11T00:00:00') };
igual('10 días de anticipación', diasAnticipados(antic, reglas), 10);
casi('bono por anticipación = 10 x 15 000', calcularBonoMeta(antic, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1, reglas).bonoAnticipada, 150000);

const tardia = { ...META_UNIDEPRO_1, fechaEntrega: new Date('2026-08-01T00:00:00') };
igual('entrega tardía: 0 días, sin negativos', diasAnticipados(tardia, reglas), 0);
igual('entrega tardía: no aplica bono base', aplicaBonoBase(tardia), false);
const rTardia = calcularBonoMeta(tardia, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1, reglas);
casi('entrega tardía: bonoBase = 0', rTardia.bonoBase, 0);
casi('entrega tardía: pierde ₡250 000 del total', rTardia.bonoTotalBruto, 248480);
igual('entrega tardía: se marca la pérdida en la UI', rTardia.bonoBaseSePerdio, true);

const sinEntrega = { ...META_UNIDEPRO_1, fechaEntrega: null };
igual('sin fecha de entrega: no aplica bono base', aplicaBonoBase(sinEntrega), false);
igual('sin fecha de entrega: 0 días anticipados', diasAnticipados(sinEntrega, reglas), 0);

igual('ajusteDiasHabiles suma a la anticipación', diasAnticipados({ ...antic, ajusteDiasHabiles: 3 }, reglas), 13);

/* ================================================================== */
bloque('4. Piso del bono por productividad (D-01)');
/* ================================================================== */

const deficit = { ...META_UNIDEPRO_1, hhPlanilla: 1500 };
const rDef = calcularBonoMeta(deficit, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1, reglas);
casi('HH economizadas negativas se reportan', rDef.hhEconomizadas, -407.75);
casi('bonoProductividad con piso en ₡0', rDef.bonoProductividad, 0);
casi('el déficit sigue visible sin piso', rDef.bonoProductividadSinPiso, -260960);
casi('el bono base se conserva', rDef.bonoTotalBruto, 250000);

const conNegativos = { ...reglas, permitirBonoNegativo: true };
casi('con la política invertida, sí resta', calcularBonoMeta(deficit, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1, conNegativos).bonoProductividad, -260960);

/* ================================================================== */
bloque('5. Factor de calidad (evaluaciones bisemanales)');
/* ================================================================== */

igual('sin evaluaciones no hay castigo', calcularFactorCalidad([]), 1);
casi('ornato 80 / SO 60 → 0.70', calcularFactorCalidad([{ ornato: 80, so: 60 }]), 0.7);
casi('promedio de dos evaluaciones bisemanales', calcularFactorCalidad([{ ornato: 100, so: 100 }, { ornato: 50, so: 50 }]), 0.75);
casi('evaluación con activo:false se ignora', calcularFactorCalidad([{ ornato: 100, so: 100 }, { ornato: 0, so: 0, activo: false }]), 1);

const rCastigo = calcularBonoMeta(META_UNIDEPRO_1, HITOS_UNIDEPRO_1, [{ ornato: 80, so: 60 }], reglas);
casi('el factor NO toca el bruto', rCastigo.bonoTotalBruto, 498480);
casi('el factor sí modula el reparto', rCastigo.bonoMO, 498480 * 0.7);

const conING = { ...reglas, pctBonoMO: 70, pctBonoING: 30 };
const rSplit = calcularBonoMeta(META_UNIDEPRO_1, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1, conING);
casi('reparto 70/30 — MO', rSplit.bonoMO, 498480 * 0.7);
casi('reparto 70/30 — ING', rSplit.bonoING, 498480 * 0.3);

/* ================================================================== */
bloque('6. Créditos y soft-delete de hitos');
/* ================================================================== */

const conCredito = [...HITOS_UNIDEPRO_1, { codigo: 'CREDT.01', descripcion: 'Se deja de ejecutar', unidad: 'glb', cantidad: -1, hhUnidad: 40, avancePct: 100, tipo: 'credito' }];
casi('el crédito resta HH estimadas', calcularBonoMeta(META_UNIDEPRO_1, conCredito, EVALUACIONES_UNIDEPRO_1, reglas).hhEstimadasTotal, 2657.1);
casi('el crédito resta HH ganadas', calcularBonoMeta(META_UNIDEPRO_1, conCredito, EVALUACIONES_UNIDEPRO_1, reglas).hhGanadasTotal, 1052.25);

const conBorrado = [...HITOS_UNIDEPRO_1, { codigo: 'X', cantidad: 100, hhUnidad: 10, avancePct: 100, activo: false }];
casi('un hito con activo:false no cuenta', calcularBonoMeta(META_UNIDEPRO_1, conBorrado, EVALUACIONES_UNIDEPRO_1, reglas).hhEstimadasTotal, 2697.1);

/* ================================================================== */
bloque('7. Tarifas derivadas y validación de reglas (fase 1)');
/* ================================================================== */

casi('₡640 se deriva, no se hardcodea', tarifaHoraEconomizada(reglas), 640);
casi('si sube el costo HH a 3600 → ₡720', tarifaHoraEconomizada({ ...reglas, costoPromHH: 3600 }), 720);
casi('₡15 000 por día se deriva', tarifaDiaAnticipado(reglas), 15000);
igual('las reglas por defecto son válidas', validarReglasBono(REGLAS_BONO_DEFAULT).length, 0);
ok('MO + ING > 100 se rechaza', validarReglasBono({ ...reglas, pctBonoMO: 80, pctBonoING: 40 }).length > 0);
ok('factorRetoBP > 1 se rechaza', validarReglasBono({ ...reglas, factorRetoBP: 1.2 }).length > 0);
ok('costo negativo se rechaza', validarReglasBono({ ...reglas, costoPromHH: -1 }).length > 0);

/* ================================================================== */
bloque('8. Bono por Productividad (tarea)');
/* ================================================================== */

const tarea = { cantidad: 1, hhUnidad: 36, hhRealCuadrilla: 30 };
const bp = calcularTareaBP(tarea, reglas);
casi('HH estimadas = 36', bp.hhEstimadas, 36);
casi('HH asignadas = 36 x 0.9 = 32.4', bp.hhAsignadas, 32.4);
casi('monto BP = 36 x 200 = ₡7 200', bp.montoBP, 7200);
igual('30 HH reales ≤ 32.4 → se gana', bp.bpGanado, true);
igual('35 HH reales > 32.4 → no se gana', calcularTareaBP({ ...tarea, hhRealCuadrilla: 35 }, reglas).bpGanado, false);
igual('sin HH reales todavía → indefinido', calcularTareaBP({ ...tarea, hhRealCuadrilla: undefined }, reglas).bpGanado, null);
casi('tarifa BP configurable por proyecto (D-07)', calcularTareaBP(tarea, { ...reglas, tarifaBPporHH: 350 }).montoBP, 12600);

/* ================================================================== */
bloque('9. Distribución manual del BP (D-02)');
/* ================================================================== */

igual('40/40/20 es válido', validarDistribucionBP([{ pctBP: 40 }, { pctBP: 40 }, { pctBP: 20 }]).length, 0);
ok('que no sume 100 se rechaza', validarDistribucionBP([{ pctBP: 50 }, { pctBP: 30 }]).length > 0);
ok('cuadrilla vacía se rechaza', validarDistribucionBP([]).length > 0);

const rep = repartirBP(7200, [{ pctBP: 40 }, { pctBP: 40 }, { pctBP: 20 }]);
igual('reparto exacto suma el monto completo', rep.reduce((s, m) => s + m.monto, 0), 7200);

const rep3 = repartirBP(1000, [{ pctBP: 33.33 }, { pctBP: 33.33 }, { pctBP: 33.34 }]);
igual('el residuo de redondeo no se pierde', rep3.reduce((s, m) => s + m.monto, 0), 1000);
igual('el residuo va al mayor resto decimal', rep3[2].monto, 334);

/* ================================================================== */
bloque('10. Migración de pesos a porcentaje (D-09)');
/* ================================================================== */

const cuad = [{ empleadoId: 'a', rol: 'operario' }, { empleadoId: 'b', rol: 'operario' }, { empleadoId: 'c', rol: 'ayudante' }];
const migrada = pesosAPorcentajes(cuad);
casi('2 operarios + 1 ayudante → 40 %', migrada[0].pctBP, 40);
casi('el ayudante → 20 %', migrada[2].pctBP, 20);
igual('los porcentajes suman 100', Math.round(migrada.reduce((s, m) => s + m.pctBP, 0) * 100) / 100, 100);

// Criterio de aceptación de la migración: mismo resultado en colones.
const casos = [
  [7200, [{ rol: 'operario' }, { rol: 'ayudante' }]],
  [12950, [{ rol: 'operario' }, { rol: 'operario' }, { rol: 'operario' }]],
  [1000, [{ rol: 'operario' }, { rol: 'ayudante' }, { rol: 'ayudante' }]],
  [8658, [{ rol: 'operario' }, { rol: 'operario' }, { rol: 'ayudante' }, { rol: 'ayudante' }]],
  [4995, [{ rol: 'ayudante' }, { rol: 'ayudante' }, { rol: 'ayudante' }]],
];
let migracionOk = true;
for (const [monto, c] of casos) {
  const viejo = repartirPorPesosLegado(monto, c).map((m) => m.monto);
  const nuevo = repartirBP(monto, pesosAPorcentajes(c)).map((m) => m.monto);
  if (JSON.stringify(viejo) !== JSON.stringify(nuevo)) {
    migracionOk = false;
    console.log(`      caso ₡${monto}: viejo ${viejo} vs nuevo ${nuevo}`);
  }
}
ok('la migración preserva los montos históricos al colón', migracionOk);
ok('cuadrilla sin pesos válidos lanza error', (() => { try { pesosAPorcentajes([{ rol: 'x' }]); return false; } catch { return true; } })());

// Prueba aleatoria: 20 000 combinaciones de cuadrilla y monto.
let fuzzFallos = 0, primerFallo = null;
for (let n = 0; n < 20000; n++) {
  const size = 1 + Math.floor(Math.random() * 8);
  const c = Array.from({ length: size }, () => ({ rol: Math.random() < 0.5 ? 'operario' : 'ayudante' }));
  const monto = Math.floor(Math.random() * 200000) + 1;
  const viejo = repartirPorPesosLegado(monto, c).map((m) => m.monto);
  const nuevo = repartirBP(monto, pesosAPorcentajes(c)).map((m) => m.monto);
  const sumaOk = nuevo.reduce((s, x) => s + x, 0) === monto;
  if (!sumaOk || JSON.stringify(viejo) !== JSON.stringify(nuevo)) {
    fuzzFallos++;
    if (!primerFallo) primerFallo = `₡${monto} ${JSON.stringify(c.map((m) => m.rol))}: ${viejo} vs ${nuevo}`;
  }
}
ok('20 000 casos aleatorios: reparto idéntico y suma exacta', fuzzFallos === 0, primerFallo || `${fuzzFallos} fallos`);


/* ================================================================== */
bloque('11. HH de producción: asistencia vs. planilla (D-12)');
/* ================================================================== */

const dia = (fecha, n, horas) => ({
  fecha: new Date(fecha + 'T00:00:00'),
  empleados: Array.from({ length: n }, () => (horas === undefined ? {} : { horas })),
});

casi('3 personas x 11 h de jornada = 33 HH', hhConsumidasEstimadas([dia('2026-06-17', 3)], reglas), 33);
casi('5 días x 4 personas = 220 HH', hhConsumidasEstimadas(
  ['2026-06-17','2026-06-18','2026-06-19','2026-06-20','2026-06-21'].map((f) => dia(f, 4)), reglas), 220);
casi('día con horas parciales', hhConsumidasEstimadas([dia('2026-06-17', 2, 6)], reglas), 12);
casi('un día con activo:false no cuenta', hhConsumidasEstimadas(
  [dia('2026-06-17', 3), { ...dia('2026-06-18', 3), activo: false }], reglas), 33);

// La asistencia NO se pondera por rol: un ayudante en obra consume 11 HH igual.
casi('operario y ayudante consumen lo mismo', hhConsumidasEstimadas(
  [{ fecha: new Date('2026-06-17T00:00:00'), empleados: [{ rol: 'operario' }, { rol: 'ayudante' }] }], reglas), 22);

// Compatibilidad: el caso del Excel no tiene asistencias y no debe cambiar.
const prodExcel = hhProduccion(META_UNIDEPRO_1, [], reglas);
casi('planilla sola sigue mandando', prodExcel.valor, 704);
igual('origen = planilla', prodExcel.origen, 'planilla');
igual('la cifra es definitiva', prodExcel.esDefinitivo, true);

// Sin planilla capturada todavía: todo estimado.
const sinPlanilla = { ...META_UNIDEPRO_1, hhPlanilla: null };
const prodEst = hhProduccion(sinPlanilla, [dia('2026-06-17', 4), dia('2026-06-18', 4)], reglas);
casi('estimado por asistencia = 88 HH', prodEst.valor, 88);
igual('origen = estimado', prodEst.origen, 'estimado');
igual('no es definitivo', prodEst.esDefinitivo, false);
igual('sin planilla ni asistencia', hhProduccion(sinPlanilla, [], reglas).origen, 'sin_datos');

// Mixto: planilla real al corte + asistencia posterior.
const mixta = { ...META_UNIDEPRO_1, hhPlanilla: 704, hhPlanillaAlCorte: new Date('2026-06-16T00:00:00') };
const prodMix = hhProduccion(mixta, [dia('2026-06-15', 9), dia('2026-06-17', 4), dia('2026-06-18', 4)], reglas);
casi('planilla 704 + 88 estimadas = 792', prodMix.valor, 792);
casi('la parte real se reporta aparte', prodMix.hhReal, 704);
casi('la parte estimada se reporta aparte', prodMix.hhEstimada, 88);
igual('origen = mixto', prodMix.origen, 'mixto');
igual('2 días estimados', prodMix.diasEstimados, 2);
igual('mixto nunca es definitivo', prodMix.esDefinitivo, false);
igual('los días anteriores al corte no se doblan', hhProduccion(mixta, [dia('2026-06-15', 9)], reglas).origen, 'planilla');

// El bono se recalcula con la cifra mixta.
const rMix = calcularBonoMeta(META_UNIDEPRO_1, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1, reglas,
  [dia('2026-06-17', 4), dia('2026-06-18', 4)]);
casi('sin fecha de corte la asistencia se ignora', rMix.bonoProductividad, 248480);
const rMix2 = calcularBonoMeta(mixta, HITOS_UNIDEPRO_1, EVALUACIONES_UNIDEPRO_1, reglas,
  [dia('2026-06-17', 4), dia('2026-06-18', 4)]);
casi('con corte, 88 HH más consumidas bajan el bono', rMix2.bonoProductividad, (1092.25 - 792) * 640);
igual('el resultado dice de dónde viene la cifra', rMix2.produccion.origen, 'mixto');

// Reconciliación al corte.
const rec = compararEstimadoVsPlanilla(704, 704);
casi('sin desviación', rec.desviacion, 0);
igual('sin alerta', rec.alerta, false);
ok('desviación del 20 % levanta alerta', compararEstimadoVsPlanilla(880, 704).alerta);
ok('subregistro también levanta alerta', compararEstimadoVsPlanilla(500, 704).alerta);
igual('5 % queda dentro de tolerancia', compararEstimadoVsPlanilla(739, 704).alerta, false);

/* ================================================================== */
console.log(`\n${'─'.repeat(56)}`);
console.log(`${pasados} pasados, ${fallidos} fallidos`);
console.log('─'.repeat(56));
if (fallidos > 0) process.exit(1);
