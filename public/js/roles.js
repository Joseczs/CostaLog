// ═══════════════════════════════════════════════════════════════════════
// roles.js — Única fuente de verdad de los identificadores de rol.
//
// Bloque 2 dejó una lección cara: el string 'supervisor' cambió de
// significado (antes era la oficina, ahora es el campo) y estaba escrito
// a mano en 14 archivos. Ningún archivo vuelve a escribir un rol literal.
//
// Bloque 5c: el identificador pasa a llamarse como la persona.
//   'ingeniero' → "Ingeniero Residente"     (ya era correcto)
//   'maestro'   → "Maestro de Obras"        (antes 'supervisor')
//
// El identificador que se guarda en Firestore y el nombre que ve la gente
// siguen SIN ser lo mismo, y conviene que sigan así: el primero no se
// traduce, el segundo sí.
// ═══════════════════════════════════════════════════════════════════════

/** Define el alcance y las reglas. Aprueba el avance. */
export const ROL_INGENIERO = 'ingeniero';

/** Maestro de Obras ≡ Jefe de Cuadrilla. Ejecuta en sitio. Propone el avance. */
export const ROL_MAESTRO = 'maestro';

/**
 * @deprecated Alias del bloque 5c. Apunta a `ROL_MAESTRO`.
 *
 * Existe para que la fase C sea DOS archivos y no doce: los once
 * consumidores lo siguen importando y siguen funcionando. Se retira en la
 * fase E, junto con el renombrado de directorios, que ya los toca a todos.
 * No agregar usos nuevos.
 */
export const ROL_SUPERVISOR = ROL_MAESTRO;

/** El valor viejo, solo para reconocer documentos sin migrar. NO se usa
 *  para conceder permisos: se normaliza a `ROL_MAESTRO` al leer el perfil. */
const ROL_MAESTRO_LEGADO = 'supervisor';

/** Los únicos dos valores aceptados. Cualquier otro no concede permisos. */
export const ROLES = Object.freeze([ROL_INGENIERO, ROL_MAESTRO]);

/**
 * Traduce el valor guardado al vigente.
 *
 * ── Por qué esto existe ───────────────────────────────────────────────
 * Las reglas de Firestore aceptan los dos valores durante la migración
 * (fase A), pero `protegerPagina()` compara el rol en JavaScript contra
 * `ROLES`. Sin esta traducción, una cuenta ya migrada a 'maestro' pasa las
 * reglas del servidor y la rebota el guardia de interfaz — que fue
 * exactamente lo que ocurrió al aplicar la fase B.
 *
 * La tolerancia tiene que estar en LOS DOS lados o no sirve de nada.
 *
 * Un valor desconocido se devuelve tal cual, sin inventarle un rol: que no
 * esté en `ROLES` ya significa que no concede nada.
 */
export function normalizarRol(rol) {
  return rol === ROL_MAESTRO_LEGADO ? ROL_MAESTRO : rol;
}

/** Etiqueta para la interfaz. Nunca se guarda en Firestore. */
export const ETIQUETA_ROL = Object.freeze({
  [ROL_INGENIERO]: 'Ingeniero Residente',
  [ROL_MAESTRO]: 'Maestro de Obras',
});

/** Página de inicio de cada rol.
 *  ⚠️ Los directorios /supervisor/ y /jefe/ conservan su nombre viejo
 *  hasta la fase E. Hoy /supervisor/* es del INGENIERO y /jefe/* es del
 *  MAESTRO DE OBRAS. Deuda 3 en CONTRATOS.md. */
export const HOME_POR_ROL = Object.freeze({
  [ROL_INGENIERO]: '/supervisor/dashboard.html',
  [ROL_MAESTRO]: '/jefe/mis-tareas.html',
});

export const esIngeniero = (perfil) => normalizarRol(perfil?.rol) === ROL_INGENIERO;
export const esMaestro = (perfil) => normalizarRol(perfil?.rol) === ROL_MAESTRO;

/** @deprecated Alias del bloque 5c. Se retira en la fase E. */
export const esSupervisor = esMaestro;

export const esRolValido = (rol) => ROLES.includes(normalizarRol(rol));
