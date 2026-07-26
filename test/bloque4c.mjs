// test/bloque4c.mjs — Prueba de aceptación del bloque 4c.
//     node test/bloque4c.mjs
//
// Lo que se prueba acá es lo que separa este bloque de una pantalla más:
// que la proyección muestre SIEMPRE las dos cifras, que proponer no toque
// `avancePct`, y que la lista se ordene por horas pendientes.

import assert from 'node:assert/strict';
import { calcularBonoMeta } from '../public/js/core/calculoMeta.js';
import { normalizarReglas } from '../public/js/core/reglasBono.config.js';
import {
  META_UNIDEPRO_1 as META,
  HITOS_UNIDEPRO_1 as HITOS,
  EVALUACIONES_UNIDEPRO_1 as EVALS,
} from '../public/js/core/fixtures/meta-unidepro-1.js';
import {
  hitosConPropuestas,
  ordenarPorPendiente,
  tarjetaDeHito,
  proyeccion,
  validarAvance,
  ESTADOS_REPORTABLES,
} from '../public/jefe/avance-controller.js';

const REGLAS = normalizarReglas(META.reglasBono ?? {});

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

console.log('\nBloque 4c — reportar avance (móvil)\n');

// ── LA restricción del plan: dos cifras, nunca una ─────────────────────

prueba('sin propuestas, las dos cifras coinciden', () => {
  const a = calcularBonoMeta(META, HITOS, EVALS, REGLAS, []);
  const b = calcularBonoMeta(META, hitosConPropuestas(HITOS), EVALS, REGLAS, []);
  const p = proyeccion(a, b);
  assert.equal(p.aprobado, p.propuesto);
  assert.equal(p.hayDiferencia, false);
  assert.equal(Math.round(p.aprobado), 498480);
});

prueba('con una propuesta, la cifra aprobada NO se mueve', () => {
  // El hito 1 está al 70 % en el fixture. El 0 está al 100 % y proponerle
  // 100 no movería nada: la primera versión de esta prueba lo usaba y
  // fallaba con razón — el código estaba bien, la expectativa no.
  const conPropuesta = HITOS.map((h, i) =>
    i === 1 ? { ...h, avancePropuesto: 100 } : h,
  );
  const a = calcularBonoMeta(META, conPropuesta, EVALS, REGLAS, []);
  const b = calcularBonoMeta(META, hitosConPropuestas(conPropuesta), EVALS, REGLAS, []);
  const p = proyeccion(a, b);
  assert.equal(Math.round(p.aprobado), 498480, 'lo aprobado no puede cambiar');
  assert.ok(p.propuesto > p.aprobado, 'lo propuesto sí sube');
  assert.equal(p.hayDiferencia, true);
});

prueba('la proyección expone SIEMPRE las dos cifras y su diferencia', () => {
  const p = proyeccion({ bonoMO: 100000 }, { bonoMO: 130000 });
  assert.equal(p.aprobado, 100000);
  assert.equal(p.propuesto, 130000);
  assert.equal(p.diferencia, 30000);
  assert.ok(p.aprobadoTexto.startsWith('₡'));
  assert.ok(p.propuestoTexto.startsWith('₡'));
});

prueba('una propuesta que BAJA el avance da diferencia negativa', () => {
  const p = proyeccion({ bonoMO: 130000 }, { bonoMO: 100000 });
  assert.equal(p.diferencia, -30000);
  assert.equal(p.hayDiferencia, true);
});

prueba('sin producción definitiva, la proyección lo declara', () => {
  assert.equal(proyeccion({ bonoMO: 1, produccion: { esDefinitivo: false } }, { bonoMO: 1 }).esDefinitivo, false);
  assert.equal(proyeccion({ bonoMO: 1, produccion: { esDefinitivo: true } }, { bonoMO: 1 }).esDefinitivo, true);
});

prueba('proponer lo mismo que ya está aprobado no genera diferencia', () => {
  const igual = HITOS.map((h, i) => (i === 0 ? { ...h, avancePropuesto: h.avancePct } : h));
  const a = calcularBonoMeta(META, igual, EVALS, REGLAS, []);
  const b = calcularBonoMeta(META, hitosConPropuestas(igual), EVALS, REGLAS, []);
  assert.equal(proyeccion(a, b).hayDiferencia, false);
});

// ── D-11: proponer no toca lo aprobado ─────────────────────────────────

prueba('hitosConPropuestas NO muta el arreglo original', () => {
  const original = [{ id: 'a', cantidad: 10, hhUnidad: 1, avancePct: 40, avancePropuesto: 90 }];
  const copia = hitosConPropuestas(original);
  assert.equal(original[0].avancePct, 40, 'el original quedó intacto');
  assert.equal(copia[0].avancePct, 90);
  assert.notEqual(original[0], copia[0]);
});

prueba('un hito sin propuesta pasa tal cual, sin copiarse', () => {
  const original = [{ id: 'a', cantidad: 10, hhUnidad: 1, avancePct: 40 }];
  assert.equal(hitosConPropuestas(original)[0], original[0]);
});

prueba('una propuesta de 0 % se aplica, no se ignora como falsy', () => {
  const c = hitosConPropuestas([{ id: 'a', cantidad: 10, hhUnidad: 1, avancePct: 80, avancePropuesto: 0 }]);
  assert.equal(c[0].avancePct, 0);
});

// ── El orden del día ───────────────────────────────────────────────────

prueba('la lista se ordena por horas pendientes, de más a menos', () => {
  const orden = ordenarPorPendiente([
    { id: 'poco', cantidad: 10, hhUnidad: 1, avancePct: 90 },   // 1 HH
    { id: 'mucho', cantidad: 100, hhUnidad: 1, avancePct: 0 },  // 100 HH
    { id: 'medio', cantidad: 50, hhUnidad: 1, avancePct: 50 },  // 25 HH
  ]);
  assert.deepEqual(orden.map((h) => h.id), ['mucho', 'medio', 'poco']);
});

prueba('el orden usa la propuesta si existe, que es lo que el Maestro ve', () => {
  const orden = ordenarPorPendiente([
    { id: 'a', cantidad: 100, hhUnidad: 1, avancePct: 0, avancePropuesto: 100 }, // 0 pendiente
    { id: 'b', cantidad: 50, hhUnidad: 1, avancePct: 0 },                        // 50 pendiente
  ]);
  assert.deepEqual(orden.map((h) => h.id), ['b', 'a']);
});

prueba('ordenar no muta el arreglo de entrada', () => {
  const entrada = [
    { id: 'x', cantidad: 1, hhUnidad: 1, avancePct: 0 },
    { id: 'y', cantidad: 9, hhUnidad: 1, avancePct: 0 },
  ];
  ordenarPorPendiente(entrada);
  assert.equal(entrada[0].id, 'x');
});

// ── La tarjeta ─────────────────────────────────────────────────────────

prueba('la tarjeta muestra el valor propuesto, no el aprobado', () => {
  const t = tarjetaDeHito({ id: 'a', cantidad: 100, hhUnidad: 1, avancePct: 40, avancePropuesto: 70 });
  assert.equal(t.valor, 70);
  assert.equal(t.aprobado, 40);
  assert.equal(t.hayPropuesta, true);
  assert.equal(t.delta, 30);
  assert.equal(t.sube, true);
});

prueba('sin propuesta, la tarjeta arranca en lo aprobado', () => {
  const t = tarjetaDeHito({ id: 'a', cantidad: 100, hhUnidad: 1, avancePct: 40 });
  assert.equal(t.valor, 40);
  assert.equal(t.delta, 0);
  assert.equal(t.hayPropuesta, false);
});

prueba('las horas pendientes son las que faltan para cerrar el hito', () => {
  const t = tarjetaDeHito({ id: 'a', cantidad: 100, hhUnidad: 2, avancePct: 25 });
  assert.equal(t.estimadas, 200);
  assert.equal(t.pendiente, 150);
  assert.equal(t.completo, false);
});

prueba('un hito al 100 % se marca completo', () => {
  assert.equal(tarjetaDeHito({ id: 'a', cantidad: 10, hhUnidad: 1, avancePct: 100 }).completo, true);
});

prueba('la tarjeta dice cuánto vale un punto en horas', () => {
  assert.equal(tarjetaDeHito({ id: 'a', cantidad: 840, hhUnidad: 0.3, avancePct: 0 }).porPuntoTexto, '2,52');
});

// ── Guardas ────────────────────────────────────────────────────────────

prueba('solo se reporta sobre metas abierta o evaluada', () => {
  assert.ok(ESTADOS_REPORTABLES.includes('abierta'));
  assert.ok(ESTADOS_REPORTABLES.includes('evaluada'));
  assert.ok(!ESTADOS_REPORTABLES.includes('cerrada'));
  assert.ok(!ESTADOS_REPORTABLES.includes('pagada'));
});

prueba('el avance fuera de rango se rechaza con el motivo', () => {
  assert.equal(validarAvance(101).ok, false);
  assert.equal(validarAvance(-1).ok, false);
  assert.equal(validarAvance('').ok, false);
  assert.equal(validarAvance('35,5').valor, 35.5);
  assert.equal(validarAvance(0).ok, true);
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
