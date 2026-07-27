// test/bloque5b.mjs — Prueba de aceptación del bloque 5b.
//     node test/bloque5b.mjs
//
// La lógica de alcance se prueba acá, sin red. Lo que NO se puede probar en
// Node son las reglas: eso se verifica en producción con dos cuentas, y está
// en el checklist del bloque.

import assert from 'node:assert/strict';

/* ══════════════════════════════════════════════════════════════════════
   Reimplementación de las tres decisiones, para poder probarlas sin
   Firestore. Si alguna cambia en el repositorio, estas pruebas quedan
   mintiendo — por eso son idénticas línea a línea a las del código.
   ══════════════════════════════════════════════════════════════════════ */

/** Lo que hace `listar({ soloDe })` en memoria, sin la consulta. */
function filtrarProyectos(proyectos, soloDe) {
  const visibles = soloDe
    ? proyectos.filter((p) => Array.isArray(p.supervisorIds) && p.supervisorIds.includes(soloDe))
    : proyectos;
  return visibles
    .filter((p) => p.activo !== false)
    .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
}

/** Lo que hace `asignarSupervisores` antes de escribir. */
function limpiarIds(ids) {
  if (!Array.isArray(ids)) throw new Error('supervisorIds tiene que ser un arreglo');
  return [...new Set(ids.filter(Boolean))];
}

/** La regla del servidor, en JavaScript. */
function puedeVerProyecto(proyecto, perfil) {
  if (perfil.rol === 'ingeniero') return true;
  if (perfil.rol !== 'supervisor') return false;
  if (!proyecto || !Array.isArray(proyecto.supervisorIds)) return false; // fail-closed
  return proyecto.supervisorIds.includes(perfil.uid);
}

const PROYECTOS = [
  { id: 'p1', nombre: 'Torre Norte', supervisorIds: ['sup-a'], activo: true },
  { id: 'p2', nombre: 'Almacén Sur', supervisorIds: ['sup-b'], activo: true },
  { id: 'p3', nombre: 'Bodegas', supervisorIds: ['sup-a', 'sup-b'], activo: true },
  { id: 'p4', nombre: 'Sin asignar', supervisorIds: [], activo: true },
  { id: 'p5', nombre: 'Viejo, sin campo', activo: true },
  { id: 'p6', nombre: 'Desactivado', supervisorIds: ['sup-a'], activo: false },
];

const ING = { uid: 'ing-1', rol: 'ingeniero' };
const SUP_A = { uid: 'sup-a', rol: 'supervisor' };
const SUP_B = { uid: 'sup-b', rol: 'supervisor' };

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

console.log('\nBloque 5b — alcance por supervisor\n');

// ── La asimetría, que es el corazón del bloque ─────────────────────────

prueba('el ingeniero ve TODOS los proyectos activos', () => {
  const vistos = filtrarProyectos(PROYECTOS, null).map((p) => p.id);
  assert.deepEqual(vistos.sort(), ['p1', 'p2', 'p3', 'p4', 'p5']);
});

prueba('el supervisor ve SOLO donde está asignado', () => {
  assert.deepEqual(filtrarProyectos(PROYECTOS, 'sup-a').map((p) => p.id).sort(), ['p1', 'p3']);
  assert.deepEqual(filtrarProyectos(PROYECTOS, 'sup-b').map((p) => p.id).sort(), ['p2', 'p3']);
});

prueba('un proyecto puede tener DOS supervisores', () => {
  assert.ok(filtrarProyectos(PROYECTOS, 'sup-a').some((p) => p.id === 'p3'));
  assert.ok(filtrarProyectos(PROYECTOS, 'sup-b').some((p) => p.id === 'p3'));
});

prueba('un supervisor puede tener DOS proyectos (§6.2)', () => {
  assert.equal(filtrarProyectos(PROYECTOS, 'sup-a').length, 2);
});

prueba('un supervisor sin asignaciones no ve nada, y eso no es un error', () => {
  assert.deepEqual(filtrarProyectos(PROYECTOS, 'sup-nuevo'), []);
});

// ── Fail-closed: la decisión de fondo ──────────────────────────────────

prueba('un proyecto SIN el campo no lo ve ningún supervisor', () => {
  assert.equal(puedeVerProyecto({ id: 'p5', activo: true }, SUP_A), false);
  assert.ok(!filtrarProyectos(PROYECTOS, 'sup-a').some((p) => p.id === 'p5'));
});

prueba('un proyecto sin el campo SÍ lo ve el ingeniero', () => {
  assert.equal(puedeVerProyecto({ id: 'p5', activo: true }, ING), true);
});

prueba('un arreglo vacío tampoco abre el proyecto a nadie', () => {
  assert.equal(puedeVerProyecto({ supervisorIds: [] }, SUP_A), false);
});

prueba('estar asignado a un proyecto no da acceso a otro', () => {
  const p1 = PROYECTOS.find((p) => p.id === 'p1');
  assert.equal(puedeVerProyecto(p1, SUP_A), true);
  assert.equal(puedeVerProyecto(p1, SUP_B), false, 'sup-b no debería ver Torre Norte');
});

prueba('un rol desconocido no ve nada', () => {
  assert.equal(puedeVerProyecto(PROYECTOS[0], { uid: 'x', rol: 'jefe_cuadrilla' }), false);
  assert.equal(puedeVerProyecto(PROYECTOS[0], { uid: 'x', rol: undefined }), false);
});

// ── El soft-delete sigue mandando ──────────────────────────────────────

prueba('un proyecto desactivado no aparece ni estando asignado', () => {
  assert.ok(!filtrarProyectos(PROYECTOS, 'sup-a').some((p) => p.id === 'p6'));
});

// ── asignarSupervisores ────────────────────────────────────────────────

prueba('los uid repetidos se colapsan', () => {
  assert.deepEqual(limpiarIds(['a', 'b', 'a']), ['a', 'b']);
});

prueba('los vacíos y nulos se descartan', () => {
  assert.deepEqual(limpiarIds(['a', '', null, undefined, 'b']), ['a', 'b']);
});

prueba('un arreglo vacío es válido: es "quitar a todos"', () => {
  assert.deepEqual(limpiarIds([]), []);
});

prueba('algo que no es arreglo se rechaza, no se envuelve', () => {
  assert.throws(() => limpiarIds('sup-a'));
  assert.throws(() => limpiarIds(null));
});

// ── El orden se mantiene en memoria ────────────────────────────────────

prueba('el orden por nombre se hace en memoria, no con orderBy', () => {
  const nombres = filtrarProyectos(PROYECTOS, null).map((p) => p.nombre);
  assert.deepEqual(nombres, [...nombres].sort((a, b) => a.localeCompare(b, 'es')));
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
