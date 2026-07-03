// ═══════════════════════════════════════════════════════════════════════
// importarExcel.js — Descarga de plantilla + importación masiva de tareas
// desde un archivo Excel. Usa ExcelJS (cargado vía CDN en dashboard.html).
// ═══════════════════════════════════════════════════════════════════════

import {
  db, collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp
} from './firebase-config.js';

const COLUMNAS_PLANTILLA = [
  'Proyecto', 'OT#', 'Actividad', '# Actividad', 'Cantidad', 'Unidad',
  'Jefe de Cuadrilla', 'HH Estimadas', 'Costo Estimado', 'Fecha Inicio (AAAA-MM-DD)'
];

// ── 1. Descargar plantilla vacía ───────────────────────────────────────
async function descargarPlantilla() {
  const workbook = new window.ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Tareas');

  ws.addRow(COLUMNAS_PLANTILLA);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
  ws.columns = COLUMNAS_PLANTILLA.map(() => ({ width: 20 }));

  // Fila de ejemplo para guiar al Supervisor
  ws.addRow(['Torre Norte', 'OT-1234', 'Repello de fachada', '12', '85', 'm2',
              'Juan Pérez', '160', '450000', '2026-07-15']);
  ws.getRow(2).font = { italic: true, color: { argb: 'FF999999' } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'Plantilla_Importar_Tareas_COSTACON.xlsx'; a.click();
  URL.revokeObjectURL(url);
}

// ── 2. Leer y validar el archivo subido ─────────────────────────────────
async function leerArchivoExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = new window.ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const ws = workbook.worksheets[0];

  const filas = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const valores = row.values; // índice 0 vacío, 1..10 = columnas
    if (!valores[1]) return;    // fila vacía

    filas.push({
      fila: rowNumber,
      proyecto: String(valores[1] || '').trim(),
      otNumero: String(valores[2] || '').trim(),
      actividad: String(valores[3] || '').trim(),
      numeroActividad: String(valores[4] || '').trim(),
      cantidad: parseFloat(valores[5]) || 0,
      unidad: String(valores[6] || '').trim(),
      jefeCuadrillaNombre: String(valores[7] || '').trim(),
      hhEstimadas: parseFloat(valores[8]) || 0,
      costoActividadEstimado: parseFloat(valores[9]) || 0,
      fechaInicio: formatearFecha(valores[10])
    });
  });

  return filas;
}

function formatearFecha(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).trim();
}

// ── 3. Validar filas contra Firestore (proyecto y jefe deben existir) ───
async function validarFilas(filas) {
  const proyectosSnap = await getDocs(collection(db, 'proyectos'));
  const proyectosPorNombre = {};
  proyectosSnap.forEach(d => { proyectosPorNombre[d.data().nombre] = d.id; });

  const jefesSnap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'jefe_cuadrilla')));
  const jefesPorNombre = {};
  jefesSnap.forEach(d => { jefesPorNombre[d.data().nombre] = d.id; });

  const validas = [];
  const errores = [];

  filas.forEach(f => {
    const problemas = [];
    if (!f.proyecto || !proyectosPorNombre[f.proyecto]) problemas.push(`Proyecto "${f.proyecto}" no existe`);
    if (!f.actividad) problemas.push('Actividad vacía');
    if (!f.jefeCuadrillaNombre || !jefesPorNombre[f.jefeCuadrillaNombre]) problemas.push(`Jefe "${f.jefeCuadrillaNombre}" no existe`);
    if (!f.hhEstimadas || f.hhEstimadas <= 0) problemas.push('HH Estimadas debe ser mayor a 0');
    if (!f.fechaInicio) problemas.push('Fecha de inicio vacía');

    if (problemas.length > 0) {
      errores.push({ fila: f.fila, problemas });
    } else {
      validas.push({
        ...f,
        proyectoId: proyectosPorNombre[f.proyecto],
        jefeCuadrillaId: jefesPorNombre[f.jefeCuadrillaNombre]
      });
    }
  });

  return { validas, errores };
}

// ── 4. Crear las tareas válidas en Firestore ────────────────────────────
async function crearTareasEnLote(filasValidas) {
  let creadas = 0;
  for (const f of filasValidas) {
    await addDoc(collection(db, 'proyectos', f.proyectoId, 'tareas'), {
      proyectoId: f.proyectoId,
      proyectoNombre: f.proyecto,
      otNumero: f.otNumero,
      actividad: f.actividad,
      numeroActividad: f.numeroActividad,
      cantidad: f.cantidad,
      unidad: f.unidad,
      jefeCuadrillaId: f.jefeCuadrillaId,
      jefeCuadrillaNombre: f.jefeCuadrillaNombre,
      hhEstimadas: f.hhEstimadas,
      tamanoCuadrilla: 0,
      costoActividadEstimado: f.costoActividadEstimado,
      fechaInicio: f.fechaInicio,
      fechaTermino: null,
      horaInicio: null,
      horaTermino: null,
      condiciones: {
        actividadTerminada: false, sinRetrabajos: false,
        calidadAprobada: false, seguridadOcup: false
      },
      estado: 'abierta',
      createdAt: serverTimestamp()
    });
    creadas++;
  }
  return creadas;
}

// ── Conectar a la UI del modal en dashboard.html ────────────────────────
document.getElementById('btn-descargar-plantilla')?.addEventListener('click', descargarPlantilla);

document.getElementById('btn-procesar-import')?.addEventListener('click', async () => {
  const fileInput = document.getElementById('input-archivo-excel');
  const resultadoEl = document.getElementById('resultado-import');
  const errorEl = document.getElementById('import-error');
  errorEl.textContent = '';
  resultadoEl.innerHTML = '';

  if (!fileInput.files[0]) {
    errorEl.textContent = 'Selecciona un archivo primero.';
    return;
  }

  const btn = document.getElementById('btn-procesar-import');
  btn.textContent = 'Procesando...';
  btn.disabled = true;

  try {
    const filas = await leerArchivoExcel(fileInput.files[0]);
    if (filas.length === 0) {
      errorEl.textContent = 'El archivo no tiene filas de datos.';
      return;
    }

    const { validas, errores } = await validarFilas(filas);

    let html = `<p><strong>${filas.length}</strong> filas leídas — <strong style="color:#2E7D32;">${validas.length} válidas</strong>, <strong style="color:#C0392B;">${errores.length} con errores</strong>.</p>`;

    if (errores.length > 0) {
      html += '<div style="max-height:150px; overflow-y:auto; margin-top:8px; font-size:11.5px;">';
      errores.forEach(e => {
        html += `<p style="color:#C0392B;">Fila ${e.fila}: ${e.problemas.join(', ')}</p>`;
      });
      html += '</div>';
    }
    resultadoEl.innerHTML = html;

    if (validas.length > 0) {
      const creadas = await crearTareasEnLote(validas);
      resultadoEl.innerHTML += `<p style="color:#2E7D32; font-weight:700; margin-top:8px;">✓ ${creadas} tarea(s) creada(s) correctamente.</p>`;
    }
  } catch (err) {
    errorEl.textContent = 'Error al procesar el archivo: ' + err.message;
  } finally {
    btn.textContent = 'Procesar e importar';
    btn.disabled = false;
  }
});
