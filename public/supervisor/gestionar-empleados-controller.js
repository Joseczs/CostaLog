import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp,
  query, where, orderBy, getDocs
} from '../js/firebase-config.js';

let jefeSeleccionadoId = null;
let unsubscribeEmpleados = null;

protegerPagina(['supervisor', 'admin'], (perfil) => {
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarJefes();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// ── Cargar lista de Jefes de Cuadrilla ─────────────────────────────────
async function cargarJefes() {
  const q = query(collection(db, 'usuarios'), where('rol', '==', 'jefe_cuadrilla'));
  const snap = await getDocs(q);
  const select = document.getElementById('selector-jefe');
  snap.forEach(d => {
    const u = d.data();
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = u.nombre;
    select.appendChild(opt);
  });
}

document.getElementById('selector-jefe').addEventListener('change', (e) => {
  jefeSeleccionadoId = e.target.value;
  const seccion = document.getElementById('seccion-empleados');

  if (!jefeSeleccionadoId) {
    seccion.style.display = 'none';
    if (unsubscribeEmpleados) unsubscribeEmpleados();
    return;
  }

  seccion.style.display = 'block';
  document.getElementById('nombre-jefe-seleccionado').textContent =
    e.target.selectedOptions[0].textContent;

  if (unsubscribeEmpleados) unsubscribeEmpleados();
  cargarEmpleadosDeJefe(jefeSeleccionadoId);
});

// ── Agregar empleado a la cuadrilla del Jefe seleccionado ──────────────
document.getElementById('form-empleado').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  if (!jefeSeleccionadoId) {
    errorEl.textContent = 'Selecciona un Jefe de Cuadrilla primero.';
    return;
  }

  try {
    const numeroEmpleado = document.getElementById('emp-numero').value.trim();
    const nombre = document.getElementById('emp-nombre').value.trim();
    const rolHabitual = document.getElementById('emp-rol').value;

    await addDoc(collection(db, 'usuarios', jefeSeleccionadoId, 'empleados'), {
      numeroEmpleado, nombre, rolHabitual,
      activo: true,
      createdAt: serverTimestamp()
    });

    e.target.reset();
  } catch (err) {
    errorEl.textContent = 'Error al agregar empleado: ' + err.message;
  }
});

// ── Listar empleados del Jefe seleccionado (tiempo real) ────────────────
function cargarEmpleadosDeJefe(jefeId) {
  const q = query(collection(db, 'usuarios', jefeId, 'empleados'), orderBy('createdAt', 'desc'));

  unsubscribeEmpleados = onSnapshot(q, (snap) => {
    const tbody = document.getElementById('tbody-empleados');
    const emptyState = document.getElementById('empty-state');
    tbody.innerHTML = '';

    if (snap.empty) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    snap.forEach(docSnap => {
      const emp = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${emp.numeroEmpleado}</td>
        <td>${emp.nombre}</td>
        <td>${emp.rolHabitual}</td>
        <td><span class="badge ${emp.activo ? 'badge-terminada' : 'badge-progreso'}">
              ${emp.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn-secundario btn-toggle" data-id="${docSnap.id}" data-activo="${emp.activo}">
            ${emp.activo ? 'Desactivar' : 'Reactivar'}
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const activoActual = btn.dataset.activo === 'true';
        await updateDoc(doc(db, 'usuarios', jefeSeleccionadoId, 'empleados', id), {
          activo: !activoActual
        });
      });
    });
  }, (error) => {
    console.error('Error cargando empleados:', error);
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('empty-state').innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
  });
}
