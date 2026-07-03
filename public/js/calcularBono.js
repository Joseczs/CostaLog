// ═══════════════════════════════════════════════════════════════════════
// calcularBono.js — función pura. Solo depende de reglasBono.config.js
// ═══════════════════════════════════════════════════════════════════════

import { REGLAS_BONO } from './reglasBono.config.js';

/**
 * @param {object} tarea - documento de /proyectos/{id}/tareas/{id}
 * @param {Array}  registrosHoras - array de documentos de registrosHoras
 * @returns {object} { bonoTotal, hhReales, hhEconomizadas, distribucion, motivo? }
 */
export function calcularBono(tarea, registrosHoras) {
  const condiciones = tarea.condiciones || {};
  const todasCompletadas = Object.values(condiciones).length > 0 &&
    Object.values(condiciones).every(v => v === true);

  if (REGLAS_BONO.requiereActividadCompletada100 && !todasCompletadas) {
    return { bonoTotal: 0, hhReales: 0, hhEconomizadas: 0, distribucion: [], motivo: 'Actividad no completada al 100%' };
  }

  const hhReales = registrosHoras.reduce((sum, r) => sum + (r.totalHH || 0), 0);

  if (REGLAS_BONO.criterioNoPago(hhReales, tarea.hhEstimadas)) {
    return { bonoTotal: 0, hhReales, hhEconomizadas: 0, distribucion: [], motivo: 'HH reales ≥ HH estimadas' };
  }

  const hhEconomizadas = tarea.hhEstimadas - hhReales;
  let bonoTotal = hhEconomizadas * REGLAS_BONO.valorPorHHEconomizada;

  if (tarea.costoActividadEstimado) {
    const tope = tarea.costoActividadEstimado * REGLAS_BONO.topeBonoPctCostoActividad;
    bonoTotal = Math.min(bonoTotal, tope);
  }

  const pesoTotal = registrosHoras.reduce(
    (sum, r) => sum + (r.totalHH || 0) * (REGLAS_BONO.pesoPorRol[r.rol] ?? 1), 0
  );

  const distribucion = registrosHoras.map(r => {
    const peso = (r.totalHH || 0) * (REGLAS_BONO.pesoPorRol[r.rol] ?? 1);
    return {
      empleadoId: r.empleadoId || r.id,
      nombre: r.nombre,
      rol: r.rol,
      totalHH: r.totalHH || 0,
      monto: pesoTotal > 0 ? bonoTotal * (peso / pesoTotal) : 0
    };
  });

  return { bonoTotal, hhReales, hhEconomizadas, distribucion };
}
