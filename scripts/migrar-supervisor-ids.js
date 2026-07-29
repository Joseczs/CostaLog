#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// scripts/migrar-supervisor-ids.js — Bloque 5b.
//
// Rellena `supervisorIds` en los proyectos que no lo tengan, y permite
// asignar supervisores desde la línea de comandos mientras no exista la
// pantalla (bloque 5b-2).
//
//   node scripts/migrar-supervisor-ids.js                 # simulación
//   node scripts/migrar-supervisor-ids.js --escribir      # aplica
//   node scripts/migrar-supervisor-ids.js --listar        # quién es quién
//   node scripts/migrar-supervisor-ids.js --asignar <proyectoId> <uid>[,<uid>] --escribir
//   node scripts/migrar-supervisor-ids.js --todos-a <uid> --escribir
//
// ⚠️ ESTE SCRIPT CORRE ANTES DEL DEPLOY DE REGLAS, NO DESPUÉS.
// Las reglas nuevas niegan el acceso a todo proyecto sin el campo. Si se
// despliegan primero, los supervisores se quedan sin pantallas hasta que
// esto termine. El orden es: script → verificar → deploy.
//
// Requiere `serviceAccountKey.json` en la raíz (está en .gitignore).
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const tiene = (bandera) => args.includes(bandera);
const valorDe = (bandera) => {
  const i = args.indexOf(bandera);
  return i === -1 ? null : args[i + 1] ?? null;
};

const ESCRIBIR = tiene('--escribir');
const SOLO_LISTAR = tiene('--listar');
const ASIGNAR_A = valorDe('--asignar');
const TODOS_A = valorDe('--todos-a');

// Bloque 5c/D — el rol de campo se llama 'maestro'. Antes decía
// 'supervisor' y, con las reglas estrictas desplegadas, este script habría
// listado CERO maestros: el filtro no calzaba con ningún documento. El
// nombre de la constante y el del campo `supervisorIds` se dejan como
// están — renombrar el campo es migración de datos, no de scripts.
const ROL_SUPERVISOR = 'maestro';
const ROL_INGENIERO = 'ingeniero';

// ⚠️ `{ credential: cert(...) }`, NO `{ cert: ... }`. La segunda forma no es
// una clave de configuración válida: el SDK la ignora, no encuentra
// credencial, cae a las credenciales por defecto y —si no existen— se queda
// reintentando contra el servidor de metadatos de Google Cloud. No falla: se
// cuelga en silencio. Es exactamente el bug que costó la primera corrida.
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

async function leerProyectos() {
  const snap = await db.collection('proyectos').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function imprimirUsuarios(usuarios) {
  const supervisores = usuarios.filter((u) => u.rol === ROL_SUPERVISOR);
  const ingenieros = usuarios.filter((u) => u.rol === ROL_INGENIERO);

  console.log('\n  INGENIEROS (ven todos los proyectos, no se asignan)');
  for (const u of ingenieros) console.log(`    ${u.uid}  ${u.nombre ?? '(sin nombre)'}`);

  console.log('\n  MAESTROS DE OBRA (ven solo lo asignado)');
  if (!supervisores.length) console.log('    — ninguno —');
  for (const u of supervisores) console.log(`    ${u.uid}  ${u.nombre ?? '(sin nombre)'}`);
  console.log('');
  return { supervisores, ingenieros };
}

/* ══════════════════════════════════════════════════════════════════════ */

async function principal() {
  console.log('\n═══ supervisorIds — bloque 5b ═══');
  console.log(ESCRIBIR ? '  MODO ESCRITURA\n' : '  SIMULACIÓN — no se escribe nada\n');

  const usuarios = await leerUsuarios();
  const proyectos = await leerProyectos();
  const { supervisores } = imprimirUsuarios(usuarios);

  if (SOLO_LISTAR) {
    console.log('  PROYECTOS');
    for (const p of proyectos) {
      const ids = Array.isArray(p.supervisorIds) ? p.supervisorIds : null;
      const detalle = ids === null
        ? '⚠ SIN CAMPO — invisible para todo supervisor'
        : ids.length === 0
          ? '(sin supervisores asignados)'
          : ids.map((id) => usuarios.find((u) => u.uid === id)?.nombre ?? id).join(', ');
      console.log(`    ${p.id.padEnd(24)} ${p.nombre ?? ''}\n      → ${detalle}`);
    }
    console.log('');
    return;
  }

  // Backup SIEMPRE, incluso en simulación. Es el mismo criterio del script
  // de roles: la copia se hace antes de saber si hará falta.
  const archivo = `backup-proyectos-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(archivo, JSON.stringify(proyectos, null, 2));
  console.log(`  Backup: ${archivo}\n`);

  // ── Validación de los uid que se van a asignar ──────────────────────
  let asignaciones = new Map(); // proyectoId → uid[]

  if (ASIGNAR_A) {
    const uids = (valorDe('--asignar') && args[args.indexOf('--asignar') + 2]) || '';
    const lista = String(uids).split(',').map((s) => s.trim()).filter(Boolean);
    if (!lista.length) {
      console.error('✗ Falta el uid. Uso: --asignar <proyectoId> <uid>[,<uid>]\n');
      process.exit(1);
    }
    verificarUids(lista, supervisores);
    if (!proyectos.some((p) => p.id === ASIGNAR_A)) {
      console.error(`✗ No existe el proyecto ${ASIGNAR_A}.\n`);
      process.exit(1);
    }
    asignaciones.set(ASIGNAR_A, lista);
  }

  if (TODOS_A) {
    verificarUids([TODOS_A], supervisores);
    for (const p of proyectos) {
      const previos = Array.isArray(p.supervisorIds) ? p.supervisorIds : [];
      asignaciones.set(p.id, [...new Set([...previos, TODOS_A])]);
    }
  }

  // ── Plan ────────────────────────────────────────────────────────────
  const plan = [];
  for (const p of proyectos) {
    const asignado = asignaciones.get(p.id);
    const tieneCampo = Array.isArray(p.supervisorIds);

    if (asignado) {
      plan.push({ id: p.id, nombre: p.nombre, valor: asignado, motivo: 'asignación explícita' });
    } else if (!tieneCampo) {
      // Fail-closed: se rellena con arreglo VACÍO, no con todos los
      // supervisores. Un proyecto que nadie asignó no debería volverse
      // visible por efecto de una migración; que falte asignarlo tiene que
      // notarse, no resolverse solo. Es la divergencia consciente con el
      // principio 4 ("activo por omisión"): ese existe para que una
      // migración no esconda media base; acá el riesgo es el contrario —
      // un campo ausente que da acceso a plata ajena.
      plan.push({ id: p.id, nombre: p.nombre, valor: [], motivo: 'rellenar campo faltante' });
    }
  }

  if (!plan.length) {
    console.log('  Nada que hacer: todos los proyectos ya tienen el campo.\n');
    return;
  }

  console.log('  PLAN');
  for (const c of plan) {
    console.log(`    ${c.id.padEnd(24)} ${c.nombre ?? ''}`);
    console.log(`      ${c.motivo} → [${c.valor.join(', ') || 'vacío'}]`);
  }

  const sinNadie = plan.filter((c) => c.valor.length === 0).length;
  if (sinNadie) {
    console.log(
      `\n  ⚠ ${sinNadie} ${sinNadie === 1 ? 'proyecto queda' : 'proyectos quedan'} sin ` +
      'supervisor asignado: ningún Maestro de Obras los verá.\n' +
      '    Asignalos con --asignar antes de desplegar las reglas.',
    );
  }

  if (!ESCRIBIR) {
    console.log('\n  Simulación. Volvé a correr con --escribir para aplicar.\n');
    return;
  }

  const lote = db.batch();
  for (const c of plan) lote.update(db.collection('proyectos').doc(c.id), { supervisorIds: c.valor });
  await lote.commit();

  // Verificación posterior: no se confía en que el batch hizo lo que dijo.
  const despues = await leerProyectos();
  const fallidos = despues.filter((p) => !Array.isArray(p.supervisorIds));
  if (fallidos.length) {
    console.error(`\n✗ Quedaron ${fallidos.length} proyectos sin el campo. Revisá antes de desplegar reglas.\n`);
    process.exit(1);
  }

  console.log(`\n  ✓ ${plan.length} proyectos actualizados. Todos tienen supervisorIds.`);
  console.log('  Siguiente paso: firebase deploy --only firestore\n');
}

function verificarUids(lista, supervisores) {
  for (const uid of lista) {
    const u = supervisores.find((s) => s.uid === uid);
    if (!u) {
      console.error(
        `\n✗ ${uid} no es un usuario con rol '${ROL_SUPERVISOR}'.\n` +
        '  Asignar a un ingeniero no tiene sentido —ya ve todo— y asignar a un\n' +
        '  uid inexistente deja un permiso muerto que nadie va a revisar.\n' +
        '  Corré --listar para ver los uid válidos.\n',
      );
      process.exit(1);
    }
  }
}

principal().catch((err) => {
  console.error('\n✗ Falló:', err.message, '\n');
  process.exit(1);
});
