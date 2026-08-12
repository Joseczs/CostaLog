// test/deuda18.mjs — Prueba de aceptación de la deuda 18.
//     node test/deuda18.mjs
//
// Dos clases de prueba, a propósito:
//
//   1. Sobre `public/js/nuevoProyecto.js` — funciones puras, se importan y
//      se ejercen. Es la lógica de cómo nace un proyecto.
//   2. Sobre el TEXTO FUENTE de los dos archivos que creaban proyectos a
//      mano. Las de la clase 1 pueden pasar enteras mientras alguien deja
//      un `addDoc(collection(db, 'proyectos'), …)` olvidado al lado; el
//      escaneo es lo que hace que la deuda no pueda reabrirse sin que una
//      prueba se ponga roja. Mismo mecanismo que `bloque5ce.mjs` usa para
//      que no vuelva a aparecer un `ROL_SUPERVISOR`.
//
// Lo que NO se prueba acá: que Firestore acepte la escritura. Las reglas
// no corren en Node y este bloque no las toca — `allow create: if
// esIngeniero()` ya cubre `proyectos` desde el bloque 2, y `supervisorIds`
// es un campo más dentro de esa misma escritura.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  normalizarSupervisorIds,
  documentoProyectoNuevo,
  sinMaestroAsignado,
  supervisorIdsHeredadosDelExcel,
  modeloMaestrosParaAlta,
  avisoProyectosSinMaestro,
} from '../public/js/nuevoProyecto.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const MAESTROS = [
  { id: 'm-ana', nombre: 'Ana Rojas', email: 'ana@obra.cr' },
  { id: 'm-beto', nombre: 'Beto Solís', telefono: '+50688887777' },
  { id: 'm-carla', nombre: 'Carla Mora' },
];

console.log('\n── normalizarSupervisorIds ──────────────────────────────────');

prueba('un uid repetido no cuenta dos veces', () => {
  assert.deepEqual(normalizarSupervisorIds(['m-ana', 'm-ana']), ['m-ana']);
});

prueba('los vacíos, nulos y espacios se caen', () => {
  assert.deepEqual(
    normalizarSupervisorIds(['m-ana', '', null, undefined, '   ', 'm-beto']),
    ['m-ana', 'm-beto']
  );
});

prueba('lo que no es arreglo devuelve arreglo vacío, no explota', () => {
  assert.deepEqual(normalizarSupervisorIds(undefined), []);
  assert.deepEqual(normalizarSupervisorIds(null), []);
  assert.deepEqual(normalizarSupervisorIds('m-ana'), []);
});

prueba('se respeta el orden de aparición', () => {
  assert.deepEqual(
    normalizarSupervisorIds(['m-carla', 'm-ana', 'm-carla', 'm-beto']),
    ['m-carla', 'm-ana', 'm-beto']
  );
});

console.log('\n── documentoProyectoNuevo ───────────────────────────────────');

prueba('SIEMPRE trae supervisorIds, aunque nadie lo mande — el corazón de la deuda', () => {
  const doc = documentoProyectoNuevo({ nombre: 'Torre Norte' });
  assert.ok('supervisorIds' in doc, 'falta el campo entero');
  assert.deepEqual(doc.supervisorIds, []);
});

prueba('sin argumentos tampoco se cae', () => {
  const doc = documentoProyectoNuevo();
  assert.deepEqual(doc.supervisorIds, []);
  assert.equal(doc.nombre, '');
});

prueba('los strings llegan recortados', () => {
  const doc = documentoProyectoNuevo({
    codigo: '  TN-01 ', nombre: ' Torre Norte  ', ubicacion: ' Escazú ',
  });
  assert.equal(doc.codigo, 'TN-01');
  assert.equal(doc.nombre, 'Torre Norte');
  assert.equal(doc.ubicacion, 'Escazú');
});

prueba('NO pone activo ni createdAt: eso es del repo, y en un solo lugar', () => {
  const doc = documentoProyectoNuevo({ nombre: 'X' });
  assert.ok(!('activo' in doc), 'activo duplicado fuera del repo');
  assert.ok(!('createdAt' in doc), 'createdAt duplicado fuera del repo');
});

prueba('`extra` deja pasar creadoDesdeExcel sin abrirle la puerta a otra cosa', () => {
  const doc = documentoProyectoNuevo({
    nombre: 'Del Excel', extra: { creadoDesdeExcel: true },
  });
  assert.equal(doc.creadoDesdeExcel, true);
});

prueba('el estado por omisión es incompleto, no activo', () => {
  // Un proyecto que nace sin ubicación no está listo; que el valor por
  // omisión sea el pesimista es lo que hace que el ⚠️ del dashboard
  // aparezca solo.
  assert.equal(documentoProyectoNuevo({ nombre: 'X' }).estado, 'incompleto');
});

prueba('los supervisorIds que entran sucios salen limpios', () => {
  const doc = documentoProyectoNuevo({
    nombre: 'X', supervisorIds: ['m-ana', 'm-ana', '', 'm-beto'],
  });
  assert.deepEqual(doc.supervisorIds, ['m-ana', 'm-beto']);
});

console.log('\n── sinMaestroAsignado ───────────────────────────────────────');

prueba('arreglo vacío es "no lo ve nadie"', () => {
  assert.equal(sinMaestroAsignado({ supervisorIds: [] }), true);
});

prueba('campo ausente es "no lo ve nadie" — igual que vacío, y por eso [] no arreglaba nada', () => {
  // Es la cuenta que corrige el diagnóstico de la deuda: para Firestore,
  // `array-contains` contra un campo ausente y contra `[]` devuelven lo
  // mismo. Si esta prueba y la anterior no dieran igual, el módulo estaría
  // fingiendo una diferencia que la base de datos no tiene.
  assert.equal(sinMaestroAsignado({}), true);
  assert.equal(sinMaestroAsignado(undefined), true);
});

prueba('con un maestro, no se avisa', () => {
  assert.equal(sinMaestroAsignado({ supervisorIds: ['m-ana'] }), false);
});

prueba('un uid vacío no cuenta como maestro asignado', () => {
  assert.equal(sinMaestroAsignado({ supervisorIds: ['', '  '] }), true);
});

console.log('\n── supervisorIdsHeredadosDelExcel ───────────────────────────');

const proyectosNuevos = new Map([
  ['Torre Norte', { nombre: 'Torre Norte', codigoSugerido: 'OT-1' }],
  ['Almacén Sur', { nombre: 'Almacén Sur', codigoSugerido: 'OT-9' }],
]);

const FILAS = [
  { proyecto: 'Torre Norte', jefeCuadrillaId: 'm-ana', proyectoExistenteId: null },
  { proyecto: 'Torre Norte', jefeCuadrillaId: 'm-beto', proyectoExistenteId: null },
  { proyecto: 'Torre Norte', jefeCuadrillaId: 'm-ana', proyectoExistenteId: null },
  { proyecto: 'Almacén Sur', jefeCuadrillaId: 'm-carla', proyectoExistenteId: null },
  { proyecto: 'Bodegas', jefeCuadrillaId: 'm-ana', proyectoExistenteId: 'p-existente' },
];

prueba('un proyecto con tres filas de dos jefes hereda los dos, sin repetir', () => {
  const r = supervisorIdsHeredadosDelExcel(FILAS, proyectosNuevos);
  assert.deepEqual(r['Torre Norte'], ['m-ana', 'm-beto']);
});

prueba('cada proyecto hereda solo de SUS filas', () => {
  const r = supervisorIdsHeredadosDelExcel(FILAS, proyectosNuevos);
  assert.deepEqual(r['Almacén Sur'], ['m-carla']);
});

prueba('un proyecto que YA existía no aparece: el Excel no reasigna nada (D-18-05)', () => {
  const r = supervisorIdsHeredadosDelExcel(FILAS, proyectosNuevos);
  assert.ok(!('Bodegas' in r), 'la importación le tocó las asignaciones a un proyecto existente');
});

prueba('todo proyecto anunciado sale en el mapa, aunque sea con lista vacía', () => {
  // Si un nombre faltara del mapa, `crearProyectosFaltantes` leería
  // `undefined` y `documentoProyectoNuevo` lo volvería `[]` igual — pero
  // el aviso de D-18-04 nunca se dispararía, que es justo el caso donde
  // más hace falta.
  const r = supervisorIdsHeredadosDelExcel([], proyectosNuevos);
  assert.deepEqual(Object.keys(r).sort(), ['Almacén Sur', 'Torre Norte']);
  assert.deepEqual(r['Torre Norte'], []);
});

prueba('una fila sin jefe no aporta un hueco al arreglo', () => {
  const r = supervisorIdsHeredadosDelExcel(
    [{ proyecto: 'Torre Norte', jefeCuadrillaId: '', proyectoExistenteId: null }],
    proyectosNuevos
  );
  assert.deepEqual(r['Torre Norte'], []);
});

prueba('acepta un Set de nombres además del Map, sin obligar al llamador', () => {
  const r = supervisorIdsHeredadosDelExcel(FILAS, new Set(['Almacén Sur']));
  assert.deepEqual(r, { 'Almacén Sur': ['m-carla'] });
});

console.log('\n── modeloMaestrosParaAlta ───────────────────────────────────');

prueba('una fila por maestro, con nombre y detalle ya resueltos', () => {
  const filas = modeloMaestrosParaAlta(MAESTROS);
  assert.equal(filas.length, 3);
  assert.deepEqual(filas[0], {
    uid: 'm-ana', nombre: 'Ana Rojas', detalle: 'ana@obra.cr', marcado: false,
  });
});

prueba('sin correo cae al teléfono; sin ninguno, cadena vacía y no "undefined"', () => {
  const filas = modeloMaestrosParaAlta(MAESTROS);
  assert.equal(filas[1].detalle, '+50688887777');
  assert.equal(filas[2].detalle, '');
});

prueba('sin ningún maestro dado de alta, lista vacía y que decida la vista', () => {
  assert.deepEqual(modeloMaestrosParaAlta([]), []);
  assert.deepEqual(modeloMaestrosParaAlta(undefined), []);
});

prueba('un documento sin id se descarta: sin uid no hay a quién asignar', () => {
  assert.equal(modeloMaestrosParaAlta([{ nombre: 'Fantasma' }]).length, 0);
});

console.log('\n── avisoProyectosSinMaestro ─────────────────────────────────');

prueba('sin nada que avisar devuelve cadena vacía, no un texto tranquilizador', () => {
  assert.equal(avisoProyectosSinMaestro([]), '');
  assert.equal(avisoProyectosSinMaestro(undefined), '');
});

prueba('con uno, el aviso lo nombra y dice a dónde ir', () => {
  const texto = avisoProyectosSinMaestro(['Torre Norte']);
  assert.match(texto, /Torre Norte/);
  assert.match(texto, /Asignar maestros/);
});

prueba('con varios, los nombra a todos', () => {
  const texto = avisoProyectosSinMaestro(['Torre Norte', 'Almacén Sur']);
  assert.match(texto, /Torre Norte/);
  assert.match(texto, /Almacén Sur/);
});

console.log('\n── el escaneo: la deuda no se puede reabrir en silencio ─────');

const FUENTES = [
  'public/ingeniero/dashboard-controller.js',
  'public/js/importarExcel.js',
];

const leer = (rel) => readFileSync(join(RAIZ, rel), 'utf8');

prueba('ningún archivo crea proyectos con addDoc directo', () => {
  const culpables = FUENTES.filter((rel) =>
    /addDoc\s*\(\s*collection\s*\(\s*db\s*,\s*['"]proyectos['"]\s*\)/.test(leer(rel))
  );
  assert.deepEqual(culpables, [], 'vuelve a haber una ruta de creación fuera del repo');
});

prueba('los dos importan proyectosRepo', () => {
  const sinRepo = FUENTES.filter((rel) => !/crearProyectosRepo/.test(leer(rel)));
  assert.deepEqual(sinRepo, []);
});

prueba('los dos arman el documento con documentoProyectoNuevo', () => {
  const sinModulo = FUENTES.filter((rel) => !/documentoProyectoNuevo/.test(leer(rel)));
  assert.deepEqual(sinModulo, []);
});

prueba('nuevoProyecto.js no importa Firestore: la mitad pura sigue siendo pura', () => {
  const fuente = leer('public/js/nuevoProyecto.js');
  assert.ok(!/from\s+['"].*firebase/.test(fuente), 'se coló un import de Firebase');
  assert.ok(!/^import /m.test(fuente), 'este módulo no debería importar nada');
});

prueba('el modal de alta tiene dónde pintar la lista y el aviso', () => {
  const html = leer('public/ingeniero/dashboard.html');
  assert.match(html, /id="lista-maestros-alta"/);
  assert.match(html, /id="seccion-maestros-alta"/);
  assert.match(html, /id="aviso-proyecto"/);
});

console.log(`\n${pasadas} pruebas pasadas.\n`);
