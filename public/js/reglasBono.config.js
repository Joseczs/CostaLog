// ═══════════════════════════════════════════════════════════════════════
// reglasBono.config.js — ÚNICA fuente de verdad para el cálculo del bono.
// Si las reglas de negocio cambian, este es el ÚNICO archivo a editar.
// ═══════════════════════════════════════════════════════════════════════

export const REGLAS_BONO = {
  // ₡ pagados por cada hora-hombre economizada
  valorPorHHEconomizada: 640,

  // Tope máximo del bono como % del costo estimado de la actividad
  topeBonoPctCostoActividad: 0.30,

  // Si HH reales >= HH estimadas → no hay bono
  criterioNoPago: (hhReales, hhEstimadas) => hhReales >= hhEstimadas,

  // La actividad debe estar 100% completada (todas las condiciones en true)
  requiereActividadCompletada100: true,

  // Peso relativo de cada rol en la distribución del bono
  // Operario = 1.0 (referencia) · Ayudante = 0.5
  pesoPorRol: {
    Operario: 1.0,
    Ayudante: 0.5
  }
};
