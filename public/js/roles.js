// ═══════════════════════════════════════════════════════════════════════
// roles.js — Única fuente de verdad de los identificadores de rol.
//
// Bloque 2 dejó una lección cara: el string 'supervisor' cambió de
// significado (antes era la oficina, ahora es el campo) y estaba escrito
// a mano en 14 archivos. Ningún archivo vuelve a escribir un rol literal.
//
// El identificador que se guarda en Firestore y el nombre que ve la gente
// NO son lo mismo, y conviene que sigan sin serlo:
//   'ingeniero'  → "Ingeniero Residente"
//   'supervisor' → "Maestro de Obras"
// ═══════════════════════════════════════════════════════════════════════

/** Define el alcance y las reglas. Aprueba el avance. */
export const ROL_INGENIERO = 'ingeniero';

/** Maestro de Obras ≡ Jefe de Cuadrilla. Ejecuta en sitio. Propone el avance. */
export const ROL_SUPERVISOR = 'supervisor';

/** Los únicos dos valores aceptados. Cualquier otro no concede permisos. */
export const ROLES = Object.freeze([ROL_INGENIERO, ROL_SUPERVISOR]);

/** Etiqueta para la interfaz. Nunca se guarda en Firestore. */
export const ETIQUETA_ROL = Object.freeze({
  [ROL_INGENIERO]: 'Ingeniero Residente',
  [ROL_SUPERVISOR]: 'Maestro de Obras',
});

/** Página de inicio de cada rol.
 *  ⚠️ Los directorios /supervisor/ y /jefe/ conservan su nombre viejo a
 *  propósito: renombrarlos durante un intercambio de roles duplicaba el
 *  radio de impacto. Hoy /supervisor/* es del INGENIERO y /jefe/* es del
 *  SUPERVISOR. Deuda declarada en CONTRATOS.md. */
export const HOME_POR_ROL = Object.freeze({
  [ROL_INGENIERO]: '/supervisor/dashboard.html',
  [ROL_SUPERVISOR]: '/jefe/mis-tareas.html',
});

export const esIngeniero = (perfil) => perfil?.rol === ROL_INGENIERO;
export const esSupervisor = (perfil) => perfil?.rol === ROL_SUPERVISOR;
export const esRolValido = (rol) => ROLES.includes(rol);
