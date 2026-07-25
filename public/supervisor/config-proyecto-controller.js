// ═══════════════════════════════════════════════════════════════════════
// config-proyecto-controller.js — Bloque 3.
//
// Pantalla de `reglasBono` por proyecto, con las dos tarifas derivadas en
// vivo y en solo lectura. Es lo que evita que alguien vuelva a tratar los
// ₡640 como una constante caída del cielo.
//
// Solo para el rol `ingeniero` (§6 de la especificación).
//
// ── Por qué este archivo está partido en dos mitades ──────────────────
// Arriba: funciones PURAS, sin DOM, sin Firestore, sin red. Se importan
// desde Node para la prueba de aceptación (`test/bloque3.mjs`).
// Abajo: el arranque del navegador, que importa Firebase de forma DIFERIDA
// (`await import`). Si esos imports fueran estáticos, importar este archivo
// en Node intentaría bajar el SDK del CDN y la prueba no correría.
// ═══════════════════════════════════════════════════════════════════════

import {
  tarifaHoraEconomizada,
  tarifaDiaAnticipado,
  validarReglasBono,
  normalizarReglas,
} from '../js/core/reglasBono.config.js';

/* ══════════════════════════════════════════════════════════════════════
   MITAD PURA
   ══════════════════════════════════════════════════════════════════════ */

/** Los 10 campos numéricos editables, en el orden en que se pintan.
 *  Los dos booleanos (`permitirBonoNegativo`, `permitirDiasAtrasoNegativos`)
 *  NO se editan: son D-01 y D-06, decisiones de empresa. Se muestran como
 *  texto en la pantalla y salen de REGLAS_BONO_DEFAULT al guardar. */
export const CAMPOS_NUMERICOS = Object.freeze([
  'costoPromHH',
  'costoDiarioAdmin',
  'pctBonoHoraProductividad',
  'pctBonoEntregaAnticipada',
  'pctBonoMO',
  'pctBonoING',
  'horasJornada',
  'hhMiscelaneosPorDia',
  'factorRetoBP',
  'tarifaBPporHH',
]);

/** ₡ con separador de miles de espacio: 640 → "₡640", 15000 → "₡15 000".
 *  ⚠️ Local a propósito. El plan pide un único `formato.js`, pero eso sería
 *  un tercer archivo y el bloque son dos. Se muda en el bloque 4 —
 *  anotado como deuda en CONTRATOS.md. */
export function formatearColones(n) {
  if (!Number.isFinite(n)) return '—';
  const redondeado = Math.round(n * 100) / 100;
  const [entero, decimales] = String(Math.abs(redondeado)).split('.');
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${redondeado < 0 ? '−' : ''}₡${agrupado}${decimales ? ',' + decimales : ''}`;
}

/** Número simple con la misma agrupación, para las fórmulas. */
export function formatearNumero(n) {
  if (!Number.isFinite(n)) return '—';
  const redondeado = Math.round(n * 100) / 100;
  const [entero, decimales] = String(Math.abs(redondeado)).split('.');
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${redondeado < 0 ? '−' : ''}${agrupado}${decimales ? ',' + decimales : ''}`;
}

/**
 * Convierte lo que hay escrito en el formulario en un objeto de reglas completo.
 * @param {Record<string,string|number>} valores — campo → valor crudo del input
 * @returns {object} reglas completas (parciales rellenadas con los defaults)
 *
 * Un campo vacío o no numérico entra como NaN a propósito: `validarReglasBono()`
 * lo rechaza con un mensaje claro. Silenciarlo con `|| 0` guardaría un cero que
 * nadie escribió, y un cero acá es dinero.
 */
export function reglasDesdeValores(valores = {}) {
  const parciales = {};
  for (const campo of CAMPOS_NUMERICOS) {
    const crudo = valores[campo];
    parciales[campo] =
      crudo === '' || crudo === null || crudo === undefined ? NaN : Number(crudo);
  }
  return normalizarReglas(parciales);
}

/**
 * Las dos tarifas derivadas, ya formateadas. Se recalcula en cada tecla:
 * es aritmética en memoria, no cuesta nada.
 */
export function textoTarifas(reglas) {
  const hora = tarifaHoraEconomizada(reglas);
  const dia = tarifaDiaAnticipado(reglas);
  return {
    hora: formatearColones(hora),
    dia: formatearColones(dia),
    horaValida: Number.isFinite(hora),
    diaValida: Number.isFinite(dia),
    formulaHora:
      `${formatearNumero(reglas.costoPromHH)} × ` +
      `${formatearNumero(reglas.pctBonoHoraProductividad)} % = ${formatearColones(hora)}`,
    formulaDia:
      `${formatearNumero(reglas.costoDiarioAdmin)} × ` +
      `${formatearNumero(reglas.pctBonoEntregaAnticipada)} % = ${formatearColones(dia)}`,
  };
}

/**
 * Puerta única antes de escribir a Firestore.
 * @returns {{ ok: boolean, errores: string[], reglas: object }}
 *
 * El controlador NO valida por su cuenta: toda la regla de negocio vive en
 * `validarReglasBono()` del bloque 0. Acá solo se arma el objeto y se pregunta.
 */
export function prepararGuardado(valores) {
  const reglas = reglasDesdeValores(valores);
  const errores = validarReglasBono(reglas);
  return { ok: errores.length === 0, errores, reglas };
}

/* ══════════════════════════════════════════════════════════════════════
   MITAD DE NAVEGADOR
   ══════════════════════════════════════════════════════════════════════ */

if (typeof document !== 'undefined' && document.getElementById('form-reglas')) {
  arrancar();
}

async function arrancar() {
  // Imports diferidos: ver la nota de la cabecera.
  const [{ ROL_INGENIERO }, { protegerPagina, cerrarSesion }, { renderSidebar },
         { db }, { crearProyectosRepo }] = await Promise.all([
    import('../js/roles.js'),
    import('../js/auth.js'),
    import('../js/sidebar.js'),
    import('../js/firebase-config.js'),
    import('../js/repos/proyectosRepo.js'),
  ]);

  const proyectosRepo = crearProyectosRepo(db);

  const $ = (id) => document.getElementById(id);
  const selector = $('selector-proyecto');
  const seccion = $('seccion-reglas');
  const avisoDefaults = $('aviso-defaults');
  const listaErrores = $('lista-errores');
  const estadoGuardado = $('estado-guardado');
  const errorCarga = $('error-carga');
  const formulario = $('form-reglas');

  /** Reglas tal como están hoy en Firestore (o los defaults si no hay nada).
   *  Sirve para "Descartar cambios" y para saber si algo cambió. */
  let reglasGuardadas = null;
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
        'No hay proyectos activos. Creá uno desde el Dashboard antes de configurarlo.';
      return;
    }

    for (const p of proyectos) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.codigo ? `${p.codigo} — ${p.nombre ?? ''}` : (p.nombre ?? p.id);
      selector.appendChild(opt);
    }

    // Preselección por querystring: ?proyecto=<id>. Si el id no está en la
    // lista, se ignora en silencio y queda el selector vacío.
    const pedido = new URLSearchParams(window.location.search).get('proyecto');
    if (pedido && proyectos.some((p) => p.id === pedido)) {
      selector.value = pedido;
      await abrirProyecto(pedido);
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
    // La URL refleja lo que se está viendo: así el enlace se puede compartir.
    const url = new URL(window.location.href);
    url.searchParams.set('proyecto', id);
    window.history.replaceState({}, '', url);
  });

  async function abrirProyecto(proyectoId) {
    errorCarga.textContent = '';
    limpiarEstado();

    let proyecto = null;
    try {
      proyecto = await proyectosRepo.obtener(proyectoId);
    } catch (err) {
      errorCarga.textContent = `No se pudo abrir el proyecto: ${err.message}`;
      return;
    }
    if (!proyecto) {
      errorCarga.textContent = 'Ese proyecto no existe o está desactivado.';
      return;
    }

    proyectoActualId = proyectoId;

    // Nunca se escribe al abrir. Si el proyecto no tiene el mapa, se pintan los
    // defaults y se avisa que todavía no hay nada guardado.
    const tieneReglas = Boolean(proyecto.reglasBono);
    reglasGuardadas = normalizarReglas(proyecto.reglasBono ?? {});
    avisoDefaults.style.display = tieneReglas ? 'none' : 'block';

    pintarFormulario(reglasGuardadas);
    refrescarTarifas();
    seccion.style.display = 'block';
  }

  function pintarFormulario(reglas) {
    for (const campo of CAMPOS_NUMERICOS) $(campo).value = reglas[campo];
  }

  function leerFormulario() {
    const valores = {};
    for (const campo of CAMPOS_NUMERICOS) valores[campo] = $(campo).value;
    return valores;
  }

  // ── Tarifas derivadas, en vivo ───────────────────────────────────────

  function refrescarTarifas() {
    const reglas = reglasDesdeValores(leerFormulario());
    const t = textoTarifas(reglas);

    $('tarifa-hora').textContent = t.hora;
    $('tarifa-dia').textContent = t.dia;
    $('formula-hora').textContent = t.formulaHora;
    $('formula-dia').textContent = t.formulaDia;
    $('tarifa-hora').classList.toggle('invalida', !t.horaValida);
    $('tarifa-dia').classList.toggle('invalida', !t.diaValida);

    const suma = reglas.pctBonoMO + reglas.pctBonoING;
    const sumaOk = Number.isFinite(suma) && suma <= 100;
    $('suma-reparto').textContent = Number.isFinite(suma)
      ? `Suma del reparto: ${formatearNumero(suma)} %` +
        (sumaOk ? '' : ' — no puede superar 100 %.')
      : 'Suma del reparto: —';
    $('suma-reparto').style.color = sumaOk ? '' : 'var(--rojo-error)';
  }

  // Se recalcula en memoria en cada tecla; a Firestore no se escribe nada
  // hasta pulsar Guardar. Medido en el bloque 0: 3.65 µs por cálculo completo.
  for (const campo of CAMPOS_NUMERICOS) {
    $(campo).addEventListener('input', () => {
      refrescarTarifas();
      limpiarEstado();
    });
  }

  // ── Guardar ──────────────────────────────────────────────────────────

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!proyectoActualId) return;

    const { ok, errores, reglas } = prepararGuardado(leerFormulario());
    if (!ok) {
      mostrarErrores(errores);
      return;
    }

    const btn = $('btn-guardar');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      // El mapa va COMPLETO y ya normalizado: nunca campo por campo, o quedan
      // mapas a medias (contrato de proyectosRepo.actualizarReglas).
      await proyectosRepo.actualizarReglas(proyectoActualId, reglas);
      reglasGuardadas = reglas;
      avisoDefaults.style.display = 'none';
      mostrarErrores([]);
      estadoGuardado.textContent = '✓ Reglas guardadas.';
    } catch (err) {
      mostrarErrores([`No se pudo guardar: ${err.message}`]);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar reglas';
    }
  });

  $('btn-revertir').addEventListener('click', () => {
    if (!reglasGuardadas) return;
    pintarFormulario(reglasGuardadas);
    refrescarTarifas();
    limpiarEstado();
  });

  // ── Estado de la pantalla ────────────────────────────────────────────

  function mostrarErrores(errores) {
    estadoGuardado.textContent = '';
    if (!errores.length) {
      listaErrores.style.display = 'none';
      listaErrores.innerHTML = '';
      return;
    }
    listaErrores.innerHTML = errores.map((e) => `<li>${e}</li>`).join('');
    listaErrores.style.display = 'block';
  }

  function limpiarEstado() {
    estadoGuardado.textContent = '';
    listaErrores.style.display = 'none';
    listaErrores.innerHTML = '';
  }
}
