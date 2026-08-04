// ═══════════════════════════════════════════════════════════════════════
// test/bloque5ce.mjs — Bloque 5c/E: renombrado de directorios.
//
//   node test/bloque5ce.mjs
//
// Prueba de aceptación del plan: cero ocurrencias de /supervisor/ y /jefe/
// fuera de netlify.toml. Corre DESPUÉS de `git mv` + el script de
// renombrado — si corre antes, todo falla y está bien que falle: significa
// que el bloque no terminó.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROLES, ROL_INGENIERO, ROL_MAESTRO, HOME_POR_ROL, ETIQUETA_ROL,
} from '../public/js/roles.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');

function listarArchivos(dir, ext, acc = []) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre !== 'node_modules') listarArchivos(ruta, ext, acc);
    } else if (ext.includes(extname(nombre))) {
      acc.push(ruta);
    }
  }
  return acc;
}

let pasadas = 0, total = 0;
function prueba(nombre, fn) {
  total++;
  try { fn(); pasadas++; console.log(`  ✓ ${nombre}`); }
  catch (e) { console.log(`  ✗ ${nombre}\n    ${e.message}`); }
}

console.log('\nBloque 5c/E — renombrado de directorios\n');

// ── Los directorios viejos no existen más ─────────────────────────────

prueba('public/supervisor/ ya no existe', () => {
  assert.ok(!existsSync(join(raiz, 'public', 'supervisor')),
    'el git mv no se hizo, o se deshizo');
});

prueba('public/jefe/ ya no existe', () => {
  assert.ok(!existsSync(join(raiz, 'public', 'jefe')));
});

prueba('public/ingeniero/ existe y no está vacío', () => {
  const dir = join(raiz, 'public', 'ingeniero');
  assert.ok(existsSync(dir));
  assert.ok(readdirSync(dir).length > 0);
});

prueba('public/maestro/ existe y no está vacío', () => {
  const dir = join(raiz, 'public', 'maestro');
  assert.ok(existsSync(dir));
  assert.ok(readdirSync(dir).length > 0);
});

// ── Cero rastros del nombre viejo, en TODO public/ ─────────────────────
// Es la prueba de aceptación literal del plan de desarrollo.

prueba('cero /supervisor/ o /jefe/ en todo public/', () => {
  const archivos = listarArchivos(join(raiz, 'public'), ['.html', '.js']);
  const encontrados = [];
  for (const ruta of archivos) {
    const contenido = readFileSync(ruta, 'utf8');
    if (/\/supervisor\/|\/jefe\//.test(contenido)) {
      encontrados.push(ruta.slice(raiz.length + 1));
    }
  }
  assert.deepEqual(encontrados, [],
    `quedaron rutas viejas en: ${encontrados.join(', ')}`);
});

prueba('cero ROL_SUPERVISOR fuera de netlify — de hecho, en ningún lado', () => {
  const archivos = listarArchivos(join(raiz, 'public'), ['.html', '.js']);
  const encontrados = archivos.filter((r) => /\bROL_SUPERVISOR\b/.test(readFileSync(r, 'utf8')));
  assert.deepEqual(encontrados, [], 'el alias debía retirarse en esta fase');
});

// ── netlify.toml SÍ conserva las rutas viejas, como origen del redirect ─

prueba('netlify.toml SIGUE mencionando las rutas viejas — a propósito', () => {
  const toml = leer('netlify.toml');
  assert.match(toml, /from = "\/supervisor\/\*"/,
    'sin el origen viejo, el redirect no tiene qué capturar');
  assert.match(toml, /from = "\/jefe\/\*"/);
});

prueba('los dos redirects van ANTES del catch-all de 404', () => {
  const toml = leer('netlify.toml');
  const iSupervisor = toml.indexOf('from = "/supervisor/*"');
  const iJefe = toml.indexOf('from = "/jefe/*"');
  const iCatchAll = toml.indexOf('from = "/*"');
  assert.ok(iSupervisor > -1 && iJefe > -1 && iCatchAll > -1);
  assert.ok(iSupervisor < iCatchAll && iJefe < iCatchAll,
    'Netlify evalúa de arriba hacia abajo; el catch-all antes se comería ' +
    'los dos redirects específicos');
});

prueba('los redirects apuntan a los directorios nuevos, con :splat', () => {
  const toml = leer('netlify.toml');
  assert.match(toml, /to = "\/ingeniero\/:splat"/);
  assert.match(toml, /to = "\/maestro\/:splat"/);
});

// ── roles.js quedó consistente con el renombrado ───────────────────────

prueba('HOME_POR_ROL apunta a los directorios nuevos', () => {
  assert.equal(HOME_POR_ROL[ROL_INGENIERO], '/ingeniero/dashboard.html');
  assert.equal(HOME_POR_ROL[ROL_MAESTRO], '/maestro/mis-tareas.html');
});

prueba('ROL_SUPERVISOR ya no se exporta', () => {
  const js = leer('public/js/roles.js');
  assert.ok(!/export const ROL_SUPERVISOR/.test(js),
    'el alias del 5c debía retirarse en la fase E');
});

prueba('esSupervisor ya no se exporta', () => {
  const js = leer('public/js/roles.js');
  assert.ok(!/export const esSupervisor/.test(js));
});

prueba('los dos roles siguen vigentes — esto NO era eliminar el ingeniero', () => {
  assert.deepEqual([...ROLES], [ROL_INGENIERO, ROL_MAESTRO]);
  assert.ok(ETIQUETA_ROL[ROL_INGENIERO] && ETIQUETA_ROL[ROL_MAESTRO]);
});

console.log(`\n  ${pasadas}/${total} pruebas pasadas\n`);
