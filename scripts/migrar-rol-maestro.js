#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// scripts/migrar-rol-maestro.js — Bloque 5c, fases B y D.
//
// El identificador del rol de campo pasa de 'supervisor' a 'maestro'.
//
//   node scripts/migrar-rol-maestro.js               # simulación + verificación
//   node scripts/migrar-rol-maestro.js --escribir    # aplica
//
// SIN BANDERAS ES LA VERIFICACIÓN DE LA FASE D. Las reglas estrictas solo
// se despliegan si esto reporta CERO documentos con el rol viejo. Un
// documento que se quede atrás es una cuenta que no puede entrar a nada, y
// sin error en consola: pasa el guardia de interfaz —`normalizarRol()` lo
// traduce— y la rebotan las reglas.
//
// Campos con nombre propio: `rolAnteriorMaestro` y `rolMaestroEn`. Los del
// bloque 2 —`rolAnterior`, `rolMigradoEn`— NO se tocan: sobrescribirlos
// borraría la única evidencia de qué era cada cuenta en el modelo viejo de
// tres roles.
//
// Requiere `serviceAccountKey.json` en la raíz (está en .gitignore).
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const ESCRIBIR = args.includes('--escribir');

const ROL_INGENIERO = 'ingeniero';
const ROL_MAESTRO = 'maestro';
const ROL_MAESTRO_LEGADO = 'supervisor';

/** Roles conocidos. Cualquier otro aborta la corrida: un valor que nadie
 *  esperaba es un dato que hay que mirar, no uno que hay que convertir. */
const MAPA = {
  [ROL_INGENIERO]: ROL_INGENIERO,
  [ROL_MAESTRO]: ROL_MAESTRO,
  [ROL_MAESTRO_LEGADO]: ROL_MAESTRO,
};

// ⚠️ `{ credential: cert(...) }`, NO `{ cert: ... }`. La segunda forma no es
// una clave de configuración válida: el SDK la ignora, no encuentra
// credencial, cae a las credenciales por defecto y —si no existen— se queda
// reintentando contra el servidor de metadatos de Google Cloud. No falla: se
// cuelga en silencio.
const CLAVE = 'serviceAccountKey.json';

if (existsSync(CLAVE)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(CLAVE, 'utf8'))) });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  initializeApp({ credential: applicationDefault() });
} else {
  console.error(`\n✗ No hay credenciales. Se esperaba ./${CLAVE} o la variable`);
  console.error('  de entorno GOOGLE_APPLICATION_CREDENTIALS.\n');
  process.exit(1);
}

const db = getFirestore();

/* ══════════════════════════════════════════════════════════════════════ */

async function leerUsuarios() {
  const snap = await db.collection('usuarios').get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

function respaldar(usuarios) {
  const nombre = `backup-usuarios-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(nombre, JSON.stringify(usuarios, null, 2), 'utf8');
  console.log(`\n  Respaldo escrito: ${nombre}`);
  return nombre;
}

async function main() {
  console.log('\n═══ migrar-rol-maestro ═══');
  console.log(ESCRIBIR ? '  MODO ESCRITURA\n' : '  Simulación — no se escribe nada\n');

  const usuarios = await leerUsuarios();
  console.log(`  ${usuarios.length} documentos en /usuarios`);

  // ── Guarda 1: ningún rol fuera del mapa ─────────────────────────────
  const desconocidos = usuarios.filter((u) => !(u.rol in MAPA));
  if (desconocidos.length) {
    console.error('\n✗ ABORTA: hay roles que este script no sabe convertir.');
    for (const u of desconocidos) {
      console.error(`    ${u.uid}  rol=${JSON.stringify(u.rol)}  ${u.nombre ?? ''}`);
    }
    console.error('\n  Revisalos a mano antes de volver a correr esto.\n');
    process.exit(1);
  }

  const porMigrar = usuarios.filter((u) => u.rol === ROL_MAESTRO_LEGADO);
  const yaMaestros = usuarios.filter((u) => u.rol === ROL_MAESTRO);
  const ingenieros = usuarios.filter((u) => u.rol === ROL_INGENIERO);

  console.log(`\n  ingenieros        ${ingenieros.length}`);
  console.log(`  maestros          ${yaMaestros.length}`);
  console.log(`  con el rol viejo  ${porMigrar.length}`);

  for (const u of porMigrar) {
    console.log(`    → ${u.uid}  ${u.nombre ?? '(sin nombre)'}`);
  }

  // ── Guarda 2: no quedarse sin ingenieros ────────────────────────────
  // Sin ingenieros nadie crea proyectos, aprueba avances ni cierra metas.
  if (ingenieros.length === 0) {
    console.error('\n✗ ABORTA: el resultado dejaría CERO ingenieros.\n');
    process.exit(1);
  }

  // ── El veredicto de la fase D ───────────────────────────────────────
  if (porMigrar.length === 0) {
    console.log('\n  ✓ CERO documentos con el rol viejo.');
    console.log('    La precondición de la fase D está cumplida:');
    console.log('    ya se pueden desplegar las reglas estrictas.\n');
    return;
  }

  respaldar(usuarios);   // siempre, incluso en simulación

  if (!ESCRIBIR) {
    console.log('\n  ⚠️ NO se desplieguen las reglas estrictas todavía.');
    console.log('    Corré esto con --escribir y volvé a verificar sin banderas.\n');
    return;
  }

  // ── Escritura ───────────────────────────────────────────────────────
  const lote = db.batch();
  for (const u of porMigrar) {
    lote.update(db.collection('usuarios').doc(u.uid), {
      rol: ROL_MAESTRO,
      rolAnteriorMaestro: u.rol,
      rolMaestroEn: FieldValue.serverTimestamp(),
    });
  }
  await lote.commit();
  console.log(`\n  ${porMigrar.length} documentos actualizados.`);

  // ── Verificación después de escribir, no antes ──────────────────────
  const despues = await leerUsuarios();
  const rezagados = despues.filter((u) => u.rol === ROL_MAESTRO_LEGADO);
  if (rezagados.length) {
    console.error(`\n✗ Quedaron ${rezagados.length} sin migrar. NO desplegar reglas.\n`);
    process.exit(1);
  }
  console.log('  ✓ Verificado: cero documentos con el rol viejo.');
  console.log('    Ahora sí: firebase deploy --only firestore\n');
}

main().catch((e) => {
  console.error('\n✗ Error:', e.message ?? e, '\n');
  process.exit(1);
});
