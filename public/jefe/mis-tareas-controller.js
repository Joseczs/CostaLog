import { protegerPagina, cerrarSesion } from '../js/auth.js';
import { db, collection, getDocs, query, where } from '../js/firebase-config.js';

protegerPagina(['jefe_cuadrilla'], (perfil) => {
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarMisTareas(perfil.uid);
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// Iteramos los proyectos existentes y, dentro de cada uno, buscamos las
// tareas asignadas a este Jefe. Usamos consultas de colección normales
// (no collectionGroup) para evitar el error "Missing or insufficient
// permissions" y para excluir tareas huérfanas de proyectos borrados.
async function cargarMisTareas(jefeUid) {
  const tbody = document.getElementById('tbody-tareas');
  const emptyState = document.getElementById('empty-state');

  try {
    const proyectosSnap = await getDocs(collection(db, 'proyectos'));
    const misTareas = [];

    await Promise.all(proyectosSnap.docs.map(async (proyDoc) => {
      const q = query(
        collection(db, 'proyectos', proyDoc.id, 'tareas'),
        where('jefeCuadrillaId', '==', jefeUid)
      );
      const tareasSnap = await getDocs(q);
      tareasSnap.forEach(docSnap => {
        misTareas.push({ id: docSnap.id, proyectoId: proyDoc.id, ...docSnap.data() });
      });
    }));

    tbody.innerHTML = '';

    if (misTareas.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    misTareas.forEach(t => {
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
             href="/jefe/horas.html?proyecto=${t.proyectoId}&tarea=${t.id}">
             Registrar horas
          </a>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error cargando mis tareas:', error);
    emptyState.style.display = 'block';
    emptyState.innerHTML =
      `<span style="color:red;">Error: ${error.message}<br>
       Revisa la consola del navegador (F12) para más detalle.</span>`;
  }
}
