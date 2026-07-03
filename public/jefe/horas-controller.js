import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, serverTimestamp
} from '../js/firebase-config.js';

// ── Parámetros de URL ────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const proyectoId = params.get('proyecto');
const tareaId = params.get('tarea');

let jefeUid = null;
let tarea = null;
let diasTarea = [];              // array de fechas ISO "YYYY-MM-DD"
let registros = {};              // { empleadoId: { nombre, rol, horasPorDia, ... } }
let cuadrillaCompleta = [];      // roster completo del jefe

if (!proyectoId || !tareaId) {
  alert('Tarea no especificada.');
  window.location.href = '/jefe/mis-tareas.html';
}

protegerPagina(['jefe_cuadrilla'], async (perfil) => {
  jefeUid = perfil.uid;
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  await cargarTarea();
  await cargarCuadrilla();
  await cargarRegistrosExistentes();
  construirGrid();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// ── Cargar datos de la tarea ──────────────────────────────────────────
async function cargarTarea() {
  const tareaRef = doc(db, 'proyectos', proyectoId, 'tareas', tareaId);
  const snap = await getDoc(tareaRef);
  if (!snap.exists()) {
    alert('Tarea no encontrada.');
    window.location.href = '/jefe/mis-tareas.html';
    return;
  }
  tarea = snap.data();

  if (tarea.jefeCuadrillaId !== jefeUid) {
    alert('No tienes acceso a esta tarea.');
    window.location.href = '/jefe/mis-tareas.html';
    return;
  }

  document.getElementById('titulo-tarea').textContent =
    `${tarea.actividad} — ${tarea.proyectoNombre || ''}`;
  document.getElementById('subtitulo-tarea').textContent =
    `OT# ${tarea.otNumero || '—'} · HH Estimadas: ${tarea.hhEstimadas} · Inicio: ${tarea.fechaInicio || '—'}`;

  diasTarea = generarRangoDias(tarea.fechaInicio, tarea.fechaTermino);
}

// Genera array de fechas ISO entre inicio y fin (o hasta hoy si no ha terminado)
function generarRangoDias(fechaInicio, fechaTermino) {
  if (!fechaInicio) return [];
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin = fechaTermino ? new Date(fechaTermino + 'T00:00:00') : new Date();
  const dias = [];
  let cursor = new Date(inicio);
  // Máximo 10 días, según el formato físico del reverso
  while (cursor <= fin && dias.length < 10) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  if (dias.length === 0) dias.push(fechaInicio);
  return dias;
}

// ── Cargar roster del jefe (empleados activos) ────────────────────────
async function cargarCuadrilla() {
  const q = query(collection(db, 'usuarios', jefeUid, 'empleados'), where('activo', '==', true));
  const snap = await getDocs(q);
  cuadrillaCompleta = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Cargar registros de horas ya existentes para esta tarea ───────────
async function cargarRegistrosExistentes() {
  const snap = await getDocs(collection(db, 'proyectos', proyectoId, 'tareas', tareaId, 'registrosHoras'));
  registros = {};
  snap.forEach(d => { registros[d.id] = d.data(); });
}

// ── Construir el grid dinámico ─────────────────────────────────────────
function construirGrid() {
  const thead = document.getElementById('thead-horas');
  const tbody = document.getElementById('tbody-horas');

  // Encabezado
  let headerHtml = '<tr><th class="col-nombre">Empleado</th><th>Rol</th>';
  diasTarea.forEach((fecha, i) => {
    const diaCorto = fecha.slice(8, 10) + '/' + fecha.slice(5, 7);
    headerHtml += `<th>${diaCorto}</th>`;
  });
  headerHtml += '<th>Total HH</th></tr>';
  thead.innerHTML = headerHtml;

  // Filas de datos
  tbody.innerHTML = '';
  Object.entries(registros).forEach(([empleadoId, reg]) => {
    tbody.appendChild(crearFilaEmpleado(empleadoId, reg));
  });

  agregarFilaTotales();
  renderizarListaCuadrillaDisponible();
}

function crearFilaEmpleado(empleadoId, reg) {
  const tr = document.createElement('tr');
  tr.dataset.empleadoId = empleadoId;

  let celdas = `<td class="col-nombre">${reg.nombre}</td><td>${reg.rol}</td>`;
  diasTarea.forEach(fecha => {
    const valor = reg.horasPorDia?.[fecha] ?? '';
    celdas += `<td><input type="number" min="0" max="24" step="0.5"
                 class="input-horas" data-fecha="${fecha}" value="${valor}"></td>`;
  });
  celdas += `<td class="total-hh">${calcularTotalFila(reg.horasPorDia)}</td>`;
  tr.innerHTML = celdas;

  // Recalcular total al cambiar cualquier celda
  tr.querySelectorAll('.input-horas').forEach(input => {
    input.addEventListener('input', () => {
      const totalCell = tr.querySelector('.total-hh');
      const valores = [...tr.querySelectorAll('.input-horas')].map(i => parseFloat(i.value) || 0);
      totalCell.textContent = valores.reduce((a, b) => a + b, 0).toFixed(1);
    });
  });

  return tr;
}

function calcularTotalFila(horasPorDia) {
  if (!horasPorDia) return '0.0';
  return Object.values(horasPorDia).reduce((a, b) => a + (b || 0), 0).toFixed(1);
}

function agregarFilaTotales() {
  const tbody = document.getElementById('tbody-horas');
  const filaExistente = tbody.querySelector('.fila-total');
  if (filaExistente) filaExistente.remove();

  const tr = document.createElement('tr');
  tr.classList.add('fila-total');
  let celdas = `<td colspan="2">TOTALES</td>`;
  diasTarea.forEach(() => { celdas += `<td>—</td>`; });
  celdas += `<td id="total-general-hh">0.0</td>`;
  tr.innerHTML = celdas;
  tbody.appendChild(tr);
}

// ── Selector para agregar empleados de la cuadrilla a esta tarea ──────
document.getElementById('btn-agregar-empleado').addEventListener('click', () => {
  const panel = document.getElementById('panel-seleccionar-empleado');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

function renderizarListaCuadrillaDisponible() {
  const cont = document.getElementById('lista-cuadrilla-disponible');
  const yaAsignados = new Set(Object.keys(registros));
  const disponibles = cuadrillaCompleta.filter(e => !yaAsignados.has(e.id));

  if (disponibles.length === 0) {
    cont.innerHTML = '<p style="font-size:12px;color:#999;">Todos tus empleados activos ya están en esta tarea.</p>';
    return;
  }

  cont.innerHTML = disponibles.map(e => `
    <div class="checklist-item" data-empleado-id="${e.id}">
      <strong>${e.numeroEmpleado}</strong> — ${e.nombre} (${e.rolHabitual})
    </div>
  `).join('');

  cont.querySelectorAll('.checklist-item').forEach(item => {
    item.addEventListener('click', () => {
      const empleadoId = item.dataset.empleadoId;
      const empleado = cuadrillaCompleta.find(e => e.id === empleadoId);
      agregarEmpleadoATarea(empleadoId, empleado);
    });
  });
}

function agregarEmpleadoATarea(empleadoId, empleado) {
  registros[empleadoId] = {
    empleadoNumero: empleado.numeroEmpleado,
    nombre: empleado.nombre,
    rol: empleado.rolHabitual,
    horasPorDia: {},
    totalHH: 0,
    jefeCuadrillaId: jefeUid
  };
  construirGrid();
  document.getElementById('panel-seleccionar-empleado').style.display = 'none';
}

// ── Guardar horas en Firestore ─────────────────────────────────────────
document.getElementById('btn-guardar-horas').addEventListener('click', async () => {
  const errorEl = document.getElementById('horas-error');
  errorEl.textContent = '';

  try {
    const filas = document.querySelectorAll('#tbody-horas tr[data-empleado-id]');

    for (const fila of filas) {
      const empleadoId = fila.dataset.empleadoId;
      const horasPorDia = {};
      let totalHH = 0;

      fila.querySelectorAll('.input-horas').forEach(input => {
        const fecha = input.dataset.fecha;
        const valor = parseFloat(input.value) || 0;
        if (valor > 0) horasPorDia[fecha] = valor;
        totalHH += valor;
      });

      const regRef = doc(db, 'proyectos', proyectoId, 'tareas', tareaId, 'registrosHoras', empleadoId);
      const datosGuardar = {
        ...registros[empleadoId],
        horasPorDia,
        totalHH,
        jefeCuadrillaId: jefeUid,
        actualizadoEn: serverTimestamp()
      };
      await setDoc(regRef, datosGuardar, { merge: true });
    }

    alert('Horas guardadas correctamente.');
    await cargarRegistrosExistentes();
    construirGrid();
  } catch (err) {
    errorEl.textContent = 'Error al guardar: ' + err.message;
  }
});
