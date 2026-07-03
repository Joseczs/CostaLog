import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy
} from '../js/firebase-config.js';

let jefeUid = null;

protegerPagina(['jefe_cuadrilla'], (perfil) => {
  jefeUid = perfil.uid;
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarEmpleados();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// ── Agregar empleado ──────────────────────────────────────────────────
document.getElementById('form-empleado').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  try {
    const numeroEmpleado = document.getElementById('emp-numero').value.trim();
    const nombre = document.getElementById('emp-nombre').value.trim();
    const rolHabitual = document.getElementById('emp-rol').value;

    await addDoc(collection(db, 'usuarios', jefeUid, 'empleados'), {
      numeroEmpleado, nombre, rolHabitual,
      activo: true,
      createdAt: serverTimestamp()
    });

    e.target.reset();
  } catch (err) {
    errorEl.textContent = 'Error al agregar empleado: ' + err.message;
  }
});

// ── Listar empleados (tiempo real) ────────────────────────────────────
function cargarEmpleados() {
  const q = query(collection(db, 'usuarios', jefeUid, 'empleados'), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
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

    // Bind toggle activo/inactivo
    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const activoActual = btn.dataset.activo === 'true';
        await updateDoc(doc(db, 'usuarios', jefeUid, 'empleados', id), {
          activo: !activoActual
        });
      });
    });
  });
}
