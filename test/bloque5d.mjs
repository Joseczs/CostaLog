// ═══════════════════════════════════════════════════════════════════════
// test/bloque5d.mjs — Bloque 5d: el rol no se lo asigna uno mismo.
//
//   node test/bloque5d.mjs
//
// ⚠️ ESTA SUITE NO PRUEBA LAS REGLAS. Fija su FORMA, no su comportamiento:
// las reglas de Firestore no se ejecutan en Node. El comportamiento se
// verifica con `node scripts/probar-reglas.js`, que fabrica sesiones
// reales y escribe contra las reglas DESPLEGADAS. Es la lección del 5b y
// del 5c/D: un guardia de servidor no se prueba desde acá.
//
// Lo que sí cubre: que el espejo entre `ROLES_REGISTRO` (código) y
// `naceComoMaestro()` (reglas) no se rompa sin que alguien se entere.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROLES, ROLES_REGISTRO, ROL_INGENIERO, ROL_MAESTRO, ETIQUETA_ROL,
} from '../public/js/roles.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');
const reglas = () => leer('firestore.rules');

/** El archivo sin comentarios: la invariante es sobre lo que se EJECUTA,
 *  no sobre lo que un comentario explica. Misma decisión que en
 *  test/bloque5c-bis.mjs — quien grepee dentro de seis meses merece
 *  encontrar el motivo y no un archivo mudo. */
function sinComentarios(ruta) {
  return leer(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/<!--[\s\S]*?-->/g, '');
}

let pasadas = 0, total = 0;
function prueba(nombre, fn) {
  total++;
  try { fn(); pasadas++; console.log(`  ✓ ${nombre}`); }
  catch (e) { console.log(`  ✗ ${nombre}\n    ${e.message}`); }
}

console.log('\nBloque 5d — el rol no se lo asigna uno mismo\n');

// ── ROLES_REGISTRO: qué se puede ofrecer al registrarse ───────────────

prueba('ROLES_REGISTRO ofrece únicamente maestro', () => {
  assert.deepEqual([...ROLES_REGISTRO], [ROL_MAESTRO]);
});

prueba('ROLES_REGISTRO está congelado', () => {
  assert.ok(Object.isFrozen(ROLES_REGISTRO));
});

prueba('el ingeniero NO se puede elegir al registrarse', () => {
  assert.ok(!ROLES_REGISTRO.includes(ROL_INGENIERO),
    'es el agujero entero: quien se lo asigna aprueba su propio avance');
});

prueba('ROLES_REGISTRO es subconjunto de ROLES, no una lista paralela', () => {
  for (const rol of ROLES_REGISTRO) {
    assert.ok(ROLES.includes(rol), `${rol} no es un rol vigente`);
    assert.ok(ETIQUETA_ROL[rol], `${rol} no tiene etiqueta que pintar`);
  }
});

prueba('el ingeniero sigue siendo un rol vigente', () => {
  // No se elimina el rol: se elimina dárselo uno mismo. Si alguien
  // "simplificara" sacándolo de ROLES, la app se queda sin quién apruebe.
  assert.ok(ROLES.includes(ROL_INGENIERO));
});

// ── El espejo con las reglas ──────────────────────────────────────────

prueba('naceComoMaestro() existe en firestore.rules', () => {
  assert.match(reglas(), /function naceComoMaestro\(\)/);
});

prueba('la regla exige el MISMO rol que ofrece ROLES_REGISTRO', () => {
  const r = reglas();
  const bloque = r.slice(r.indexOf('function naceComoMaestro()'));
  const unico = ROLES_REGISTRO[0];
  assert.ok(bloque.includes(`request.resource.data.rol == '${unico}'`),
    `la regla y ROLES_REGISTRO se desincronizaron: el formulario ofrece ` +
    `'${unico}' y la regla exige otra cosa`);
});

prueba('la regla exige que el campo rol esté PRESENTE', () => {
  const r = reglas();
  const bloque = r.slice(r.indexOf('function naceComoMaestro()'));
  assert.ok(bloque.includes("'rol' in request.resource.data"),
    'sin esto, un documento sin rol depende de que el error deniegue solo');
});

// ── create y update de usuarios/{uid} ─────────────────────────────────

prueba('create de usuarios exige naceComoMaestro()', () => {
  const r = sinComentarios('firestore.rules');
  assert.match(r, /allow create:\s*if esElMismoUsuario\(uid\) && naceComoMaestro\(\)/,
    'el create volvió a no mirar el campo rol');
});

prueba('update no deja al propio usuario tocar rol ni activo', () => {
  const r = sinComentarios('firestore.rules');
  assert.match(r, /noToca\(\['rol', 'activo'\]\)/,
    'cerrar solo el create deja el agujero abierto con una regla nueva ' +
    'encima dando la impresión de que se cerró');
});

prueba('activo está protegido junto con rol', () => {
  // habilitado() mira `activo`. Si su dueño lo puede reescribir, la
  // desactivación que hace el Ingeniero es decorativa.
  // Se busca la INVOCACIÓN `noToca([`, no la definición `noToca(campos)`:
  // la primera corrida de esta prueba agarró la definición y falló con el
  // código correcto. Cuando una expectativa choca con el código, primero
  // se verifica la especificación.
  const r = sinComentarios('firestore.rules');
  const linea = r.split('\n').find((l) => l.includes('noToca(['));
  assert.ok(linea && linea.includes("'activo'"), 'falta activo en la exclusión');
});

prueba('el ingeniero sigue pudiendo promover', () => {
  const r = sinComentarios('firestore.rules');
  assert.match(r, /allow update:\s*if esIngeniero\(\)/,
    'sin esta rama nadie puede promover a nadie nunca');
});

prueba('noToca() es el espejo de soloCambia(), no una copia', () => {
  const r = reglas();
  assert.match(r, /function noToca\(campos\)/);
  assert.match(r, /!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(campos\)/,
    'hasAny negado, no hasOnly: son cosas distintas');
});

// ── Lo que el 5d NO debía tocar ───────────────────────────────────────

prueba('sigue habiendo solo DOS lecturas de rol del perfil', () => {
  const c = reglas().match(/perfil\(\)\.rol ==/g) || [];
  assert.equal(c.length, 2,
    'la invariante del 5c/D: cada rol se compara en una sola función. ' +
    'La del 5d es distinta — lee lo que se escribe, no quién sos');
});

prueba('el alcance del bloque 5b quedó intacto', () => {
  const r = reglas();
  for (const fn of ['estaEnLaLista', 'puedeVerEsteProyecto', 'puedeVerProyecto']) {
    assert.match(r, new RegExp(`function ${fn}\\(`), `falta ${fn}()`);
  }
});

prueba('el borrado duro sigue prohibido sobre usuarios', () => {
  const r = sinComentarios('firestore.rules');
  const i = r.indexOf('match /usuarios/{uid}');
  assert.match(r.slice(i, i + 400), /allow delete:\s*if false/);
});

// ── El formulario ─────────────────────────────────────────────────────

prueba('login-controller pinta desde ROLES_REGISTRO, no desde ROLES', () => {
  const js = sinComentarios('public/js/login-controller.js');
  assert.match(js, /ROLES_REGISTRO\.forEach/,
    'pintar desde ROLES vuelve a ofrecer el ingeniero');
});

prueba('login-controller importa ROLES_REGISTRO', () => {
  assert.match(leer('public/js/login-controller.js'),
    /import \{[^}]*ROLES_REGISTRO[^}]*\} from '\.\/roles\.js'/);
});

prueba('con un solo rol elegible se preselecciona', () => {
  const js = sinComentarios('public/js/login-controller.js');
  assert.match(js, /ROLES_REGISTRO\.length === 1/,
    'un botón obligatorio de opción única es un paso que solo se puede ' +
    'hacer mal');
});

prueba('el rol se sigue PINTANDO, no solo asignando en silencio', () => {
  const js = sinComentarios('public/js/login-controller.js');
  assert.match(js, /contenedor\.appendChild\(btn\)/,
    'la persona tiene que ver con qué rol se está registrando');
});

prueba('el formulario no escribe ningún rol literal', () => {
  const js = sinComentarios('public/js/login-controller.js');
  assert.ok(!/['"](ingeniero|maestro|supervisor)['"]/.test(js));
  assert.ok(!/['"](ingeniero|maestro|supervisor)['"]/.test(sinComentarios('public/index.html')));
});

// ── probar-reglas.js: los casos nuevos, y su limpieza ─────────────────

prueba('probar-reglas.js usa un uid fabricado, no una cuenta real', () => {
  const js = leer('scripts/probar-reglas.js');
  assert.match(js, /const UID_PRUEBA = 'zz-prueba-reglas-5d'/,
    'escribir sobre cuentas reales para probar una regla es dar de alta ' +
    'un usuario de verdad y promover a alguien de verdad');
});

prueba('probar-reglas.js limpia el documento Y la cuenta de Auth', () => {
  const js = leer('scripts/probar-reglas.js');
  const bloque = js.slice(js.indexOf('async function limpiarUidDePrueba'));
  assert.match(bloque.slice(0, 300), /usuarios\/\$\{UID_PRUEBA\}`\)\.delete\(\)/);
  assert.match(bloque.slice(0, 300), /authAdmin\.deleteUser\(UID_PRUEBA\)/,
    'signInWithCustomToken CREA la cuenta en Auth: sin esto queda un ' +
    'rezagado invisible');
});

prueba('la limpieza corre pase lo que pase', () => {
  const js = leer('scripts/probar-reglas.js');
  assert.match(js, /finally \{\s*await limpiarUidDePrueba\(\)/,
    'si el script muere entre el caso 6 y el 8 queda un documento con ' +
    'rol ingeniero dando vueltas');
});

prueba('probar-reglas.js cubre los cuatro casos del 5d', () => {
  const js = leer('scripts/probar-reglas.js');
  for (const n of [5, 6, 7, 8]) {
    assert.match(js, new RegExp(`n: ${n},`), `falta el caso ${n}`);
  }
});

console.log(`\n  ${pasadas}/${total} pruebas pasadas\n`);
