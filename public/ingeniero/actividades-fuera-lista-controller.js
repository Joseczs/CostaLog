// ═══════════════════════════════════════════════════════════════════════
// actividades-fuera-lista-controller.js — Bloque 6.
//
// Registrar EXTRA.XX y CREDT.XX. Solo rol `ingeniero` (§6: "Registrar
// extras y créditos" no lo tiene el supervisor).
//
// ── Lo que esta pantalla NO hace, y por qué ───────────────────────────
// • NO edita el `% avance` de lo que crea. `meta-detalle.html` (bloque 4b)
//   ya edita el avance de CUALQUIER hito — lista, extra o crédito— con su
//   propio momento de escritura (D-4b-05, al salir del campo) y su propia
//   auditoría (`aprobarAvance`, que deja `aprobadoPor`/`aprobadoEn`).
//   Repetir ese campo acá sería un segundo lugar donde el mismo dato se
//   escribe, con dos rutas para el mismo error.
// • NO edita una actividad ya creada. Un typo se corrige desactivando y
//   creando de nuevo — dos acciones explícitas y auditables, en vez de un
//   `update` silencioso sobre un código que ya pudo haber entrado al
//   cálculo. Mismo criterio que "nunca se corrige en silencio" del 4b.
//
// ── El signo, resuelto por construcción, no por validación tardía ──────
// El plan pide "validación de signo, sin excepción" (crédito ⇒ cantidad
// negativa). La forma más segura de cumplirlo no es validar un número que
// alguien ya escribió con el signo equivocado: es no dejarlo escribir el
// signo. El formulario pide una MAGNITUD siempre positiva y el tipo
// (Extra / Crédito) decide el signo. `prepararActividad` igual valida —
// defensa en profundidad— pero el error que el plan quiere evitar ya no
// tiene por dónde entrar.
//
// ── Por qué está partido en dos mitades ───────────────────────────────
// Mismo patrón del 3, el 4b y el 5. `calcularBonoMeta` y sus vecinos son
// puros — sin Firestore — así que se importan ESTÁTICOS arriba, como ya
// hace `hitos-tabla.js`: es lo que permite que la vista previa de impacto
// se pruebe en Node, no solo el formulario.
// ═══════════════════════════════════════════════════════════════════════

import { calcularBonoMeta, hhEstimadasHito, hhGanadasHito } from '../js/core/calculoMeta.js';
import { formatearColones, formatearHoras, formatearNumero, SIN_DATO } from '../js/formato.js';
// `esEditable` ya está exportada por el bloque 4b. El import es seguro
// porque su mitad de navegador solo arranca si existe `#tabla-hitos`, que
// acá no existe — mismo argumento que usó `bono-resumen.js` en el bloque 5
// para importar `textoProcedencia` del mismo archivo.
import { esEditable } from './meta-detalle-controller.js';

const PREFIJOS = Object.freeze({ extra: 'EXTRA', credito: 'CREDT' });
const ETIQUETAS_TIPO = Object.freeze({ extra: 'Extra', credito: 'Crédito' });

/* ══════════════════════════════════════════════════════════════════════
   MITAD PURA
   ══════════════════════════════════════════════════════════════════════ */

/** 'extra' → 'EXTRA', 'credito' → 'CREDT'. Los prefijos del plan, tal cual. */
export function siguientePrefijo(tipo) {
  const prefijo = PREFIJOS[tipo];
  if (!prefijo) throw new Error(`actividades: tipo inválido "${tipo}"`);
  return prefijo;
}

/**
 * El siguiente `orden` libre, sobre TODOS los hitos de la meta —lista,
 * extras y créditos—, no solo los de este tipo. Nace al final: una
 * actividad fuera de lista se registra después de que la lista existe.
 */
export function siguienteOrden(hitos) {
  const maximo = (hitos ?? []).reduce((max, h) => Math.max(max, h.orden ?? 0), 0);
  return maximo + 1;
}

/**
 * Valida y arma los datos de una actividad nueva, sin tocar Firestore.
 *
 * `magnitud` llega SIEMPRE positiva desde el formulario (ver cabecera).
 * Acá se convierte en `cantidad` con el signo que le toca según `tipo` —
 * el único lugar del sistema donde eso pasa.
 *
 * @returns {{ ok:true, datos:object } | { ok:false, errores:string[] }}
 */
export function prepararActividad({ tipo, descripcion, unidad, magnitud, hhUnidad }) {
  const errores = [];

  if (!PREFIJOS[tipo]) errores.push('Elegí si es un Extra o un Crédito.');

  const desc = (descripcion ?? '').trim();
  if (!desc) errores.push('La descripción no puede quedar vacía.');

  const unid = (unidad ?? '').trim();
  if (!unid) errores.push('La unidad no puede quedar vacía.');

  const mag = Number(String(magnitud ?? '').replace(',', '.'));
  if (!Number.isFinite(mag) || mag <= 0) {
    errores.push('La cantidad tiene que ser un número mayor que cero.');
  }

  const hhU = Number(String(hhUnidad ?? '').replace(',', '.'));
  if (!Number.isFinite(hhU) || hhU <= 0) {
    errores.push('El rendimiento HH/unidad tiene que ser mayor que cero.');
  }

  if (errores.length) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      tipo,
      descripcion: desc,
      unidad: unid,
      // El único lugar del sistema donde el signo se decide, no se valida.
      cantidad: tipo === 'credito' ? -mag : mag,
      hhUnidad: hhU,
    },
  };
}

/**
 * Una actividad ya creada → fila de tabla, ya en texto.
 * Reusa `hhEstimadasHito`/`hhGanadasHito` del motor: la misma cuenta que
 * usa `meta-detalle.html`, nunca una copia local que se pueda desalinear.
 */
export function filaActividad(hito) {
  const estimadas = hhEstimadasHito(hito);
  const ganadas = hhGanadasHito(hito);
  return {
    id: hito.id,
    codigo: hito.codigo ?? SIN_DATO,
    tipo: hito.tipo,
    tipoTexto: ETIQUETAS_TIPO[hito.tipo] ?? hito.tipo,
    descripcion: hito.descripcion ?? '',
    unidad: hito.unidad ?? '',
    cantidad: formatearNumero(hito.cantidad),
    hhUnidad: formatearNumero(hito.hhUnidad),
    avancePct: Number.isFinite(hito.avancePct) ? hito.avancePct : 0,
    hhEstimadasTexto: formatearHoras(estimadas, { conSufijo: false }),
    hhGanadasTexto: formatearHoras(ganadas, { conSufijo: false }),
    negativo: estimadas < 0,
  };
}

/** Línea de resumen arriba de la tabla. Nunca queda vacía ni en cero mudo. */
export function resumenActividades(filas) {
  const extras = (filas ?? []).filter((f) => f.tipo === 'extra');
  const creditos = (filas ?? []).filter((f) => f.tipo === 'credito');
  if (!extras.length && !creditos.length) {
    return 'Sin extras ni créditos registrados todavía.';
  }
  const partes = [];
  if (extras.length) partes.push(`${extras.length} ${extras.length === 1 ? 'extra' : 'extras'}`);
  if (creditos.length) partes.push(`${creditos.length} ${creditos.length === 1 ? 'crédito' : 'créditos'}`);
  return partes.join(' · ');
}

/**
 * Impacto de un borrador de actividad sobre los totales de la meta, ANTES
 * de guardar nada. Es la misma pregunta que hace `bono-resumen.js` con la
 * proyección de avances: "¿qué pasa si esto se guarda?", contestada con el
 * mismo motor, no con una cuenta paralela.
 *
 * `hhGanadas` casi siempre da 0 en el borrador — es correcto, no un error:
 * `hitosRepo.crear()` nace con `avancePct: 0` (ver cabecera), así que nada
 * queda "ganado" hasta que alguien le ponga avance en el detalle. Lo que SÍ
 * se mueve de inmediato es `hhEstimadasTotal`, porque no depende del avance.
 * Es exactamente el criterio de aceptación del plan: un crédito de −40 HH
 * baja el total estimado en 40 aunque su avance siga en cero.
 *
 * @param {object} meta
 * @param {Array} hitosExistentes — los que ya devolvió el repositorio
 * @param {Array} evaluaciones
 * @param {object} reglas
 * @param {object|null} draftHito — `{ tipo, cantidad, hhUnidad }`, o null
 */
export function impactoActividad(meta, hitosExistentes, evaluaciones, reglas, draftHito) {
  const actual = calcularBonoMeta(meta, hitosExistentes, evaluaciones, reglas, []);
  if (!draftHito) {
    return { actual, proyectado: actual, deltaHHEstimadas: 0, deltaHHGanadas: 0, deltaBonoMO: 0 };
  }
  const borrador = { avancePct: 0, activo: true, ...draftHito };
  const proyectado = calcularBonoMeta(meta, [...hitosExistentes, borrador], evaluaciones, reglas, []);
  return {
    actual,
    proyectado,
    deltaHHEstimadas: proyectado.hhEstimadasTotal - actual.hhEstimadasTotal,
    deltaHHGanadas: proyectado.hhGanadasTotal - actual.hhGanadasTotal,
    deltaBonoMO: proyectado.bonoMO - actual.bonoMO,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   MITAD DE NAVEGADOR
   ══════════════════════════════════════════════════════════════════════ */

if (typeof document !== 'undefined' && document.getElementById('tabla-actividades')) {
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
  let hitos = [];          // TODOS los hitos de la meta, no solo extras/créditos
  let evaluaciones = [];
  let uid = null;

  protegerPagina([ROL_INGENIERO], async (perfil) => {
    renderSidebar(perfil);
    $('nombre-usuario').textContent = perfil.nombre;
    uid = perfil.uid;

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
      // D-10, igual que el 4b: una meta con reglas congeladas calcula con
      // su copia, no con la configuración viva del proyecto.
      reglas = normalizarReglas(meta.reglasSnapshot ?? proyecto.reglasBono ?? {});

      [hitos, evaluaciones] = await Promise.all([
        hitosRepo.listar(proyectoId, metaId),
        metasRepo.listarEvaluaciones(proyectoId, metaId),
      ]);

      $('titulo-meta').textContent = `Meta ${meta.numero ?? ''}`.trim();
      $('nombre-proyecto').textContent = proyecto.nombre ?? proyecto.id;
      $('enlace-volver').href =
        `/ingeniero/meta-detalle.html?proyecto=${encodeURIComponent(proyectoId)}&meta=${encodeURIComponent(metaId)}`;

      if (!esEditable(meta)) {
        $('form-actividad').style.display = 'none';
        $('aviso-solo-lectura').style.display = 'block';
      }

      pintarLista();
      pintarImpacto(null);
    } catch (err) {
      avisar('error', `No se pudo cargar: ${err.message}`);
    }
  }

  function actividades() {
    return hitos.filter((h) => h.tipo === 'extra' || h.tipo === 'credito');
  }

  function pintarLista() {
    const filas = actividades().map(filaActividad);
    $('resumen-actividades').textContent = resumenActividades(filas);

    const cuerpo = $('cuerpo-actividades');
    cuerpo.innerHTML = '';
    for (const f of filas) {
      const tr = document.createElement('tr');
      if (f.negativo) tr.classList.add('fila-credito');
      tr.innerHTML = `
        <td class="col-codigo">${escapar(f.codigo)}</td>
        <td><span class="badge ${f.tipo === 'credito' ? 'badge-credito' : 'badge-extra'}">${escapar(f.tipoTexto)}</span></td>
        <td>${escapar(f.descripcion)}</td>
        <td>${escapar(f.unidad)}</td>
        <td class="num">${escapar(f.cantidad)}</td>
        <td class="num">${escapar(f.hhUnidad)}</td>
        <td class="num">${escapar(f.hhEstimadasTexto)}</td>
        <td class="num">${f.avancePct} %</td>
        <td class="num">${escapar(f.hhGanadasTexto)}</td>
        <td><button type="button" class="link-accion link-peligro btn-baja" data-id="${escapar(f.id)}" data-codigo="${escapar(f.codigo)}">Desactivar</button></td>`;
      cuerpo.appendChild(tr);
    }

    cuerpo.querySelectorAll('.btn-baja').forEach((btn) => {
      btn.addEventListener('click', () => desactivar(btn.dataset.id, btn.dataset.codigo));
    });

    $('vacio-actividades').style.display = filas.length ? 'none' : 'block';
  }

  async function desactivar(hitoId, codigo) {
    const ok = confirm(
      `¿Desactivar ${codigo}?\n\n` +
      `Deja de contar en el cálculo del bono. Queda en el histórico, pero ` +
      `desaparece de esta lista. Si fue un error de tipeo, esta es la forma ` +
      `de corregirlo: no se edita, se desactiva y se crea de nuevo.`,
    );
    if (!ok) return;
    try {
      await hitosRepo.desactivar(proyectoId, metaId, hitoId);
      hitos = hitos.filter((h) => h.id !== hitoId);
      pintarLista();
      pintarImpacto(null);
      limpiarBorrador();
    } catch (err) {
      avisar('error', `No se pudo desactivar: ${err.message}`);
    }
  }

  // ── Vista previa en vivo ─────────────────────────────────────────────
  // Se recalcula en memoria en cada tecla, igual que config-proyecto y
  // bono-resumen: no hay ESCRITURA acá, solo lectura de lo que ya se
  // cargó una vez. El costo es el mismo 3,65 µs medido en el bloque 0.

  ['sel-tipo', 'campo-magnitud', 'campo-hh-unidad'].forEach((id) => {
    $(id).addEventListener('input', actualizarVistaPrevia);
    $(id).addEventListener('change', actualizarVistaPrevia);
  });

  function borradorActual() {
    const tipo = $('sel-tipo').value;
    if (!PREFIJOS[tipo]) return null;
    const mag = Number(String($('campo-magnitud').value).replace(',', '.'));
    const hhU = Number(String($('campo-hh-unidad').value).replace(',', '.'));
    if (!Number.isFinite(mag) || mag <= 0 || !Number.isFinite(hhU) || hhU <= 0) return null;
    return { tipo, cantidad: tipo === 'credito' ? -mag : mag, hhUnidad: hhU };
  }

  function actualizarVistaPrevia() {
    if (!meta) return;
    pintarImpacto(borradorActual());
  }

  function pintarImpacto(draft) {
    const r = impactoActividad(meta, hitos, evaluaciones, reglas, draft);
    $('impacto-estimadas').textContent = signoHoras(r.deltaHHEstimadas);
    $('impacto-ganadas').textContent = signoHoras(r.deltaHHGanadas);
    $('impacto-bono').textContent = draft
      ? `Bono del Maestro de Obras: ${formatearColones(r.actual.bonoMO)} → ${formatearColones(r.proyectado.bonoMO)}`
      : '';
  }

  function signoHoras(n) {
    if (!Number.isFinite(n) || n === 0) return '—';
    const texto = formatearHoras(Math.abs(n), { conSufijo: false });
    return n > 0 ? `+${texto}` : `−${texto}`;
  }

  function limpiarBorrador() {
    $('form-actividad').reset();
    pintarImpacto(null);
  }

  // ── Guardar ──────────────────────────────────────────────────────────

  $('form-actividad').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('error-form').textContent = '';

    const preparado = prepararActividad({
      tipo: $('sel-tipo').value,
      descripcion: $('campo-descripcion').value,
      unidad: $('campo-unidad').value,
      magnitud: $('campo-magnitud').value,
      hhUnidad: $('campo-hh-unidad').value,
    });

    if (!preparado.ok) {
      $('error-form').textContent = preparado.errores.join(' ');
      return;
    }

    const btn = $('btn-guardar-actividad');
    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = 'Guardando…';

    try {
      const codigo = await hitosRepo.siguienteCodigo(proyectoId, metaId, siguientePrefijo(preparado.datos.tipo));
      const orden = siguienteOrden(hitos);
      const id = await hitosRepo.crear(proyectoId, metaId, { ...preparado.datos, codigo, orden });

      // Se relee el hito recién creado en vez de armarlo a mano: lo que se
      // pinta tiene que ser lo que quedó escrito, no lo que se creía haber
      // mandado — mismo criterio que el 5b-2 con la confirmación de guardado.
      const nuevo = await hitosRepo.obtener(proyectoId, metaId, id);
      if (nuevo) hitos.push(nuevo);

      pintarLista();
      limpiarBorrador();
      avisar('ok', `${codigo} guardado.`);
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
