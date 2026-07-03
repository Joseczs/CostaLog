import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, collection, addDoc, onSnapshot, collectionGroup, query, where, orderBy,
  getDocs, serverTimestamp
} from '../js/firebase-config.js';
import { ejecutarExportacion } from '../js/exportarExcel.js';
import { calcularBono } from '../js/calcularBono.js';

let todasLasTareas = [];       // caché completa (sin filtrar) con datos enriquecidos
let ordenColumna = null;
let ordenAscendente = true;

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
    const selectFiltro = document.getElementById('filtro-proyecto');
    // Reconstruir opciones del filtro (mantener selección si existía)
    const seleccionActual = selectFiltro.value;
    selectFiltro.innerHTML = '<option value="">Todos los proyectos</option>';

    snap.forEach(d => {
      const p = d.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.codigo}</td><td>${p.nombre}</td><td>${p.ubicacion || '—'}</td>
        <td><span class="badge badge-terminada">${p.estado}</span></td>
        <td><a href="/supervisor/nueva-tarea.html?proyecto=${d.id}" style="font-size:12px;">+ Tarea</a></td>`;
      tbody.appendChild(tr);

      const opt = document.createElement('option');
      opt.value = p.nombre;
      opt.textContent = p.nombre;
      selectFiltro.appendChild(opt);
    });
    selectFiltro.value = seleccionActual;
  }, (error) => {
    console.error('Error cargando proyectos:', error);
  });
}

// ── Listar tareas + enriquecer con HH reales y bono calculado ──────────
function cargarTareas() {
  const q = query(collectionGroup(db, 'tareas'), orderBy('createdAt', 'desc'));

  onSnapshot(q, async (snap) => {
    if (snap.empty) {
      todasLasTareas = [];
      renderizarTabla([]);
      return;
    }

    const tareasEnriquecidas = await Promise.all(snap.docs.map(async (docSnap) => {
      const t = docSnap.data();
      const proyectoId = docSnap.ref.parent.parent.id;

      // Traer registros de horas para calcular HH reales y bono en vivo
      const registrosSnap = await getDocs(collection(docSnap.ref, 'registrosHoras'));
      const registros = registrosSnap.docs.map(r => ({ id: r.id, ...r.data() }));
      const resultado = calcularBono(t, registros);

      return {
        id: docSnap.id,
        proyectoId,
        proyectoNombre: t.proyectoNombre || '—',
        actividad: t.actividad || '—',
        numeroActividad: t.numeroActividad || '—',
        cantidad: t.cantidad || 0,
        unidad: t.unidad || '—',
        otNumero: t.otNumero || '—',
        jefeCuadrillaNombre: t.jefeCuadrillaNombre || '—',
        hhEstimadas: t.hhEstimadas || 0,
        hhReales: resultado.hhReales,
        costoActividadEstimado: t.costoActividadEstimado || 0,
        bonoCalculado: resultado.bonoTotal,
        estado: t.estado || '—',
        fechaInicio: t.fechaInicio || '—',
        fechaTermino: t.fechaTermino || '—'
      };
    }));

    todasLasTareas = tareasEnriquecidas;
    poblarFiltroJefes(tareasEnriquecidas);
    aplicarFiltrosYRenderizar();
  }, (error) => {
    console.error('Error cargando tareas (revisa si falta un índice):', error);
    document.getElementById('tbody-tareas').innerHTML =
      `<tr><td colspan="15" style="color:red;">Error: ${error.message}<br>
       Revisa la consola del navegador (F12) — si falta un índice, ahí aparece el link para crearlo.</td></tr>`;
  });
}

function poblarFiltroJefes(tareas) {
  const selectJefe = document.getElementById('filtro-jefe');
  const seleccionActual = selectJefe.value;
  const nombres = [...new Set(tareas.map(t => t.jefeCuadrillaNombre).filter(n => n && n !== '—'))].sort();

  selectJefe.innerHTML = '<option value="">Todos los jefes</option>';
  nombres.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    selectJefe.appendChild(opt);
  });
  selectJefe.value = seleccionActual;
}

// ── Filtros ───────────────────────────────────────────────────────────
['filtro-texto', 'filtro-proyecto', 'filtro-jefe', 'filtro-estado'].forEach(id => {
  document.getElementById(id).addEventListener('input', aplicarFiltrosYRenderizar);
  document.getElementById(id).addEventListener('change', aplicarFiltrosYRenderizar);
});

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
  document.getElementById('filtro-texto').value = '';
  document.getElementById('filtro-proyecto').value = '';
  document.getElementById('filtro-jefe').value = '';
  document.getElementById('filtro-estado').value = '';
  aplicarFiltrosYRenderizar();
});

function aplicarFiltrosYRenderizar() {
  const texto = document.getElementById('filtro-texto').value.toLowerCase().trim();
  const proyecto = document.getElementById('filtro-proyecto').value;
  const jefe = document.getElementById('filtro-jefe').value;
  const estado = document.getElementById('filtro-estado').value;

  let filtradas = todasLasTareas.filter(t => {
    if (proyecto && t.proyectoNombre !== proyecto) return false;
    if (jefe && t.jefeCuadrillaNombre !== jefe) return false;
    if (estado && t.estado !== estado) return false;
    if (texto) {
      const campoBusqueda = `${t.actividad} ${t.otNumero} ${t.numeroActividad} ${t.proyectoNombre}`.toLowerCase();
      if (!campoBusqueda.includes(texto)) return false;
    }
    return true;
  });

  if (ordenColumna) {
    filtradas = [...filtradas].sort((a, b) => {
      const va = a[ordenColumna], vb = b[ordenColumna];
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return ordenAscendente ? cmp : -cmp;
    });
  }

  renderizarTabla(filtradas);
}

// ── Ordenar por columna (clic en encabezado) ────────────────────────────
document.querySelectorAll('#tabla-tareas-completa th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (ordenColumna === col) {
      ordenAscendente = !ordenAscendente;
    } else {
      ordenColumna = col;
      ordenAscendente = true;
    }
    aplicarFiltrosYRenderizar();
  });
});

// ── Render de la tabla ────────────────────────────────────────────────
function renderizarTabla(tareas) {
  const tbody = document.getElementById('tbody-tareas');
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;color:#999;">Sin resultados con estos filtros.</td></tr>';
  }

  const badgeClass = {
    abierta: 'badge-abierta', en_progreso: 'badge-progreso',
    terminada: 'badge-terminada', pagada: 'badge-pagada'
  };

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.proyectoNombre}</td>
      <td>${t.actividad}</td>
      <td>${t.numeroActividad}</td>
      <td>${t.cantidad}</td>
      <td>${t.unidad}</td>
      <td>${t.otNumero}</td>
      <td>${t.jefeCuadrillaNombre}</td>
      <td>${t.hhEstimadas}</td>
      <td>${t.hhReales.toFixed(1)}</td>
      <td>₡${t.costoActividadEstimado.toLocaleString('es-CR')}</td>
      <td>₡${t.bonoCalculado.toLocaleString('es-CR', { maximumFractionDigits: 0 })}</td>
      <td><span class="badge ${badgeClass[t.estado] || 'badge-abierta'}">${t.estado}</span></td>
      <td>${t.fechaInicio}</td>
      <td>${t.fechaTermino}</td>
      <td><a href="/supervisor/tarea-detalle.html?proyecto=${t.proyectoId}&tarea=${t.id}" style="font-size:12px;">Ver</a></td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('contador-resultados').textContent =
    `${tareas.length} tarea(s) mostrada(s) de ${todasLasTareas.length} en total`;
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

// ── Modal Importar ────────────────────────────────────────────────────
document.getElementById('btn-importar').addEventListener('click', () => {
  document.getElementById('modal-importar').style.display = 'flex';
});
document.getElementById('btn-cerrar-import').addEventListener('click', () => {
  document.getElementById('modal-importar').style.display = 'none';
  document.getElementById('resultado-import').innerHTML = '';
  document.getElementById('import-error').textContent = '';
});
