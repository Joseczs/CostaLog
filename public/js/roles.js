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
 * Los roles que el formulario público puede OFRECER al registrarse.
 *
 * ── Por qué es una lista distinta de ROLES ────────────────────────────
 * `ROLES` es quién puede existir; esto es quién puede darse de alta solo.
 * No son lo mismo: el `ingeniero` sigue siendo un rol vigente —aprueba
 * avances, cierra metas, cobra— pero nadie se lo puede auto-asignar.
 *
 * Bloque 5d: hasta hoy `allow create` de `usuarios/{uid}` no miraba el
 * campo `rol`, así que cualquier cuenta autenticada podía crearse como
 * ingeniero desde la consola del navegador y quedar habilitada para
 * aprobar su propio % de avance. El contrapeso de D-11 era de interfaz.
 *
 * ⚠️ ESTO ES EL ESPEJO DE LA REGLA `naceComoMaestro()` en
 * `firestore.rules`. Si las dos dejaran de coincidir, el formulario
 * ofrecería un rol que el servidor rechaza — y el error le saldría a la
 * persona que se registra, no a quien lo desincronizó. Se cambian juntas
 * o no se cambia ninguna.
 *
 * Promover a `ingeniero` es un `update` que solo puede hacer otro
 * ingeniero. Hoy no hay pantalla: es consola o script (deuda 23).
 */
export const ROLES_REGISTRO = Object.freeze([ROL_MAESTRO]);

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

/**
 * Puerta ÚNICA para escribir un rol en Firestore.
 *
 * ── Por qué existe ────────────────────────────────────────────────────
 * `normalizarRol()` traduce al LEER, y eso alcanzaba mientras nadie
 * escribiera. Pero `index.html` tenía `data-rol="supervisor"` literal, así
 * que cada cuenta nueva nacía con el valor viejo: la fase B migró un
 * usuario y el formulario seguía fabricando más. Una migración que corre
 * contra un grifo abierto no termina nunca.
 *
 * Normaliza y RECHAZA lo desconocido. No devuelve un rol por defecto a
 * propósito: un registro con el rol equivocado es una cuenta con permisos
 * que nadie decidió, y eso tiene que fallar ruidosamente, no acomodarse.
 *
 * @throws {Error} si el valor no corresponde a ninguno de los dos roles.
 */
export function rolParaGuardar(rol) {
  const normalizado = normalizarRol(rol);
  if (!ROLES.includes(normalizado)) {
    throw new Error(`Rol inválido: ${JSON.stringify(rol)}`);
  }
  return normalizado;
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
