import { ROL_MAESTRO } from '../js/roles.js';
import { protegerPagina, cerrarSesion } from '../js/auth.js';
import { db, collection, getDocs, query, where } from '../js/firebase-config.js';
import { crearProyectosRepo } from '../js/repos/proyectosRepo.js';
import { renderSidebar } from '../js/sidebar.js';

protegerPagina([ROL_MAESTRO], (perfil) => {
  renderSidebar(perfil);
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarMisTareas(perfil.uid);
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// Iteramos los proyectos existentes y, dentro de cada uno, buscamos las
// tareas asignadas a este Maestro de Obras. Usamos consultas de colección
// normales (no collectionGroup) para evitar el error "Missing or
// insufficient permissions" y para excluir tareas huérfanas de proyectos
// borrados.
//
// ── Corrección del bloque 5b (26.07.2026) ────────────────────────────
// Esta pantalla leía `collection(db, 'proyectos')` DIRECTO, saltándose el
// repositorio. Con el alcance del 5b eso dejó de funcionar: es una
// consulta sin filtro hecha por un Maestro de Obras, y Firestore no
// devuelve menos documentos cuando las reglas no alcanzan — falla la
// consulta ENTERA. El síntoma era "Missing or insufficient permissions"
// en una pantalla que nadie había tocado.
//
// El repositorio arma la consulta con `array-contains` y por eso pasa. La
// lección va más allá de este archivo: **saltarse la capa de datos no es
// un atajo, es un archivo que no se entera de los cambios de contrato.**
// Los otros consumidores directos que quedan son todos del ingeniero, a
// quien las reglas no le restringen nada — pero son deuda igual.
async function cargarMisTareas(jefeUid) {
  const tbody = document.getElementById('tbody-tareas');
  const emptyState = document.getElementById('empty-state');

  try {
    const proyectosRepo = crearProyectosRepo(db);
    const proyectos = await proyectosRepo.listar({ soloDe: jefeUid });
    const misTareas = [];

    await Promise.all(proyectos.map(async (proy) => {
      const q = query(
        collection(db, 'proyectos', proy.id, 'tareas'),
        where('jefeCuadrillaId', '==', jefeUid)
      );
      const tareasSnap = await getDocs(q);
      tareasSnap.forEach(docSnap => {
        const t = docSnap.data();
        if (t.activo === false) return; // tarea eliminada (soft-delete): ocultar
        // El nombre del proyecto sale del repo si la tarea no lo trae:
        // antes dependía de que estuviera denormalizado en la tarea y
        // pintaba '—' cuando no lo estaba.
        misTareas.push({
          id: docSnap.id,
          proyectoId: proy.id,
          proyectoNombre: t.proyectoNombre ?? proy.nombre,
          ...t,
        });
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
             href="/maestro/horas.html?proyecto=${t.proyectoId}&tarea=${t.id}">
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
