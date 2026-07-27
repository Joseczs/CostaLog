// ═══════════════════════════════════════════════════════════════════════
// bono-resumen.js — Bloque 5. La pantalla que justifica la aplicación.
//
// La cascada completa en el ORDEN DEL EXCEL, para que el Ingeniero pueda
// auditarla de un vistazo contra el libro que lleva años usando:
//
//     base → anticipada → productividad → bruto → × factor → ING / MO
//
// ── Decisiones cerradas de este bloque ────────────────────────────────
// D-5-01  La ven LOS DOS roles, con la misma cascada y los mismos números.
//         El Maestro de Obras ya ve su bono en el teléfono, pero sin
//         explicación: "se lo dicen, no lo verifica". Una pantalla que le
//         muestra el monto y le esconde de dónde sale reproduce el Excel
//         en digital. Lo único que cambia por rol es quién puede editar,
//         y acá nadie edita: es de solo lectura para ambos.
// D-5-02  Dos cifras siempre: la cascada con los avances APROBADOS y, al
//         lado, el total con las propuestas pendientes. Nunca solo la
//         segunda. Es la restricción del plan y la misma del 4c.
// D-5-03  El factor de calidad va DENTRO de la cascada, en su renglón,
//         no en una tarjeta aparte. Es el freno del sistema; en el Excel
//         está en la misma columna y así se queda.
// D-5-04  Solo lectura. Cambiar avances es del 4b; capturar planilla y
//         cerrar la meta son del bloque 6 y del 8. Acá no se escribe nada,
//         ni siquiera `totales`.
// ═══════════════════════════════════════════════════════════════════════

import {
  formatearColones,
  formatearFecha,
  formatearHoras,
  formatearNumero,
  formatearPorcentaje,
  SIN_DATO,
} from '../js/formato.js';

/* ══════════════════════════════════════════════════════════════════════
   MITAD PURA
   ══════════════════════════════════════════════════════════════════════ */

/**
 * La cascada, renglón por renglón, en el orden del libro.
 *
 * Devuelve datos, no HTML. Cada renglón trae su `tipo` para que el pintado
 * decida el peso visual sin volver a razonar el negocio:
 *   'componente' suma · 'total' subtotal · 'factor' multiplica · 'reparto' final
 *
 * @param {object} r       — lo que devolvió `calcularBonoMeta`
 * @param {object} reglas  — para los porcentajes de reparto
 */
export function filasCascada(r, reglas) {
  const filas = [];

  filas.push({
    clave: 'base',
    etiqueta: 'Bono base',
    monto: r.bonoBase,
    montoTexto: formatearColones(r.bonoBase),
    tipo: 'componente',
    // D-05: la entrega tardía se lleva el bono base completo. Que el
    // renglón diga por qué vale ₡0 y no solo que vale ₡0.
    nota: r.bonoBaseSePerdio
      ? 'se perdió: la entrega quedó después de la fecha límite (D-05)'
      : 'aplica solo si la entrega es puntual o anticipada',
    alerta: r.bonoBaseSePerdio,
  });

  filas.push({
    clave: 'anticipada',
    etiqueta: 'Bono por entrega anticipada',
    monto: r.bonoAnticipada,
    montoTexto: formatearColones(r.bonoAnticipada),
    tipo: 'componente',
    nota: `${formatearNumero(r.diasAnticipados)} ${
      r.diasAnticipados === 1 ? 'día' : 'días'
    } × ${formatearColones(r.tarifaDiaAnticipado)} por día`,
  });

  // D-01: el piso en ₡0 no se aplica en silencio. Si hubo déficit de horas,
  // el renglón lo dice: el monto no baja de cero, pero la realidad sí.
  const hayDeficit = r.bonoProductividadSinPiso < 0;
  filas.push({
    clave: 'productividad',
    etiqueta: 'Bono por productividad',
    monto: r.bonoProductividad,
    montoTexto: formatearColones(r.bonoProductividad),
    tipo: 'componente',
    nota: hayDeficit
      ? `déficit de ${formatearHoras(Math.abs(r.hhEconomizadas))} — el monto tiene piso en ₡0 (D-01)`
      : `${formatearHoras(r.hhEconomizadas)} economizadas × ${formatearColones(
          r.tarifaHoraEconomizada,
        )} por HH`,
    alerta: hayDeficit,
  });

  filas.push({
    clave: 'bruto',
    etiqueta: 'Bono total bruto',
    monto: r.bonoTotalBruto,
    montoTexto: formatearColones(r.bonoTotalBruto),
    tipo: 'total',
    nota: 'suma de los tres componentes de arriba',
  });

  // D-5-03: el factor va acá, en la cascada, no en una tarjeta lateral.
  filas.push({
    clave: 'factor',
    etiqueta: 'Factor de calidad',
    monto: null,
    montoTexto: `× ${r.factorCalidad.toFixed(2)}`,
    tipo: 'factor',
    nota:
      r.factorCalidad === 1
        ? 'sin evaluaciones registradas: se paga completo, sin castigo'
        : `promedio de ornato y seguridad ocupacional — se paga el ${formatearPorcentaje(
            r.factorCalidad * 100,
            { decimales: 0 },
          )} de lo bruto`,
    alerta: r.factorCalidad < 1,
  });

  filas.push({
    clave: 'ing',
    etiqueta: 'Ingeniero Residente',
    monto: r.bonoING,
    montoTexto: formatearColones(r.bonoING),
    tipo: 'reparto',
    nota: `${formatearNumero(reglas.pctBonoING)} % del bruto × factor`,
  });

  filas.push({
    clave: 'mo',
    etiqueta: 'Maestro de Obras',
    monto: r.bonoMO,
    montoTexto: formatearColones(r.bonoMO),
    tipo: 'reparto',
    nota: `${formatearNumero(reglas.pctBonoMO)} % del bruto × factor`,
  });

  return filas;
}

/**
 * Comprueba que la cascada cierre consigo misma.
 *
 * No es paranoia: si un día el motor cambia y el bruto deja de ser la suma
 * de sus tres componentes, esta pantalla lo seguiría pintando como si nada
 * y nadie lo notaría hasta que alguien cuadre a mano contra el Excel. Que
 * la propia pantalla se revise es más barato que descubrirlo pagando.
 *
 * @returns {{ ok: boolean, errores: string[] }}
 */
export function verificarCascada(r, reglas, tolerancia = 0.01) {
  const errores = [];
  const cerca = (a, b) => Math.abs(a - b) <= tolerancia;

  const suma = r.bonoBase + r.bonoAnticipada + r.bonoProductividad;
  if (!cerca(suma, r.bonoTotalBruto)) {
    errores.push(`el bruto (${r.bonoTotalBruto}) no es la suma de sus componentes (${suma})`);
  }
  if (!cerca((r.bonoTotalBruto * reglas.pctBonoMO) / 100 * r.factorCalidad, r.bonoMO)) {
    errores.push('el reparto al Maestro de Obras no cuadra con el bruto por el factor');
  }
  if (!cerca((r.bonoTotalBruto * reglas.pctBonoING) / 100 * r.factorCalidad, r.bonoING)) {
    errores.push('el reparto al Ingeniero no cuadra con el bruto por el factor');
  }
  if (reglas.pctBonoMO + reglas.pctBonoING > 100) {
    errores.push('pctBonoMO + pctBonoING pasa de 100: se está repartiendo más de lo que hay');
  }
  return { ok: errores.length === 0, errores };
}

/**
 * Las dos cifras de D-5-02. Devuelve la comparación, no una sola cifra.
 */
export function comparativa(rAprobado, rPropuesto) {
  const dif = rPropuesto.bonoMO - rAprobado.bonoMO;
  return {
    aprobadoTexto: formatearColones(rAprobado.bonoMO),
    propuestoTexto: formatearColones(rPropuesto.bonoMO),
    diferencia: dif,
    diferenciaTexto: formatearColones(Math.abs(dif)),
    hayDiferencia: Math.round(dif) !== 0,
    sube: dif > 0,
  };
}

/** El renglón de horas que explica el bono por productividad. */
export function filasHoras(r) {
  return [
    { etiqueta: 'HH estimadas', valor: formatearHoras(r.hhEstimadasTotal) },
    { etiqueta: 'HH ganadas', valor: formatearHoras(r.hhGanadasTotal) },
    { etiqueta: 'HH de producción', valor: formatearHoras(r.hhPlanilla) },
    { etiqueta: 'HH economizadas', valor: formatearHoras(r.hhEconomizadas) },
    { etiqueta: 'Indicador de productividad', valor: formatearPorcentaje(r.indicador * 100) },
    { etiqueta: 'Misceláneos incluidos', valor: formatearHoras(r.hhMiscelaneos) },
  ];
}

/* ══════════════════════════════════════════════════════════════════════
   MITAD DE NAVEGADOR
   ══════════════════════════════════════════════════════════════════════ */

if (typeof document !== 'undefined' && document.getElementById('cascada')) {
  arrancar();
}

async function arrancar() {
  const [{ ROL_INGENIERO, ROL_SUPERVISOR }, { protegerPagina, cerrarSesion },
         { renderSidebar }, { db }, { crearProyectosRepo }, { crearMetasRepo },
         { crearHitosRepo }, { calcularBonoMeta }, { normalizarReglas },
         { textoProcedencia }] = await Promise.all([
    import('../js/roles.js'),
    import('../js/auth.js'),
    import('../js/sidebar.js'),
    import('../js/firebase-config.js'),
    import('../js/repos/proyectosRepo.js'),
    import('../js/repos/metasRepo.js'),
    import('../js/repos/hitosRepo.js'),
    import('../js/core/calculoMeta.js'),
    import('../js/core/reglasBono.config.js'),
    // Se IMPORTA de un archivo del bloque 4b, no se copia. Importar no es
    // modificar, y duplicar el texto de la procedencia garantizaría que un
    // día las dos pantallas digan cosas distintas del mismo dato.
    import('./meta-detalle-controller.js'),
  ]);

  const proyectosRepo = crearProyectosRepo(db);
  const metasRepo = crearMetasRepo(db);
  const hitosRepo = crearHitosRepo(db);
  const $ = (id) => document.getElementById(id);

  let proyectoId = null;
  let metas = [];
  /** uid con el que filtrar, o `null` para ver todo. Lo fija el rol. */
  let soloDe = null;

  protegerPagina([ROL_INGENIERO, ROL_SUPERVISOR], async (perfil) => {
    renderSidebar(perfil);
    $('nombre-usuario').textContent = perfil.nombre;
    // Bloque 5b — la asimetría es deliberada: el ingeniero define el alcance
    // de todos los frentes y tiene que verlos todos; el Maestro de Obras ve
    // solo los suyos. El bono de otro Maestro de Obras no es asunto suyo.
    soloDe = perfil.rol === ROL_SUPERVISOR ? perfil.uid : null;
    await cargarProyectos();
  });

  $('btn-logout').addEventListener('click', async () => {
    await cerrarSesion();
    window.location.href = '/index.html';
  });

  async function cargarProyectos() {
    let proyectos = [];
    try {
      proyectos = await proyectosRepo.listar({ soloDe });
    } catch (err) {
      return avisar(`No se pudieron cargar los proyectos: ${err.message}`);
    }
    if (!proyectos.length && soloDe) {
      return avisar('No tenés ningún proyecto asignado.');
    }
    for (const p of proyectos) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.nombre ?? p.id;
      $('selector-proyecto').appendChild(o);
    }

    const params = new URLSearchParams(window.location.search);
    const pedido = params.get('proyecto');
    if (pedido && proyectos.some((p) => p.id === pedido)) {
      $('selector-proyecto').value = pedido;
      await cargarMetas(pedido, params.get('meta'));
    } else if (proyectos.length === 1) {
      $('selector-proyecto').value = proyectos[0].id;
      await cargarMetas(proyectos[0].id, null);
    }
  }

  $('selector-proyecto').addEventListener('change', async (e) => {
    if (e.target.value) await cargarMetas(e.target.value, null);
  });

  async function cargarMetas(pid, metaPedida) {
    proyectoId = pid;
    $('selector-meta').innerHTML = '<option value="">Elegí la meta…</option>';
    $('seccion-resumen').style.display = 'none';

    try {
      metas = await metasRepo.listar(pid);
    } catch (err) {
      return avisar(`No se pudieron cargar las metas: ${err.message}`);
    }
    if (!metas.length) return avisar('Este proyecto no tiene metas activas.');

    for (const m of metas) {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = `Meta ${m.numero ?? ''} — ${m.estado ?? ''}`.trim();
      $('selector-meta').appendChild(o);
    }

    const elegida = metaPedida && metas.some((m) => m.id === metaPedida) ? metaPedida : metas[0].id;
    $('selector-meta').value = elegida;
    await pintarMeta(elegida);
  }

  $('selector-meta').addEventListener('change', async (e) => {
    if (e.target.value) await pintarMeta(e.target.value);
  });

  async function pintarMeta(metaId) {
    $('avisos').innerHTML = '';
    const meta = metas.find((m) => m.id === metaId);
    if (!meta) return;

    let proyecto = null;
    let hitos = [];
    let evaluaciones = [];
    try {
      [proyecto, hitos, evaluaciones] = await Promise.all([
        proyectosRepo.obtener(proyectoId),
        hitosRepo.listar(proyectoId, metaId),
        metasRepo.listarEvaluaciones(proyectoId, metaId),
      ]);
    } catch (err) {
      return avisar(`No se pudo cargar el detalle: ${err.message}`);
    }

    // D-10: si la meta tiene snapshot, manda el snapshot.
    const reglas = normalizarReglas(meta.reglasSnapshot ?? proyecto?.reglasBono ?? {});
    const rAprobado = calcularBonoMeta(meta, hitos, evaluaciones, reglas, []);

    // D-5-02: la segunda cifra, con las propuestas pendientes aplicadas.
    const conPropuestas = hitos.map((h) =>
      h.avancePropuesto === null || h.avancePropuesto === undefined
        ? h
        : { ...h, avancePct: h.avancePropuesto },
    );
    const rPropuesto = calcularBonoMeta(meta, conPropuestas, evaluaciones, reglas, []);

    $('seccion-resumen').style.display = 'block';
    $('titulo-meta').textContent = `Meta ${meta.numero ?? ''}`.trim();
    $('estado-meta').textContent = meta.estado ?? SIN_DATO;
    $('fecha-limite').textContent = formatearFecha(meta.fechaLimite);
    $('fecha-entrega').textContent = meta.fechaEntrega
      ? formatearFecha(meta.fechaEntrega)
      : 'sin entregar';
    $('origen-reglas').textContent = meta.reglasSnapshot
      ? 'reglas congeladas de esta meta (D-10)'
      : 'configuración viva del proyecto';

    pintarCascada(filasCascada(rAprobado, reglas));
    pintarHoras(filasHoras(rAprobado));
    pintarComparativa(comparativa(rAprobado, rPropuesto));

    $('procedencia').textContent = textoProcedencia(rAprobado.produccion, meta);

    // La pantalla se audita a sí misma. Si esto sale, no se discute con la
    // pantalla: se mira el motor.
    const chequeo = verificarCascada(rAprobado, reglas);
    $('chequeo').style.display = chequeo.ok ? 'none' : 'block';
    $('chequeo').textContent = chequeo.ok ? '' : `La cascada no cuadra: ${chequeo.errores.join(' · ')}`;
  }

  function pintarCascada(filas) {
    const cuerpo = $('cascada');
    cuerpo.innerHTML = '';
    for (const f of filas) {
      const tr = document.createElement('tr');
      tr.className = `fila-${f.tipo}${f.alerta ? ' con-alerta' : ''}`;
      tr.innerHTML = `
        <td class="etiqueta">${escapar(f.etiqueta)}<div class="nota">${escapar(f.nota)}</div></td>
        <td class="monto">${escapar(f.montoTexto)}</td>`;
      cuerpo.appendChild(tr);
    }
  }

  function pintarHoras(filas) {
    const ul = $('lista-horas');
    ul.innerHTML = '';
    for (const f of filas) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapar(f.etiqueta)}</span><strong>${escapar(f.valor)}</strong>`;
      ul.appendChild(li);
    }
  }

  function pintarComparativa(c) {
    $('cifra-aprobada').textContent = c.aprobadoTexto;
    $('cifra-propuesta').textContent = c.propuestoTexto;
    $('cifra-diferencia').textContent = c.hayDiferencia
      ? `${c.sube ? '+' : '−'}${c.diferenciaTexto} en propuestas sin aprobar`
      : 'no hay propuestas pendientes: las dos cifras son la misma';
    $('cifra-diferencia').className = c.hayDiferencia ? 'diferencia hay' : 'diferencia cero';
  }

  function avisar(texto) {
    const p = document.createElement('p');
    p.className = 'error-msg';
    p.textContent = texto;
    $('avisos').appendChild(p);
  }

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
  }
}
