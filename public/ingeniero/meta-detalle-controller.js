// ═══════════════════════════════════════════════════════════════════════
// meta-detalle-controller.js — Bloque 4b.
//
// La tabla de hitos con el `% AVANCE` editable en línea. Solo `ingeniero`
// (D-4b-01): la mitad de PROPONER de D-11 vive en el bloque 4c, pensado
// para teléfono desde el principio, no adaptado después.
//
// ── El orden de las escrituras (D-4b-05) ──────────────────────────────
// 1. el hito, al SALIR del campo — nunca por tecla;
// 2. `totales` inmediatamente después.
// Si la segunda falla, la lista queda con totales viejos. Está declarado:
// la lista dice al pie que ahí se lee lo guardado, y que el detalle manda.
// ═══════════════════════════════════════════════════════════════════════

import { modeloTabla, pintarTabla } from './hitos-tabla.js';
import {
  formatearColones,
  formatearFecha,
  formatearHoras,
  formatearPorcentaje,
  SIN_DATO,
} from '../js/formato.js';

/* ══════════════════════════════════════════════════════════════════════
   MITAD PURA
   ══════════════════════════════════════════════════════════════════════ */

/** Estados en los que la tabla NO se edita.
 *  Una meta cerrada o pagada tiene su `reglasSnapshot` congelado y montos ya
 *  liquidados. Reabrirla es una acción explícita y auditada (D-10), no un
 *  clic distraído sobre una celda. */
export const ESTADOS_SOLO_LECTURA = Object.freeze(['cerrada', 'pagada']);

export const esEditable = (meta) => !ESTADOS_SOLO_LECTURA.includes(meta?.estado);

/**
 * De dónde salió la cifra de producción (D-12).
 *
 * La proyección NUNCA se pinta como número pelado: un bono estimado que se
 * ve idéntico a uno definitivo es una promesa que alguien va a cobrar.
 */
export function textoProcedencia(produccion, meta) {
  if (!produccion) return 'sin datos de producción';
  const corte = meta?.hhPlanillaAlCorte ? formatearFecha(meta.hhPlanillaAlCorte) : null;

  switch (produccion.origen) {
    case 'planilla':
      return corte
        ? `planilla al ${corte} — cifra definitiva`
        : 'planilla del período — cifra definitiva';
    case 'estimado':
      return `estimado por asistencia (${produccion.diasEstimados} ${
        produccion.diasEstimados === 1 ? 'día' : 'días'
      }) — no definitivo`;
    case 'mixto':
      return `planilla${corte ? ` al ${corte}` : ''} + ${produccion.diasEstimados} ${
        produccion.diasEstimados === 1 ? 'día estimado' : 'días estimados'
      } por asistencia — no definitivo`;
    default:
      return 'sin datos de producción — el bono todavía no significa nada';
  }
}

/**
 * El mapa `totales` que se guarda en la meta (D-4b-02). Plano, sin anidar:
 * es lo único que la lista puede leer sin abrir los hitos de cada meta.
 */
export function totalesDesdeResultado(resultado, uid) {
  return {
    hhEstimadasTotal: resultado.hhEstimadasTotal,
    hhGanadasTotal: resultado.hhGanadasTotal,
    hhEconomizadas: resultado.hhEconomizadas,
    indicador: resultado.indicador, // fracción, no porcentaje
    bonoTotalBruto: resultado.bonoTotalBruto,
    factorCalidad: resultado.factorCalidad,
    bonoMO: resultado.bonoMO,
    bonoING: resultado.bonoING,
    bonoBaseSePerdio: resultado.bonoBaseSePerdio,
    produccionOrigen: resultado.produccion?.origen ?? 'sin_datos',
    esDefinitivo: resultado.produccion?.esDefinitivo === true,
    calculadoEn: new Date(),
    calculadoPor: uid ?? null,
  };
}

/** Un avance escrito a mano: se acepta o se rechaza con el motivo, nunca se
 *  corrige en silencio. Un 700 % silenciado a 100 % es plata inventada. */
export function validarAvance(valor) {
  if (valor === '' || valor === null || valor === undefined) {
    return { ok: false, error: 'El avance no puede quedar vacío.' };
  }
  const n = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n)) return { ok: false, error: 'El avance tiene que ser un número.' };
  if (n < 0 || n > 100) return { ok: false, error: 'El avance va de 0 a 100.' };
  return { ok: true, valor: n };
}

/* ══════════════════════════════════════════════════════════════════════
   MITAD DE NAVEGADOR
   ══════════════════════════════════════════════════════════════════════ */

if (typeof document !== 'undefined' && document.getElementById('tabla-hitos')) {
  arrancar();
}

async function arrancar() {
  const [{ ROL_INGENIERO }, { protegerPagina, cerrarSesion }, { renderSidebar },
         { db }, { crearProyectosRepo }, { crearMetasRepo }, { crearHitosRepo },
         { calcularBonoMeta }, { normalizarReglas }] = await Promise.all([
    import('../js/roles.js'),
    import('../js/auth.js'),
    import('../js/sidebar.js'),
    import('../js/firebase-config.js'),
    import('../js/repos/proyectosRepo.js'),
    import('../js/repos/metasRepo.js'),
    import('../js/repos/hitosRepo.js'),
    import('../js/core/calculoMeta.js'),
    import('../js/core/reglasBono.config.js'),
  ]);

  const proyectosRepo = crearProyectosRepo(db);
  const metasRepo = crearMetasRepo(db);
  const hitosRepo = crearHitosRepo(db);

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const proyectoId = params.get('proyecto');
  const metaId = params.get('meta');

  // Estado de la pantalla. Los hitos se cargan UNA vez y se recalcula en
  // memoria: 3,65 µs con 52 hitos. Volver a Firestore por cada tecla sería
  // pagar red por algo que sale gratis acá.
  let meta = null;
  let hitos = [];
  let evaluaciones = [];
  let reglas = null;
  let uid = null;
  let ultimoResultado = null;

  protegerPagina([ROL_INGENIERO], async (perfil) => {
    renderSidebar(perfil);
    $('nombre-usuario').textContent = perfil.nombre;
    uid = perfil.uid;

    if (!proyectoId || !metaId) {
      avisar('error', 'Falta el proyecto o la meta en la dirección. Volvé a la lista de metas.');
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

      // D-10: una meta cerrada calcula con SU snapshot, no con la
      // configuración viva. Si no, al abrir un histórico aparecerían montos
      // que nunca se pagaron.
      reglas = normalizarReglas(meta.reglasSnapshot ?? proyecto.reglasBono ?? {});

      [hitos, evaluaciones] = await Promise.all([
        hitosRepo.listar(proyectoId, metaId),
        metasRepo.listarEvaluaciones(proyectoId, metaId),
      ]);

      $('titulo-meta').textContent = `Meta ${meta.numero ?? ''}`.trim();
      $('enlace-volver').href = `/ingeniero/metas.html?proyecto=${encodeURIComponent(proyectoId)}`;

      pintarCabecera(proyecto);
      recalcularYPintar();
    } catch (err) {
      avisar('error', `No se pudo cargar la meta: ${err.message}`);
    }
  }

  function pintarCabecera(proyecto) {
    $('nombre-proyecto').textContent = proyecto.nombre ?? proyecto.id;
    $('fecha-inicio').textContent = formatearFecha(meta.fechaInicio);
    $('fecha-limite').textContent = formatearFecha(meta.fechaLimite);
    $('fecha-evaluacion').textContent = formatearFecha(meta.fechaEvaluacion);
    $('fecha-entrega').textContent = meta.fechaEntrega
      ? formatearFecha(meta.fechaEntrega)
      : 'sin entregar';
    $('estado-meta').textContent = meta.estado ?? SIN_DATO;

    if (meta.reglasSnapshot) {
      avisar(
        'info',
        'Esta meta calcula con sus reglas congeladas, no con la configuración viva del proyecto (D-10).',
      );
    }
    if (!esEditable(meta)) {
      $('aviso-solo-lectura').style.display = 'block';
    }
  }

  // ── Cálculo y pintado ────────────────────────────────────────────────

  function recalcularYPintar() {
    // Sin asistencias todavía: el bloque 7b las conecta. Hasta entonces la
    // producción sale de `hhPlanilla` y el origen es 'planilla', que es
    // exactamente lo que hace el Excel hoy.
    const resultado = calcularBonoMeta(meta, hitos, evaluaciones, reglas, []);
    ultimoResultado = resultado;

    const editable = esEditable(meta);
    const modelo = modeloTabla(hitos, resultado, reglas, { editable });

    pintarTabla($('cuerpo-hitos'), modelo, {
      onAvance: editable ? guardarAvance : null,
      onAprobar: editable ? aprobarPropuesta : null,
      onDescartar: editable ? descartarPropuesta : null,
    });

    $('total-estimadas').textContent = modelo.pie.hhEstimadasTexto;
    $('total-ganadas').textContent = modelo.pie.hhGanadasTexto;

    $('contador-pendientes').textContent = modelo.pendientes
      ? `${modelo.pendientes} ${modelo.pendientes === 1 ? 'avance propuesto' : 'avances propuestos'} sin aprobar`
      : 'sin avances pendientes de aprobación';
    $('contador-pendientes').className = modelo.pendientes ? 'pendientes-hay' : 'pendientes-cero';

    pintarResumen(resultado);
  }

  function pintarResumen(r) {
    $('hh-economizadas').textContent = formatearHoras(r.hhEconomizadas);
    $('indicador').textContent = formatearPorcentaje(r.indicador * 100);
    $('hh-produccion').textContent = formatearHoras(r.hhPlanilla);
    $('procedencia').textContent = textoProcedencia(r.produccion, meta);

    // El bono va SIEMPRE con su procedencia al lado, nunca solo (D-12).
    $('bono-mo').textContent = formatearColones(r.bonoMO);
    $('bono-mo').className = r.produccion?.esDefinitivo ? 'monto definitivo' : 'monto estimado';

    // El factor de calidad va junto al monto, nunca en otra pestaña: es el
    // freno del sistema y esconderlo lo desactiva.
    $('factor-calidad').textContent = r.factorCalidad.toFixed(2);
    $('factor-nota').textContent = evaluaciones.length
      ? `promedio de ${evaluaciones.length} ${evaluaciones.length === 1 ? 'evaluación' : 'evaluaciones'} de ornato y SO`
      : 'sin evaluaciones registradas: se calcula al 100 %, sin castigo';

    $('aviso-bono-base').style.display = r.bonoBaseSePerdio ? 'block' : 'none';
  }

  // ── Escrituras ───────────────────────────────────────────────────────

  async function guardarAvance(hitoId, valorCrudo, campo) {
    const hito = hitos.find((h) => h.id === hitoId);
    if (!hito) return;

    const validacion = validarAvance(valorCrudo);
    if (!validacion.ok) {
      avisar('error', validacion.error);
      campo.value = hito.avancePct; // se devuelve al valor bueno, no se inventa uno
      return;
    }
    if (validacion.valor === hito.avancePct) return; // nada que escribir

    try {
      marcarGuardando(campo, true);
      // El ingeniero escribe directo en `avancePct`, pero por la vía de
      // `aprobarAvance`: así queda `aprobadoPor` y `aprobadoEn`. Digitar el
      // avance es uno de los cinco momentos donde el sistema se rompe, y
      // todos llevan autor y fecha.
      await hitosRepo.aprobarAvance(proyectoId, metaId, hitoId, uid, {
        avanceAprobado: validacion.valor,
      });
      hito.avancePct = validacion.valor;
      hito.avancePropuesto = null;
      recalcularYPintar();
      await persistirTotales();
    } catch (err) {
      avisar('error', `No se pudo guardar el avance: ${err.message}`);
      campo.value = hito.avancePct;
    } finally {
      marcarGuardando(campo, false);
    }
  }

  async function aprobarPropuesta(hitoId) {
    const hito = hitos.find((h) => h.id === hitoId);
    if (!hito || hito.avancePropuesto === null) return;
    try {
      const aprobado = await hitosRepo.aprobarAvance(proyectoId, metaId, hitoId, uid);
      hito.avancePct = aprobado;
      hito.avancePropuesto = null;
      recalcularYPintar();
      await persistirTotales();
    } catch (err) {
      avisar('error', `No se pudo aprobar: ${err.message}`);
    }
  }

  async function descartarPropuesta(hitoId) {
    const hito = hitos.find((h) => h.id === hitoId);
    if (!hito) return;
    if (!window.confirm(`Descartar la propuesta de ${hito.codigo}? El avance aprobado no cambia.`)) return;
    try {
      await hitosRepo.actualizar(proyectoId, metaId, hitoId, { avancePropuesto: null });
      hito.avancePropuesto = null;
      recalcularYPintar();
    } catch (err) {
      avisar('error', `No se pudo descartar: ${err.message}`);
    }
  }

  /** Segunda escritura de D-4b-05. Si falla, se avisa y no se reintenta
   *  solo: los totales viejos son un problema visible; un reintento en
   *  silencio que también falle, no. */
  async function persistirTotales() {
    if (!ultimoResultado) return;
    try {
      await metasRepo.guardarTotales(proyectoId, metaId, totalesDesdeResultado(ultimoResultado, uid));
      $('estado-guardado').textContent = 'totales guardados';
      $('estado-guardado').className = 'guardado-ok';
    } catch (err) {
      $('estado-guardado').textContent = `los totales de la lista quedaron viejos: ${err.message}`;
      $('estado-guardado').className = 'guardado-error';
    }
  }

  // ── Auxiliares de interfaz ───────────────────────────────────────────

  function marcarGuardando(campo, activo) {
    campo.classList.toggle('guardando', activo);
    campo.disabled = activo;
  }

  function avisar(tipo, texto) {
    const caja = $('avisos');
    const p = document.createElement('p');
    p.className = tipo === 'error' ? 'error-msg' : 'info-msg';
    p.textContent = texto;
    caja.appendChild(p);
  }
}
