// ═══════════════════════════════════════════════════════════════════════
// nuevoProyecto.js — Deuda 18. Cómo nace un proyecto.
//
// ── Qué estaba mal, y qué NO arregla escribir `supervisorIds: []` ─────
// La deuda decía "dos archivos crean proyectos sin `supervisorIds`". Es
// cierto, pero el diagnóstico se queda corto: para Firestore, un
// `array-contains` contra un campo AUSENTE y contra un arreglo VACÍO
// devuelven exactamente lo mismo —nada—, así que agregar `[]` no le hace
// visible el proyecto a nadie. Escribir el campo vacío y declarar la
// deuda pagada habría sido cambiar el síntoma de lugar.
//
// Lo que duele es otra cosa: TODO proyecto nacido fuera de la pantalla
// del 5b-2 nace invisible para todos los Maestros de Obra, y alguien
// tiene que acordarse de ir a asignarlo. Es un paso manual permanente que
// falla en silencio —el proyecto existe, se ve en el dashboard, y el
// maestro simplemente no lo tiene—, que es la peor forma de fallar.
//
// Por eso este módulo hace dos cosas y no una:
//   1. Normaliza el documento del proyecto, con `supervisorIds` SIEMPRE
//      presente y siempre limpio (D-18-01).
//   2. Deriva a quién asignarle desde lo que ya se sabe en el momento de
//      crearlo (D-18-02 en el dashboard, D-18-03 en el Excel), y cuando
//      no se sabe nada, lo DICE (D-18-04).
//
// ── Por qué es un archivo aparte y no dos copias ─────────────────────
// Las dos rutas de creación —el modal del dashboard y la importación de
// Excel— viven en archivos distintos, los dos con listeners de DOM en el
// nivel superior, o sea imposibles de importar desde Node. Poner la
// lógica acá es lo que permite que `test/deuda18.mjs` la ejerza sin
// navegador. Mismo patrón mitad-pura/mitad-navegador de los bloques 3,
// 4b, 5 y 5b-2, con la diferencia de que acá la mitad pura la comparten
// dos consumidores, así que vive en su propio archivo.
//
// Este módulo NO importa Firestore. No escribe: arma el objeto que
// `proyectosRepo.crear()` escribe.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Deja una lista de uid lista para guardar: sin vacíos, sin duplicados,
 * en el orden en que aparecieron.
 *
 * Es la misma limpieza que hace `proyectosRepo.asignarSupervisores()`, y
 * se repite acá a propósito: el repo la hace porque es el guardia de la
 * escritura, esto la hace porque necesita CONTAR cuántos maestros quedan
 * para decidir si avisar (`sinMaestroAsignado`). Contar sobre una lista
 * con duplicados daría "1 maestro asignado" sobre el mismo uid dos veces.
 */
export function normalizarSupervisorIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((uid) => typeof uid === 'string' && uid.trim() !== ''))];
}

/**
 * El documento de un proyecto nuevo, listo para `proyectosRepo.crear()`.
 *
 * `activo` y `createdAt` NO se ponen acá: los pone el repo, que es donde
 * viven desde el bloque 1. Duplicarlos sería tener dos lugares que
 * deciden lo mismo.
 *
 * ── Los strings se recortan acá, no en cada llamador ─────────────────
 * El modal ya hacía `.trim()`; la importación de Excel también. Que lo
 * haga el módulo significa que el tercer llamador que aparezca no tiene
 * que acordarse.
 *
 * @param {{codigo?, nombre?, ubicacion?, estado?, supervisorIds?, extra?}} datos
 */
export function documentoProyectoNuevo({
  codigo = '',
  nombre = '',
  ubicacion = '',
  estado = 'incompleto',
  supervisorIds = [],
  extra = {},
} = {}) {
  return {
    codigo: String(codigo ?? '').trim(),
    nombre: String(nombre ?? '').trim(),
    ubicacion: String(ubicacion ?? '').trim(),
    estado,
    supervisorIds: normalizarSupervisorIds(supervisorIds),
    ...extra,
  };
}

/**
 * ¿Este proyecto nace sin que ningún Maestro de Obra lo vea?
 *
 * D-18-04: nacer sin maestros es LEGAL —un proyecto en licitación, uno
 * que todavía no tiene cuadrilla— pero nunca silencioso. El llamador usa
 * esto para pintar el aviso; el módulo no decide si se pinta, decide
 * cuándo hay algo que decir.
 */
export function sinMaestroAsignado(documentoProyecto) {
  return normalizarSupervisorIds(documentoProyecto?.supervisorIds).length === 0;
}

/**
 * De qué maestros hereda cada proyecto que la importación va a crear.
 * D-18-03.
 *
 * ── Por qué la columna "Jefe de Cuadrilla" es la respuesta correcta ───
 * El Excel ya trae, fila por fila, el nombre de la persona que va a
 * ejecutar esa tarea, y `validarFilas()` ya rechaza toda fila cuyo jefe
 * no exista entre los maestros activos. O sea: en el momento en que la
 * fila se declara válida, ya está resuelto el uid del Maestro de Obra que
 * TIENE que ver esa tarea para poder reportarla. Pedirle al ingeniero que
 * después entre a otra pantalla a repetir esa misma información sería
 * pedirle que copie a mano un dato que el archivo ya trajo.
 *
 * Un proyecto con tareas de tres jefes distintos hereda los tres. No es
 * una suposición: las tres personas necesitan ver el proyecto para hacer
 * su trabajo.
 *
 * Solo mira las filas VÁLIDAS. Una fila rechazada no aporta un uid —
 * puede haber sido rechazada justamente porque el jefe no existía.
 *
 * @param {Array} filasValidas — con `proyecto` y `jefeCuadrillaId`.
 * @param {Map|Iterable} proyectosNuevos — los nombres que se van a crear.
 * @returns {Object} nombre de proyecto → uid[]
 */
export function supervisorIdsHeredadosDelExcel(filasValidas, proyectosNuevos) {
  const nombresNuevos = new Set(
    proyectosNuevos instanceof Map
      ? proyectosNuevos.keys()
      : Array.from(proyectosNuevos ?? [])
  );

  const porProyecto = {};
  for (const nombre of nombresNuevos) porProyecto[nombre] = [];

  for (const fila of filasValidas ?? []) {
    if (!fila || !nombresNuevos.has(fila.proyecto)) continue;
    // Solo las filas que van al proyecto NUEVO. Una fila dirigida a un
    // proyecto que ya existía no puede cambiarle las asignaciones: eso
    // es D-18-05 —después de nacer, la única ruta de escritura es la
    // pantalla de asignación— y un archivo de Excel no la puede saltar.
    if (fila.proyectoExistenteId) continue;
    if (fila.jefeCuadrillaId) porProyecto[fila.proyecto].push(fila.jefeCuadrillaId);
  }

  for (const nombre of Object.keys(porProyecto)) {
    porProyecto[nombre] = normalizarSupervisorIds(porProyecto[nombre]);
  }
  return porProyecto;
}

/**
 * El modelo de la lista de maestros del modal "Nuevo Proyecto". D-18-02.
 *
 * Devuelve texto ya resuelto, no documentos crudos: la vista no vuelve a
 * decidir qué mostrar cuando un maestro no tiene correo. Mismo criterio
 * que `modeloAsignacion()` en el 5b-2.
 *
 * A diferencia de aquella pantalla, acá NO hay huérfanos que resolver: un
 * proyecto que todavía no existe no puede tener asignado a alguien que ya
 * no está.
 */
export function modeloMaestrosParaAlta(maestros, seleccionados = []) {
  const marcados = new Set(normalizarSupervisorIds(seleccionados));
  return (maestros ?? [])
    .filter((m) => m && m.id)
    .map((m) => ({
      uid: m.id,
      nombre: m.nombre ?? m.id,
      detalle: m.email ?? m.telefono ?? '',
      marcado: marcados.has(m.id),
    }));
}

/**
 * El aviso de los proyectos que nacieron sin maestro. D-18-04.
 *
 * Devuelve `''` cuando no hay nada que avisar, para que el llamador no
 * tenga que preguntar dos veces (`if (lista.length) …` y después el
 * texto). Cadena vacía es "no pintes nada".
 */
export function avisoProyectosSinMaestro(nombres) {
  const lista = (nombres ?? []).filter(Boolean);
  if (lista.length === 0) return '';
  const cuales = lista.join(', ');
  return lista.length === 1
    ? `El proyecto "${cuales}" quedó sin ningún Maestro de Obra asignado: ` +
      'nadie lo ve todavía en su lista. Se asigna en Asignar maestros.'
    : `Estos proyectos quedaron sin ningún Maestro de Obra asignado y ` +
      `nadie los ve todavía: ${cuales}. Se asignan en Asignar maestros.`;
}
