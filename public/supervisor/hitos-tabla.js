// ═══════════════════════════════════════════════════════════════════════
// hitos-tabla.js — Bloque 4b. La tabla de hitos del detalle de meta.
//
// Partido en dos, como todo lo del bloque 3 en adelante: arriba el MODELO
// (puro, sin DOM, probable desde Node), abajo el PINTADO. La prueba de
// aceptación —2 697,10 y 1 092,25— corre contra el modelo, no contra el
// navegador.
// ═══════════════════════════════════════════════════════════════════════

import { hhEstimadasHito, hhGanadasHito } from '../js/core/calculoMeta.js';
import { formatearHoras, formatearNumero, SIN_DATO } from '../js/formato.js';

/** El renglón de misceláneos NO existe en Firestore: lo genera el motor
 *  (§4-bis). Se le pone un id imposible para que ningún manejador lo
 *  confunda con un documento. */
export const ID_MISCELANEOS = '__mic01__';

/* ══════════════════════════════════════════════════════════════════════
   MODELO — puro
   ══════════════════════════════════════════════════════════════════════ */

/**
 * El renglón sintético `MIC.01`, construido desde el resultado del motor.
 *
 * Se pinta a propósito (D-4b-04). Si no estuviera, los 2 697,10 del pie no
 * cuadrarían con la suma de los 52 renglones de arriba y alguien acabaría
 * "arreglando" un total que está bien. Un renglón calculado que se ve
 * calculado explica la diferencia solo.
 */
export function hitoMiscelaneos(hhMisc, reglas) {
  return {
    id: ID_MISCELANEOS,
    codigo: 'MIC.01',
    descripcion: 'Misceláneos',
    unidad: 'HH',
    cantidad: null,
    hhUnidad: null,
    avancePct: 100, // siempre, por definición
    avancePropuesto: null,
    tipo: 'miscelaneo',
    sintetico: true,
    hhMisc,
    hhPorDia: reglas?.hhMiscelaneosPorDia ?? null,
  };
}

/**
 * Un hito → una fila, ya en texto. Sin DOM: devuelve datos.
 *
 * @param {object} hito — documento del repositorio, o el sintético
 * @param {{ editable?: boolean }} [opciones]
 */
export function filaDeHito(hito, { editable = true } = {}) {
  const sintetico = hito.sintetico === true;

  // El sintético no tiene cantidad ni rendimiento: sus horas SON el dato.
  const estimadas = sintetico ? hito.hhMisc : hhEstimadasHito(hito);
  const ganadas = sintetico ? hito.hhMisc : hhGanadasHito(hito);

  const hayPropuesta =
    hito.avancePropuesto !== null && hito.avancePropuesto !== undefined;

  // El delta en horas, que es el punto entero de esta columna: un punto
  // porcentual no le dice nada a nadie, dos horas y media sí.
  const ganadasPropuestas = hayPropuesta
    ? (hito.avancePropuesto / 100) * estimadas
    : null;

  return {
    id: hito.id,
    codigo: hito.codigo ?? SIN_DATO,
    descripcion: hito.descripcion ?? '',
    unidad: hito.unidad ?? '',
    tipo: hito.tipo ?? 'lista',
    sintetico,
    // Solo se edita lo que es documento y la meta está abierta.
    editable: editable && !sintetico,
    cantidad: Number.isFinite(hito.cantidad) ? formatearNumero(hito.cantidad) : SIN_DATO,
    hhUnidad: Number.isFinite(hito.hhUnidad) ? formatearNumero(hito.hhUnidad) : SIN_DATO,
    hhEstimadas: estimadas,
    hhEstimadasTexto: formatearHoras(estimadas, { conSufijo: false }),
    avancePct: Number.isFinite(hito.avancePct) ? hito.avancePct : 0,
    hhGanadas: ganadas,
    hhGanadasTexto: formatearHoras(ganadas, { conSufijo: false }),
    // Cuánto vale UN punto de avance en horas. Es lo que convierte el campo
    // en una decisión informada en vez de un número que se digita.
    porPunto: estimadas / 100,
    porPuntoTexto: formatearHoras(estimadas / 100, { conSufijo: false }),
    propuesta: hayPropuesta
      ? {
          valor: hito.avancePropuesto,
          delta: ganadasPropuestas - ganadas,
          deltaTexto: formatearHoras(ganadasPropuestas - ganadas),
          // El signo importa: una propuesta puede BAJAR el avance.
          sube: ganadasPropuestas > ganadas,
        }
      : null,
    // Un crédito trae cantidad negativa y resta. Que se note en la fila.
    negativo: estimadas < 0,
  };
}

/**
 * El modelo completo de la tabla: los hitos reales más el sintético al
 * final, y el pie con los dos totales de la prueba de aceptación.
 *
 * @param {Array} hitos      — los que devolvió el repositorio
 * @param {object} resultado — lo que devolvió `calcularBonoMeta`
 * @param {object} reglas
 * @param {{ editable?: boolean }} [opciones]
 */
export function modeloTabla(hitos, resultado, reglas, { editable = true } = {}) {
  const filas = hitos.map((h) => filaDeHito(h, { editable }));

  // El sintético se agrega solo si el motor generó horas de misceláneos.
  if (Number.isFinite(resultado?.hhMiscelaneos) && resultado.hhMiscelaneos !== 0) {
    filas.push(filaDeHito(hitoMiscelaneos(resultado.hhMiscelaneos, reglas), { editable }));
  }

  return {
    filas,
    pendientes: filas.filter((f) => f.propuesta).length,
    pie: {
      // Se leen del motor, NO se resuelven sumando las filas: el motor es la
      // única fuente. Si un día no coinciden, el que tiene razón es él.
      hhEstimadasTotal: resultado.hhEstimadasTotal,
      hhGanadasTotal: resultado.hhGanadasTotal,
      hhEstimadasTexto: formatearHoras(resultado.hhEstimadasTotal, { conSufijo: false }),
      hhGanadasTexto: formatearHoras(resultado.hhGanadasTotal, { conSufijo: false }),
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════
   PINTADO — DOM
   ══════════════════════════════════════════════════════════════════════ */

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

/**
 * Pinta el modelo dentro de un `<tbody>` y engancha los manejadores.
 *
 * @param {HTMLElement} tbody
 * @param {object} modelo — el de `modeloTabla`
 * @param {{ onAvance: Function, onAprobar: Function, onDescartar: Function }} manejadores
 */
export function pintarTabla(tbody, modelo, manejadores = {}) {
  const { onAvance, onAprobar, onDescartar } = manejadores;
  tbody.innerHTML = '';

  for (const f of modelo.filas) {
    const tr = document.createElement('tr');
    if (f.sintetico) tr.className = 'fila-sintetica';
    if (f.negativo) tr.classList.add('fila-credito');
    if (f.propuesta) tr.classList.add('fila-con-propuesta');

    const campoAvance = f.editable
      ? `<input type="number" class="campo-avance" data-hito="${escapar(f.id)}"
                value="${f.avancePct}" min="0" max="100" step="0.01"
                aria-label="Porcentaje de avance de ${escapar(f.codigo)}">`
      : `<span class="avance-fijo" title="Renglón calculado: no se edita">${f.avancePct} %</span>`;

    tr.innerHTML = `
      <td class="col-codigo">${escapar(f.codigo)}</td>
      <td class="col-desc">
        ${escapar(f.descripcion)}
        ${f.sintetico ? '<span class="marca-calculado">calculado</span>' : ''}
        ${f.tipo === 'credito' ? '<span class="marca-credito">crédito</span>' : ''}
        ${f.tipo === 'extra' ? '<span class="marca-extra">extra</span>' : ''}
      </td>
      <td>${escapar(f.unidad)}</td>
      <td class="num">${escapar(f.cantidad)}</td>
      <td class="num">${escapar(f.hhUnidad)}</td>
      <td class="num">${escapar(f.hhEstimadasTexto)}</td>
      <td class="col-avance">
        ${campoAvance}
        <div class="por-punto">1 % = ${escapar(f.porPuntoTexto)} HH</div>
      </td>
      <td class="num col-ganadas">${escapar(f.hhGanadasTexto)}</td>
      <td class="col-propuesta">${propuestaHTML(f)}</td>`;

    tbody.appendChild(tr);
  }

  // Se enganchan una sola vez por pintado, sobre los nodos recién creados.
  if (onAvance) {
    // `change`, no `input`: se escribe al SALIR del campo (D-4b-05). Con
    // `input`, "3" en el camino de "35" sería un avance guardado.
    tbody.querySelectorAll('.campo-avance').forEach((el) => {
      el.addEventListener('change', () => onAvance(el.dataset.hito, el.value, el));
    });
  }
  if (onAprobar) {
    tbody.querySelectorAll('[data-aprobar]').forEach((el) => {
      el.addEventListener('click', () => onAprobar(el.dataset.aprobar));
    });
  }
  if (onDescartar) {
    tbody.querySelectorAll('[data-descartar]').forEach((el) => {
      el.addEventListener('click', () => onDescartar(el.dataset.descartar));
    });
  }
}

/** La propuesta pendiente tiene que verse DISTINTA del valor aprobado. Si
 *  las dos cifras se ven iguales, el control de D-11 no sirve de nada. */
function propuestaHTML(f) {
  if (!f.propuesta) return '<span class="sin-propuesta">—</span>';
  const signo = f.propuesta.sube ? '+' : '';
  return `
    <div class="propuesta">
      <span class="propuesta-valor">propone ${f.propuesta.valor} %</span>
      <span class="propuesta-delta ${f.propuesta.sube ? 'sube' : 'baja'}">
        ${signo}${escapar(f.propuesta.deltaTexto)}
      </span>
      <span class="propuesta-acciones">
        <button type="button" class="btn-mini btn-aprobar" data-aprobar="${escapar(f.id)}">Aprobar</button>
        <button type="button" class="btn-mini btn-descartar" data-descartar="${escapar(f.id)}">Descartar</button>
      </span>
    </div>`;
}
