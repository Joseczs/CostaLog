// ═══════════════════════════════════════════════════════════════════════
// estilosExcel.js — paleta y estilos reutilizables para ExcelJS
// Coherente con la identidad visual de los tickets físicos.
// ═══════════════════════════════════════════════════════════════════════

export const COLORES = {
  azulOscuro: 'FF1A3A5C',
  azulClaro: 'FFE8EEF5',
  naranja: 'FFF0A500',
  naranjaClaro: 'FFFDF0D9',
  blanco: 'FFFFFFFF',
  grisTexto: 'FF444444',
  bordeGris: 'FFC0CCD8'
};

export function bordeCompleto() {
  const linea = { style: 'thin', color: { argb: COLORES.bordeGris } };
  return { top: linea, bottom: linea, left: linea, right: linea };
}

export function estiloTituloHoja() {
  return {
    font: { bold: true, size: 14, color: { argb: COLORES.blanco } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.azulOscuro } },
    alignment: { vertical: 'middle', horizontal: 'left' }
  };
}

export function estiloEncabezadoColumna() {
  return {
    font: { bold: true, size: 10, color: { argb: COLORES.blanco } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.azulOscuro } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: bordeCompleto()
  };
}

export function estiloFilaAlterna(esPar) {
  return {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: esPar ? COLORES.azulClaro : COLORES.blanco } },
    border: bordeCompleto()
  };
}

export function estiloCeldaBono() {
  return {
    font: { bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.naranjaClaro } },
    numFmt: '"₡"#,##0',
    border: bordeCompleto()
  };
}

export function estiloFilaTotal() {
  return {
    font: { bold: true, size: 10, color: { argb: 'FF111111' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.naranja } },
    border: bordeCompleto(),
    alignment: { vertical: 'middle' }
  };
}
