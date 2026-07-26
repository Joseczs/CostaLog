// ═══════════════════════════════════════════════════════════════════════
// metas-controller.js — Bloque 4a.
//
// Lista de metas por proyecto. Solo lectura: número, fechas, estado y bono
// acumulado. Solo para el rol `ingeniero` (§6 de la especificación).
//
// ── Lo que esta pantalla NO hace, y por qué ───────────────────────────
// • NO crea metas. El formulario pide fechas, bonoBase, hhPlanilla y
//   `siguienteNumero()`: es una pantalla entera y se comía el bloque.
// • NO escribe `totales`. Ese mapa lo escribe el detalle (4b), que es
//   donde el cálculo ya está en pantalla. Una lista que escribe mientras
//   la miras es una lista en la que no se puede confiar.
// • NO recalcula el bono. Leer `totales` cuesta cero consultas extra;
//   recalcular costaría 2 por meta (hitos + evaluaciones). Cuando el mapa
//   no está, se dice que no está — no se inventa un número.
//
// ── Por qué este archivo está partido en dos mitades ──────────────────
// Mismo patrón del bloque 3: arriba funciones PURAS (sin DOM, sin
// Firestore), abajo el arranque del navegador con imports DIFERIDOS.
// Así el día que estas reglas de pintado necesiten prueba en Node, la
// prueba se escribe sin bajar el SDK de Firebase del CDN.
// ═══════════════════════════════════════════════════════════════════════

import {
  formatearColones,
  formatearFecha,
  formatearHoras,
  SIN_DATO,
} from '../js/formato.js';

/* ══════════════════════════════════════════════════════════════════════
   MITAD PURA
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Estado del documento → cómo se ve en la lista.
 *
 * ⚠️ Se reutilizan las clases `badge-*` que ya existen en `css/styles.css`,
 * que es archivo de otro bloque y no se toca. Los nombres de clase no
 * calzan uno a uno con los estados y está bien: `evaluada` pinta como
 * "en progreso" y `cerrada` como "terminada". El día que styles.css se
 * abra por otra razón, se les da nombre propio.
 */
export const ESTADO_META = Object.freeze({
  abierta: { etiqueta: 'Abierta', clase: 'badge-abierta' },
  evaluada: { etiqueta: 'Evaluada', clase: 'badge-progreso' },
  cerrada: { etiqueta: 'Cerrada', clase: 'badge-terminada' },
  pagada: { etiqueta: 'Pagada', clase: 'badge-pagada' },
});

/** Un estado desconocido se pinta tal cual, sin color. No se esconde. */
export function pintarEstado(estado) {
  return ESTADO_META[estado] ?? { etiqueta: estado ?? SIN_DATO, clase: '' };
}

/**
 * Qué se pinta en la columna de bono cuando `totales` es `null` — que hoy
 * es el caso de TODAS las metas, incluida la del fixture.
 *
 * La tentación es pintar ₡0. Un cero acá es una cifra falsa con cara de
 * cifra buena: dice "esta meta no generó bono" cuando lo que pasa es que
 * nadie lo ha calculado. Se pinta "—" y se explica al pie.
 *
 * @param {object|null} totales — el mapa denormalizado de la meta
 * @returns {{ texto: string, detalle: string, calculado: boolean }}
 */
export function textoBono(totales) {
  if (!totales || !Number.isFinite(totales.bonoMO)) {
    return {
      texto: SIN_DATO,
      detalle: 'sin calcular',
      calculado: false,
    };
  }
  const partes = [];
  if (Number.isFinite(totales.hhEconomizadas)) {
    partes.push(`${formatearHoras(totales.hhEconomizadas)} economizadas`);
  }
  if (Number.isFinite(totales.factorCalidad) && totales.factorCalidad !== 1) {
    partes.push(`factor ${totales.factorCalidad.toFixed(2)}`);
  }
  return {
    texto: formatearColones(totales.bonoMO),
    detalle: partes.join(' · '),
    calculado: true,
  };
}

/**
 * Una fila de la tabla, ya en texto. Sin DOM: devuelve datos, no HTML.
 * @param {object} meta — documento plano del repositorio
 */
export function filaDeMeta(meta) {
  const estado = pintarEstado(meta.estado);
  const bono = textoBono(meta.totales);
  return {
    id: meta.id,
    numero: Number.isFinite(meta.numero) ? `Meta ${meta.numero}` : SIN_DATO,
    inicio: formatearFecha(meta.fechaInicio),
    limite: formatearFecha(meta.fechaLimite),
    // `fechaEntrega` en `null` no es un dato faltante: es una meta que aún
    // no se ha entregado. Se dice con palabras, no con un guion mudo.
    entrega: meta.fechaEntrega ? formatearFecha(meta.fechaEntrega) : 'sin entregar',
    entregada: Boolean(meta.fechaEntrega),
    // D-05: entregar tarde cuesta el bono base completo. Si ya pasó, la
    // lista lo dice; no se descubre al abrir el detalle.
    tarde: Boolean(
      meta.fechaEntrega && meta.fechaLimite && meta.fechaEntrega > meta.fechaLimite,
    ),
    planilla: Number.isFinite(meta.hhPlanilla) ? formatearHoras(meta.hhPlanilla) : SIN_DATO,
    estadoEtiqueta: estado.etiqueta,
    estadoClase: estado.clase,
    bono: bono.texto,
    bonoDetalle: bono.detalle,
    bonoCalculado: bono.calculado,
    esFixture: Boolean(meta.esFixture),
  };
}

/* ══════════════════════════════════════════════════════════════════════
   MITAD DE NAVEGADOR
   ══════════════════════════════════════════════════════════════════════ */

if (typeof document !== 'undefined' && document.getElementById('tabla-metas')) {
  arrancar();
}

async function arrancar() {
  const [{ ROL_INGENIERO }, { protegerPagina, cerrarSesion }, { renderSidebar },
         { db }, { crearProyectosRepo }, { crearMetasRepo }] = await Promise.all([
    import('../js/roles.js'),
    import('../js/auth.js'),
    import('../js/sidebar.js'),
    import('../js/firebase-config.js'),
    import('../js/repos/proyectosRepo.js'),
    import('../js/repos/metasRepo.js'),
  ]);

  const proyectosRepo = crearProyectosRepo(db);
  const metasRepo = crearMetasRepo(db);

  const $ = (id) => document.getElementById(id);
  const selector = $('selector-proyecto');
  const seccion = $('seccion-metas');
  const cuerpo = $('cuerpo-metas');
  const errorCarga = $('error-carga');
  const vacio = $('sin-metas');
  const resumen = $('resumen-lista');
  const enlaceConfig = $('enlace-config');

  let proyectoActualId = null;

  protegerPagina([ROL_INGENIERO], async (perfil) => {
    renderSidebar(perfil);
    $('nombre-usuario').textContent = perfil.nombre;
    await cargarProyectos();
  });

  $('btn-logout').addEventListener('click', async () => {
    await cerrarSesion();
    window.location.href = '/index.html';
  });

  // ── Carga ────────────────────────────────────────────────────────────

  async function cargarProyectos() {
    let proyectos = [];
    try {
      proyectos = await proyectosRepo.listar();
    } catch (err) {
      errorCarga.textContent = `No se pudieron cargar los proyectos: ${err.message}`;
      return;
    }

    if (!proyectos.length) {
      errorCarga.textContent =
        'No hay proyectos activos. Creá uno desde el Dashboard antes de abrir sus metas.';
      return;
    }

    for (const p of proyectos) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.codigo ? `${p.codigo} — ${p.nombre ?? ''}` : (p.nombre ?? p.id);
      selector.appendChild(opt);
    }

    // Preselección por querystring, igual que en config-proyecto. Un id que
    // no esté en la lista se ignora en silencio.
    const pedido = new URLSearchParams(window.location.search).get('proyecto');
    if (pedido && proyectos.some((p) => p.id === pedido)) {
      selector.value = pedido;
      await abrirProyecto(pedido);
      return;
    }

    // Con un solo proyecto activo, elegirlo es un clic sin decisión: se hace
    // solo. Con dos o más, se pregunta — adivinar cuál queda pintado sería
    // peor que no pintar ninguno.
    if (proyectos.length === 1) {
      selector.value = proyectos[0].id;
      await abrirProyecto(proyectos[0].id);
      sincronizarURL(proyectos[0].id);
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

  /** La URL refleja lo que se está viendo: así el enlace se puede compartir.
   *  No hay `localStorage`: la barra de direcciones ya es la memoria, y una
   *  que se ve. Un proyecto recordado en silencio es el que se abre creyendo
   *  que se está mirando otro. */
  function sincronizarURL(id) {
    const url = new URL(window.location.href);
    url.searchParams.set('proyecto', id);
    window.history.replaceState({}, '', url);
  }

  async function abrirProyecto(proyectoId) {
    errorCarga.textContent = '';
    cuerpo.innerHTML = '';
    vacio.style.display = 'none';
    resumen.textContent = 'Cargando…';
    seccion.style.display = 'block';
    proyectoActualId = proyectoId;

    enlaceConfig.href = `/supervisor/config-proyecto.html?proyecto=${encodeURIComponent(proyectoId)}`;

    let metas = [];
    try {
      metas = await metasRepo.listar(proyectoId);
    } catch (err) {
      resumen.textContent = '';
      errorCarga.textContent = `No se pudieron cargar las metas: ${err.message}`;
      return;
    }

    // La carrera importa: si se cambió de proyecto mientras esto respondía,
    // lo que llegó ya no es lo que se está mirando.
    if (proyectoActualId !== proyectoId) return;

    pintarMetas(metas);
  }

  function pintarMetas(metas) {
    if (!metas.length) {
      resumen.textContent = '';
      vacio.style.display = 'block';
      return;
    }

    // El repositorio ya las devuelve por `numero` descendente.
    const filas = metas.map(filaDeMeta);
    const sinCalcular = filas.filter((f) => !f.bonoCalculado).length;

    resumen.textContent =
      `${filas.length} ${filas.length === 1 ? 'meta activa' : 'metas activas'}` +
      (sinCalcular ? ` · ${sinCalcular} sin bono calculado` : '');

    for (const f of filas) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-meta">
          <strong>${escapar(f.numero)}</strong>
          ${f.esFixture ? '<span class="marca-fixture">fixture</span>' : ''}
        </td>
        <td>${escapar(f.inicio)}</td>
        <td>${escapar(f.limite)}</td>
        <td class="${f.tarde ? 'entrega-tarde' : ''}">
          ${escapar(f.entrega)}
          ${f.tarde ? '<span class="aviso-tarde" title="D-05: se pierde el bono base completo">tarde</span>' : ''}
        </td>
        <td class="num">${escapar(f.planilla)}</td>
        <td><span class="badge ${f.estadoClase}">${escapar(f.estadoEtiqueta)}</span></td>
        <td class="num ${f.bonoCalculado ? 'bono-calculado' : 'bono-pendiente'}">
          ${escapar(f.bono)}
          ${f.bonoDetalle ? `<div class="bono-detalle">${escapar(f.bonoDetalle)}</div>` : ''}
        </td>`;
      cuerpo.appendChild(tr);
    }
  }

  /** Los datos vienen de Firestore, no de un literal. Se escapan igual. */
  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
  }
}
