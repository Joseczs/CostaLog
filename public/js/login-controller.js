import {
  registrarUsuario, iniciarSesion, obtenerPerfilUsuario, rutaHomePorRol,
  inicializarRecaptcha, enviarCodigoTelefono, confirmarCodigoTelefono
} from './auth.js';

// ── Traduce códigos de error de Firebase a mensajes claros en español ────
function mensajeError(err) {
  const codigo = err.code || '';
  const mapa = {
    'auth/invalid-email': 'El correo no tiene un formato válido.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-phone-number': 'El número de teléfono no es válido. Incluye el código de país (ej: +506).',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
    'auth/billing-not-enabled': 'El envío de SMS no está habilitado en este proyecto (falta activar el plan Blaze en Firebase).',
    'auth/captcha-check-failed': 'Verificación de seguridad falló. Revisa que este dominio esté autorizado en Firebase.',
    'auth/error-code:-39': 'Límite de intentos alcanzado para este número, o el operador/región no está disponible temporalmente. Intenta más tarde o con otro número.',
    'auth/invalid-verification-code': 'El código ingresado es incorrecto.',
    'auth/code-expired': 'El código expiró. Solicita uno nuevo.'
  };
  return mapa[codigo] || err.message || 'Ocurrió un error inesperado.';
}

// ── Tabs: Login / Signup ────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`#panel-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── Toggle: Correo / Teléfono ────────────────────────────────────────────
let metodoActual = 'email';

document.querySelectorAll('.metodo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    metodoActual = btn.dataset.metodo;
    document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Muestra/oculta el formulario correspondiente en AMBOS tabs
    document.getElementById('form-login-email').style.display = metodoActual === 'email' ? 'flex' : 'none';
    document.getElementById('form-login-telefono').style.display = metodoActual === 'telefono' ? 'flex' : 'none';
    document.getElementById('form-signup-email').style.display = metodoActual === 'email' ? 'flex' : 'none';
    document.getElementById('form-signup-telefono').style.display = metodoActual === 'telefono' ? 'flex' : 'none';
  });
});

// ── Selector de rol (signup) ──────────────────────────────────────────
const inputRol = document.getElementById('signup-rol');

document.querySelectorAll('.rol-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rol-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    inputRol.value = btn.dataset.rol;
  });
});

// ── Inicializar reCAPTCHA una sola vez ───────────────────────────────────
inicializarRecaptcha('recaptcha-container');

// ═══════════════════════════════════════════════════════════════════════
// LOGIN POR CORREO
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('form-login-email').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const uid = await iniciarSesion(email, password);
    const perfil = await obtenerPerfilUsuario(uid);
    window.location.href = rutaHomePorRol(perfil.rol);
  } catch (err) {
    errorEl.textContent = mensajeError(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// LOGIN POR TELÉFONO
// ═══════════════════════════════════════════════════════════════════════
let confirmationResultLogin = null;

document.getElementById('btn-enviar-codigo-login').addEventListener('click', async () => {
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    const numero = document.getElementById('login-telefono').value.trim();
    confirmationResultLogin = await enviarCodigoTelefono(numero);
    document.getElementById('login-telefono-paso1').style.display = 'none';
    document.getElementById('login-telefono-paso2').style.display = 'block';
  } catch (err) {
    errorEl.textContent = mensajeError(err);
  }
});

document.getElementById('btn-verificar-codigo-login').addEventListener('click', async () => {
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    const codigo = document.getElementById('login-codigo').value.trim();
    const uid = await confirmarCodigoTelefono(confirmationResultLogin, codigo);
    const perfil = await obtenerPerfilUsuario(uid);
    if (!perfil) {
      errorEl.textContent = 'Este número no tiene una cuenta registrada. Ve a "Registrarse".';
      return;
    }
    window.location.href = rutaHomePorRol(perfil.rol);
  } catch (err) {
    errorEl.textContent = mensajeError(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SIGNUP POR CORREO
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('form-signup-email').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('signup-error');
  errorEl.textContent = '';

  const rol = inputRol.value;
  if (!rol) { errorEl.textContent = 'Selecciona tu rol.'; return; }

  try {
    const nombre = document.getElementById('signup-nombre').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    await registrarUsuario({ email, password, nombre, rol });
    alert('Cuenta creada. Te enviamos un correo de verificación — revísalo cuando puedas (no es obligatorio para empezar a usar la app).');
    window.location.href = rutaHomePorRol(rol);
  } catch (err) {
    errorEl.textContent = mensajeError(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SIGNUP POR TELÉFONO
// ═══════════════════════════════════════════════════════════════════════
let confirmationResultSignup = null;

document.getElementById('btn-enviar-codigo-signup').addEventListener('click', async () => {
  const errorEl = document.getElementById('signup-error');
  errorEl.textContent = '';

  // El nombre y el rol se validan ANTES de enviar el SMS —
  // el teléfono solo verifica identidad, no reemplaza estos datos.
  const nombre = document.getElementById('signup-nombre').value.trim();
  const rol = inputRol.value;
  if (!nombre) { errorEl.textContent = 'Ingresa tu nombre completo.'; return; }
  if (!rol) { errorEl.textContent = 'Selecciona tu rol.'; return; }

  try {
    const numero = document.getElementById('signup-telefono').value.trim();
    confirmationResultSignup = await enviarCodigoTelefono(numero);
    document.getElementById('signup-telefono-paso1').style.display = 'none';
    document.getElementById('signup-telefono-paso2').style.display = 'block';
  } catch (err) {
    errorEl.textContent = mensajeError(err);
  }
});

document.getElementById('btn-verificar-codigo-signup').addEventListener('click', async () => {
  const errorEl = document.getElementById('signup-error');
  errorEl.textContent = '';
  try {
    const codigo = document.getElementById('signup-codigo').value.trim();
    const nombre = document.getElementById('signup-nombre').value.trim();
    const rol = inputRol.value;

    const uid = await confirmarCodigoTelefono(confirmationResultSignup, codigo, { nombre, rol });
    window.location.href = rutaHomePorRol(rol);
  } catch (err) {
    errorEl.textContent = mensajeError(err);
  }
});
