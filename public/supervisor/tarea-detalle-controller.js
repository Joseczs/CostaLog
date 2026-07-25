import { protegerPagina, cerrarSesion } from '../js/auth.js';
import { renderSidebar } from '../js/sidebar.js';
import {
  db, doc, getDoc, updateDoc, collection, getDocs
} from '../js/firebase-config.js';
import { calcularBono } from '../js/calcularBono.js';

const params = new URLSearchParams(window.location.search);
const proyectoId = params.get('proyecto');
const tareaId = params.get('tarea');

if (!proyectoId || !tareaId) {
  alert('Tarea no especificada.');
  window.location.href = '/supervisor/dashboard.html';
}

let tareaRef = null;
let tarea = null;

protegerPagina(['supervisor', 'admin'], (perfil) => {
  renderSidebar(perfil);
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarTarea();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

async function cargarTarea() {
  tareaRef = doc(db, 'proyectos', proyectoId, 'tareas', tareaId);
  const snap = await getDoc(tareaRef);
  if (!snap.exists()) {
    alert('Tarea no encontrada.');
    window.location.href = '/supervisor/dashboard.html';
    return;
  }
  tarea = snap.data();

  document.getElementById('titulo-tarea').textContent =
    `${tarea.actividad} — ${tarea.proyectoNombre || ''}`;
  document.getElementById('subtitulo-tarea').textContent =
    `OT# ${tarea.otNumero || '—'} · Jefe: ${tarea.jefeCuadrillaNombre || '—'} · Inicio: ${tarea.fechaInicio || '—'}`;

  const badgeClass = {
    abierta: 'badge-abierta', en_progreso: 'badge-progreso',
    terminada: 'badge-terminada', pagada: 'badge-pagada'
  }[tarea.estado] || 'badge-abierta';
  const badge = document.getElementById('badge-estado');
  badge.textContent = tarea.estado;
  badge.classList.add(badgeClass);

  // Prellenar checkboxes de condiciones
  const c = tarea.condiciones || {};
  document.getElementById('cond-actividad-terminada').checked = !!c.actividadTerminada;
  document.getElementById('cond-sin-retrabajos').checked = !!c.sinRetrabajos;
  document.getElementById('cond-calidad-aprobada').checked = !!c.calidadAprobada;
  document.getElementById('cond-seguridad-ocup').checked = !!c.seguridadOcup;

  if (tarea.fechaTermino) document.getElementById('fecha-termino').value = tarea.fechaTermino;
  if (tarea.horaTermino) document.getElementById('hora-termino').value = tarea.horaTermino;

  await cargarYCalcularBono();
}

async function cargarYCalcularBono() {
  const registrosSnap = await getDocs(collection(tareaRef, 'registrosHoras'));
  const registros = registrosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const resultado = calcularBono(tarea, registros);

  document.getElementById('dato-hh-estimadas').textContent = tarea.hhEstimadas ?? '—';
  document.getElementById('dato-hh-reales').textContent = resultado.hhReales.toFixed(1);
  document.getElementById('dato-hh-economizadas').textContent = resultado.hhEconomizadas.toFixed(1);
  document.getElementById('dato-bono-total').textContent =
    '₡' + resultado.bonoTotal.toLocaleString('es-CR', { maximumFractionDigits: 0 });

  const motivoEl = document.getElementById('motivo-no-pago');
  motivoEl.textContent = resultado.motivo ? `⚠ ${resultado.motivo}` : '';

  const tbody = document.getElementById('tbody-distribucion');
  tbody.innerHTML = '';
  (resultado.distribucion || []).forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.nombre}</td><td>${d.rol}</td>
      <td>${d.totalHH.toFixed(1)}</td>
      <td>₡${d.monto.toLocaleString('es-CR', { maximumFractionDigits: 0 })}</td>`;
    tbody.appendChild(tr);
  });
  if ((resultado.distribucion || []).length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">Sin registros de horas aún</td></tr>';
  }
}

// ── Guardar condiciones sin cerrar la tarea ────────────────────────────
document.getElementById('btn-guardar-condiciones').addEventListener('click', async () => {
  const condiciones = leerCondiciones();
  await updateDoc(tareaRef, { condiciones });
  tarea.condiciones = condiciones;
  await cargarYCalcularBono();
  alert('Condiciones guardadas.');
});

// ── Cerrar tarea ────────────────────────────────────────────────────────
document.getElementById('btn-cerrar-tarea').addEventListener('click', async () => {
  const errorEl = document.getElementById('cierre-error');
  errorEl.textContent = '';

  const fechaTermino = document.getElementById('fecha-termino').value;
  const horaTermino = document.getElementById('hora-termino').value;

  if (!fechaTermino) {
    errorEl.textContent = 'Debes indicar la fecha de término.';
    return;
  }

  const condiciones = leerCondiciones();

  try {
    await updateDoc(tareaRef, {
      condiciones,
      fechaTermino,
      horaTermino: horaTermino || null,
      estado: 'terminada'
    });
    alert('Tarea cerrada correctamente.');
    window.location.href = '/supervisor/dashboard.html';
  } catch (err) {
    errorEl.textContent = 'Error al cerrar tarea: ' + err.message;
  }
});

function leerCondiciones() {
  return {
    actividadTerminada: document.getElementById('cond-actividad-terminada').checked,
    sinRetrabajos: document.getElementById('cond-sin-retrabajos').checked,
    calidadAprobada: document.getElementById('cond-calidad-aprobada').checked,
    seguridadOcup: document.getElementById('cond-seguridad-ocup').checked
  };
}
