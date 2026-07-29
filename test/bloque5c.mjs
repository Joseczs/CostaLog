// test/bloque5c.mjs — Prueba de aceptación del bloque 5c, fase C.
//     node test/bloque5c.mjs
//
// Lo que se prueba es la tolerancia: una cuenta con el rol viejo y una con
// el nuevo tienen que comportarse IDÉNTICO. Eso es lo que permite que las
// fases B y C no sean simultáneas.

import assert from 'node:assert/strict';
import {
  ROL_INGENIERO,
  ROL_MAESTRO,
  ROL_SUPERVISOR,
  ROLES,
  ETIQUETA_ROL,
  HOME_POR_ROL,
  normalizarRol,
  esIngeniero,
  esMaestro,
  esSupervisor,
  esRolValido,
} from '../public/js/roles.js';

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

console.log('\nBloque 5c fase C — roles.js tolerante\n');

// ── Los identificadores ────────────────────────────────────────────────

prueba("el rol se llama 'maestro'", () => {
  assert.equal(ROL_MAESTRO, 'maestro');
  assert.equal(ROL_INGENIERO, 'ingeniero');
});

prueba('ROLES lleva los dos vigentes, no el viejo', () => {
  assert.deepEqual([...ROLES], ['ingeniero', 'maestro']);
  assert.ok(!ROLES.includes('supervisor'));
});

prueba('ROL_SUPERVISOR sobrevive como alias y apunta al nuevo', () => {
  assert.equal(ROL_SUPERVISOR, ROL_MAESTRO);
});

// ── La tolerancia, que es el punto del bloque ──────────────────────────

prueba("'supervisor' se traduce a 'maestro'", () => {
  assert.equal(normalizarRol('supervisor'), 'maestro');
});

prueba("'maestro' se queda igual: normalizar es idempotente", () => {
  assert.equal(normalizarRol('maestro'), 'maestro');
  assert.equal(normalizarRol(normalizarRol('supervisor')), 'maestro');
});

prueba("'ingeniero' no se toca", () => {
  assert.equal(normalizarRol('ingeniero'), 'ingeniero');
});

prueba('un valor desconocido se devuelve tal cual, sin inventarle un rol', () => {
  assert.equal(normalizarRol('jefe_cuadrilla'), 'jefe_cuadrilla');
  assert.equal(normalizarRol('admin'), 'admin');
  assert.equal(normalizarRol(undefined), undefined);
});

prueba('las dos cuentas, migrada y sin migrar, se comportan IDÉNTICO', () => {
  const sinMigrar = { uid: 'x', rol: 'supervisor' };
  const migrada = { uid: 'x', rol: 'maestro' };
  assert.equal(esMaestro(sinMigrar), esMaestro(migrada));
  assert.equal(esIngeniero(sinMigrar), esIngeniero(migrada));
  assert.equal(esRolValido(sinMigrar.rol), esRolValido(migrada.rol));
  // Es exactamente lo que faltaba cuando la fase B rebotó a Test 1: las
  // reglas lo aceptaban y el guardia de interfaz no.
  assert.equal(esMaestro(sinMigrar), true);
});

// ── Los roles muertos siguen muertos ───────────────────────────────────

prueba('jefe_cuadrilla y admin no conceden nada', () => {
  for (const rol of ['jefe_cuadrilla', 'jefeCuadrilla', 'admin', '', null, undefined]) {
    assert.equal(esRolValido(rol), false, `${rol} no debería ser válido`);
    assert.equal(esIngeniero({ rol }), false);
    assert.equal(esMaestro({ rol }), false);
  }
});

prueba('la tolerancia NO reabre roles viejos: es un rol con dos nombres', () => {
  assert.equal(esRolValido('supervisor'), true);
  assert.equal(esRolValido('jefe_cuadrilla'), false);
});

// ── Predicados ─────────────────────────────────────────────────────────

prueba('esSupervisor sigue siendo el mismo predicado que esMaestro', () => {
  assert.equal(esSupervisor, esMaestro);
});

prueba('un perfil nulo no revienta', () => {
  assert.equal(esIngeniero(null), false);
  assert.equal(esMaestro(undefined), false);
  assert.equal(esMaestro({}), false);
});

// ── Etiquetas y rutas ──────────────────────────────────────────────────

prueba('la etiqueta visible dice Maestro de Obras', () => {
  assert.equal(ETIQUETA_ROL[ROL_MAESTRO], 'Maestro de Obras');
  assert.equal(ETIQUETA_ROL[ROL_INGENIERO], 'Ingeniero Residente');
});

prueba('cada rol tiene su home, y los directorios siguen invertidos', () => {
  assert.equal(HOME_POR_ROL[ROL_INGENIERO], '/supervisor/dashboard.html');
  assert.equal(HOME_POR_ROL[ROL_MAESTRO], '/jefe/mis-tareas.html');
});

prueba('todo rol de ROLES tiene etiqueta y home', () => {
  for (const rol of ROLES) {
    assert.ok(ETIQUETA_ROL[rol], `falta etiqueta de ${rol}`);
    assert.ok(HOME_POR_ROL[rol], `falta home de ${rol}`);
  }
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
