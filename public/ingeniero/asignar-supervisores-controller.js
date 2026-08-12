// ═══════════════════════════════════════════════════════════════════════
// asignar-supervisores-controller.js — Bloque 5b-2.
//
// Cierra la deuda 16: hasta hoy, asignar un Maestro de Obras a un proyecto
// exigía `serviceAccountKey.json` y `node scripts/migrar-supervisor-ids.js
// --asignar <proyecto> <uid> --escribir`. Funciona para dos o tres
// proyectos; no escala a una obra real.
//
// ── El guardia ya existe. Esto es SOLO la herramienta ─────────────────
// El bloque 5b puso `supervisorIds` en el documento del proyecto y las
// reglas que lo hacen valer, con fail-closed: un proyecto sin el campo no
// lo ve ningún maestro. Este bloque NO toca `firestore.rules`. Si al
// probar apareciera "Missing or insufficient permissions" escribiendo
// `supervisorIds` como ingeniero, el problema es del 5b y no de acá.
//
// ── Lo que esta pantalla NO hace, y por qué ───────────────────────────
// • NO promueve a nadie a `ingeniero` (deuda 23). Comparte la FORMA de la
//   interfaz —una lista de personas con un control que solo el ingeniero
//   toca— y nada más: son dos colecciones y dos permisos distintos.
//   Asignar un maestro reparte visibilidad; promover a ingeniero crea otro
//   aprobador de avance, que es el contrapeso entero de D-11. Esa
//   escritura merece su propio bloque con su propio caso en
//   `scripts/probar-reglas.js`.
// • NO crea ni desactiva proyectos. Eso es el dashboard.
// • NO escribe con `arrayUnion`. Ver `asignarSupervisores` en el repo.
//
// ── Por qué está partido en dos mitades ───────────────────────────────
// Mismo patrón del 3, el 4a, el 4b y el 5: arriba funciones PURAS (sin
// DOM, sin Firestore), abajo el arranque del navegador con imports
// DIFERIDOS. Es lo que permite que `test/bloque5b2.mjs` corra en Node sin
// bajar el SDK de Firebase del CDN.
// ═══════════════════════════════════════════════════════════════════════

import { SIN_DATO } from '../js/formato.js';

/* ══════════════════════════════════════════════════════════════════════
   MITAD PURA
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Los proyectos que se pueden elegir en el selector.
 *
 * `proyectosRepo.listar()` ya filtra `activo !== false`, así que esto es
 * redundante hoy — y se deja igual. Es el principio 4 aplicado en la
 * pantalla, no una decisión nueva (D-5b2-05), y es lo que cierra la deuda
 * 17 del lado de la interfaz: `--listar` del script muestra los
 * desactivados junto a los vivos y eso ya mandó una vez a buscar un
 * problema de permisos que no existía. Asignar un maestro a un proyecto
 * borrado es trabajo que se pierde sin avisar.
 */
export function proyectosAsignables(proyectos) {
  return (proyectos ?? [])
    .filter((p) => p && p.activo !== false)
    .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
}

/** Etiqueta de un proyecto en el selector: código si lo tiene, nombre si no. */
export function etiquetaProyecto(proyecto) {
  if (!proyecto) return SIN_DATO;
  const nombre = proyecto.nombre ?? proyecto.id;
  return proyecto.codigo ? `${proyecto.codigo} — ${nombre}` : nombre;
}

/**
 * El modelo de la tabla: una fila por maestro, ya en texto.
 *
 * ── Los uid huérfanos NO se esconden ni se conservan en silencio ───────
 * `supervisorIds` puede contener el uid de alguien que ya no es Maestro de
 * Obras: promovido a ingeniero, desactivado, o borrado. Hay tres salidas y
 * dos son malas:
 *
 *   • Construir el arreglo solo con los checkbox visibles lo DESASIGNA sin
 *     que nadie lo haya decidido. `asignarSupervisores` manda el arreglo
 *     completo — lo que no está marcado, no se guarda.
 *   • Conservarlo por debajo lo vuelve invisible: un permiso vivo que
 *     ninguna pantalla muestra es exactamente lo que este bloque viene a
 *     terminar.
 *   • Pintarlo como una fila más, marcada, con la advertencia al lado.
 *
 * Se hace la tercera. El ingeniero lo ve, y si lo desmarca es porque lo
 * decidió. Mismo criterio que el 4b con un avance inválido: nunca se
 * corrige en silencio.
 *
 * @param {Object[]} maestros — de `usuariosRepo.listarMaestros()`
 * @param {string[]} supervisorIds — el arreglo guardado en el proyecto
 * @param {Object<string,Object>} [conocidos] — uid → documento de usuario,
 *        para poner nombre a los huérfanos. Sin él se muestra el uid.
 * @returns {{ filas: Object[], huerfanos: number }}
 */
export function modeloAsignacion(maestros, supervisorIds, conocidos = {}) {
  // Campo ausente ⇒ arreglo vacío. Es el fail-closed del 5b visto desde la
  // pantalla: un proyecto creado por el dashboard o por una importación de
  // Excel nace sin el campo (deuda 18) y hoy es invisible para todos los
  // maestros. Acá se ve como "0 asignados", que es la verdad.
  const asignados = new Set(Array.isArray(supervisorIds) ? supervisorIds.filter(Boolean) : []);

  const filas = (maestros ?? []).map((m) => ({
    uid: m.id,
    nombre: m.nombre ?? SIN_DATO,
    detalle: m.email ?? m.telefono ?? '',
    marcado: asignados.has(m.id),
    vigente: true,
    aviso: '',
  }));

  const conocidosEnTabla = new Set(filas.map((f) => f.uid));
  const huerfanos = [...asignados].filter((uid) => !conocidosEnTabla.has(uid));

  for (const uid of huerfanos) {
    const doc = conocidos[uid];
    filas.push({
      uid,
      nombre: doc?.nombre ?? uid,
      detalle: doc?.email ?? doc?.telefono ?? uid,
      marcado: true,
      vigente: false,
      aviso: doc
        ? 'Asignado, pero ya no figura como Maestro de Obras activo.'
        : 'Asignado, pero no existe ningún usuario con ese identificador.',
    });
  }

  return { filas, huerfanos: huerfanos.length };
}

/** Los uid marcados, en el orden de la tabla. Es lo que se manda al repo. */
export function uidsSeleccionados(filas) {
  return (filas ?? []).filter((f) => f.marcado).map((f) => f.uid);
}

/**
 * ¿Cambió algo de verdad?
 *
 * Comparación de CONJUNTOS, no de longitudes: cambiar un maestro por otro
 * deja el mismo largo y es un cambio real. Comparar `length` habría dejado
 * el botón apagado justo en ese caso.
 *
 * Sirve para dos cosas: no permitir guardar sin cambios —una escritura
 * vacía es una escritura que nadie puede explicar después— y avisar antes
 * de salir de la pantalla.
 */
export function hayCambios(inicial, actual) {
  const a = new Set(inicial ?? []);
  const b = new Set(actual ?? []);
  if (a.size !== b.size) return true;
  for (const uid of a) if (!b.has(uid)) return true;
  return false;
}

/** Resumen de una línea, arriba de la tabla. Nunca queda vacío. */
export function textoResumen(filas) {
  const total = (filas ?? []).filter((f) => f.vigente).length;
  const marcados = uidsSeleccionados(filas).length;
  const huerfanos = (filas ?? []).filter((f) => !f.vigente).length;

  if (total === 0 && huerfanos === 0) {
    return 'No hay ningún Maestro de Obras dado de alta.';
  }

  const partes = [
    `${marcados} de ${total} ${total === 1 ? 'Maestro de Obras' : 'Maestros de Obra'} asignado${marcados === 1 ? '' : 's'}`,
  ];
  if (huerfanos) {
    partes.push(`${huerfanos} asignación sin usuario vigente`);
  }
  if (marcados === 0) {
    partes.push('sin nadie asignado, este proyecto es invisible para todos los maestros');
  }
  return partes.join(' · ');
}

/* ══════════════════════════════════════════════════════════════════════
   MITAD DE NAVEGADOR
   ══════════════════════════════════════════════════════════════════════ */

if (typeof document !== 'undefined' && document.getElementById('tabla-maestros')) {
  arrancar();
}

async function arrancar() {
  const [{ ROL_INGENIERO }, { protegerPagina, cerrarSesion }, { renderSidebar },
         { db }, { crearProyectosRepo }, { crearUsuariosRepo }] = await Promise.all([
    import('../js/roles.js'),
    import('../js/auth.js'),
    import('../js/sidebar.js'),
    import('../js/firebase-config.js'),
    import('../js/repos/proyectosRepo.js'),
    import('../js/repos/usuariosRepo.js'),
  ]);

  const proyectosRepo = crearProyectosRepo(db);
  const usuariosRepo = crearUsuariosRepo(db);

  const $ = (id) => document.getElementById(id);
  const selector = $('selector-proyecto');
  const seccion = $('seccion-asignacion');
  const cuerpo = $('cuerpo-maestros');
  const resumen = $('resumen-asignacion');
  const errorCarga = $('error-carga');
  const aviso = $('aviso-guardado');
  const btnGuardar = $('btn-guardar');

  let proyectoActualId = null;   // el que se está mirando
  let generacion = 0;            // token contra carreras
  let maestros = [];             // catálogo, se carga una vez
  let filas = [];                // modelo de la tabla en curso
  let seleccionInicial = [];     // lo que dice Firestore hoy

  protegerPagina([ROL_INGENIERO], async (perfil) => {
    renderSidebar(perfil);
    $('nombre-usuario').textContent = perfil.nombre;
    await cargar();
  });

  $('btn-logout').addEventListener('click', async () => {
    await cerrarSesion();
    window.location.href = '/index.html';
  });

  // ── Carga inicial ────────────────────────────────────────────────────

  async function cargar() {
    let proyectos = [];
    try {
      [proyectos, maestros] = await Promise.all([
        proyectosRepo.listar(),
        usuariosRepo.listarMaestros(),
      ]);
    } catch (err) {
      errorCarga.textContent = `No se pudo cargar: ${err.message}`;
      return;
    }

    const asignables = proyectosAsignables(proyectos);

    if (!asignables.length) {
      errorCarga.textContent =
        'No hay proyectos activos. Creá uno desde el Dashboard antes de asignar Maestros de Obra.';
      return;
    }
    if (!maestros.length) {
      errorCarga.textContent =
        'No hay ningún Maestro de Obras dado de alta. Cada uno crea su propia cuenta desde la pantalla de ingreso.';
    }

    for (const p of asignables) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = etiquetaProyecto(p);
      selector.appendChild(opt);
    }

    // Preselección por querystring, igual que el bloque 3 y el 4a. Un id que
    // no esté en la lista se ignora en silencio.
    const pedido = new URLSearchParams(window.location.search).get('proyecto');
    if (pedido && asignables.some((p) => p.id === pedido)) {
      selector.value = pedido;
      await abrirProyecto(pedido);
      return;
    }

    // Con un solo proyecto activo se abre solo: elegir entre uno no es una
    // decisión. Con dos o más se pregunta.
    if (asignables.length === 1) {
      selector.value = asignables[0].id;
      await abrirProyecto(asignables[0].id);
      sincronizarURL(asignables[0].id);
    }
  }

  selector.addEventListener('change', async () => {
    const id = selector.value;
    if (!id) {
      seccion.style.display = 'none';
      proyectoActualId = null;
      return;
    }
    await abrirProyecto(id);
    sincronizarURL(id);
  });

  function sincronizarURL(id) {
    const url = new URL(window.location.href);
    url.searchParams.set('proyecto', id);
    window.history.replaceState({}, '', url);
  }

  // ── Abrir un proyecto ────────────────────────────────────────────────

  async function abrirProyecto(proyectoId) {
    const gen = ++generacion;
    proyectoActualId = proyectoId;
    errorCarga.textContent = '';
    aviso.textContent = '';
    aviso.className = 'aviso';
    cuerpo.innerHTML = '';
    resumen.textContent = 'Cargando…';
    seccion.style.display = 'block';
    btnGuardar.disabled = true;

    let proyecto = null;
    try {
      proyecto = await proyectosRepo.obtener(proyectoId);
    } catch (err) {
      if (gen !== generacion) return;
      resumen.textContent = '';
      errorCarga.textContent = `No se pudo abrir el proyecto: ${err.message}`;
      return;
    }

    // La carrera importa: si se cambió de proyecto mientras esto respondía,
    // lo que llegó ya no es lo que se está mirando. Sin esta guarda, dos
    // clics rápidos pintan la asignación de un proyecto bajo el nombre de
    // otro — y acá eso se guarda con el botón.
    if (gen !== generacion) return;

    if (!proyecto) {
      resumen.textContent = '';
      errorCarga.textContent = 'Ese proyecto ya no existe o fue desactivado.';
      return;
    }

    const guardados = Array.isArray(proyecto.supervisorIds) ? proyecto.supervisorIds : [];

    // Nombres de los uid asignados que no están entre los maestros activos.
    // Una lectura por huérfano, y normalmente son cero.
    const conocidosEnTabla = new Set(maestros.map((m) => m.id));
    const huerfanos = guardados.filter((uid) => uid && !conocidosEnTabla.has(uid));
    const conocidos = {};
    for (const uid of huerfanos) {
      try {
        const doc = await usuariosRepo.obtener(uid);
        if (doc) conocidos[uid] = doc;
      } catch { /* sin nombre: la fila muestra el uid, que ya es informativo */ }
    }
    if (gen !== generacion) return;

    seleccionInicial = [...guardados];
    ({ filas } = modeloAsignacion(maestros, guardados, conocidos));
    pintar();
  }

  // ── Pintado ──────────────────────────────────────────────────────────

  function pintar() {
    cuerpo.innerHTML = '';

    for (const f of filas) {
      const tr = document.createElement('tr');
      if (!f.vigente) tr.classList.add('fila-huerfana');

      const tdCheck = document.createElement('td');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = f.marcado;
      check.setAttribute('aria-label', `Asignar a ${f.nombre}`);
      // El manejador se ata AL CREAR el control, nunca con un
      // `querySelectorAll` posterior: así no hay forma de pintar una casilla
      // sin su manejador. Lección del 5c/C-bis.
      check.addEventListener('change', () => {
        f.marcado = check.checked;
        actualizarEstado();
      });
      tdCheck.appendChild(check);

      const tdNombre = document.createElement('td');
      tdNombre.textContent = f.nombre;          // textContent: viene de Firestore
      if (f.aviso) {
        const nota = document.createElement('div');
        nota.className = 'aviso-fila';
        nota.textContent = f.aviso;
        tdNombre.appendChild(nota);
      }

      const tdDetalle = document.createElement('td');
      tdDetalle.className = 'detalle';
      tdDetalle.textContent = f.detalle || SIN_DATO;

      tr.append(tdCheck, tdNombre, tdDetalle);
      cuerpo.appendChild(tr);
    }

    actualizarEstado();
  }

  function actualizarEstado() {
    resumen.textContent = textoResumen(filas);
    btnGuardar.disabled = !hayCambios(seleccionInicial, uidsSeleccionados(filas));
  }

  // ── Guardar ──────────────────────────────────────────────────────────

  btnGuardar.addEventListener('click', async () => {
    if (!proyectoActualId) return;

    const seleccion = uidsSeleccionados(filas);
    if (!hayCambios(seleccionInicial, seleccion)) return;

    // Quedarse sin nadie asignado es una decisión válida —y a veces la
    // correcta— pero deja el proyecto invisible para todos los maestros.
    // Se pregunta una vez; no se impide.
    if (seleccion.length === 0) {
      const ok = confirm(
        'Vas a dejar el proyecto sin ningún Maestro de Obras asignado.\n\n' +
        'Nadie del campo va a poder verlo: ni sus metas, ni sus tareas, ni su bono. ' +
        '¿Seguir?',
      );
      if (!ok) return;
    }

    const gen = generacion;
    btnGuardar.disabled = true;
    const textoOriginal = btnGuardar.textContent;
    btnGuardar.textContent = 'Guardando…';
    aviso.textContent = '';
    aviso.className = 'aviso';

    try {
      // El arreglo COMPLETO, en una sola escritura. Nunca `arrayUnion`, y
      // nunca una escritura por casilla tocada: la lista es una decisión
      // sobre quién entra y quién sale, y una operación parcial dejaría
      // estados que nadie decidió.
      await proyectosRepo.asignarSupervisores(proyectoActualId, seleccion);
    } catch (err) {
      btnGuardar.textContent = textoOriginal;
      btnGuardar.disabled = false;
      aviso.className = 'aviso aviso-error';
      aviso.textContent = `No se guardó: ${err.message}`;
      return;
    }

    btnGuardar.textContent = textoOriginal;

    if (gen !== generacion) return;   // se cambió de proyecto mientras escribía

    // La confirmación se releva desde Firestore, no desde la memoria de la
    // pantalla: lo que se muestra después de guardar tiene que ser lo que
    // quedó escrito, no lo que se creía que se estaba escribiendo.
    aviso.className = 'aviso aviso-ok';
    aviso.textContent = 'Asignación guardada. Releyendo…';
    await abrirProyecto(proyectoActualId);
    if (gen !== generacion) return;
    aviso.className = 'aviso aviso-ok';
    aviso.textContent = `Guardado: ${textoResumen(filas)}`;
  });

  // Un cambio sin guardar se pierde al salir. Se avisa.
  window.addEventListener('beforeunload', (e) => {
    if (hayCambios(seleccionInicial, uidsSeleccionados(filas))) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
