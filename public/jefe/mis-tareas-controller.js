import { protegerPagina, cerrarSesion } from '../js/auth.js';
import { db, collectionGroup, query, where, onSnapshot } from '../js/firebase-config.js';

protegerPagina(['jefe_cuadrilla'], (perfil) => {
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarMisTareas(perfil.uid);
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

function cargarMisTareas(jefeUid) {
  const q = query(collectionGroup(db, 'tareas'), where('jefeCuadrillaId', '==', jefeUid));

  onSnapshot(q, (snap) => {
    const tbody = document.getElementById('tbody-tareas');
    const emptyState = document.getElementById('empty-state');
    tbody.innerHTML = '';

    if (snap.empty) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    snap.forEach(docSnap => {
      const t = docSnap.data();
      // docSnap.ref.path = proyectos/{proyectoId}/tareas/{tareaId}
      const proyectoId = docSnap.ref.parent.parent.id;
      const tareaId = docSnap.id;

      const badgeClass = {
        abierta: 'badge-abierta',
        en_progreso: 'badge-progreso',
        terminada: 'badge-terminada',
        pagada: 'badge-pagada'
      }[t.estado] || 'badge-abierta';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.proyectoNombre || '—'}</td>
        <td>${t.actividad}</td>
        <td>${t.otNumero || '—'}</td>
        <td>${t.hhEstimadas}</td>
        <td><span class="badge ${badgeClass}">${t.estado}</span></td>
        <td>
          <a class="btn-accion" style="text-decoration:none;display:inline-block;"
             href="/jefe/horas.html?proyecto=${proyectoId}&tarea=${tareaId}">
             Registrar horas
          </a>
        </td>`;
      tbody.appendChild(tr);
    });
  });
}
