// test/bloque5b2.mjs — Prueba de aceptación del bloque 5b-2.
//     node test/bloque5b2.mjs
//
// Las funciones se IMPORTAN del controlador real, no se reimplementan: la
// mitad de navegador de ese archivo solo arranca si existe `#tabla-maestros`,
// que en Node no existe. Es el mismo mecanismo del 4b y del 5.
//
// Lo que NO se prueba acá son las reglas de Firestore: no se ejecutan en
// Node. Este bloque no las toca —el guardia es del 5b, ya verificado en
// producción— y por eso no hay corrida del simulador en su checklist.

import assert from 'node:assert/strict';

import {
  proyectosAsignables,
  etiquetaProyecto,
  modeloAsignacion,
  uidsSeleccionados,
  hayCambios,
  textoResumen,
} from '../public/ingeniero/asignar-supervisores-controller.js';

const MAESTROS = [
  { id: 'm-ana', nombre: 'Ana Rojas', email: 'ana@obra.cr' },
  { id: 'm-beto', nombre: 'Beto Solís', telefono: '+50688887777' },
  { id: 'm-carla', nombre: 'Carla Mora' },
];

const PROYECTOS = [
  { id: 'p1', nombre: 'Torre Norte', codigo: 'TN-01', activo: true, supervisorIds: ['m-ana'] },
  { id: 'p2', nombre: 'Almacén Sur', activo: true, supervisorIds: [] },
  { id: 'p3', nombre: 'Bodegas', activo: false, supervisorIds: ['m-beto'] },
  { id: 'p4', nombre: 'Nacido del dashboard' },   // sin `supervisorIds` (deuda 18)
];

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

console.log('\nBloque 5b-2 — pantalla de asignación de Maestros de Obra\n');

// ── D-5b2-05: los proyectos desactivados no se ofrecen ──────────────────

prueba('un proyecto con activo:false no se puede elegir', () => {
  assert.deepEqual(proyectosAsignables(PROYECTOS).map((p) => p.id).sort(), ['p2', 'p1', 'p4'].sort());
});

prueba('activo ausente cuenta como activo — principio 4', () => {
  assert.ok(proyectosAsignables(PROYECTOS).some((p) => p.id === 'p4'));
});

prueba('el orden por nombre se hace en memoria', () => {
  const nombres = proyectosAsignables(PROYECTOS).map((p) => p.nombre);
  assert.deepEqual(nombres, [...nombres].sort((a, b) => a.localeCompare(b, 'es')));
});

prueba('la etiqueta usa el código cuando existe y el nombre cuando no', () => {
  assert.equal(etiquetaProyecto(PROYECTOS[0]), 'TN-01 — Torre Norte');
  assert.equal(etiquetaProyecto(PROYECTOS[1]), 'Almacén Sur');
});

// ── El modelo de la tabla ───────────────────────────────────────────────

prueba('una fila por maestro, marcadas las que están en supervisorIds', () => {
  const { filas } = modeloAsignacion(MAESTROS, ['m-beto']);
  assert.equal(filas.length, 3);
  assert.deepEqual(filas.map((f) => f.marcado), [false, true, false]);
});

prueba('un proyecto SIN el campo se ve como cero asignados, no como error', () => {
  const { filas, huerfanos } = modeloAsignacion(MAESTROS, undefined);
  assert.equal(huerfanos, 0);
  assert.equal(uidsSeleccionados(filas).length, 0);
});

prueba('los uid vacíos del arreglo guardado se ignoran', () => {
  const { filas, huerfanos } = modeloAsignacion(MAESTROS, ['', null, 'm-ana']);
  assert.equal(huerfanos, 0);
  assert.deepEqual(uidsSeleccionados(filas), ['m-ana']);
});

// ── Los huérfanos: ni escondidos ni conservados en silencio ─────────────

prueba('un uid asignado que ya no es maestro aparece como fila marcada', () => {
  const { filas, huerfanos } = modeloAsignacion(MAESTROS, ['m-ana', 'ex-maestro']);
  assert.equal(huerfanos, 1);
  const fila = filas.find((f) => f.uid === 'ex-maestro');
  assert.ok(fila, 'el huérfano tiene que estar en la tabla');
  assert.equal(fila.marcado, true, 'está asignado hoy: nace marcado');
  assert.equal(fila.vigente, false);
  assert.ok(fila.aviso.length > 0, 'nunca aparece sin explicación');
});

prueba('sin nombre conocido, la fila muestra el uid y no queda muda', () => {
  const { filas } = modeloAsignacion(MAESTROS, ['ex-maestro']);
  const fila = filas.find((f) => f.uid === 'ex-maestro');
  assert.equal(fila.nombre, 'ex-maestro');
});

prueba('con el documento a mano, se muestra el nombre real', () => {
  const { filas } = modeloAsignacion(MAESTROS, ['ex-maestro'], {
    'ex-maestro': { nombre: 'Dora Vega', email: 'dora@obra.cr' },
  });
  const fila = filas.find((f) => f.uid === 'ex-maestro');
  assert.equal(fila.nombre, 'Dora Vega');
  assert.match(fila.aviso, /Maestro de Obras/);
});

prueba('el huérfano NO se pierde al guardar sin tocarlo', () => {
  const { filas } = modeloAsignacion(MAESTROS, ['m-ana', 'ex-maestro']);
  assert.deepEqual(uidsSeleccionados(filas).sort(), ['ex-maestro', 'm-ana']);
});

// ── hayCambios: conjuntos, no longitudes ────────────────────────────────

prueba('sin cambios, no se puede guardar', () => {
  assert.equal(hayCambios(['a', 'b'], ['b', 'a']), false);
});

prueba('cambiar un maestro por otro ES un cambio, aunque el largo no cambie', () => {
  assert.equal(hayCambios(['a', 'b'], ['a', 'c']), true);
});

prueba('agregar y quitar se detectan', () => {
  assert.equal(hayCambios(['a'], ['a', 'b']), true);
  assert.equal(hayCambios(['a', 'b'], ['a']), true);
});

prueba('vaciar la lista es un cambio, no un "no pasó nada"', () => {
  assert.equal(hayCambios(['a'], []), true);
  assert.equal(hayCambios([], []), false);
});

// ── El resumen nunca queda mudo ─────────────────────────────────────────

prueba('el resumen cuenta asignados sobre el total de maestros vigentes', () => {
  const { filas } = modeloAsignacion(MAESTROS, ['m-ana']);
  assert.match(textoResumen(filas), /1 de 3/);
});

prueba('cero asignados avisa que el proyecto es invisible para el campo', () => {
  const { filas } = modeloAsignacion(MAESTROS, []);
  assert.match(textoResumen(filas), /invisible/);
});

prueba('los huérfanos se cuentan aparte y no inflan el total', () => {
  const { filas } = modeloAsignacion(MAESTROS, ['m-ana', 'ex-maestro']);
  const texto = textoResumen(filas);
  assert.match(texto, /2 de 3/);          // 2 marcados, 3 maestros vigentes
  assert.match(texto, /sin usuario vigente/);
});

prueba('sin ningún maestro dado de alta se dice, no se pinta una tabla vacía', () => {
  const { filas } = modeloAsignacion([], []);
  assert.match(textoResumen(filas), /No hay ningún Maestro de Obras/);
});

// ── La invariante del repo, vista desde la pantalla ─────────────────────

prueba('lo que se manda es el arreglo COMPLETO de lo marcado, en orden', () => {
  const { filas } = modeloAsignacion(MAESTROS, ['m-ana', 'm-carla']);
  filas.find((f) => f.uid === 'm-ana').marcado = false;
  filas.find((f) => f.uid === 'm-beto').marcado = true;
  assert.deepEqual(uidsSeleccionados(filas), ['m-beto', 'm-carla']);
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
