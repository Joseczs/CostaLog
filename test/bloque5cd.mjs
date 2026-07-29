// ═══════════════════════════════════════════════════════════════════════
// test/bloque5cd.mjs — Fase D del bloque 5c: reglas estrictas.
//
// Node, sin red. Fuera del deploy.
//
// Las reglas de Firestore no se ejecutan acá — eso se verifica en el
// Simulador de la consola, con dos cuentas, como el bloque 5b. Lo que esta
// suite fija es la FORMA del archivo: que el valor viejo no quede aceptado
// en ningún lado y que el alias de la fase A no sobreviva.
//
// Un archivo de reglas se restaura de un backup viejo con demasiada
// facilidad. Esto lo atrapa antes del deploy.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(join(raiz, r), 'utf8');

/** Las reglas sin comentarios: la invariante es sobre lo que se evalúa. */
const sinComentarios = (r) => leer(r).replace(/^\s*\/\/.*$/gm, '');

let pasadas = 0, total = 0;
const prueba = (nombre, fn) => {
  total++;
  try { fn(); pasadas++; console.log(`  ✓ ${nombre}`); }
  catch (e) { console.error(`  ✗ ${nombre}\n    ${e.message}`); process.exitCode = 1; }
};

const REGLAS = 'firestore.rules';
const reglas = () => sinComentarios(REGLAS);

console.log('\nBloque 5c/D — reglas estrictas: un solo nombre por rol\n');

// ── La tolerancia de la fase A quedó retirada ─────────────────────────

prueba('esMaestro() acepta SOLO el valor vigente', () => {
  const fn = reglas().match(/function esMaestro\(\)\s*\{[^}]*\}/);
  assert.ok(fn, 'no se encontró esMaestro()');
  assert.match(fn[0], /perfil\(\)\.rol == 'maestro'/);
  assert.doesNotMatch(fn[0], /'supervisor'/,
    'la fase D no se aplicó: esMaestro() sigue aceptando el valor viejo');
  assert.doesNotMatch(fn[0], /\|\|/,
    'esMaestro() no debe tener alternativas: un rol, un nombre');
});

prueba('ninguna regla evalúa el valor viejo', () => {
  assert.doesNotMatch(reglas(), /rol == 'supervisor'/);
});

prueba('el alias de compatibilidad de la fase A no sobrevive', () => {
  assert.doesNotMatch(reglas(), /esSupervisor/,
    'un alias que no hace nada se lee como si hiciera algo');
});

prueba('los roles muertos del bloque 2 siguen sin conceder nada', () => {
  for (const muerto of ['jefe_cuadrilla', 'admin', 'jefeCuadrilla']) {
    assert.doesNotMatch(reglas(), new RegExp(`rol == '${muerto}'`));
  }
});

prueba('solo hay DOS comparaciones de rol en todo el archivo', () => {
  const comparaciones = reglas().match(/perfil\(\)\.rol ==/g) || [];
  assert.equal(comparaciones.length, 2,
    'cada rol se compara en una sola función; si hay más, alguien ' +
    'escribió un rol a mano fuera de los helpers');
});

// ── Lo que la fase D NO debía tocar ───────────────────────────────────

prueba('el alcance del bloque 5b quedó intacto', () => {
  const r = reglas();
  for (const fn of ['estaEnLaLista', 'puedeVerEsteProyecto', 'puedeVerProyecto']) {
    assert.match(r, new RegExp(`function ${fn}\\(`), `falta ${fn}()`);
  }
  assert.match(r, /'supervisorIds' in datos\.keys\(\)/,
    'el fail-closed del 5b: campo ausente ⇒ no lo ve ningún maestro');
});

prueba('el borrado duro sigue prohibido en toda la base', () => {
  const r = reglas();
  const denegados = (r.match(/allow delete:\s*if false/g) || []).length;
  assert.ok(denegados >= 9,
    `solo ${denegados} documentos niegan delete; el histórico de bonos ` +
    'cuelga del soft-delete');
  assert.doesNotMatch(r, /allow delete:\s*if (?!false)/);
});

prueba('D-11 sigue en el servidor: el maestro solo escribe la propuesta', () => {
  assert.match(reglas(),
    /hasOnly\(\['avancePropuesto', 'propuestoPor', 'propuestoEn'\]\)|soloCambia\(\['avancePropuesto', 'propuestoPor', 'propuestoEn'\]\)/,
    'avancePct es inescribible para quien cobra el bonoMO');
});

prueba('`disponible` sigue siendo lo único que el maestro toca del roster', () => {
  assert.match(reglas(), /soloCambia\(\['disponible'\]\)/);
});

prueba('los pagos siguen cerrados al maestro', () => {
  const pagos = reglas().match(/match \/pagos\/\{pagoId\}\s*\{[\s\S]*?\n      \}/);
  assert.ok(pagos, 'no se encontró el bloque de pagos');
  assert.doesNotMatch(pagos[0], /esMaestro|puedeVerProyecto/,
    'el libro de pagos incluye el monto del ingeniero y el de los trabajadores');
});

// ── Los scripts que la fase D deja obsoletos ──────────────────────────

prueba('migrar-rol-maestro.js existe y verifica la precondición', () => {
  const js = leer('scripts/migrar-rol-maestro.js');
  assert.match(js, /rolAnteriorMaestro/, 'debe dejar constancia con nombre propio');
  assert.match(js, /rolMaestroEn/);
  assert.doesNotMatch(js, /rolAnterior:/,
    'no debe sobrescribir los campos del bloque 2');
  assert.match(js, /credential: cert\(/,
    'el arranque se copia de un script que ya corre, no se reescribe');
});

prueba('migrar-supervisor-ids.js clasifica por el rol vigente', () => {
  const js = leer('scripts/migrar-supervisor-ids.js');
  assert.match(js, /const ROL_SUPERVISOR = 'maestro';/,
    'con el valor viejo, el script listaría cero maestros');
});

prueba('migrar-roles.js está retirado con guarda', () => {
  const js = leer('scripts/migrar-roles.js');
  assert.match(js, /process\.exit\(1\)/);
  assert.match(js, /si-se-lo-que-hago/,
    'su mapa escribe un rol que ya no concede permisos');
});

console.log(`\n  ${pasadas}/${total} pruebas pasadas\n`);
