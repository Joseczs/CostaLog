import { protegerPagina, cerrarSesion } from '../js/auth.js';
import {
  db, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy,
  getDocs, serverTimestamp
} from '../js/firebase-config.js';
import { ejecutarExportacion } from '../js/exportarExcel.js';
import { descargarPlantilla } from '../js/importarExcel.js';
import { calcularBono } from '../js/calcularBono.js';
import { renderSidebar } from '../js/sidebar.js';
import { validarCamposProyecto, etiquetasCamposFaltantes } from '../js/validaciones.js';

let todasLasTareas = [];       // caché completa (sin filtrar) con datos enriquecidos
let proyectosActuales = [];    // [{ id, nombre }] de proyectos ACTIVOS existentes
let genCargaTareas = 0;        // token para descartar cargas de tareas obsoletas
let ordenColumna = null;
let ordenAscendente = true;
let grupoEstado = 'abiertas';  // tab activo: 'abiertas' | 'cerradas' | 'todas'
let proyectoEditandoId = null; // null = modal en modo "crear"

// Qué estados cuentan como abiertos vs cerrados (feature 3)
const ESTADOS_ABIERTOS = ['abierta', 'en_progreso'];
const ESTADOS_CERRADOS = ['terminada', 'pagada'];

protegerPagina(['supervisor', 'admin'], (perfil) => {
  renderSidebar(perfil);
  document.getElementById('nombre-usuario').textContent = perfil.nombre;
  cargarProyectos();

  // Si se llegó desde el menú "Excel" del sidebar, abrir el modal de importar.
  if (new URLSearchParams(window.location.search).get('panel') === 'excel') {
    document.getElementById('modal-importar').style.display = 'flex';
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await cerrarSesion();
  window.location.href = '/index.html';
});

// ── Modal Nuevo / Editar Proyecto ───────────────────────────────────────
const modal = document.getElementById('modal-proyecto');

function abrirModalNuevoProyecto() {
  proyectoEditandoId = null;
  document.getElementById('modal-proyecto-titulo').textContent = 'Nuevo Proyecto';
  document.getElementById('btn-guardar-proyecto').textContent = 'Crear';
  document.getElementById('form-proyecto').reset();
  modal.style.display = 'flex';
}

function abrirModalEditarProyecto(p) {
  proyectoEditandoId = p.id;
  document.getElementById('modal-proyecto-titulo').textContent = 'Editar Proyecto';
  document.getElementById('btn-guardar-proyecto').textContent = 'Guardar';
  document.getElementById('proy-codigo').value = p.codigo || '';
  document.getElementById('proy-nombre').value = p.nombre || '';
  document.getElementById('proy-ubicacion').value = p.ubicacion || '';
  modal.style.display = 'flex';
}

document.getElementById('btn-nuevo-proyecto').addEventListener('click', abrirModalNuevoProyecto);
document.getElementById('btn-cancelar-proyecto').addEventListener('click', () => modal.style.display = 'none');

document.getElementById('form-proyecto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = {
    codigo: document.getElementById('proy-codigo').value.trim(),
    nombre: document.getElementById('proy-nombre').value.trim(),
    ubicacion: document.getElementById('proy-ubicacion').value.trim()
  };
  // El estado se deriva de si el proyecto está completo (validador reutilizable).
  const estado = validarCamposProyecto(datos).length === 0 ? 'activo' : 'incompleto';

  if (proyectoEditandoId) {
    await updateDoc(doc(db, 'proyectos', proyectoEditandoId), { ...datos, estado });
  } else {
    await addDoc(collection(db, 'proyectos'), {
      ...datos, estado, activo: true, createdAt: serverTimestamp()
    });
  }
  e.target.reset();
  proyectoEditandoId = null;
  modal.style.display = 'none';
});

// ── Listar proyectos (en vivo) ─────────────────────────────────────────
function cargarProyectos() {
  const q = query(collection(db, 'proyectos'), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    const tbody = document.getElementById('tbody-proyectos');
    tbody.innerHTML = '';
    const selectFiltro = document.getElementById('filtro-proyecto');
    const seleccionActual = selectFiltro.value;
    selectFiltro.innerHTML = '<option value="">Todos los proyectos</option>';

    // Solo proyectos NO eliminados (soft-delete: activo !== false)
    const docsActivos = snap.docs.filter(d => d.data().activo !== false);

    docsActivos.forEach(d => {
      const p = { id: d.id, ...d.data() };
      const incompleto = p.estado === 'incompleto';
      const faltan = etiquetasCamposFaltantes(p);
      const warn = incompleto
        ? `<span class="warn-icono" title="Faltan datos: ${faltan || 'por completar'}">⚠️</span>`
        : '';
      const badgeClase = incompleto ? 'badge-incompleto' : 'badge-terminada';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.codigo || '—'}</td>
        <td>${p.nombre || '—'}${warn}</td>
        <td>${p.ubicacion || '—'}</td>
        <td><span class="badge ${badgeClase}">${p.estado}</span></td>
        <td>
          <span class="acciones-celda">
            <a href="/supervisor/nueva-tarea.html?proyecto=${p.id}" class="link-accion link-normal">+ Tarea</a>
            <button class="link-accion link-normal btn-editar-proy" data-id="${p.id}">Editar</button>
            <button class="link-accion link-peligro btn-eliminar-proy" data-id="${p.id}" data-nombre="${p.nombre || ''}">Eliminar</button>
          </span>
        </td>`;
      tbody.appendChild(tr);

      const opt = document.createElement('option');
      opt.value = p.nombre;
      opt.textContent = p.nombre;
      selectFiltro.appendChild(opt);
    });
    selectFiltro.value = seleccionActual;

    // Guardar datos completos para el modal de edición
    const proyectosData = docsActivos.map(d => ({ id: d.id, ...d.data() }));
    document.querySelectorAll('.btn-editar-proy').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = proyectosData.find(x => x.id === btn.dataset.id);
        if (p) abrirModalEditarProyecto(p);
      });
    });
    document.querySelectorAll('.btn-eliminar-proy').forEach(btn => {
      btn.addEventListener('click', () => eliminarProyecto(btn.dataset.id, btn.dataset.nombre));
    });

    // Guardar la lista de proyectos vigentes (activos) y recargar sus tareas.
    proyectosActuales = docsActivos.map(d => ({ id: d.id, nombre: d.data().nombre }));
    cargarTareasDeProyectos();
  }, (error) => {
    console.error('Error cargando proyectos:', error);
  });
}

// ── Soft-delete de proyecto + borrado recursivo de sus tareas ──────────
async function eliminarProyecto(proyectoId, nombre) {
  const ok = confirm(
    `¿Eliminar el proyecto "${nombre}"?\n\n` +
    `Se ocultarán también todas sus tareas. Esta acción se puede revertir ` +
    `desde la base de datos (borrado lógico), pero no desde la app.`
  );
  if (!ok) return;

  try {
    // 1) Marcar recursivamente todas las tareas del proyecto como inactivas
    const tareasSnap = await getDocs(collection(db, 'proyectos', proyectoId, 'tareas'));
    await Promise.all(tareasSnap.docs.map(t =>
      updateDoc(doc(db, 'proyectos', proyectoId, 'tareas', t.id), { activo: false })
    ));
    // 2) Marcar el proyecto como inactivo
    await updateDoc(doc(db, 'proyectos', proyectoId), { activo: false });
  } catch (err) {
    alert('Error al eliminar el proyecto: ' + err.message);
  }
}

// ── Listar tareas iterando proyecto por proyecto ───────────────────────
async function cargarTareasDeProyectos() {
  const gen = ++genCargaTareas;

  try {
    if (proyectosActuales.length === 0) {
      todasLasTareas = [];
      poblarFiltroJefes([]);
      aplicarFiltrosYRenderizar();
      return;
    }

    const listasPorProyecto = await Promise.all(
      proyectosActuales.map(async (proy) => {
        const tareasSnap = await getDocs(collection(db, 'proyectos', proy.id, 'tareas'));
        const filas = await Promise.all(tareasSnap.docs.map(async (docSnap) => {
          const t = docSnap.data();
          if (t.activo === false) return null; // soft-deleted: no mostrar

          const registrosSnap = await getDocs(collection(docSnap.ref, 'registrosHoras'));
          const registros = registrosSnap.docs.map(r => ({ id: r.id, ...r.data() }));
          const resultado = calcularBono(t, registros);

          return {
            id: docSnap.id,
            proyectoId: proy.id,
            proyectoNombre: t.proyectoNombre || proy.nombre || '—',
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
            fechaTermino: t.fechaTermino || '—',
            _createdAtMs: (t.createdAt && t.createdAt.toMillis) ? t.createdAt.toMillis() : 0
          };
        }));
        return filas.filter(Boolean);
      })
    );

    if (gen !== genCargaTareas) return;

    const tareas = listasPorProyecto.flat();
    tareas.sort((a, b) => b._createdAtMs - a._createdAtMs);

    todasLasTareas = tareas;
    poblarFiltroJefes(tareas);
    aplicarFiltrosYRenderizar();
  } catch (error) {
    if (gen !== genCargaTareas) return;
    console.error('Error cargando tareas:', error);
    document.getElementById('tbody-tareas').innerHTML =
      `<tr><td colspan="15" style="color:red;">Error: ${error.message}</td></tr>`;
  }
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

// ── Tabs de estado (Abiertas / Cerradas / Todas) ───────────────────────
document.querySelectorAll('.tab-estado').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-estado').forEach(t => t.classList.remove('activo'));
    tab.classList.add('activo');
    grupoEstado = tab.dataset.grupo;
    aplicarFiltrosYRenderizar();
  });
});

// ── Filtros ───────────────────────────────────────────────────────────
['filtro-texto', 'filtro-proyecto', 'filtro-jefe'].forEach(id => {
  document.getElementById(id).addEventListener('input', aplicarFiltrosYRenderizar);
  document.getElementById(id).addEventListener('change', aplicarFiltrosYRenderizar);
});

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
  document.getElementById('filtro-texto').value = '';
  document.getElementById('filtro-proyecto').value = '';
  document.getElementById('filtro-jefe').value = '';
  aplicarFiltrosYRenderizar();
});

function aplicarFiltrosYRenderizar() {
  const texto = document.getElementById('filtro-texto').value.toLowerCase().trim();
  const proyecto = document.getElementById('filtro-proyecto').value;
  const jefe = document.getElementById('filtro-jefe').value;

  let filtradas = todasLasTareas.filter(t => {
    // Filtro por grupo de estado (tab)
    if (grupoEstado === 'abiertas' && !ESTADOS_ABIERTOS.includes(t.estado)) return false;
    if (grupoEstado === 'cerradas' && !ESTADOS_CERRADOS.includes(t.estado)) return false;

    if (proyecto && t.proyectoNombre !== proyecto) return false;
    if (jefe && t.jefeCuadrillaNombre !== jefe) return false;
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
      <td>
        <span class="acciones-celda">
          <a href="/supervisor/tarea-detalle.html?proyecto=${t.proyectoId}&tarea=${t.id}" class="link-accion link-normal">Ver</a>
          <button class="link-accion link-peligro btn-eliminar-tarea"
                  data-proy="${t.proyectoId}" data-tarea="${t.id}" data-act="${t.actividad}">Eliminar</button>
        </span>
      </td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.btn-eliminar-tarea').forEach(btn => {
    btn.addEventListener('click', () =>
      eliminarTarea(btn.dataset.proy, btn.dataset.tarea, btn.dataset.act));
  });

  document.getElementById('contador-resultados').textContent =
    `${tareas.length} tarea(s) mostrada(s) de ${todasLasTareas.length} en total`;
}

// ── Soft-delete de una tarea ───────────────────────────────────────────
async function eliminarTarea(proyectoId, tareaId, actividad) {
  const ok = confirm(`¿Eliminar la tarea "${actividad}"?\n\nSe ocultará de la lista (borrado lógico).`);
  if (!ok) return;
  try {
    await updateDoc(doc(db, 'proyectos', proyectoId, 'tareas', tareaId), { activo: false });
    cargarTareasDeProyectos();
  } catch (err) {
    alert('Error al eliminar la tarea: ' + err.message);
  }
}

// ── Excel: dropdown único (feature 2) ──────────────────────────────────
const excelMenu = document.getElementById('excel-menu');
const btnExcel = document.getElementById('btn-excel');

btnExcel.addEventListener('click', (e) => {
  e.stopPropagation();
  excelMenu.classList.toggle('abierto');
});
document.addEventListener('click', (e) => {
  if (!excelMenu.contains(e.target) && e.target !== btnExcel) {
    excelMenu.classList.remove('abierto');
  }
});

document.getElementById('menu-descargar-plantilla').addEventListener('click', async () => {
  excelMenu.classList.remove('abierto');
  await descargarPlantilla();
});
document.getElementById('menu-importar').addEventListener('click', () => {
  excelMenu.classList.remove('abierto');
  document.getElementById('modal-importar').style.display = 'flex';
});
document.getElementById('menu-exportar').addEventListener('click', async () => {
  excelMenu.classList.remove('abierto');
  const original = btnExcel.textContent;
  btnExcel.textContent = 'Generando...';
  try {
    await ejecutarExportacion();
  } catch (err) {
    alert('Error al exportar: ' + err.message);
  } finally {
    btnExcel.textContent = original;
  }
});

// ── Modal Importar: cerrar ─────────────────────────────────────────────
document.getElementById('btn-cerrar-import').addEventListener('click', () => {
  document.getElementById('modal-importar').style.display = 'none';
  document.getElementById('resultado-import').innerHTML = '';
  document.getElementById('import-error').textContent = '';
});
