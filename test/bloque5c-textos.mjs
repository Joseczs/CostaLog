// ═══════════════════════════════════════════════════════════════════════
// test/bloque5c-textos.mjs — Un nombre por cosa, en toda la interfaz.
//
// Node, sin red. Fuera del deploy.
//
// El vocabulario canónico (D-04):
//   ingeniero → "Ingeniero Residente"
//   maestro   → "Maestro de Obras"
//
// "Jefe de Cuadrilla" y "Supervisor" NO se usan en la interfaz. D-04 dice
// que Maestro de Obras y Jefe de Cuadrilla son la misma persona; dos
// nombres para un rol es la incoherencia que este bloque cierra.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { ROLES, ETIQUETA_ROL } from '../public/js/roles.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const publico = join(raiz, 'public');

let pasadas = 0, total = 0;
const prueba = (nombre, fn) => {
  total++;
  try { fn(); pasadas++; console.log(`  ✓ ${nombre}`); }
  catch (e) { console.error(`  ✗ ${nombre}\n    ${e.message}`); process.exitCode = 1; }
};

/** Todos los .html y .js bajo public/, recursivo. */
function archivos(dir = publico, acc = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivos(ruta, acc);
    else if (/\.(html|js)$/.test(entrada)) acc.push(ruta);
  }
  return acc;
}

/**
 * El archivo sin comentarios. La invariante es sobre lo que la gente LEE
 * en pantalla, no sobre lo que un comentario explica: quien documenta por
 * qué se retiró un nombre viejo tiene que poder nombrarlo.
 */
const sinComentarios = (ruta) =>
  readFileSync(ruta, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

// ── Los dos nombres retirados ─────────────────────────────────────────

/**
 * EXCEPCIÓN DECLARADA — los encabezados de Excel no son etiquetas de UI.
 *
 * `importarExcel.js` lee la columna "Jefe de Cuadrilla" de los archivos
 * que la obra ya tiene armados, y `exportarExcel.js` la escribe.
 * `dashboard.html` documenta esa misma columna en el modal de importación,
 * así que tiene que decir exactamente lo mismo o la instrucción miente.
 *
 * Es un contrato de intercambio de datos, no un texto de pantalla.
 * Renombrarlo rompe cada plantilla existente y pertenece al bloque 8,
 * junto con el resto del libro de Excel.
 */
const EXCEPCIONES_EXCEL = [
  'public/js/importarExcel.js',
  'public/js/exportarExcel.js',
  'public/supervisor/dashboard.html',
];

const esExcepcionExcel = (ruta) =>
  EXCEPCIONES_EXCEL.includes(relative(raiz, ruta).replace(/\\/g, '/'));

prueba('ninguna pantalla dice "Jefe de Cuadrilla"', () => {
  const culpables = archivos()
    .filter(r => !esExcepcionExcel(r))
    .filter(r => /Jefe de Cuadrilla/i.test(sinComentarios(r)))
    .map(r => relative(raiz, r));
  assert.deepEqual(culpables, [],
    `D-04: es la misma persona que el Maestro de Obras.\n    ${culpables.join('\n    ')}`);
});

prueba('ninguna pantalla llama "Supervisor" a un rol', () => {
  // `supervisorIds` es nombre de campo de datos, no etiqueta: se migra en
  // su propio bloque. Acá se busca la palabra suelta, con mayúscula.
  const culpables = archivos()
    .filter(r => /(?<!\/)\bSupervisor\b(?!Ids)/.test(sinComentarios(r)))
    .map(r => relative(raiz, r));
  assert.deepEqual(culpables, [], `\n    ${culpables.join('\n    ')}`);
});

// ── Los dos nombres vigentes ──────────────────────────────────────────

prueba('las etiquetas canónicas son las de roles.js', () => {
  assert.equal(ETIQUETA_ROL.ingeniero, 'Ingeniero Residente');
  assert.equal(ETIQUETA_ROL.maestro, 'Maestro de Obras');
  assert.equal(ROLES.length, 2);
});

prueba('el panel del ingeniero se llama como el ingeniero', () => {
  const html = sinComentarios(join(publico, 'supervisor/dashboard.html'));
  assert.match(html, /Panel del Ingeniero Residente/);
});

prueba('la pantalla del maestro no lo nombra con el rol viejo', () => {
  const html = sinComentarios(join(publico, 'jefe/mis-tareas.html'));
  assert.doesNotMatch(html, /Jefe de Cuadrilla/i);
});

// ── La excepción de Excel está viva y es deliberada ───────────────────

prueba('la columna de Excel CONSERVA su nombre en los dos sentidos', () => {
  // Si alguien la "arregla", los archivos que la obra ya tiene dejan de
  // importar. Esta prueba existe para que ese cambio falle acá y no allá.
  const importar = readFileSync(join(publico, 'js/importarExcel.js'), 'utf8');
  const exportar = readFileSync(join(publico, 'js/exportarExcel.js'), 'utf8');
  assert.match(importar, /'Jefe de Cuadrilla'/,
    'la columna de la plantilla NO se renombra: rompe los Excel existentes');
  assert.match(exportar, /'Jefe de Cuadrilla'/);
});

prueba('el modal de importación describe la columna tal como se lee', () => {
  const html = readFileSync(join(publico, 'supervisor/dashboard.html'), 'utf8');
  const importar = readFileSync(join(publico, 'js/importarExcel.js'), 'utf8');
  assert.ok(importar.includes("'Jefe de Cuadrilla'"));
  assert.ok(html.includes('Jefe de Cuadrilla'),
    'la instrucción del modal tiene que nombrar la columna igual que el lector');
});

console.log(`\n  ${pasadas}/${total} pruebas pasadas\n`);
