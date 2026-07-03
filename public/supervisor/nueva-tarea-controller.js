import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp
} from '../js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const proyectoPreseleccionado = params.get('proyecto');

protegerPagina(['supervisor', 'admin'], (perfil) => {
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarProyectos();
  cargarJefesCuadrilla();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// ── Cargar selects ────────────────────────────────────────────────────
async function cargarProyectos() {
  const snap = await getDocs(collection(db, 'proyectos'));
  const select = document.getElementById('tarea-proyecto');
  snap.forEach(d => {
    const p = d.data();
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${p.codigo} — ${p.nombre}`;
    if (d.id === proyectoPreseleccionado) opt.selected = true;
    select.appendChild(opt);
  });
}

async function cargarJefesCuadrilla() {
  const q = query(collection(db, 'usuarios'), where('rol', '==', 'jefe_cuadrilla'));
  const snap = await getDocs(q);
  const select = document.getElementById('tarea-jefe');
  snap.forEach(d => {
    const u = d.data();
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = u.nombre;
    opt.dataset.nombre = u.nombre;
    select.appendChild(opt);
  });
}

// ── Crear tarea ───────────────────────────────────────────────────────
document.getElementById('form-tarea').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  try {
    const proyectoId = document.getElementById('tarea-proyecto').value;
    const proyectoSnap = await getDoc(doc(db, 'proyectos', proyectoId));
    const proyectoNombre = proyectoSnap.data().nombre;

    const jefeSelect = document.getElementById('tarea-jefe');
    const jefeCuadrillaId = jefeSelect.value;
    const jefeCuadrillaNombre = jefeSelect.selectedOptions[0]?.dataset.nombre || '';

    const nuevaTarea = {
      proyectoId, proyectoNombre,
      otNumero: document.getElementById('tarea-ot').value,
      actividad: document.getElementById('tarea-actividad').value,
      numeroActividad: document.getElementById('tarea-numero-actividad').value,
      cantidad: parseFloat(document.getElementById('tarea-cantidad').value) || 0,
      unidad: document.getElementById('tarea-unidad').value,
      tamanoCuadrilla: parseInt(document.getElementById('tarea-tamano-cuadrilla').value) || 0,
      jefeCuadrillaId, jefeCuadrillaNombre,
      hhEstimadas: parseFloat(document.getElementById('tarea-hh-estimadas').value),
      costoActividadEstimado: parseFloat(document.getElementById('tarea-costo-estimado').value) || 0,
      fechaInicio: document.getElementById('tarea-fecha-inicio').value,
      fechaTermino: null,
      horaInicio: null,
      horaTermino: null,
      condiciones: {
        actividadTerminada: false,
        sinRetrabajos: false,
        calidadAprobada: false,
        seguridadOcup: false
      },
      estado: 'abierta',
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'proyectos', proyectoId, 'tareas'), nuevaTarea);
    alert('Tarea creada correctamente.');
    window.location.href = '/supervisor/dashboard.html';
  } catch (err) {
    errorEl.textContent = 'Error al crear tarea: ' + err.message;
  }
});
