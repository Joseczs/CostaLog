#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// cargar-fixture-unidepro.js — Andamio de pruebas. Fuera del deploy.
//
// Escribe en Firestore el caso de aceptación UNA UNIDEPRO / Meta 1, que
// hoy solo existe como objetos en memoria dentro de
// `public/js/core/fixtures/meta-unidepro-1.js`.
//
// Sin esto, la prueba de aceptación del bloque 4b no tiene qué leer: los
// 47 hitos de lista + 5 extras nunca han estado en la base.
//
// ── USO ────────────────────────────────────────────────────────────────
//   node scripts/cargar-fixture-unidepro.js              → simulación
//   node scripts/cargar-fixture-unidepro.js --escribir   → aplica
//   node scripts/cargar-fixture-unidepro.js --borrar     → activo:false
//
// La simulación NO toca la base: imprime qué escribiría y, sobre todo,
// los totales que el motor calcula con esos datos. Si ahí no salen
// 2 697.10 y 1 092.25, el problema está en el fixture o en el motor —
// no en Firestore, y no en la pantalla.
//
// ── IDS FIJOS, A PROPÓSITO ─────────────────────────────────────────────
// Todo se escribe con `set()` sobre ids conocidos, nunca con `add()`.
// Correrlo dos veces deja exactamente el mismo estado. Con ids
// autogenerados, la segunda pasada dejaría 104 hitos y una tarde perdida
// entendiendo por qué los totales dan el doble.
//
// ── CREDENCIALES ───────────────────────────────────────────────────────
// `serviceAccountKey.json` en la raíz, el mismo del bloque 2.
//   ⚠️ Da acceso total a la base, saltándose las reglas. NO SE SUBE A GIT.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  META_UNIDEPRO_1,
  HITOS_UNIDEPRO_1,
  EVALUACIONES_UNIDEPRO_1,
} from '../public/js/core/fixtures/meta-unidepro-1.js';
import { REGLAS_BONO_DEFAULT } from '../public/js/core/reglasBono.config.js';
import { calcularBonoMeta } from '../public/js/core/calculoMeta.js';

const ESCRIBIR = process.argv.includes('--escribir');
const BORRAR = process.argv.includes('--borrar');
const CLAVE = 'serviceAccountKey.json';

// ── Ids fijos ──────────────────────────────────────────────────────────
const PROYECTO_ID = 'fixture-unidepro';
const META_ID = 'meta-1';
const EVAL_ID = 'eval-000';

// Totales de aceptación (§5.6 de la especificación). No se tocan.
const ESPERADO = { hhEstimadasTotal: 2697.1, hhGanadasTotal: 1092.25, bonoMO: 498480 };

// ── Conexión ───────────────────────────────────────────────────────────
function conectar() {
  if (existsSync(CLAVE)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(CLAVE, 'utf8'))) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault() });
  } else {
    console.error(`\n✗ No hay credenciales. Se esperaba ./${CLAVE} o la variable`);
    console.error('  de entorno GOOGLE_APPLICATION_CREDENTIALS. Ver cabecera.\n');
    process.exit(1);
  }
  return getFirestore();
}

/* ══════════════════════════════════════════════════════════════════════
   TRANSFORMACIÓN — fixture en memoria → documentos de Firestore
   ══════════════════════════════════════════════════════════════════════ */

/**
 * El fixture es el Excel, tal cual. Le faltan tres cosas que el modelo de
 * datos (§4) sí pide, y que este script agrega:
 *
 *   1. `codigo` en los 5 extras, que vienen en blanco → EXTRA.01 … EXTRA.05
 *   2. `orden`  → la posición en el arreglo, que es el orden del Excel
 *   3. `activo` → true en los 52
 *
 * Además deja los campos de D-11 explícitos en null: el fixture trae el
 * avance ya APROBADO (`avancePct`), sin ninguna propuesta pendiente.
 *
 * ⚠️ El código `A.35` está DUPLICADO en el fixture (dos renglones
 * distintos). Está así en el Excel y no se corrige: los totales de
 * aceptación dependen de estos datos exactos. Consecuencia para todo el
 * que lea esta colección: `codigo` NO es clave única. Usar el id del
 * documento o el campo `orden`.
 */
export function documentosDeHitos(hitos) {
  let nExtra = 0;
  return hitos.map((h, i) => {
    const esExtraSinCodigo = h.tipo === 'extra' && !h.codigo;
    if (esExtraSinCodigo) nExtra++;
    return {
      id: `h-${String(i).padStart(3, '0')}`,
      datos: {
        codigo: esExtraSinCodigo ? `EXTRA.${String(nExtra).padStart(2, '0')}` : h.codigo,
        descripcion: h.descripcion,
        unidad: h.unidad,
        cantidad: h.cantidad,
        hhUnidad: h.hhUnidad,
        avancePct: h.avancePct,
        tipo: h.tipo,
        orden: i,
        // D-11: el fixture trae el valor aprobado, sin propuesta pendiente.
        avancePropuesto: null,
        propuestoPor: null,
        propuestoEn: null,
        aprobadoPor: null,
        aprobadoEn: null,
        activo: true,
      },
    };
  });
}

/** El documento del proyecto. `esFixture` es lo que lo delata como de mentira. */
function documentoProyecto() {
  return {
    nombre: '⚠ FIXTURE — UNA UNIDEPRO',
    codigo: 'FIXTURE',
    frente: 'Caso de aceptación §5.6',
    esFixture: true,
    reglasBono: { ...REGLAS_BONO_DEFAULT },
    activo: true,
  };
}

function documentoMeta() {
  return {
    ...META_UNIDEPRO_1,
    supervisorId: null,
    hhPlanillaAlCorte: null,
    reglasSnapshot: null, // estado 'evaluada': todavía no se congela (§4-bis)
    snapshotCongeladoEn: null,
    totales: null, // lo escribe el bloque 4, no este script
    esFixture: true,
    activo: true,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   VERIFICACIÓN — antes de escribir, no después
   ══════════════════════════════════════════════════════════════════════ */

function verificarTotales() {
  const hitos = documentosDeHitos(HITOS_UNIDEPRO_1).map((d) => d.datos);
  const r = calcularBonoMeta(
    META_UNIDEPRO_1,
    hitos,
    EVALUACIONES_UNIDEPRO_1,
    REGLAS_BONO_DEFAULT,
  );

  const casi = (a, b) => Math.abs(a - b) < 0.005;
  const filas = [
    ['hhEstimadasTotal', r.hhEstimadasTotal, ESPERADO.hhEstimadasTotal],
    ['hhGanadasTotal', r.hhGanadasTotal, ESPERADO.hhGanadasTotal],
    ['bonoMO', r.bonoMO, ESPERADO.bonoMO],
  ];

  console.log('\n── Totales del motor con los datos transformados ──');
  let ok = true;
  for (const [nombre, obtenido, esperado] of filas) {
    const bien = casi(obtenido, esperado);
    if (!bien) ok = false;
    console.log(
      `  ${bien ? '✓' : '✗'} ${nombre.padEnd(18)} ${obtenido.toFixed(2).padStart(12)}` +
        (bien ? '' : `   esperado ${esperado}`),
    );
  }
  return ok;
}

/* ══════════════════════════════════════════════════════════════════════
   ESCRITURA
   ══════════════════════════════════════════════════════════════════════ */

async function cargar(db) {
  const refProyecto = db.collection('proyectos').doc(PROYECTO_ID);

  // Guarda contra colisión de id: si ese documento existe y NO es fixture,
  // es un proyecto real y no se le escribe encima por ningún motivo.
  const snap = await refProyecto.get();
  if (snap.exists && snap.data().esFixture !== true) {
    console.error(`\n✗ Ya existe proyectos/${PROYECTO_ID} y NO tiene esFixture:true.`);
    console.error('  Parece un proyecto real. No se escribe nada. Revisalo a mano.\n');
    process.exit(1);
  }

  const hitos = documentosDeHitos(HITOS_UNIDEPRO_1);

  console.log('\n── Lo que se escribiría ──');
  console.log(`  proyectos/${PROYECTO_ID}`);
  console.log(`    └── metas/${META_ID}`);
  console.log(`         ├── hitos/          ${hitos.length} documentos`);
  console.log(`         └── evaluaciones/   ${EVALUACIONES_UNIDEPRO_1.length} documento`);

  const extras = hitos.filter((h) => h.datos.tipo === 'extra');
  console.log(`\n  Códigos asignados a los extras sin código:`);
  for (const e of extras) {
    console.log(`    ${e.id}  ${e.datos.codigo}  ${e.datos.descripcion.slice(0, 46)}`);
  }

  if (!ESCRIBIR) {
    console.log('\n  (simulación — no se escribió nada)\n');
    return;
  }

  const lote = db.batch();
  lote.set(refProyecto, documentoProyecto(), { merge: true });

  const refMeta = refProyecto.collection('metas').doc(META_ID);
  lote.set(refMeta, documentoMeta(), { merge: true });

  for (const h of hitos) {
    lote.set(refMeta.collection('hitos').doc(h.id), h.datos, { merge: true });
  }

  EVALUACIONES_UNIDEPRO_1.forEach((e, i) => {
    const id = i === 0 ? EVAL_ID : `eval-${String(i).padStart(3, '0')}`;
    lote.set(refMeta.collection('evaluaciones').doc(id), { ...e, activo: true }, { merge: true });
  });

  await lote.commit();
  console.log(`\n✓ Escrito. ${hitos.length + EVALUACIONES_UNIDEPRO_1.length + 2} documentos.\n`);
}

async function borrar(db) {
  const refProyecto = db.collection('proyectos').doc(PROYECTO_ID);
  const snap = await refProyecto.get();

  if (!snap.exists) {
    console.log('\n  No existe. Nada que borrar.\n');
    return;
  }
  if (snap.data().esFixture !== true) {
    console.error('\n✗ Ese proyecto no tiene esFixture:true. No se toca.\n');
    process.exit(1);
  }

  console.log('\n── Soft-delete del fixture ──');
  console.log(`  proyectos/${PROYECTO_ID}.activo = false`);
  console.log('  (los hitos quedan en la base; el proyecto deja de listarse)');

  if (!ESCRIBIR) {
    console.log('\n  (simulación — agregá --escribir para aplicar)\n');
    return;
  }

  // Soft-delete, nunca deleteDoc: es invariante de toda la base.
  await refProyecto.update({ activo: false });
  console.log('\n✓ Desactivado.\n');
}

/* ══════════════════════════════════════════════════════════════════════ */

async function principal() {
  console.log('\n═══ Fixture UNA UNIDEPRO / Meta 1 ═══');
  console.log(ESCRIBIR ? '  modo: ESCRITURA' : '  modo: simulación (sin --escribir)');

  if (!BORRAR && !verificarTotales()) {
    console.error('\n✗ Los totales no coinciden con §5.6. No se escribe nada.');
    console.error('  El problema está en el fixture o en el motor, no en Firestore.\n');
    process.exit(1);
  }

  const db = conectar();
  if (BORRAR) await borrar(db);
  else await cargar(db);
}

principal().catch((err) => {
  console.error('\n✗ Falló:', err.message, '\n');
  process.exit(1);
});
