/**
 * Fixture extraído directamente de INCENTIVOS_MO_OG_META_1_UNIDEPRO.xlsx.
 * Caso de aceptación: proyecto UNA UNIDEPRO, Meta #1, corte 16.06.2026.
 * NO editar a mano: si el Excel cambia, se regenera.
 */

export const META_UNIDEPRO_1 = {
  numero: 1,
  fechaInicio: new Date('2026-05-26T00:00:00'),
  fechaLimite: new Date('2026-07-21T00:00:00'),
  fechaEvaluacion: new Date('2026-06-16T00:00:00'),
  fechaEntrega: new Date('2026-07-21T00:00:00'),
  bonoBase: 250000,
  hhPlanilla: 704,
  ajusteDiasHabiles: 0,
  estado: 'evaluada',
};

export const EVALUACIONES_UNIDEPRO_1 = [
  { fecha: new Date('2026-06-16T00:00:00'), ornato: 100, so: 100 },
];

/** 47 hitos de lista + 5 actividades fuera de lista. */
export const HITOS_UNIDEPRO_1 = [
  { codigo: "A.01", descripcion: "Mejoras en bodegas  y reparación de cerramientos", unidad: "Glb", cantidad: 1, hhUnidad: 60, avancePct: 100, tipo: 'lista' },
  { codigo: "A.02", descripcion: "Cortar maleza area externa / recoger basura externa ", unidad: "Glb", cantidad: 1, hhUnidad: 60, avancePct: 70, tipo: 'lista' },
  { codigo: "A.03", descripcion: "Podar un arbol de aguacate y otro de roble sabana", unidad: "Glb", cantidad: 1, hhUnidad: 20, avancePct: 0, tipo: 'lista' },
  { codigo: "A.04", descripcion: "Limpieza general de edificio / recoger basura", unidad: "Glb", cantidad: 1, hhUnidad: 38, avancePct: 100, tipo: 'lista' },
  { codigo: "A.05", descripcion: "Remover instalación electrica según instrucciones", unidad: "m2", cantidad: 186, hhUnidad: 0.5, avancePct: 100, tipo: 'lista' },
  { codigo: "A.06", descripcion: "Remover y empacar plafones de cielos", unidad: "m2", cantidad: 120, hhUnidad: 0.4, avancePct: 100, tipo: 'lista' },
  { codigo: "A.07", descripcion: "Construir tapicheles de durock 12 mm / para pintar", unidad: "m2", cantidad: 3.5, hhUnidad: 5, avancePct: 0, tipo: 'lista' },
  { codigo: "A.08", descripcion: "Reparar pared y repello junto a futura ducha de emergencia", unidad: "m2", cantidad: 0.6, hhUnidad: 20, avancePct: 100, tipo: 'lista' },
  { codigo: "A.09", descripcion: "Detallado de paredes internas y externas listas para pintar", unidad: "m2", cantidad: 840, hhUnidad: 0.1, avancePct: 80, tipo: 'lista' },
  { codigo: "A.10", descripcion: "Pintura de paredes internas y externas ( 2 manos )", unidad: "m2", cantidad: 840, hhUnidad: 0.3, avancePct: 0, tipo: 'lista' },
  { codigo: "A.11", descripcion: "Reparar y completar enchapes de servicios sanitarios", unidad: "m2", cantidad: 1.2, hhUnidad: 12, avancePct: 80, tipo: 'lista' },
  { codigo: "A.12", descripcion: "Remover fragua y volver a fraguar porcelanato de SS", unidad: "m2", cantidad: 43, hhUnidad: 1.5, avancePct: 70, tipo: 'lista' },
  { codigo: "A.13", descripcion: "Colocar rodapie de pisos faltante incluye accesorios de A Inox", unidad: "ml", cantidad: 5.6, hhUnidad: 3, avancePct: 70, tipo: 'lista' },
  { codigo: "A.14", descripcion: "Remover fragua a rodapie y volver a fraguar", unidad: "ml", cantidad: 141, hhUnidad: 0.2, avancePct: 70, tipo: 'lista' },
  { codigo: "A.15", descripcion: "Remover fragua y volver a fraguar porcelanato de pisos", unidad: "m2", cantidad: 169, hhUnidad: 1.5, avancePct: 70, tipo: 'lista' },
  { codigo: "A.16", descripcion: "Colocar ganchos para ropa", unidad: "Unid", cantidad: 10, hhUnidad: 1, avancePct: 0, tipo: 'lista' },
  { codigo: "A.17", descripcion: "Colocación de portarollos, papeleras, jaboneras y dispensador", unidad: "Unid", cantidad: 7, hhUnidad: 1.5, avancePct: 0, tipo: 'lista' },
  { codigo: "A.18", descripcion: "Colocar barras ley 7600", unidad: "Unid", cantidad: 11, hhUnidad: 2, avancePct: 0, tipo: 'lista' },
  { codigo: "A.19", descripcion: "Colocar espejos", unidad: "Unid", cantidad: 3, hhUnidad: 2, avancePct: 0, tipo: 'lista' },
  { codigo: "A.20", descripcion: "Terminar y detallar totalmente pileta item 8.24. NIC rodapie", unidad: "Unid", cantidad: 1, hhUnidad: 25, avancePct: 80, tipo: 'lista' },
  { codigo: "A.21", descripcion: "Terminar y detallar totalmente pileta item 8.25. NIC rodapie", unidad: "Unid", cantidad: 1, hhUnidad: 25, avancePct: 80, tipo: 'lista' },
  { codigo: "A.22", descripcion: "Colocar bajante faltante PVC 100 cms D. Detallado", unidad: "Unid", cantidad: 1, hhUnidad: 10, avancePct: 0, tipo: 'lista' },
  { codigo: "A.23", descripcion: "Limpiar caja RP-2 / detallar y construir tapa", unidad: "Unid", cantidad: 1, hhUnidad: 12, avancePct: 0, tipo: 'lista' },
  { codigo: "A.24", descripcion: "Terminar cajas RP-3 incluyendo tapas", unidad: "Unid", cantidad: 2, hhUnidad: 10, avancePct: 0, tipo: 'lista' },
  { codigo: "A.25", descripcion: "Sustituir tubería de aguas negras 75 mm D. Ver item 10.01 ", unidad: "ml", cantidad: 60, hhUnidad: 2, avancePct: 0, tipo: 'lista' },
  { codigo: "A.26", descripcion: "Pruebas de presión tuberia AN y limpieza de CR . Item 10.02", unidad: "Glb", cantidad: 1, hhUnidad: 30, avancePct: 50, tipo: 'lista' },
  { codigo: "A.27", descripcion: "Colocación de Extintores", unidad: "Unid", cantidad: 4, hhUnidad: 1.5, avancePct: 0, tipo: 'lista' },
  { codigo: "A.28", descripcion: "Instalación ducha lava ojos", unidad: "Unid", cantidad: 1, hhUnidad: 12, avancePct: 0, tipo: 'lista' },
  { codigo: "A.29", descripcion: "Colocación de registros y drenajes de piso", unidad: "Unid", cantidad: 4, hhUnidad: 5, avancePct: 0, tipo: 'lista' },
  { codigo: "A.30", descripcion: "Limpieza de TG y tanque de bombeo. Todo el item 10.09", unidad: "Glb", cantidad: 1, hhUnidad: 30, avancePct: 100, tipo: 'lista' },
  { codigo: "A.31", descripcion: "Pruebas de presión tuberia AN edificio . Item 10.10", unidad: "Glb", cantidad: 1, hhUnidad: 20, avancePct: 50, tipo: 'lista' },
  { codigo: "A.32", descripcion: "Remover equipos, ductos y accesorios equipo AA. Item 10.13", unidad: "Glb", cantidad: 1, hhUnidad: 20, avancePct: 100, tipo: 'lista' },
  { codigo: "A.33", descripcion: "Remover equipos ductos etc extractores baños. Item 10.20", unidad: "Glb", cantidad: 1, hhUnidad: 20, avancePct: 100, tipo: 'lista' },
  { codigo: "A.34", descripcion: "Obras sistema mecanico caseta de bombas. Item 10.22", unidad: "Glb", cantidad: 1, hhUnidad: 50, avancePct: 0, tipo: 'lista' },
  { codigo: "A.35", descripcion: "Obra civil caseta bombeo. Item 10.26", unidad: "Glb", cantidad: 1, hhUnidad: 60, avancePct: 0, tipo: 'lista' },
  { codigo: "A.35", descripcion: "Pruebas de presión red de AP interna y externa del Edificio. ", unidad: "Glb", cantidad: 1, hhUnidad: 20, avancePct: 50, tipo: 'lista' },
  { codigo: "A.36", descripcion: "Obra civil acometida electrica. Item 11.01", unidad: "Glb", cantidad: 1, hhUnidad: 180, avancePct: 0, tipo: 'lista' },
  { codigo: "A.37", descripcion: "Pedestal para planta electrica", unidad: "Glb", cantidad: 1, hhUnidad: 60, avancePct: 0, tipo: 'lista' },
  { codigo: "A.38", descripcion: "Obra civil columna para transferencia electrica. Item 11.20", unidad: "Glb", cantidad: 1, hhUnidad: 80, avancePct: 0, tipo: 'lista' },
  { codigo: "A.39", descripcion: "Terminar arquetas para redes", unidad: "Unid", cantidad: 4, hhUnidad: 20, avancePct: 0, tipo: 'lista' },
  { codigo: "A.40", descripcion: "Colocación de señaletica", unidad: "Glb", cantidad: 1, hhUnidad: 12, avancePct: 0, tipo: 'lista' },
  { codigo: "A.41", descripcion: "Preparación de areas para colocar zacate", unidad: "m2", cantidad: 102, hhUnidad: 0.4, avancePct: 0, tipo: 'lista' },
  { codigo: "A.42", descripcion: "Lavado y demarcación de parqueo", unidad: "Glb", cantidad: 1, hhUnidad: 120, avancePct: 0, tipo: 'lista' },
  { codigo: "A.43", descripcion: "Demolición, excavación y sustitución area asfalto. Item 13.06", unidad: "m2", cantidad: 54, hhUnidad: 0.5, avancePct: 90, tipo: 'lista' },
  { codigo: "A.44", descripcion: "Rampas. Item 13.15", unidad: "Unid", cantidad: 2, hhUnidad: 20, avancePct: 0, tipo: 'lista' },
  { codigo: "A.45", descripcion: "Colocar losetas podotactiles. Items 13.16 a 13.13.18", unidad: "ml", cantidad: 76.5, hhUnidad: 0.6, avancePct: 70, tipo: 'lista' },
  { codigo: "A.46", descripcion: "Remover porcelanato pared y piso para reutilizar", unidad: "m2", cantidad: 10, hhUnidad: 3, avancePct: 100, tipo: 'lista' },
  { codigo: "", descripcion: "Aplicación de neutralizar de oxido en malla y otros", unidad: "glb", cantidad: 1, hhUnidad: 30, avancePct: 100, tipo: 'extra' },
  { codigo: "", descripcion: "Muro riel de porton peatonal", unidad: "ml", cantidad: 6, hhUnidad: 10, avancePct: 0, tipo: 'extra' },
  { codigo: "", descripcion: "Lavado, repello y filos de muros de rampas", unidad: "glb", cantidad: 1, hhUnidad: 40, avancePct: 70, tipo: 'extra' },
  { codigo: "", descripcion: "Demoliciones, cajas e inst. mecanica para valvulas", unidad: "unid", cantidad: 8, hhUnidad: 8, avancePct: 0, tipo: 'extra' },
  { codigo: "", descripcion: "Picas para tuberías electricas", unidad: "glb", cantidad: 1, hhUnidad: 30, avancePct: 100, tipo: 'extra' },
];
