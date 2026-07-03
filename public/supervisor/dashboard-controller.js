import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, collection, addDoc, onSnapshot, collectionGroup, query, orderBy, serverTimestamp
} from '../js/firebase-config.js';
import { ejecutarExportacion } from '../js/exportarExcel.js';

protegerPagina(['supervisor', 'admin'], (perfil) => {
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarProyectos();
  cargarTareas();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// ── Modal Nuevo Proyecto ────────────────────────────────────────────────
const modal = document.getElementById('modal-proyecto');
document.getElementById('btn-nuevo-proyecto').addEventListener('click', () => modal.style.display = 'flex');
document.getElementById('btn-cancelar-proyecto').addEventListener('click', () => modal.style.display = 'none');

document.getElementById('form-proyecto').addEventListener('submit', async (e) => {
  e.preventDefault();
  await addDoc(collection(db, 'proyectos'), {
    codigo: document.getElementById('proy-codigo').value,
    nombre: document.getElementById('proy-nombre').value,
    ubicacion: document.getElementById('proy-ubicacion').value,
    estado: 'activo',
    createdAt: serverTimestamp()
  });
  e.target.reset();
  modal.style.display = 'none';
});

// ── Listar proyectos ─────────────────────────────────────────────────
function cargarProyectos() {
  const q = query(collection(db, 'proyectos'), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    const tbody = document.getElementById('tbody-proyectos');
    tbody.innerHTML = '';
    snap.forEach(d => {
      const p = d.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.codigo}</td><td>${p.nombre}</td><td>${p.ubicacion || '—'}</td>
        <td><span class="badge badge-terminada">${p.estado}</span></td>
        <td><a href="/supervisor/nueva-tarea.html?proyecto=${d.id}" style="font-size:12px;">+ Tarea</a></td>`;
      tbody.appendChild(tr);
    });
  });
}

// ── Listar tareas (todos los proyectos) ──────────────────────────────
function cargarTareas() {
  const q = query(collectionGroup(db, 'tareas'), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    const tbody = document.getElementById('tbody-tareas');
    tbody.innerHTML = '';
    snap.forEach(d => {
      const t = d.data();
      const proyectoId = d.ref.parent.parent.id;
      const badgeClass = {
        abierta: 'badge-abierta', en_progreso: 'badge-progreso',
        terminada: 'badge-terminada', pagada: 'badge-pagada'
      }[t.estado] || 'badge-abierta';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.proyectoNombre || '—'}</td><td>${t.actividad}</td>
        <td>${t.jefeCuadrillaNombre || '—'}</td><td>${t.hhEstimadas}</td>
        <td><span class="badge ${badgeClass}">${t.estado}</span></td>
        <td><a href="/supervisor/tarea-detalle.html?proyecto=${proyectoId}&tarea=${d.id}" style="font-size:12px;">Ver detalle</a></td>`;
      tbody.appendChild(tr);
    });
  });
}

// ── Exportar Excel ────────────────────────────────────────────────────
document.getElementById('btn-exportar').addEventListener('click', async () => {
  document.getElementById('btn-exportar').textContent = 'Generando...';
  try {
    await ejecutarExportacion();
  } catch (err) {
    alert('Error al exportar: ' + err.message);
  } finally {
    document.getElementById('btn-exportar').textContent = '📊 Exportar Excel';
  }
});
