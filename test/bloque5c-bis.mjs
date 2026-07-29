// ═══════════════════════════════════════════════════════════════════════
// test/bloque5c-bis.mjs — El registro deja de escribir el rol viejo.
//
// Node, sin red. Fuera del deploy.
//
// Lo que este bloque corrige: `index.html` tenía data-rol="supervisor"
// escrito a mano. La fase B migró un usuario a 'maestro' mientras el
// formulario seguía fabricando cuentas con el valor viejo. La fase D
// —reglas estrictas— habría dejado sin acceso a cada cuenta nueva.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ROL_INGENIERO, ROL_MAESTRO, ROLES, ETIQUETA_ROL,
  rolParaGuardar, normalizarRol,
} from '../public/js/roles.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');

/**
 * El archivo SIN comentarios.
 *
 * La invariante es "ningún archivo EJECUTA un identificador de rol
 * literal", no "ningún archivo lo menciona". Los comentarios que explican
 * por qué se retiró `data-rol="supervisor"` tienen que poder nombrarlo:
 * quien grepee esa cadena dentro de seis meses merece encontrar el motivo
 * y no un archivo mudo. Escanear el texto crudo confundía las dos cosas.
 *
 * Solo se descartan comentarios de línea COMPLETA, así que un `https://`
 * dentro de una cadena queda intacto.
 */
const leerSinComentarios = (ruta) =>
  leer(ruta)
    .replace(/<!--[\s\S]*?-->/g, '')   // HTML
    .replace(/\/\*[\s\S]*?\*\//g, '')  // JS de bloque
    .replace(/^[ \t]*\/\/.*$/gm, '');  // JS de línea completa

let pasadas = 0;
const prueba = (nombre, fn) => {
  try { fn(); pasadas++; console.log(`  ✓ ${nombre}`); }
  catch (e) { console.error(`  ✗ ${nombre}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('\nBloque 5c/C-bis — el registro escribe el rol vigente\n');

// ── rolParaGuardar ────────────────────────────────────────────────────

prueba('el valor viejo se traduce al vigente', () => {
  assert.equal(rolParaGuardar('supervisor'), ROL_MAESTRO);
});

prueba('el valor vigente pasa tal cual', () => {
  assert.equal(rolParaGuardar(ROL_MAESTRO), ROL_MAESTRO);
  assert.equal(rolParaGuardar(ROL_INGENIERO), ROL_INGENIERO);
});

prueba('NUNCA devuelve el valor viejo, venga como venga', () => {
  for (const entrada of ['supervisor', ROL_MAESTRO]) {
    assert.notEqual(rolParaGuardar(entrada), 'supervisor');
  }
});

prueba('los roles muertos del bloque 2 no resucitan', () => {
  for (const muerto of ['jefe_cuadrilla', 'jefeCuadrilla', 'admin']) {
    assert.throws(() => rolParaGuardar(muerto), /Rol inválido/);
  }
});

prueba('lo desconocido LANZA en vez de acomodarse a un valor por defecto', () => {
  for (const basura of ['', null, undefined, 'INGENIERO', 'maestro ', 42, {}]) {
    assert.throws(() => rolParaGuardar(basura), /Rol inválido/,
      `debió rechazar ${JSON.stringify(basura)}`);
  }
});

prueba('rechazar es lo correcto: un rol por defecto sería permiso no decidido', () => {
  // Si algún día esto devolviera ROL_MAESTRO ante basura en vez de lanzar,
  // un formulario roto crearía cuentas silenciosamente. Falla ruidosa.
  let lanzo = false;
  try { rolParaGuardar('cualquier-cosa'); } catch { lanzo = true; }
  assert.equal(lanzo, true);
});

prueba('lo que sale de rolParaGuardar siempre está en ROLES', () => {
  for (const entrada of ['supervisor', 'maestro', 'ingeniero']) {
    assert.ok(ROLES.includes(rolParaGuardar(entrada)));
  }
});

prueba('escribir y volver a leer da el mismo rol (ida y vuelta)', () => {
  // rolParaGuardar escribe · normalizarRol lee. Son espejo.
  for (const entrada of ['supervisor', 'maestro', 'ingeniero']) {
    const guardado = rolParaGuardar(entrada);
    assert.equal(normalizarRol(guardado), guardado);
  }
});

// ── El HTML ya no sabe cómo se llama un rol ───────────────────────────

prueba('index.html no ejecuta ningún identificador de rol literal', () => {
  const html = leerSinComentarios('public/index.html');
  assert.ok(!/data-rol=/.test(html),
    'quedó un data-rol escrito a mano en el HTML');
  assert.ok(html.includes('id="rol-selector"'),
    'falta el contenedor que llena el controlador');
});

prueba('index.html no lleva el valor viejo fuera de los comentarios', () => {
  assert.ok(!/supervisor/i.test(leerSinComentarios('public/index.html')));
});

prueba('el contenedor del selector está vacío en el HTML', () => {
  const html = leer('public/index.html');
  assert.match(html, /<div class="rol-selector" id="rol-selector"><\/div>/);
});

// ── El controlador lo pinta desde roles.js ────────────────────────────

prueba('login-controller importa los roles en vez de escribirlos', () => {
  const js = leer('public/js/login-controller.js');
  assert.match(js, /import \{[^}]*ROLES[^}]*\} from '\.\/roles\.js'/);
  assert.match(js, /import \{[^}]*ETIQUETA_ROL[^}]*\} from '\.\/roles\.js'/);
});

prueba('login-controller no escribe ningún rol literal', () => {
  const js = leerSinComentarios('public/js/login-controller.js');
  assert.ok(!/['"]supervisor['"]/.test(js), 'quedó un rol literal viejo');
  assert.ok(!/dataset\.rol\s*=\s*['"]/.test(js), 'quedó un rol literal asignado');
});

prueba('hay un ícono por cada rol vigente', () => {
  const js = leer('public/js/login-controller.js');
  const bloque = js.slice(js.indexOf('ICONO_ROL'), js.indexOf('ICONO_ROL') + 200);
  for (const rol of ROLES) {
    assert.ok(bloque.includes(`[${rol === ROL_INGENIERO ? 'ROL_INGENIERO' : 'ROL_MAESTRO'}]`),
      `falta el ícono de ${rol}`);
  }
});

prueba('cada rol vigente tiene etiqueta y ninguna dice "Supervisor"', () => {
  for (const rol of ROLES) {
    assert.ok(ETIQUETA_ROL[rol], `falta la etiqueta de ${rol}`);
    assert.doesNotMatch(ETIQUETA_ROL[rol], /supervisor/i);
  }
});

// ── auth.js escribe por la puerta única ───────────────────────────────

prueba('auth.js no escribe el rol crudo en Firestore', () => {
  const js = leer('public/js/auth.js');
  assert.match(js, /rol:\s*rolParaGuardar\(rol\)/,
    'crearDocumentoUsuario debe pasar el rol por rolParaGuardar');
  assert.ok(!/^\s*rol,\s*\/\//m.test(js), 'quedó el rol pasando crudo');
});

prueba('auth.js importa rolParaGuardar', () => {
  assert.match(leer('public/js/auth.js'),
    /import \{[^}]*rolParaGuardar[^}]*\} from '\.\/roles\.js'/);
});

console.log(`\n  ${pasadas}/17 pruebas pasadas\n`);
