/**
 * calculoMeta.js
 * Motor de cálculo de bonos. Funciones PURAS: sin Firestore, sin DOM, sin red.
 * Todo lo que entra son objetos planos; todo lo que sale son números.
 *
 * Esto permite correr la suite de tests sin credenciales ni conexión.
 */

import { tarifaHoraEconomizada, tarifaDiaAnticipado } from './reglasBono.config.js';

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const MS_DIA = 86400000;

/** Convierte Date | Timestamp de Firestore | string ISO a Date. */
export function aFecha(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate(); // Firestore Timestamp
  return new Date(v);
}

/**
 * Diferencia en días calendario completos entre dos fechas (hasta - desde).
 * Normaliza a medianoche UTC para que el resultado no dependa de la hora.
 */
export function diffDias(hasta, desde) {
  const a = aFecha(hasta);
  const b = aFecha(desde);
  if (!a || !b) return 0;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / MS_DIA);
}

const suma = (xs) => xs.reduce((s, x) => s + x, 0);
const promedio = (xs) => (xs.length ? suma(xs) / xs.length : 0);

/* ------------------------------------------------------------------ */
/* Hitos                                                               */
/* ------------------------------------------------------------------ */

/** HH presupuestadas del hito. Los créditos traen cantidad negativa y restan solos. */
export function hhEstimadasHito(hito) {
  return (hito.cantidad || 0) * (hito.hhUnidad || 0);
}

/** HH ganadas (valor ganado) del hito, según su porcentaje de avance. */
export function hhGanadasHito(hito) {
  return ((hito.avancePct || 0) / 100) * hhEstimadasHito(hito);
}

/* ------------------------------------------------------------------ */
/* Bloques de la meta                                                  */
/* ------------------------------------------------------------------ */

/**
 * Días de entrega anticipada.
 * D-06: si la entrega es tardía el resultado es 0, nunca negativo.
 * Mientras no exista fechaEntrega real, la meta no ha sido entregada.
 */
export function diasAnticipados(meta, reglas) {
  const entrega = aFecha(meta.fechaEntrega);
  if (!entrega) return 0;
  const d = diffDias(meta.fechaLimite, entrega) + (meta.ajusteDiasHabiles || 0);
  return reglas.permitirDiasAtrasoNegativos ? d : Math.max(0, d);
}

/**
 * Bolsa automática de misceláneos (MIC.01 en el Excel).
 * Siempre se considera al 100 % de avance.
 */
export function hhMiscelaneos(meta, reglas, diasAntic) {
  const dias = diffDias(meta.fechaEvaluacion, meta.fechaInicio) - diasAntic;
  return Math.max(0, dias) * reglas.hhMiscelaneosPorDia;
}

/** D-05: el bono base se pierde por completo si la entrega es tardía. */
export function aplicaBonoBase(meta) {
  const entrega = aFecha(meta.fechaEntrega);
  if (!entrega) return false;
  return diffDias(meta.fechaLimite, entrega) >= 0;
}

/**
 * Factor de calidad: promedio de las evaluaciones bisemanales de
 * ornato/limpieza y de normas SO, como multiplicador 0–1.
 * Sin evaluaciones registradas no hay castigo (factor 1).
 */
export function calcularFactorCalidad(evaluaciones = []) {
  const activas = evaluaciones.filter((e) => e.activo !== false);
  if (!activas.length) return 1;
  const ornato = promedio(activas.map((e) => e.ornato || 0));
  const so = promedio(activas.map((e) => e.so || 0));
  return (ornato + so) / 2 / 100;
}

/* ------------------------------------------------------------------ */
/* HH de producción: asistencia estimada vs. planilla real (D-12)      */
/* ------------------------------------------------------------------ */

/**
 * HH consumidas según la asistencia registrada.
 *
 * IMPORTANTE: aquí NO se pondera por rol. Un ayudante que estuvo 11 horas
 * en obra consumió 11 horas-hombre, igual que un operario. Los pesos
 * 1.0 / 0.5 nunca tuvieron que ver con horas consumidas, solo con reparto
 * de bono, y ya ni eso (D-09).
 *
 * @param {Array} asistencias  documentos de asistencia diaria
 * @param {object} reglas      para `horasJornada` cuando el día no trae horas
 */
export function hhConsumidasEstimadas(asistencias = [], reglas) {
  return suma(
    asistencias
      .filter((d) => d.activo !== false)
      .map((dia) =>
        suma((dia.empleados || []).map((e) =>
          typeof e.horas === 'number' ? e.horas : reglas.horasJornada
        ))
      )
  );
}

/**
 * Determina qué cifra de HH de producción usar y de dónde viene.
 *
 * La planilla es la verdad, pero llega tarde y por período. La asistencia
 * está al día pero es estimada. Se combinan: planilla real hasta la fecha
 * que cubre, asistencia estimada para los días posteriores.
 *
 * @returns {{ valor, hhReal, hhEstimada, origen, diasEstimados, esDefinitivo }}
 *   origen: 'planilla' | 'estimado' | 'mixto' | 'sin_datos'
 */
export function hhProduccion(meta, asistencias = [], reglas) {
  const hhReal = typeof meta.hhPlanilla === 'number' ? meta.hhPlanilla : null;
  const corte = aFecha(meta.hhPlanillaAlCorte);

  // Sin planilla capturada: todo se estima por asistencia.
  if (hhReal === null) {
    const posteriores = asistencias.filter((d) => d.activo !== false);
    const hhEstimada = hhConsumidasEstimadas(posteriores, reglas);
    return {
      valor: hhEstimada,
      hhReal: 0,
      hhEstimada,
      origen: posteriores.length ? 'estimado' : 'sin_datos',
      diasEstimados: posteriores.length,
      esDefinitivo: false,
    };
  }

  // Planilla capturada sin fecha de corte: se asume que cubre todo el período.
  // Es el comportamiento del Excel original y mantiene la compatibilidad.
  if (!corte) {
    return {
      valor: hhReal,
      hhReal,
      hhEstimada: 0,
      origen: 'planilla',
      diasEstimados: 0,
      esDefinitivo: true,
    };
  }

  // Planilla con fecha de corte: se estima solo lo posterior.
  const posteriores = asistencias.filter(
    (d) => d.activo !== false && diffDias(d.fecha, corte) > 0
  );
  const hhEstimada = hhConsumidasEstimadas(posteriores, reglas);

  return {
    valor: hhReal + hhEstimada,
    hhReal,
    hhEstimada,
    origen: hhEstimada > 0 ? 'mixto' : 'planilla',
    diasEstimados: posteriores.length,
    esDefinitivo: hhEstimada === 0,
  };
}

/**
 * Compara la estimación por asistencia contra la planilla real de un período.
 * Una desviación grande y sostenida significa que la asistencia no se está
 * marcando bien, o que hay horas extra que nadie está registrando.
 *
 * @returns {{ desviacion, desviacionPct, alerta }}
 */
export function compararEstimadoVsPlanilla(hhEstimada, hhPlanillaReal, tolerancia = 0.1) {
  const desviacion = hhEstimada - hhPlanillaReal;
  const desviacionPct = hhPlanillaReal === 0 ? 0 : desviacion / hhPlanillaReal;
  return {
    desviacion,
    desviacionPct,
    alerta: Math.abs(desviacionPct) > tolerancia,
  };
}

/* ------------------------------------------------------------------ */
/* Cálculo principal                                                   */
/* ------------------------------------------------------------------ */

/**
 * Calcula el bono completo de una meta.
 *
 * @param {object} meta         documento de la meta
 * @param {Array}  hitos        hitos de la meta (lista, extras y créditos)
 * @param {Array}  evaluaciones evaluaciones bisemanales
 * @param {object} reglas       reglasSnapshot si la meta está cerrada,
 *                              reglasBono del proyecto si sigue abierta
 * @param {Array}  asistencias  asistencia diaria de la meta (D-12).
 *                              Vacío = comportamiento clásico: solo planilla.
 */
export function calcularBonoMeta(meta, hitos = [], evaluaciones = [], reglas, asistencias = []) {
  const vigentes = hitos.filter((h) => h.activo !== false);

  // 1. Días anticipados (no depende de los hitos)
  const diasAntic = diasAnticipados(meta, reglas);

  // 2. Misceláneos (depende de los días anticipados)
  const hhMisc = hhMiscelaneos(meta, reglas, diasAntic);

  // 3. Totales de HH
  const hhEstimadasHitos = suma(vigentes.map(hhEstimadasHito));
  const hhGanadasHitos = suma(vigentes.map(hhGanadasHito));
  const hhEstimadasTotal = hhEstimadasHitos + hhMisc;
  const hhGanadasTotal = hhGanadasHitos + hhMisc;

  // 4. Productividad. La cifra de producción puede ser real, estimada o mixta.
  const produccion = hhProduccion(meta, asistencias, reglas);
  const hhPlanilla = produccion.valor;
  const hhEconomizadas = hhGanadasTotal - hhPlanilla;
  const indicador = hhGanadasTotal === 0 ? 0 : hhEconomizadas / hhGanadasTotal;

  // 5. Componentes del bono
  const tarifaHora = tarifaHoraEconomizada(reglas);
  const tarifaDia = tarifaDiaAnticipado(reglas);

  const bonoBase = aplicaBonoBase(meta) ? meta.bonoBase || 0 : 0;
  const bonoAnticipada = diasAntic * tarifaDia;

  let bonoProductividad = hhEconomizadas * tarifaHora;
  if (!reglas.permitirBonoNegativo) bonoProductividad = Math.max(0, bonoProductividad);

  const bonoTotalBruto = bonoBase + bonoAnticipada + bonoProductividad;

  // 6. Reparto, modulado por calidad
  const factorCalidad = calcularFactorCalidad(evaluaciones);
  const bonoING = (bonoTotalBruto * reglas.pctBonoING) / 100 * factorCalidad;
  const bonoMO = (bonoTotalBruto * reglas.pctBonoMO) / 100 * factorCalidad;

  return {
    hhEstimadasTotal,
    hhGanadasTotal,
    hhMiscelaneos: hhMisc,
    hhPlanilla,
    produccion, // D-12: de dónde viene la cifra y si es definitiva
    hhEconomizadas,
    indicador,
    diasAnticipados: diasAntic,
    tarifaHoraEconomizada: tarifaHora,
    tarifaDiaAnticipado: tarifaDia,
    bonoBase,
    bonoBaseSePerdio: !aplicaBonoBase(meta) && (meta.bonoBase || 0) > 0,
    bonoAnticipada,
    bonoProductividad,
    bonoProductividadSinPiso: hhEconomizadas * tarifaHora, // para mostrar el déficit
    bonoTotalBruto,
    factorCalidad,
    bonoING,
    bonoMO,
  };
}

/* ------------------------------------------------------------------ */
/* Bono por Productividad (tarea / cuadrilla)                          */
/* ------------------------------------------------------------------ */

/** Calcula HH asignadas, monto y si la cuadrilla ganó el BP. */
export function calcularTareaBP(tarea, reglas) {
  const hhEstimadas = (tarea.cantidad || 0) * (tarea.hhUnidad || 0);
  const hhAsignadas = hhEstimadas * reglas.factorRetoBP;
  const montoBP = hhEstimadas * reglas.tarifaBPporHH;
  const hhReal = tarea.hhRealCuadrilla;

  // El BP es binario: se gana completo o no se gana.
  const bpGanado = typeof hhReal === 'number' ? hhReal <= hhAsignadas : null;

  return { hhEstimadas, hhAsignadas, montoBP, bpGanado };
}

/** Valida que los porcentajes manuales de la cuadrilla sumen 100 (D-02). */
export function validarDistribucionBP(cuadrilla = []) {
  const errores = [];
  if (!cuadrilla.length) {
    errores.push('La cuadrilla no puede estar vacía.');
    return errores;
  }
  for (const m of cuadrilla) {
    if (typeof m.pctBP !== 'number' || m.pctBP < 0) {
      errores.push(`Porcentaje inválido para ${m.nombre || m.empleadoId}.`);
    }
  }
  const total = Math.round(suma(cuadrilla.map((m) => m.pctBP || 0)) * 100) / 100;
  if (total !== 100) errores.push(`Los porcentajes suman ${total} %, deben sumar 100 %.`);
  return errores;
}

/**
 * Reparto en enteros por método de MAYOR RESIDUO (largest remainder).
 *
 * Es la única forma de que la suma de las partes sea exactamente el total
 * y que el resultado no dependa de cómo se haya expresado la participación
 * (fracción exacta o porcentaje redondeado). Repartir por `floor` y darle
 * todo el sobrante al mayor produce diferencias de ₡1–2 por tarea que se
 * acumulan en el libro de pagos.
 *
 * @param {number} total       monto a repartir
 * @param {number[]} fracciones participaciones (misma escala, no necesitan sumar 1)
 * @returns {number[]} enteros que suman exactamente Math.round(total)
 */
export function repartirEnteros(total, fracciones = []) {
  const objetivo = Math.round(total);
  const sumaFr = suma(fracciones);
  if (!fracciones.length || sumaFr === 0) return fracciones.map(() => 0);

  const exactos = fracciones.map((f) => (objetivo * f) / sumaFr);
  const base = exactos.map(Math.floor);
  let residuo = objetivo - suma(base);

  // Reparte el residuo entre los mayores restos decimales; empates por índice.
  const orden = exactos
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);

  for (let k = 0; residuo > 0; k = (k + 1) % orden.length) {
    base[orden[k].i] += 1;
    residuo -= 1;
  }
  return base;
}

/** Reparte el monto del BP en colones enteros según los porcentajes manuales. */
export function repartirBP(montoBP, cuadrilla = []) {
  const montos = repartirEnteros(montoBP, cuadrilla.map((m) => m.pctBP || 0));
  return cuadrilla.map((m, i) => ({ ...m, monto: montos[i] }));
}

/* ------------------------------------------------------------------ */
/* Migración de pesos 1.0 / 0.5 a porcentaje manual (D-09)             */
/* ------------------------------------------------------------------ */

const PESOS_LEGADO = { operario: 1.0, ayudante: 0.5 };

/**
 * Convierte una cuadrilla con pesos por rol a porcentajes manuales.
 * La conversión es exacta: peso / suma de pesos. El residuo de redondeo
 * se asigna al de mayor participación para cuadrar a 100 %.
 *
 * También sirve como botón "repartir por rol" en la UI de tareas nuevas.
 */
export function pesosAPorcentajes(cuadrilla = []) {
  const peso = (m) => PESOS_LEGADO[m.rol] ?? 0;
  const total = suma(cuadrilla.map(peso));
  if (total === 0) throw new Error('Cuadrilla sin pesos válidos: no se puede repartir.');

  // 6 decimales: 2 decimales no alcanzan para representar 1/3 sin desviar
  // los colones del reparto histórico. Se cuadra a 100 con mayor residuo.
  const centesimas = repartirEnteros(100 * 1e6, cuadrilla.map(peso));
  return cuadrilla.map((m, i) => ({ ...m, pctBP: centesimas[i] / 1e6 }));
}

/**
 * Reparto histórico por pesos, tal como lo hacía el código anterior.
 * Se conserva ÚNICAMENTE para verificar la migración: el script debe comprobar
 * que el reparto por pesos y el reparto por porcentajes dan el mismo resultado
 * en colones. No debe usarse en producción.
 */
export function repartirPorPesosLegado(montoBP, cuadrilla = []) {
  const peso = (m) => PESOS_LEGADO[m.rol] ?? 0;
  const montos = repartirEnteros(montoBP, cuadrilla.map(peso));
  return cuadrilla.map((m, i) => ({ ...m, monto: montos[i] }));
}
