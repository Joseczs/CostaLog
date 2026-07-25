// ═══════════════════════════════════════════════════════════════════════
// exportarExcel.js — consulta Firestore, calcula bonos con la MISMA
// función que usa la app (calcularBono.js), y genera el .xlsx con
// diseño profesional usando ExcelJS (cargado vía CDN en el HTML).
// ═══════════════════════════════════════════════════════════════════════

import { db, collection, getDocs } from './firebase-config.js';
import { calcularBono } from './calcularBono.js';
import {
  estiloTituloHoja, estiloEncabezadoColumna, estiloFilaAlterna,
  estiloCeldaBono, estiloFilaTotal
} from './estilosExcel.js';

// ── 1. Obtener y consolidar datos desde Firestore ─────────────────────
async function obtenerDatosReporte() {
  // Iteramos proyectos → tareas (en vez de collectionGroup) para evitar la
  // fragilidad de las reglas con consultas de grupo de colecciones y para
  // excluir tareas huérfanas de proyectos borrados.
  const proyectosSnap = await getDocs(collection(db, 'proyectos'));
  const tareaDocs = [];
  for (const proyDoc of proyectosSnap.docs) {
    const tSnap = await getDocs(collection(db, 'proyectos', proyDoc.id, 'tareas'));
    tareaDocs.push(...tSnap.docs);
  }

  const filas = { resumen: [], detalleEmpleado: [], horasDiarias: [] };

  for (const tareaDoc of tareaDocs) {
    const tarea = tareaDoc.data();
    const registrosSnap = await getDocs(collection(tareaDoc.ref, 'registrosHoras'));
    const registros = registrosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const resultado = calcularBono(tarea, registros);

    filas.resumen.push({
      proyecto: tarea.proyectoNombre || '—',
      tarea: tarea.actividad,
      ot: tarea.otNumero || '—',
      jefeCuadrilla: tarea.jefeCuadrillaNombre || '—',
      hhEstimadas: tarea.hhEstimadas || 0,
      hhReales: resultado.hhReales,
      hhEconomizadas: resultado.hhEconomizadas,
      bonoTotal: resultado.bonoTotal,
      estado: tarea.estado,
      fechaTermino: tarea.fechaTermino || '—'
    });

    (resultado.distribucion || []).forEach(d => {
      const reg = registros.find(r => (r.empleadoId || r.id) === d.empleadoId);
      if (!reg) return;

      filas.detalleEmpleado.push({
        proyecto: tarea.proyectoNombre || '—',
        tarea: tarea.actividad,
        empleadoNumero: reg.empleadoNumero,
        nombre: reg.nombre,
        rol: reg.rol,
        hhTrabajadas: reg.totalHH || 0,
        bonoAsignado: d.monto,
        jefeCuadrilla: tarea.jefeCuadrillaNombre || '—'
      });

      const dias = Object.keys(reg.horasPorDia || {}).sort();
      const valoresDias = [];
      for (let i = 0; i < 10; i++) {
        valoresDias.push(dias[i] ? (reg.horasPorDia[dias[i]] || 0) : 0);
      }

      filas.horasDiarias.push({
        proyecto: tarea.proyectoNombre || '—',
        tarea: tarea.actividad,
        empleado: reg.nombre,
        rol: reg.rol,
        dias: valoresDias,
        total: reg.totalHH || 0
      });
    });
  }
  return filas;
}

// ── 2. Hoja 1 — Resumen por Tarea ──────────────────────────────────────
function generarHojaResumen(workbook, datos) {
  const ws = workbook.addWorksheet('Resumen por Tarea');

  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = 'COSTACON – REPORTE DE BONOS · RESUMEN POR TAREA';
  ws.getCell('A1').style = estiloTituloHoja();
  ws.getRow(1).height = 26;

  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-CR')}`;
  ws.getCell('A2').font = { italic: true, size: 8, color: { argb: 'FF888888' } };

  const headers = ['Proyecto', 'Tarea', 'OT #', 'Jefe de Cuadrilla', 'HH Estimadas',
                    'HH Reales', 'HH Economizadas', 'Bono Total', 'Estado', 'Fecha Término'];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
    headerRow.getCell(i + 1).style = estiloEncabezadoColumna();
  });
  headerRow.height = 28;

  ws.columns = [
    { width: 20 }, { width: 26 }, { width: 10 }, { width: 20 }, { width: 14 },
    { width: 12 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 14 }
  ];

  datos.resumen.forEach((fila, i) => {
    const r = ws.getRow(5 + i);
    const valores = [fila.proyecto, fila.tarea, fila.ot, fila.jefeCuadrilla,
                      fila.hhEstimadas, fila.hhReales, fila.hhEconomizadas,
                      fila.bonoTotal, fila.estado, fila.fechaTermino];
    valores.forEach((v, j) => {
      const cell = r.getCell(j + 1);
      cell.value = v;
      cell.style = (j === 7) ? estiloCeldaBono() : estiloFilaAlterna(i % 2 === 0);
    });
  });

  const filaTotalIdx = 5 + datos.resumen.length;
  const rTotal = ws.getRow(filaTotalIdx);
  const sumaHHEstimadas = datos.resumen.reduce((s, f) => s + f.hhEstimadas, 0);
  const sumaHHReales = datos.resumen.reduce((s, f) => s + f.hhReales, 0);
  const sumaHHEconomizadas = datos.resumen.reduce((s, f) => s + f.hhEconomizadas, 0);
  const sumaBonoTotal = datos.resumen.reduce((s, f) => s + f.bonoTotal, 0);

  rTotal.getCell(1).value = 'TOTALES';
  ws.mergeCells(`A${filaTotalIdx}:D${filaTotalIdx}`);
  for (let c = 1; c <= 4; c++) rTotal.getCell(c).style = estiloFilaTotal();
  rTotal.getCell(5).value = sumaHHEstimadas;
  rTotal.getCell(6).value = sumaHHReales;
  rTotal.getCell(7).value = sumaHHEconomizadas;
  rTotal.getCell(8).value = sumaBonoTotal;
  rTotal.getCell(8).numFmt = '"₡"#,##0';
  for (let c = 5; c <= 10; c++) rTotal.getCell(c).style = estiloFilaTotal();
  rTotal.height = 22;

  ws.autoFilter = { from: 'A4', to: 'J4' };
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

// ── 3. Hoja 2 — Detalle por Empleado ───────────────────────────────────
function generarHojaDetalleEmpleado(workbook, datos) {
  const ws = workbook.addWorksheet('Detalle por Empleado');

  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = 'COSTACON – DETALLE DE BONO POR EMPLEADO';
  ws.getCell('A1').style = estiloTituloHoja();
  ws.getRow(1).height = 26;

  const headers = ['Proyecto', 'Tarea', '# Empleado', 'Nombre', 'Rol', 'HH Trabajadas', 'Bono Asignado', 'Jefe Cuadrilla'];
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
    headerRow.getCell(i + 1).style = estiloEncabezadoColumna();
  });
  headerRow.height = 26;

  ws.columns = [{ width: 20 }, { width: 26 }, { width: 12 }, { width: 22 },
                { width: 12 }, { width: 14 }, { width: 14 }, { width: 20 }];

  datos.detalleEmpleado.forEach((fila, i) => {
    const r = ws.getRow(4 + i);
    const valores = [fila.proyecto, fila.tarea, fila.empleadoNumero, fila.nombre,
                      fila.rol, fila.hhTrabajadas, fila.bonoAsignado, fila.jefeCuadrilla];
    valores.forEach((v, j) => {
      const cell = r.getCell(j + 1);
      cell.value = v;
      cell.style = (j === 6) ? estiloCeldaBono() : estiloFilaAlterna(i % 2 === 0);
    });
  });

  const filaTotalIdx = 4 + datos.detalleEmpleado.length;
  const rTotal = ws.getRow(filaTotalIdx);
  const sumaHH = datos.detalleEmpleado.reduce((s, f) => s + f.hhTrabajadas, 0);
  const sumaBono = datos.detalleEmpleado.reduce((s, f) => s + f.bonoAsignado, 0);

  rTotal.getCell(1).value = 'TOTALES';
  ws.mergeCells(`A${filaTotalIdx}:E${filaTotalIdx}`);
  for (let c = 1; c <= 5; c++) rTotal.getCell(c).style = estiloFilaTotal();
  rTotal.getCell(6).value = sumaHH;
  rTotal.getCell(7).value = sumaBono;
  rTotal.getCell(7).numFmt = '"₡"#,##0';
  for (let c = 6; c <= 8; c++) rTotal.getCell(c).style = estiloFilaTotal();
  rTotal.height = 22;

  ws.autoFilter = { from: 'A3', to: 'H3' };
  ws.views = [{ state: 'frozen', ySplit: 3 }];
}

// ── 4. Hoja 3 — Horas Diarias ───────────────────────────────────────────
function generarHojaHorasDiarias(workbook, datos) {
  const ws = workbook.addWorksheet('Horas Diarias');

  ws.mergeCells('A1:P1');
  ws.getCell('A1').value = 'COSTACON – CONTROL DIARIO DE HORAS';
  ws.getCell('A1').style = estiloTituloHoja();
  ws.getRow(1).height = 26;

  const diasHeaders = Array.from({ length: 10 }, (_, i) => `Día ${i + 1}`);
  const headers = ['Proyecto', 'Tarea', 'Empleado', 'Rol', ...diasHeaders, 'Total HH'];
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
    headerRow.getCell(i + 1).style = estiloEncabezadoColumna();
  });
  headerRow.height = 24;

  ws.columns = [
    { width: 18 }, { width: 22 }, { width: 20 }, { width: 10 },
    ...Array(10).fill({ width: 7 }), { width: 12 }
  ];

  datos.horasDiarias.forEach((fila, i) => {
    const r = ws.getRow(4 + i);
    const valores = [fila.proyecto, fila.tarea, fila.empleado, fila.rol, ...fila.dias, fila.total];
    valores.forEach((v, j) => {
      const cell = r.getCell(j + 1);
      cell.value = v;
      const esTotal = j === valores.length - 1;
      cell.style = esTotal ? estiloCeldaBono() : estiloFilaAlterna(i % 2 === 0);
      if (esTotal) cell.numFmt = '0.0" HH"';
    });
  });

  const filaTotalIdx = 4 + datos.horasDiarias.length;
  const rTotal = ws.getRow(filaTotalIdx);
  rTotal.getCell(1).value = 'TOTALES';
  ws.mergeCells(`A${filaTotalIdx}:D${filaTotalIdx}`);
  for (let c = 1; c <= 4; c++) rTotal.getCell(c).style = estiloFilaTotal();

  for (let dia = 0; dia < 10; dia++) {
    const sumaDia = datos.horasDiarias.reduce((s, f) => s + (f.dias[dia] || 0), 0);
    rTotal.getCell(5 + dia).value = sumaDia;
    rTotal.getCell(5 + dia).style = estiloFilaTotal();
  }
  const sumaTotalGeneral = datos.horasDiarias.reduce((s, f) => s + f.total, 0);
  rTotal.getCell(15).value = sumaTotalGeneral;
  rTotal.getCell(15).numFmt = '0.0" HH"';
  rTotal.getCell(15).style = estiloFilaTotal();
  rTotal.height = 22;

  ws.autoFilter = { from: 'A3', to: 'N3' };
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 4 }];
}

// ── 5. Función maestra — llamar desde el botón "Exportar Excel" ──────
export async function ejecutarExportacion(nombreArchivo = 'Reporte_Bonos_COSTACON.xlsx') {
  const datos = await obtenerDatosReporte();

  // ExcelJS se carga como global desde el CDN en el <head> del HTML
  const workbook = new window.ExcelJS.Workbook();
  workbook.creator = 'COSTACON';
  workbook.created = new Date();

  generarHojaResumen(workbook, datos);
  generarHojaDetalleEmpleado(workbook, datos);
  generarHojaHorasDiarias(workbook, datos);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombreArchivo; a.click();
  URL.revokeObjectURL(url);
}
