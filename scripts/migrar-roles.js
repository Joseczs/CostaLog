#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// migrar-roles.js — Bloque 2. Intercambio de roles en /usuarios.
//
//   supervisor      → ingeniero     (era la oficina: proyectos, tareas,
//                                    empleados. Hoy eso es el Ingeniero.)
//   jefe_cuadrilla  → supervisor    (Maestro de Obras. D-04.)
//   jefeCuadrilla   → supervisor    (defensivo: variante camelCase.)
//   admin           → ingeniero     (el rol se elimina.)
//
// ⚠️ ESTO ES UN INTERCAMBIO, NO UN RENOMBRADO. El string 'supervisor'
// cambia de significado. Mientras corre, un documento con rol 'supervisor'
// es ambiguo: puede ser oficina-viejo o campo-nuevo. El desempate es el
// campo `rolMigradoEn`:
//
//     rol='supervisor' SIN  rolMigradoEn  → oficina vieja  → ingeniero
//     rol='supervisor' CON  rolMigradoEn  → campo nuevo    → no se toca
//
// Por eso el script es idempotente y se puede correr dos veces sin daño.
// Pero el DESPLIEGUE no lo es: reglas y UI deben salir en la misma
// ventana. Ver el procedimiento al final de este archivo.
//
// ── USO ────────────────────────────────────────────────────────────────
//   npm install firebase-admin
//   node scripts/migrar-roles.js              → simulación (no escribe)
//   node scripts/migrar-roles.js --escribir   → aplica los cambios
//
// Credenciales: Firebase Console → Configuración del proyecto → Cuentas de
// servicio → Generar nueva clave privada. Guardar como serviceAccountKey.json
// en la raíz del repo, o exportar GOOGLE_APPLICATION_CREDENTIALS.
//
//   ⚠️ serviceAccountKey.json NO SE SUBE A GIT. Agregarlo a .gitignore
//      antes de descargarlo. Da acceso total a la base, sin reglas.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ═══════════════════════════════════════════════════════════════════════
// ⚠️ SCRIPT RETIRADO — bloque 2, ya ejecutado. NO VOLVER A CORRERLO.
//
// Su mapa convierte HACIA 'supervisor', que desde la fase D del bloque 5c
// no concede ningún permiso. Correrlo hoy dejaría cuentas sin acceso a
// nada, y sin error visible.
//
// No se borra porque documenta el intercambio de significado del string
// 'supervisor' —oficina → campo— que es la única explicación de por qué
// `rolAnterior` y `rolMigradoEn` existen en los documentos de usuario.
//
// Para migrar roles hoy: scripts/migrar-rol-maestro.js
// ═══════════════════════════════════════════════════════════════════════
if (!process.argv.includes('--si-se-lo-que-hago')) {
  console.error('\n✗ Script retirado (bloque 2, ya ejecutado).');
  console.error('  Su mapa escribe un rol que ya no concede permisos.');
  console.error('  Para migrar roles: node scripts/migrar-rol-maestro.js\n');
  process.exit(1);
}

const ESCRIBIR = process.argv.includes('--escribir');
const CLAVE = 'serviceAccountKey.json';

// ── Mapa de conversión ─────────────────────────────────────────────────
const MAPA = {
  supervisor: 'ingeniero',
  jefe_cuadrilla: 'supervisor',
  jefeCuadrilla: 'supervisor',
  admin: 'ingeniero',
};

const ROLES_NUEVOS = ['ingeniero', 'supervisor'];

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

// ── Clasificación de un documento ──────────────────────────────────────
function clasificar(doc) {
  const d = doc.data();
  const rol = d.rol;
  const yaMigrado = Boolean(d.rolMigradoEn);

  if (yaMigrado) {
    if (!ROLES_NUEVOS.includes(rol)) {
      return { accion: 'ABORTAR', motivo: `migrado pero con rol inválido "${rol}"` };
    }
    return { accion: 'OMITIR', motivo: 'ya migrado' };
  }

  if (rol === 'ingeniero') {
    // Rol nuevo sin marca: alguien lo escribió a mano. Se acepta y se marca.
    return { accion: 'MARCAR', destino: 'ingeniero', motivo: 'ya era ingeniero, se marca' };
  }

  if (rol in MAPA) {
    return { accion: 'MIGRAR', destino: MAPA[rol], origen: rol };
  }

  return { accion: 'ABORTAR', motivo: `rol desconocido "${rol}"` };
}

// ── Principal ──────────────────────────────────────────────────────────
async function main() {
  const modo = ESCRIBIR ? 'ESCRITURA' : 'SIMULACIÓN';
  console.log(`\n${'═'.repeat(66)}`);
  console.log(`  COSTACON — migración de roles · modo ${modo}`);
  console.log(`${'═'.repeat(66)}\n`);

  const db = conectar();
  const snap = await db.collection('usuarios').get();

  if (snap.empty) {
    console.log('  La colección /usuarios está vacía. Nada que hacer.\n');
    return;
  }

  // ── Backup SIEMPRE, incluso en simulación ────────────────────────────
  const backup = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  const archivo = `backup-usuarios-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(archivo, JSON.stringify(backup, null, 2));
  console.log(`  Backup: ${archivo}  (${backup.length} documentos)\n`);

  // ── Clasificar todo ANTES de escribir nada ───────────────────────────
  const plan = snap.docs.map((doc) => ({ doc, ...clasificar(doc) }));
  const abortos = plan.filter((p) => p.accion === 'ABORTAR');

  console.log('  uid                            nombre                 rol → destino');
  console.log(`  ${'─'.repeat(62)}`);
  for (const p of plan) {
    const nombre = String(p.doc.data().nombre ?? '—').slice(0, 20).padEnd(20);
    const rol = String(p.doc.data().rol ?? '(sin rol)').padEnd(15);
    const uid = p.doc.id.slice(0, 28).padEnd(28);
    const flecha =
      p.accion === 'MIGRAR' ? `→ ${p.destino}`
      : p.accion === 'MARCAR' ? '→ (marcar)'
      : p.accion === 'OMITIR' ? '· omitido'
      : `✗ ${p.motivo}`;
    console.log(`  ${uid} ${nombre} ${rol} ${flecha}`);
  }

  const cuenta = (a) => plan.filter((p) => p.accion === a).length;
  console.log(`\n  migrar: ${cuenta('MIGRAR')}   marcar: ${cuenta('MARCAR')}   ` +
              `omitir: ${cuenta('OMITIR')}   problemas: ${abortos.length}`);

  // ── Verificación obligatoria ─────────────────────────────────────────
  if (abortos.length > 0) {
    console.error('\n  ✗ ABORTADO. Hay documentos que el mapa no cubre.');
    console.error('    Ningún documento fue modificado. Corregilos a mano y volvé a correr.\n');
    process.exit(1);
  }

  // Un intercambio sin ingenieros deja la app sin quien cree metas.
  const ingenierosFinales = plan.filter(
    (p) => p.destino === 'ingeniero' ||
           (p.accion === 'OMITIR' && p.doc.data().rol === 'ingeniero')
  ).length;

  if (ingenierosFinales === 0) {
    console.error('\n  ✗ ABORTADO. La migración dejaría CERO usuarios con rol ingeniero.');
    console.error('    Nadie podría crear proyectos, metas ni empleados. Revisá el mapa.\n');
    process.exit(1);
  }
  console.log(`  ingenieros al terminar: ${ingenierosFinales}`);

  const aEscribir = plan.filter((p) => p.accion === 'MIGRAR' || p.accion === 'MARCAR');
  if (aEscribir.length === 0) {
    console.log('\n  ✓ Todo estaba migrado. Nada que escribir.\n');
    return;
  }

  if (!ESCRIBIR) {
    console.log('\n  Simulación terminada. Nada se escribió.');
    console.log('  Si el plan de arriba es correcto:  node scripts/migrar-roles.js --escribir\n');
    return;
  }

  // ── Escritura por lotes ──────────────────────────────────────────────
  for (let i = 0; i < aEscribir.length; i += 400) {
    const lote = db.batch();
    for (const p of aEscribir.slice(i, i + 400)) {
      const cambios = {
        rol: p.destino,
        rolMigradoEn: FieldValue.serverTimestamp(),
      };
      if (p.accion === 'MIGRAR') cambios.rolAnterior = p.origen;
      lote.update(p.doc.ref, cambios);
    }
    await lote.commit();
  }

  console.log(`\n  ✓ ${aEscribir.length} documentos actualizados.`);
  console.log('    `rolAnterior` queda para auditar. No se borra.\n');
  console.log('  SIGUIENTE, sin pausa:');
  console.log('    1. firebase deploy --only firestore     (desde cmd)');
  console.log('    2. git push                             (Netlify publica la UI)');
  console.log('    Entre el paso 1 y el 2 la app está inconsistente. Que sea corto.\n');
}

main().catch((err) => {
  console.error('\n✗ Error no controlado. Revisá el backup antes de reintentar.');
  console.error(err);
  process.exit(1);
});
