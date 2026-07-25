/**
 * reglasBono.config.js
 * ÚNICA fuente de verdad para las reglas de cálculo de bonos de COSTACON.
 *
 * Ninguna constante de este archivo puede aparecer hardcodeada en controladores,
 * vistas ni servicios. Si un número de negocio no está aquí, está mal.
 *
 * Derivado de INCENTIVOS_MO_OG_META_1_UNIDEPRO.xlsx (hoja `Hoja1`).
 */

/**
 * Valores por defecto al crear un proyecto nuevo.
 * Cada proyecto guarda su propia copia en `proyectos/{id}.reglasBono`,
 * y cada meta cerrada congela la suya en `metas/{id}.reglasSnapshot`.
 */
export const REGLAS_BONO_DEFAULT = Object.freeze({
  // --- Costos base del proyecto ---
  costoPromHH: 3200, // ₡ por hora-hombre
  costoDiarioAdmin: 50000, // ₡ por día de administración

  // --- Porcentajes del bono por meta ---
  pctBonoEntregaAnticipada: 30, // % aplicado sobre costoDiarioAdmin
  pctBonoHoraProductividad: 20, // % aplicado sobre costoPromHH

  // --- Reparto del bono por meta (deben sumar <= 100) ---
  pctBonoMO: 100, // Maestro de Obras  (rol `supervisor`)
  pctBonoING: 0, // Ingeniero Residente (rol `ingeniero`)

  // --- Operación ---
  horasJornada: 11,
  hhMiscelaneosPorDia: 7, // bolsa automática MIC.01

  // --- Bono por Productividad (tarea / cuadrilla) ---
  factorRetoBP: 0.9, // HH asignadas = HH estimadas x factor
  tarifaBPporHH: 200, // ₡ de BP por HH estimada del hito

  // --- Políticas ---
  permitirBonoNegativo: false, // D-01: piso en ₡0
  permitirDiasAtrasoNegativos: false, // D-06: atraso no descuenta
});

/* ------------------------------------------------------------------ */
/* Tarifas DERIVADAS. Nunca constantes.                                */
/* ------------------------------------------------------------------ */

/**
 * ₡ por cada HH economizada.
 * Con los valores por defecto: 3200 * 20 / 100 = ₡640.
 * Si cambia el costo promedio HH del proyecto, esta tarifa cambia con él.
 */
export function tarifaHoraEconomizada(reglas) {
  return (reglas.costoPromHH * reglas.pctBonoHoraProductividad) / 100;
}

/**
 * ₡ por cada día de entrega anticipada.
 * Con los valores por defecto: 50000 * 30 / 100 = ₡15 000.
 * OJO: el 30 % NO es un tope de costo. No existe ningún cap en este modelo.
 */
export function tarifaDiaAnticipado(reglas) {
  return (reglas.costoDiarioAdmin * reglas.pctBonoEntregaAnticipada) / 100;
}

/* ------------------------------------------------------------------ */
/* Validación                                                          */
/* ------------------------------------------------------------------ */

const NUMERICOS = [
  'costoPromHH',
  'costoDiarioAdmin',
  'pctBonoEntregaAnticipada',
  'pctBonoHoraProductividad',
  'pctBonoMO',
  'pctBonoING',
  'horasJornada',
  'hhMiscelaneosPorDia',
  'factorRetoBP',
  'tarifaBPporHH',
];

/**
 * Valida un objeto de reglas antes de guardarlo en Firestore.
 * @returns {string[]} lista de errores; vacía si todo está bien.
 */
export function validarReglasBono(reglas) {
  const errores = [];

  for (const campo of NUMERICOS) {
    const v = reglas[campo];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errores.push(`"${campo}" debe ser un número.`);
    } else if (v < 0) {
      errores.push(`"${campo}" no puede ser negativo.`);
    }
  }

  if (reglas.pctBonoMO + reglas.pctBonoING > 100) {
    errores.push('pctBonoMO + pctBonoING no puede superar 100 %.');
  }
  if (reglas.factorRetoBP > 1) {
    errores.push('factorRetoBP no puede ser mayor que 1 (sería un reto negativo).');
  }
  if (reglas.hhMiscelaneosPorDia > reglas.horasJornada) {
    errores.push('hhMiscelaneosPorDia no puede superar las horas de jornada.');
  }

  return errores;
}

/** Completa un objeto parcial con los valores por defecto. */
export function normalizarReglas(parciales = {}) {
  return { ...REGLAS_BONO_DEFAULT, ...parciales };
}
