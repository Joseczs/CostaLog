// ═══════════════════════════════════════════════════════════════════════
// validaciones.js — Validaciones reutilizables de dominio.
// Centraliza "qué campos hacen que un proyecto esté completo" para que,
// cuando el Excel (o cualquier flujo) empiece a traer más columnas, solo
// haya que ajustar este archivo y no reescribir ifs regados por la app.
// ═══════════════════════════════════════════════════════════════════════

// Campos que un proyecto DEBE tener para considerarse "completo" (estado activo).
// Ampliar esta lista aquí cuando el negocio requiera más datos obligatorios.
export const CAMPOS_REQUERIDOS_PROYECTO = ['codigo', 'nombre', 'ubicacion'];

// Etiquetas legibles para mostrar al usuario qué datos faltan.
export const ETIQUETA_CAMPO_PROYECTO = {
  codigo: 'Código',
  nombre: 'Nombre',
  ubicacion: 'Ubicación'
};

/**
 * Devuelve la lista de campos requeridos que faltan en un proyecto.
 * @param {object} proyecto - { codigo, nombre, ubicacion, ... }
 * @returns {string[]} claves de los campos faltantes ([] = proyecto completo)
 */
export function validarCamposProyecto(proyecto) {
  const faltantes = [];
  for (const campo of CAMPOS_REQUERIDOS_PROYECTO) {
    const valor = proyecto ? proyecto[campo] : undefined;
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      faltantes.push(campo);
    }
  }
  return faltantes;
}

/**
 * true si al proyecto NO le falta ningún campo requerido.
 */
export function proyectoEstaCompleto(proyecto) {
  return validarCamposProyecto(proyecto).length === 0;
}

/**
 * Texto legible de los campos faltantes, ej: "Ubicación" o "Código, Ubicación".
 */
export function etiquetasCamposFaltantes(proyecto) {
  return validarCamposProyecto(proyecto)
    .map(c => ETIQUETA_CAMPO_PROYECTO[c] || c)
    .join(', ');
}
