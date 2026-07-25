import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp,
  query, where, orderBy, getDocs
} from '../js/firebase-config.js';
import { renderSidebar } from '../js/sidebar.js';

let jefeSeleccionadoId = null;
let unsubscribeEmpleados = null;

protegerPagina(['supervisor', 'admin'], (perfil) => {
  renderSidebar(perfil);
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
      activo: true,        // estado maestro — lo controla el Supervisor
      disponible: true,    // disponibilidad diaria — la controla el Jefe
      createdAt: serverTimestamp()
    });

    e.target.reset();
  } catch (err) {
    errorEl.textContent = 'Error al agregar empleado: ' + err.message;
  }
});

// ── Listar empleados del Jefe seleccionado (tiempo real) ────────────────
// El Supervisor ve TODOS (activos e inactivos) y puede Eliminar (soft-delete
// activo:false) o Restaurar. Un empleado inactivo desaparece de las listas
// de selección de tareas y de "Mi Equipo" del Jefe, pero su historial de
// bonos ya calculados permanece intacto.
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
      const activo = emp.activo !== false;
      const tr = document.createElement('tr');
      if (!activo) tr.classList.add('fila-inactiva');
      tr.innerHTML = `
        <td>${emp.numeroEmpleado}</td>
        <td>${emp.nombre}</td>
        <td>${emp.rolHabitual}</td>
        <td><span class="badge ${activo ? 'badge-terminada' : 'badge-progreso'}">
              ${activo ? 'Activo' : 'Eliminado'}</span></td>
        <td>
          <button class="btn-secundario btn-toggle" data-id="${docSnap.id}"
                  data-activo="${activo}" data-nombre="${emp.nombre}"
                  style="${activo ? 'color:var(--rojo-error);border-color:var(--rojo-error);' : ''}">
            ${activo ? 'Eliminar' : 'Restaurar'}
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const activoActual = btn.dataset.activo === 'true';
        const nombre = btn.dataset.nombre;

        if (activoActual) {
          const ok = confirm(
            `¿Eliminar al colaborador "${nombre}"?\n\n` +
            `Dejará de aparecer en las listas de tareas y en "Mi Equipo" del Jefe. ` +
            `Su historial de bonos ya calculados se conserva. Podrás restaurarlo después.`
          );
          if (!ok) return;
        }

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
