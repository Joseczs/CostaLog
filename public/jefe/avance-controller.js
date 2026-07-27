// ═══════════════════════════════════════════════════════════════════════
// avance-controller.js — Bloque 4c. Rol `supervisor` (Maestro de Obras).
//
// La mitad de PROPONER de D-11. Es la única entrada de datos reales del
// sistema: todo lo que la aplicación sabe de la obra pasa por acá.
//
// ── Restricción no negociable ─────────────────────────────────────────
// Esta pantalla vive en un teléfono, en obra, con señal irregular y manos
// sucias. Se diseñó PRIMERO para móvil; el escritorio es lo que se adapta,
// no al revés. Si proponer un avance costara más de un gesto, o si fallara
// callado sin red, el dato llegaría tarde o llegaría inventado — y todo el
// edificio de cálculo se apoya en él.
//
// ── Lo que este rol NO puede hacer, por reglas del servidor ───────────
// • Escribir `avancePct`. Solo alcanza `avancePropuesto`. Es el contrapeso
//   de D-11 y está en `firestore.rules`, no en esta interfaz.
// • Escribir `totales` en la meta. Ese mapa lo escribe el ingeniero desde
//   el 4b. Acá NO se llama `guardarTotales`: fallaría, y con razón.
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

/** Estados de meta sobre los que tiene sentido reportar avance. */
export const ESTADOS_REPORTABLES = Object.freeze(['abierta', 'evaluada']);

/**
 * Copia de los hitos con las propuestas aplicadas sobre `avancePct`.
 *
 * Es lo que permite calcular la SEGUNDA cifra de la proyección. El original
 * no se toca: la primera cifra —la de los avances ya aprobados— tiene que
 * seguir siendo calculable, porque mostrar solo la proyección con propuestas
 * sería enseñarle al Maestro de Obras un bono que nadie ha aprobado.
 */
export function hitosConPropuestas(hitos = []) {
  return hitos.map((h) =>
    h.avancePropuesto === null || h.avancePropuesto === undefined
      ? h
      : { ...h, avancePct: h.avancePropuesto },
  );
}

/**
 * Orden de trabajo del día: primero lo que más horas tiene pendientes.
 *
 * El Maestro decide por la mañana dónde poner a la gente, y hoy lo hace de
 * memoria. Ordenar por horas pendientes es lo que convierte esta lista en
 * esa decisión: arriba está lo que más mueve el bono.
 */
export function ordenarPorPendiente(hitos = []) {
  const pendiente = (h) => {
    const est = (h.cantidad ?? 0) * (h.hhUnidad ?? 0);
    const avance = h.avancePropuesto ?? h.avancePct ?? 0;
    return est - (avance / 100) * est;
  };
  return [...hitos].sort((a, b) => pendiente(b) - pendiente(a));
}

/**
 * Una tarjeta. En el teléfono no hay tabla: hay tarjetas grandes con un
 * dato dominante y todo lo demás en letra chica.
 */
export function tarjetaDeHito(hito) {
  const estimadas = (hito.cantidad ?? 0) * (hito.hhUnidad ?? 0);
  const aprobado = Number.isFinite(hito.avancePct) ? hito.avancePct : 0;
  const hayPropuesta =
    hito.avancePropuesto !== null && hito.avancePropuesto !== undefined;
  const valor = hayPropuesta ? hito.avancePropuesto : aprobado;

  const ganadasAprobadas = (aprobado / 100) * estimadas;
  const ganadasValor = (valor / 100) * estimadas;

  return {
    id: hito.id,
    codigo: hito.codigo ?? SIN_DATO,
    descripcion: hito.descripcion ?? '',
    unidad: hito.unidad ?? '',
    estimadas,
    estimadasTexto: formatearHoras(estimadas),
    aprobado,
    valor,
    hayPropuesta,
    // El delta contra lo aprobado, en horas y con signo. Es lo que el
    // Maestro está pidiendo que le reconozcan.
    delta: ganadasValor - ganadasAprobadas,
    deltaTexto: formatearHoras(ganadasValor - ganadasAprobadas),
    sube: ganadasValor > ganadasAprobadas,
    // Horas que faltan para cerrar el hito. Es el número por el que se
    // ordena la lista y el que decide dónde va la gente mañana.
    pendiente: estimadas - ganadasValor,
    pendienteTexto: formatearHoras(estimadas - ganadasValor),
    completo: valor >= 100,
    porPuntoTexto: formatearHoras(estimadas / 100, { conSufijo: false }),
  };
}

/**
 * Las DOS cifras de la proyección. Nunca una sola (restricción del plan).
 *
 * Un bono que solo muestra el escenario con propuestas es una promesa que
 * nadie firmó: el ingeniero todavía no aprobó nada. Mostrar las dos deja
 * ver exactamente qué está en juego y qué ya está ganado.
 */
export function proyeccion(resAprobado, resPropuesto) {
  const aprobado = resAprobado?.bonoMO ?? 0;
  const propuesto = resPropuesto?.bonoMO ?? 0;
  return {
    aprobado,
    propuesto,
    diferencia: propuesto - aprobado,
    aprobadoTexto: formatearColones(aprobado),
    propuestoTexto: formatearColones(propuesto),
    diferenciaTexto: formatearColones(propuesto - aprobado),
    hayDiferencia: Math.round(propuesto - aprobado) !== 0,
    // Si la producción no es definitiva, la cifra no puede verse definitiva.
    esDefinitivo: resAprobado?.produccion?.esDefinitivo === true,
  };
}

/** Mismo validador que el 4b: se rechaza con el motivo, no se corrige solo. */
export function validarAvance(valor) {
  if (valor === '' || valor === null || valor === undefined) {
    return { ok: false, error: 'Escribí un porcentaje.' };
  }
  const n = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n)) return { ok: false, error: 'Tiene que ser un número.' };
  if (n < 0 || n > 100) return { ok: false, error: 'El avance va de 0 a 100.' };
  return { ok: true, valor: n };
}

/* ══════════════════════════════════════════════════════════════════════
   MITAD DE NAVEGADOR
   ══════════════════════════════════════════════════════════════════════ */

if (typeof document !== 'undefined' && document.getElementById('lista-hitos')) {
  arrancar();
}

async function arrancar() {
  const [{ ROL_SUPERVISOR }, { protegerPagina, cerrarSesion }, { renderSidebar },
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

  let proyectoId = null;
  let meta = null;
  let hitos = [];
  let evaluaciones = [];
  let reglas = null;
  let uid = null;
  /** Ids con la propuesta escrita pero no confirmada por el servidor. */
  const sinEnviar = new Map();

  protegerPagina([ROL_SUPERVISOR], async (perfil) => {
    renderSidebar(perfil);
    $('nombre-usuario').textContent = perfil.nombre;
    uid = perfil.uid;
    await cargarProyectos();
  });

  $('btn-logout').addEventListener('click', async () => {
    await cerrarSesion();
    window.location.href = '/index.html';
  });

  // ── Elegir dónde se reporta ──────────────────────────────────────────

  async function cargarProyectos() {
    let proyectos = [];
    try {
      // Bloque 5b: solo los proyectos donde este supervisor está asignado.
      // `soloDe` no es cosmético — sin él la consulta ni siquiera pasa las
      // reglas, porque Firestore evalúa la consulta entera, no sus resultados.
      proyectos = await proyectosRepo.listar({ soloDe: uid });
    } catch (err) {
      return avisar(`No se pudieron cargar los proyectos: ${err.message}`);
    }
    if (!proyectos.length) {
      return avisar(
        'No tenés ningún proyecto asignado. Pedile al Ingeniero que te asigne uno.',
      );
    }

    for (const p of proyectos) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nombre ?? p.id;
      $('selector-proyecto').appendChild(opt);
    }

    const pedido = new URLSearchParams(window.location.search).get('proyecto');
    if (pedido && proyectos.some((p) => p.id === pedido)) {
      $('selector-proyecto').value = pedido;
      await cargarMeta(pedido);
    } else if (proyectos.length === 1) {
      $('selector-proyecto').value = proyectos[0].id;
      await cargarMeta(proyectos[0].id);
    }
  }

  $('selector-proyecto').addEventListener('change', async (e) => {
    if (e.target.value) await cargarMeta(e.target.value);
  });

  async function cargarMeta(pid) {
    proyectoId = pid;
    $('seccion-avance').style.display = 'none';
    $('avisos').innerHTML = '';

    try {
      const [proyecto, metas] = await Promise.all([
        proyectosRepo.obtener(pid),
        metasRepo.listar(pid),
      ]);

      // La meta reportable más reciente. Si hay varias abiertas, la de
      // número mayor: el repositorio ya las devuelve en ese orden.
      meta = metas.find((m) => ESTADOS_REPORTABLES.includes(m.estado)) ?? null;

      if (!meta) {
        return avisar(
          'Este proyecto no tiene ninguna meta abierta. Cuando el Ingeniero abra una, aparece acá.',
        );
      }

      reglas = normalizarReglas(meta.reglasSnapshot ?? proyecto?.reglasBono ?? {});
      [hitos, evaluaciones] = await Promise.all([
        hitosRepo.listar(pid, meta.id),
        metasRepo.listarEvaluaciones(pid, meta.id),
      ]);

      $('titulo-meta').textContent = `Meta ${meta.numero ?? ''}`.trim();
      $('fecha-limite').textContent = formatearFecha(meta.fechaLimite);
      $('seccion-avance').style.display = 'block';
      pintar();
    } catch (err) {
      avisar(`No se pudo cargar la meta: ${err.message}`);
    }
  }

  // ── Pintado ──────────────────────────────────────────────────────────

  function pintar() {
    pintarProyeccion();

    const lista = $('lista-hitos');
    lista.innerHTML = '';
    const ordenados = ordenarPorPendiente(hitos);

    const soloPendientes = $('filtro-pendientes').checked;
    const visibles = soloPendientes
      ? ordenados.filter((h) => tarjetaDeHito(h).completo === false)
      : ordenados;

    if (!visibles.length) {
      lista.innerHTML =
        '<p class="vacio">No queda ningún hito pendiente. Quitá el filtro para ver los terminados.</p>';
      return;
    }

    for (const hito of visibles) {
      lista.appendChild(tarjeta(tarjetaDeHito(hito)));
    }
  }

  function tarjeta(t) {
    const div = document.createElement('article');
    div.className = 'tarjeta-hito';
    if (t.hayPropuesta) div.classList.add('con-propuesta');
    if (t.completo) div.classList.add('completo');

    const estado = sinEnviar.has(t.id) ? sinEnviar.get(t.id) : null;

    div.innerHTML = `
      <div class="tarjeta-cabecera">
        <span class="codigo">${escapar(t.codigo)}</span>
        <span class="pendiente">${escapar(t.pendienteTexto)} pendientes</span>
      </div>
      <p class="descripcion">${escapar(t.descripcion)}</p>

      <div class="control-avance">
        <button type="button" class="btn-paso" data-paso="-5" aria-label="Bajar 5 por ciento">−5</button>
        <input type="number" class="campo-avance" inputmode="decimal"
               value="${t.valor}" min="0" max="100" step="1"
               aria-label="Avance de ${escapar(t.codigo)}">
        <span class="signo-pct">%</span>
        <button type="button" class="btn-paso" data-paso="5" aria-label="Subir 5 por ciento">+5</button>
        <button type="button" class="btn-cien" data-paso="cien">100 %</button>
      </div>

      <div class="tarjeta-pie">
        <span class="delta ${t.sube ? 'sube' : t.delta < 0 ? 'baja' : ''}">
          ${t.delta === 0 ? 'igual a lo aprobado' : `${t.sube ? '+' : ''}${escapar(t.deltaTexto)} sobre lo aprobado`}
        </span>
        <span class="por-punto">1 % = ${escapar(t.porPuntoTexto)} HH · aprobado ${t.aprobado} %</span>
      </div>

      <div class="estado-envio ${estado ? estado.clase : ''}">${estado ? escapar(estado.texto) : ''}</div>`;

    const campo = div.querySelector('.campo-avance');

    // Un gesto: se toca el paso o se escribe, y sale. No hay botón "guardar"
    // que se pueda olvidar con el teléfono en el bolsillo.
    campo.addEventListener('change', () => proponer(t.id, campo.value, div));

    div.querySelectorAll('[data-paso]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const paso = btn.dataset.paso;
        const actual = Number(campo.value) || 0;
        const nuevo = paso === 'cien' ? 100 : Math.min(100, Math.max(0, actual + Number(paso)));
        campo.value = nuevo;
        proponer(t.id, nuevo, div);
      });
    });

    return div;
  }

  function pintarProyeccion() {
    const resAprobado = calcularBonoMeta(meta, hitos, evaluaciones, reglas, []);
    const resPropuesto = calcularBonoMeta(
      meta, hitosConPropuestas(hitos), evaluaciones, reglas, [],
    );
    const p = proyeccion(resAprobado, resPropuesto);

    $('bono-aprobado').textContent = p.aprobadoTexto;
    $('bono-propuesto').textContent = p.propuestoTexto;
    $('bono-diferencia').textContent = p.hayDiferencia
      ? `${p.diferencia > 0 ? '+' : ''}${p.diferenciaTexto} esperando aprobación`
      : 'sin propuestas pendientes';
    $('bono-diferencia').className = p.hayDiferencia ? 'diferencia hay' : 'diferencia cero';

    // D-12: la cifra nunca va pelada. Mientras la producción no sea
    // definitiva, esto es una proyección y tiene que decirlo.
    $('nota-proyeccion').textContent = p.esDefinitivo
      ? 'Calculado con la planilla del período.'
      : 'Proyección: la planilla del período todavía no está cerrada.';
  }

  // ── Escritura ────────────────────────────────────────────────────────

  async function proponer(hitoId, valorCrudo, tarjetaEl) {
    const hito = hitos.find((h) => h.id === hitoId);
    if (!hito) return;

    const v = validarAvance(valorCrudo);
    if (!v.ok) {
      marcar(tarjetaEl, 'error', v.error);
      return;
    }

    marcar(tarjetaEl, 'enviando', 'enviando…');
    sinEnviar.set(hitoId, { clase: 'enviando', texto: 'enviando…' });

    try {
      await hitosRepo.proponerAvance(proyectoId, meta.id, hitoId, v.valor, uid);
      hito.avancePropuesto = v.valor;
      sinEnviar.delete(hitoId);
      marcar(tarjetaEl, 'ok', 'enviado ✓');
      // Se repinta solo la proyección: repintar la lista entera movería las
      // tarjetas de lugar bajo el dedo, que en obra es como perder el dato.
      pintarProyeccion();
    } catch (err) {
      // Sin red el dato NO se pierde en silencio: queda a la vista, en rojo,
      // con un botón para reintentar. Un fallo callado es un dato inventado.
      sinEnviar.set(hitoId, { clase: 'error', texto: 'sin enviar — tocá para reintentar' });
      marcar(tarjetaEl, 'error', 'sin enviar — tocá para reintentar');
      const aviso = tarjetaEl.querySelector('.estado-envio');
      aviso.onclick = () => proponer(hitoId, v.valor, tarjetaEl);
      actualizarContadorPendientes();
    }
  }

  function marcar(tarjetaEl, clase, texto) {
    const el = tarjetaEl.querySelector('.estado-envio');
    el.className = `estado-envio ${clase}`;
    el.textContent = texto;
  }

  function actualizarContadorPendientes() {
    const n = [...sinEnviar.values()].filter((e) => e.clase === 'error').length;
    $('sin-enviar').textContent = n
      ? `${n} ${n === 1 ? 'cambio' : 'cambios'} sin enviar`
      : '';
    $('sin-enviar').style.display = n ? 'block' : 'none';
  }

  $('filtro-pendientes').addEventListener('change', pintar);

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
