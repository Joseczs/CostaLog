import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, collection, onSnapshot, doc, updateDoc, query, orderBy
} from '../js/firebase-config.js';
import { renderSidebar } from '../js/sidebar.js';

let jefeUid = null;

protegerPagina(['jefe_cuadrilla'], (perfil) => {
  renderSidebar(perfil);
  jefeUid = perfil.uid;
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarEmpleados();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// ── Listar SOLO colaboradores activos (feature 7) ──────────────────────
// El Jefe ve únicamente a quienes el Supervisor mantiene activos (activo:true).
// Sobre ellos, el Jefe controla el campo "disponible" (asistencia del día),
// que es DISTINTO de "activo" (estado maestro del Supervisor).
function cargarEmpleados() {
  // Solo orderBy (índice de campo único, auto-gestionado). El filtro
  // activo:true se hace del lado del cliente para NO requerir un índice
  // compuesto (ver principio de arquitectura #3).
  const q = query(
    collection(db, 'usuarios', jefeUid, 'empleados'),
    orderBy('createdAt', 'desc')
  );

  onSnapshot(q, (snap) => {
    const tbody = document.getElementById('tbody-empleados');
    const emptyState = document.getElementById('empty-state');
    tbody.innerHTML = '';

    const activos = snap.docs.filter(d => d.data().activo !== false);

    if (activos.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    activos.forEach(docSnap => {
      const emp = docSnap.data();
      const disponible = emp.disponible !== false; // default: disponible
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${emp.numeroEmpleado}</td>
        <td>${emp.nombre}</td>
        <td>${emp.rolHabitual}</td>
        <td><span class="badge ${disponible ? 'badge-terminada' : 'badge-progreso'}">
              ${disponible ? 'Disponible' : 'No disponible'}</span></td>
        <td>
          <button class="btn-secundario btn-toggle" data-id="${docSnap.id}" data-disponible="${disponible}">
            ${disponible ? 'Marcar ausente' : 'Marcar presente'}
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    // El Jefe SOLO puede modificar el campo "disponible" (lo permiten las
    // reglas de seguridad) — no puede crear, editar nombre, ni # de empleado,
    // ni tocar "activo" (eso es del Supervisor).
    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const disponibleActual = btn.dataset.disponible === 'true';
        await updateDoc(doc(db, 'usuarios', jefeUid, 'empleados', id), {
          disponible: !disponibleActual
        });
      });
    });
  }, (error) => {
    console.error('Error cargando el equipo:', error);
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('empty-state').innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
  });
}
