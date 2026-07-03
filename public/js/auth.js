// ═══════════════════════════════════════════════════════════════════════
// auth.js — Registro con selección de rol (Opción A: el usuario elige
// su rol libremente al registrarse) + login + ruteo por rol.
// ═══════════════════════════════════════════════════════════════════════

import {
  auth, db,
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut,
  RecaptchaVerifier, signInWithPhoneNumber,
  doc, getDoc, setDoc, serverTimestamp
} from './firebase-config.js';

// ── Registro por correo ──────────────────────────────────────────────
export async function registrarUsuario({ email, password, nombre, rol, numeroJefe }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await crearDocumentoUsuario(uid, { nombre, email, rol, numeroJefe });
  return uid;
}

// ── Login por correo ──────────────────────────────────────────────────
export async function iniciarSesion(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
}

// ── Helper compartido: crea /usuarios/{uid} ────────────────────────────
async function crearDocumentoUsuario(uid, { nombre, email, telefono, rol, numeroJefe }) {
  const datosUsuario = {
    nombre,             // ⚠️ SIEMPRE el nombre completo — es lo que se muestra
                         // en toda la app, sin importar el método de login usado.
    rol,                // 'supervisor' | 'jefe_cuadrilla'
    activo: true,
    createdAt: serverTimestamp()
  };
  if (email) datosUsuario.email = email;
  if (telefono) datosUsuario.telefono = telefono;
  if (rol === 'jefe_cuadrilla' && numeroJefe) datosUsuario.numeroJefe = numeroJefe;

  await setDoc(doc(db, 'usuarios', uid), datosUsuario);
}

// ═══════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN POR TELÉFONO (SMS con código de verificación)
// ═══════════════════════════════════════════════════════════════════════

let recaptchaVerifier = null;

/**
 * Inicializa el reCAPTCHA invisible requerido por Firebase para enviar SMS.
 * Llamar una sola vez, antes de enviar el primer código.
 * @param {string} containerId - id del div contenedor (invisible en el DOM)
 */
export function inicializarRecaptcha(containerId) {
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  return recaptchaVerifier;
}

/**
 * Envía el código SMS al número indicado.
 * @param {string} numeroTelefono - formato internacional, ej: "+50688887777"
 * @returns {Promise<ConfirmationResult>} — usar con confirmarCodigoTelefono()
 */
export async function enviarCodigoTelefono(numeroTelefono) {
  if (!recaptchaVerifier) throw new Error('reCAPTCHA no inicializado.');
  return await signInWithPhoneNumber(auth, numeroTelefono, recaptchaVerifier);
}

/**
 * Confirma el código recibido por SMS. Si es un usuario NUEVO (registro),
 * pasar nombre/rol/numeroJefe para crear su perfil en Firestore.
 * Si es login de un usuario existente, esos parámetros se ignoran.
 */
export async function confirmarCodigoTelefono(confirmationResult, codigo, datosRegistro = null) {
  const cred = await confirmationResult.confirm(codigo);
  const uid = cred.user.uid;

  const perfilExistente = await obtenerPerfilUsuario(uid);

  if (!perfilExistente) {
    // Es un registro nuevo — el nombre es OBLIGATORIO en este punto.
    if (!datosRegistro || !datosRegistro.nombre || !datosRegistro.rol) {
      throw new Error('Falta el nombre o el rol para completar el registro.');
    }
    await crearDocumentoUsuario(uid, {
      nombre: datosRegistro.nombre,
      telefono: cred.user.phoneNumber,
      rol: datosRegistro.rol,
      numeroJefe: datosRegistro.numeroJefe
    });
  }

  return uid;
}

// ── Común a ambos métodos ──────────────────────────────────────────────
export async function cerrarSesion() {
  await signOut(auth);
}

export async function obtenerPerfilUsuario(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

export function protegerPagina(rolesPermitidos, callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/index.html';
      return;
    }
    const perfil = await obtenerPerfilUsuario(user.uid);
    if (!perfil || !perfil.activo) {
      alert('Tu cuenta no está activa. Contacta al administrador.');
      await cerrarSesion();
      window.location.href = '/index.html';
      return;
    }
    if (!rolesPermitidos.includes(perfil.rol)) {
      window.location.href = perfil.rol === 'supervisor'
        ? '/supervisor/dashboard.html'
        : '/jefe/mis-tareas.html';
      return;
    }
    callback(perfil);
  });
}

export function rutaHomePorRol(rol) {
  return rol === 'supervisor' ? '/supervisor/dashboard.html' : '/jefe/mis-tareas.html';
}
