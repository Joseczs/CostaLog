// ═══════════════════════════════════════════════════════════════════════
// evaluaciones-controller.js — Bloque 6.
//
// Captura bisemanal de ornato y SO (D-08). Solo rol `ingeniero` (§6): es
// quien califica y no cobra el bono que ese factor reduce — el freno del
// sistema calificado por quien no lo sufre.
//
// ── El hueco que este bloque cierra de paso ────────────────────────────
// `meta-detalle.html` (4b) vuelve la tabla de hitos de solo lectura cuando
// la meta está `cerrada`/`pagada` (D-4b-01, `ESTADOS_SOLO_LECTURA`). Pero
// `metasRepo.listarEvaluaciones()` no filtra por estado, y nada impedía
// agregar una evaluación a una meta ya cerrada — cambiando en silencio el
// `factorCalidad`, y con él el `bonoMO`, de un período que se suponía
// liquidado con sus `reglasSnapshot` congeladas. `reglasSnapshot` congela
// las TARIFAS; nada congelaba las EVALUACIONES. Esta pantalla reusa
// `esEditable()` del 4b para cerrar ese hueco acá, sin tocar el 4b ni el
// 0: es la misma pregunta que ya existía, aplicada a un dato que faltaba.
//
// ── Por qué está partido en dos mitades ───────────────────────────────
// `calcularFactorCalidad` y `calcularBonoMeta` son puros — sin Firestore—
// así que se importan ESTÁTICOS arriba, igual que `hitos-tabla.js`: la
// vista previa de impacto se puede probar en Node.
// ═══════════════════════════════════════════════════════════════════════

import { calcularFactorCalidad, calcularBonoMeta } from '../js/core/calculoMeta.js';
import {
  formatearColones, formatearFecha, formatearPorcentaje, SIN_DATO,
} from '../js/formato.js';
// Mismo argumento que en `actividades-fuera-lista-controller.js` y que ya
// usó `bono-resumen.js` en el bloque 5 para importar `textoProcedencia`
// del mismo archivo: la mitad de navegador de `meta-detalle-controller.js`
// solo arranca si existe `#tabla-hitos`, que acá no existe.
import { esEditable } from './meta-detalle-controller.js';

/* ══════════════════════════════════════════════════════════════════════
   MITAD PURA
   ══════════════════════════════════════════════════════════════════════ */

/**
 * `<input type="date">` → `Date`, por componentes.
 *
 * Espejo del `aDate()` interno de `js/formato.js`: `new Date('2026-07-21')`
 * es medianoche UTC, que en Costa Rica (UTC−6) es el día anterior. Ese
 * helper no está exportado —nace pensado para lectura, no para capturar un
 * formulario— así que acá se repite la misma técnica, no se reinventa otra.
 *
 * @returns {Date|null} null si la cadena no es una fecha válida.
 */
export function fechaDesdeInput(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor ?? '');
  if (!m) return null;
  const [, a, mes, d] = m;
  const fecha = new Date(Number(a), Number(mes) - 1, Number(d));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Valida una evaluación antes de escribir. Ornato y SO van de 0 a 100
 * (misma escala que `avancePct`, acepta coma decimal como el 4b). La fecha
 * no puede ser futura: no se califica algo que todavía no pasó.
 */
export function validarEvaluacion({ fecha, ornato, so }) {
  const errores = [];

  const f = fechaDesdeInput(fecha);
  if (!f) {
    errores.push('La fecha es obligatoria y tiene que ser válida.');
  } else {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (f.getTime() > hoy.getTime()) errores.push('La fecha no puede ser futura.');
  }

  const o = Number(String(ornato ?? '').replace(',', '.'));
  if (!Number.isFinite(o) || o < 0 || o > 100) errores.push('Ornato va de 0 a 100.');

  const s = Number(String(so ?? '').replace(',', '.'));
  if (!Number.isFinite(s) || s < 0 || s > 100) errores.push('SO va de 0 a 100.');

  if (errores.length) return { ok: false, errores };
  return { ok: true, datos: { fecha: f, ornato: o, so: s } };
}

/** Una evaluación ya creada → fila de tabla, ya en texto. */
export function filaEvaluacion(ev) {
  const ornato = Number.isFinite(ev.ornato) ? ev.ornato : null;
  const so = Number.isFinite(ev.so) ? ev.so : null;
  const promedio = ornato !== null && so !== null ? (ornato + so) / 2 : null;
  return {
    id: ev.id,
    fechaTexto: formatearFecha(ev.fecha),
    ornatoTexto: ornato !== null ? formatearPorcentaje(ornato) : SIN_DATO,
    soTexto: so !== null ? formatearPorcentaje(so) : SIN_DATO,
    promedioTexto: promedio !== null ? formatearPorcentaje(promedio) : SIN_DATO,
    notas: ev.notas || '',
  };
}

/** Qué dice la pantalla cuando no hay evaluaciones — mismo texto que pinta
 *  `meta-detalle-controller.js`. Se repite a propósito y no se importa: es
 *  dos ramas de una frase, el riesgo de que diverja es bajo, y extraerla
 *  exigía tocar un archivo de otro bloque solo para exportar dos líneas. */
export function notaFactor(evaluacionesActivas) {
  const n = (evaluacionesActivas ?? []).length;
  return n
    ? `promedio de ${n} ${n === 1 ? 'evaluación' : 'evaluaciones'} de ornato y SO`
    : 'sin evaluaciones registradas: se calcula al 100 %, sin castigo';
}

/** El factor que resultaría de sumar un borrador a las evaluaciones activas. */
export function factorProyectado(evaluacionesActivas, draft) {
  const conjunto = draft ? [...(evaluacionesActivas ?? []), draft] : (evaluacionesActivas ?? []);
  return calcularFactorCalidad(conjunto);
}

/**
 * Impacto de un borrador de evaluación sobre el bono, ANTES de guardar.
 * Es la misma pregunta que `impactoActividad()` en la pantalla de extras y
 * créditos, contestada con el mismo motor real — nunca una cuenta paralela.
 *
 * A diferencia del borrador de una actividad, acá SÍ hay efecto inmediato:
 * el factor de calidad modula el reparto completo apenas se guarda, no
 * depende de ningún avance que alguien tenga que poner después.
 */
export function impactoEnBono(meta, hitos, evaluacionesActivas, reglas, draft) {
  const actual = calcularBonoMeta(meta, hitos, evaluacionesActivas, reglas, []);
  if (!draft) return { actual, proyectado: actual, deltaBonoMO: 0 };
  const proyectado = calcularBonoMeta(meta, hitos, [...evaluacionesActivas, draft], reglas, []);
  return { actual, proyectado, deltaBonoMO: proyectado.bonoMO - actual.bonoMO };
}

/* ══════════════════════════════════════════════════════════════════════
   MITAD DE NAVEGADOR
   ══════════════════════════════════════════════════════════════════════ */

if (typeof document !== 'undefined' && document.getElementById('tabla-evaluaciones')) {
  arrancar();
}

async function arrancar() {
  const [{ ROL_INGENIERO }, { protegerPagina, cerrarSesion }, { renderSidebar },
         { db }, { crearProyectosRepo }, { crearMetasRepo }, { crearHitosRepo },
         { normalizarReglas }] = await Promise.all([
    import('../js/roles.js'),
    import('../js/auth.js'),
    import('../js/sidebar.js'),
    import('../js/firebase-config.js'),
    import('../js/repos/proyectosRepo.js'),
    import('../js/repos/metasRepo.js'),
    import('../js/repos/hitosRepo.js'),
    import('../js/core/reglasBono.config.js'),
  ]);

  const proyectosRepo = crearProyectosRepo(db);
  const metasRepo = crearMetasRepo(db);
  const hitosRepo = crearHitosRepo(db);

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const proyectoId = params.get('proyecto');
  const metaId = params.get('meta');

  let meta = null;
  let reglas = null;
  let hitos = [];
  let evaluaciones = [];

  protegerPagina([ROL_INGENIERO], async (perfil) => {
    renderSidebar(perfil);
    $('nombre-usuario').textContent = perfil.nombre;

    if (!proyectoId || !metaId) {
      avisar('error', 'Falta el proyecto o la meta en la dirección. Volvé al detalle de la meta.');
      return;
    }
    await cargar();
  });

  $('btn-logout').addEventListener('click', async () => {
    await cerrarSesion();
    window.location.href = '/index.html';
  });

  // ── Carga ────────────────────────────────────────────────────────────

  async function cargar() {
    try {
      const [proyecto, metaDoc] = await Promise.all([
        proyectosRepo.obtener(proyectoId),
        metasRepo.obtener(proyectoId, metaId),
      ]);
      if (!proyecto) return avisar('error', 'Ese proyecto no existe o está desactivado.');
      if (!metaDoc) return avisar('error', 'Esa meta no existe o está desactivada.');

      meta = metaDoc;
      reglas = normalizarReglas(meta.reglasSnapshot ?? proyecto.reglasBono ?? {});

      [hitos, evaluaciones] = await Promise.all([
        hitosRepo.listar(proyectoId, metaId),
        metasRepo.listarEvaluaciones(proyectoId, metaId),
      ]);

      $('titulo-meta').textContent = `Meta ${meta.numero ?? ''}`.trim();
      $('nombre-proyecto').textContent = proyecto.nombre ?? proyecto.id;
      $('enlace-volver').href =
        `/ingeniero/meta-detalle.html?proyecto=${encodeURIComponent(proyectoId)}&meta=${encodeURIComponent(metaId)}`;

      // Ver cabecera: el hueco que este bloque cierra. `esEditable()` ya
      // hacía esta pregunta para los hitos; acá se le hace la misma a las
      // evaluaciones, que hasta hoy no la tenían.
      if (!esEditable(meta)) {
        $('form-evaluacion').style.display = 'none';
        $('aviso-solo-lectura').style.display = 'block';
      }

      pintarLista();
      pintarImpacto(null);
    } catch (err) {
      avisar('error', `No se pudo cargar: ${err.message}`);
    }
  }

  function pintarLista() {
    $('factor-actual').textContent = calcularFactorCalidad(evaluaciones).toFixed(2);
    $('factor-nota').textContent = notaFactor(evaluaciones);

    const cuerpo = $('cuerpo-evaluaciones');
    cuerpo.innerHTML = '';
    for (const ev of evaluaciones) {
      const f = filaEvaluacion(ev);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapar(f.fechaTexto)}</td>
        <td class="num">${escapar(f.ornatoTexto)}</td>
        <td class="num">${escapar(f.soTexto)}</td>
        <td class="num">${escapar(f.promedioTexto)}</td>
        <td>${escapar(f.notas)}</td>
        <td><button type="button" class="link-accion link-peligro btn-baja" data-id="${escapar(f.id)}">Desactivar</button></td>`;
      cuerpo.appendChild(tr);
    }
    cuerpo.querySelectorAll('.btn-baja').forEach((btn) => {
      btn.addEventListener('click', () => desactivar(btn.dataset.id));
    });

    $('vacio-evaluaciones').style.display = evaluaciones.length ? 'none' : 'block';
  }

  async function desactivar(evaluacionId) {
    const ok = confirm(
      '¿Desactivar esta evaluación?\n\n' +
      'Deja de contar en el factor de calidad. Queda en el histórico, pero ' +
      'desaparece de esta lista.',
    );
    if (!ok) return;
    try {
      await metasRepo.desactivarEvaluacion(proyectoId, metaId, evaluacionId);
      evaluaciones = evaluaciones.filter((e) => e.id !== evaluacionId);
      pintarLista();
      pintarImpacto(null);
      limpiarBorrador();
    } catch (err) {
      avisar('error', `No se pudo desactivar: ${err.message}`);
    }
  }

  // ── Vista previa en vivo, sin escribir nada ─────────────────────────

  ['campo-fecha', 'campo-ornato', 'campo-so'].forEach((id) => {
    $(id).addEventListener('input', actualizarVistaPrevia);
    $(id).addEventListener('change', actualizarVistaPrevia);
  });

  function actualizarVistaPrevia() {
    if (!meta) return;
    const validacion = validarEvaluacion({
      fecha: $('campo-fecha').value,
      ornato: $('campo-ornato').value,
      so: $('campo-so').value,
    });
    pintarImpacto(validacion.ok ? validacion.datos : null);
  }

  function pintarImpacto(draft) {
    const factorPrevio = calcularFactorCalidad(evaluaciones);
    const factorNuevo = factorProyectado(evaluaciones, draft);
    $('impacto-factor').textContent = draft
      ? `${factorPrevio.toFixed(2)} → ${factorNuevo.toFixed(2)}`
      : '—';

    const r = impactoEnBono(meta, hitos, evaluaciones, reglas, draft);
    $('impacto-bono').textContent = draft
      ? `Bono del Maestro de Obras: ${formatearColones(r.actual.bonoMO)} → ${formatearColones(r.proyectado.bonoMO)}`
      : '';
  }

  function limpiarBorrador() {
    $('form-evaluacion').reset();
    pintarImpacto(null);
  }

  // ── Guardar ──────────────────────────────────────────────────────────

  $('form-evaluacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('error-form').textContent = '';

    const validacion = validarEvaluacion({
      fecha: $('campo-fecha').value,
      ornato: $('campo-ornato').value,
      so: $('campo-so').value,
    });
    if (!validacion.ok) {
      $('error-form').textContent = validacion.errores.join(' ');
      return;
    }

    const btn = $('btn-guardar-evaluacion');
    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = 'Guardando…';

    try {
      const notas = $('campo-notas').value.trim();
      const id = await metasRepo.crearEvaluacion(proyectoId, metaId, { ...validacion.datos, notas });

      // Releído desde Firestore, no armado a mano: mismo criterio del 5b-2
      // y de la pantalla de actividades de este mismo bloque.
      const todas = await metasRepo.listarEvaluaciones(proyectoId, metaId);
      evaluaciones = todas;

      pintarLista();
      limpiarBorrador();
      avisar('ok', `Evaluación del ${formatearFecha(validacion.datos.fecha)} guardada.`);
      void id;
    } catch (err) {
      $('error-form').textContent = `No se pudo guardar: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });

  // ── Auxiliares ───────────────────────────────────────────────────────

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
  }

  function avisar(tipo, texto) {
    const caja = $('avisos');
    const p = document.createElement('p');
    p.className = tipo === 'error' ? 'error-msg' : 'info-msg';
    p.textContent = texto;
    caja.appendChild(p);
    if (tipo === 'ok') setTimeout(() => p.remove(), 4000);
  }
}
