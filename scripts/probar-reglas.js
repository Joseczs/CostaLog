#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// scripts/probar-reglas.js — Reemplazo del Simulador de la consola.
//
//   node scripts/probar-reglas.js
//
// El Simulador de Firebase prueba las reglas en abstracto: hay que armar
// cada caso a mano, activar un toggle de "Autenticado" que no siempre está
// a la vista, y un error de null value no dice cuál de los pasos falló.
//
// Esto hace lo mismo pero con LOGIN REAL. Usa `firebase-admin` para
// fabricar una sesión de cada cuenta (sin pedir contraseña — el admin
// puede emitir un "custom token" para cualquier uid) y el SDK de cliente
// para leer Firestore CON esa sesión puesta. Las reglas desplegadas se
// ejercitan de verdad: si el resultado no coincide con lo esperado, es la
// regla, no la forma de probarla.
//
// Requiere:
//   npm install firebase --no-save          (SDK de cliente; el admin ya
//                                             lo tenés instalado)
//   serviceAccountKey.json en la raíz (igual que los otros scripts)
//
// Qué prueba, con los datos reales de esta sesión:
//   1. El maestro lee un proyecto donde SÍ está en supervisorIds → permitido
//   2. El maestro lee un proyecto donde NO está                 → denegado
//   3. El maestro lee una meta de ese proyecto ajeno             → denegado
//   4. El ingeniero lee ese mismo proyecto ajeno                 → permitido
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

import { initializeApp as initClient } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// ── Conexión admin (para fabricar tokens y leer sin restricción) ───────
const CLAVE = 'serviceAccountKey.json';
if (!existsSync(CLAVE)) {
  console.error(`\n✗ Falta ./${CLAVE} en la raíz del proyecto.\n`);
  process.exit(1);
}
const cuenta = JSON.parse(readFileSync(CLAVE, 'utf8'));
initAdmin({ credential: cert(cuenta) });
const dbAdmin = getAdminFirestore();
const authAdmin = getAdminAuth();

// ── Conexión cliente (para leer CON las reglas puestas) ─────────────────
// El apiKey es público a propósito — es el mismo que ya viaja en
// public/js/firebase-config.js. No es un secreto: identifica el proyecto,
// no autoriza nada por sí solo.
const clientApp = initClient({
  apiKey: 'AIzaSyAiL736RD3ChtOCcHFDsQ8wsDFo6WEPpn8',
  authDomain: 'costalog-12a44.firebaseapp.com',
  projectId: 'costalog-12a44',
});
const authClient = getAuth(clientApp);
const dbClient = getFirestore(clientApp);

/* ══════════════════════════════════════════════════════════════════════ */

/** Intenta un `getDoc` autenticado como `uid`. Nunca lanza: siempre
 *  devuelve 'permitido' | 'denegado' | el error crudo si es otra cosa. */
async function probar(uid, ruta) {
  const token = await authAdmin.createCustomToken(uid);
  await signInWithCustomToken(authClient, token);
  try {
    await getDoc(doc(dbClient, ruta));
    return 'permitido';
  } catch (err) {
    if (err.code === 'permission-denied') return 'denegado';
    return `ERROR INESPERADO: ${err.code ?? err.message}`;
  } finally {
    await signOut(authClient);
  }
}

/* ── Bloque 5d: los casos que ESCRIBEN ─────────────────────────────────
 *
 * Los cuatro casos del 5d no son lecturas: crean y actualizan documentos.
 * Ejecutarlos contra las cuentas reales significaría dar de alta un usuario
 * de verdad y promover a alguien de verdad sobre una base con 4 cuentas.
 *
 * Por eso los cuatro corren ENCADENADOS sobre un uid fabricado: el 5d/A lo
 * crea, el 5d/B intenta ascenderlo, el 5d/C lo asciende desde la cuenta del
 * ingeniero real. Ninguna cuenta real se escribe en ningún momento.
 *
 * ⚠️ Dos cosas que hay que saber:
 *
 * 1. `signInWithCustomToken` con un uid inexistente CREA la cuenta en
 *    Authentication. La limpieza tiene que borrar el documento de Firestore
 *    Y el usuario de Auth, o queda un rezagado invisible que nadie busca.
 *
 * 2. Ese borrado es DURO, y choca de frente con el principio 3 ("todo
 *    borrado es soft-delete"). Es admisible y queda declarado: lo hace el
 *    SDK admin sobre un documento que esta misma prueba fabricó, nunca
 *    sobre el histórico, y las reglas siguen negando `delete` a la
 *    aplicación en los nueve documentos.
 *
 * La limpieza corre al arrancar (por si una corrida anterior murió a la
 * mitad) y en el `finally`. El uid es fijo y reconocible a propósito.
 */
const UID_PRUEBA = 'zz-prueba-reglas-5d';

async function limpiarUidDePrueba() {
  await dbAdmin.doc(`usuarios/${UID_PRUEBA}`).delete().catch(() => {});
  await authAdmin.deleteUser(UID_PRUEBA).catch(() => {});
}

/** Intenta una escritura autenticada como `uid`. Nunca lanza. */
async function probarEscritura(uid, ruta, datos, modo) {
  const token = await authAdmin.createCustomToken(uid);
  await signInWithCustomToken(authClient, token);
  try {
    const referencia = doc(dbClient, ruta);
    if (modo === 'crear') await setDoc(referencia, datos);
    else                  await updateDoc(referencia, datos);
    return 'permitido';
  } catch (err) {
    if (err.code === 'permission-denied') return 'denegado';
    return `ERROR INESPERADO: ${err.code ?? err.message}`;
  } finally {
    await signOut(authClient);
  }
}

/** Busca en la base real: un ingeniero, un maestro CON proyectos asignados,
 *  un proyecto suyo y uno ajeno. Sin esto habría que pegar uids e ids a
 *  mano, que es justo la parte confusa del Simulador.
 *
 *  Se elige el maestro POR SUS ASIGNACIONES, no el primero de la lista: en
 *  una base con varios maestros, agarrar el primero puede caer en una
 *  cuenta de prueba sin proyectos y abortar sin motivo real. */
async function elegirDatos() {
  const usuarios = (await dbAdmin.collection('usuarios').get()).docs
    .map((d) => ({ uid: d.id, ...d.data() }));
  const ingeniero = usuarios.find((u) => u.rol === 'ingeniero');
  const maestros = usuarios.filter((u) => u.rol === 'maestro');

  if (!ingeniero || maestros.length === 0) {
    console.error('\n✗ Falta una cuenta con rol ingeniero o maestro en /usuarios.\n');
    process.exit(1);
  }

  const proyectos = (await dbAdmin.collection('proyectos').get()).docs
    .map((d) => ({ id: d.id, ...d.data() }));

  const tieneAsignado = (p, uid) =>
    Array.isArray(p.supervisorIds) && p.supervisorIds.includes(uid);

  // El primer maestro que tenga al menos un proyecto. Los demás quedan
  // fuera de la prueba y está bien: acá se verifica la REGLA, no el
  // estado de asignación de cada cuenta.
  let maestro = null, asignado = null;
  for (const m of maestros) {
    const suyo = proyectos.find((p) => tieneAsignado(p, m.uid));
    if (suyo) { maestro = m; asignado = suyo; break; }
  }

  if (!maestro) {
    console.error('\n✗ Ningún maestro tiene proyectos en supervisorIds:');
    for (const m of maestros) {
      console.error(`    ${m.uid}  ${m.nombre ?? '(sin nombre)'}`);
    }
    console.error('\n  Asignale uno con scripts/migrar-supervisor-ids.js.\n');
    process.exit(1);
  }

  const ajeno = proyectos.find((p) => !tieneAsignado(p, maestro.uid));
  if (!ajeno) {
    console.error('\n✗ TODOS los proyectos tienen asignado a este maestro — no hay caso');
    console.error('  negativo que probar. Cargá o liberá al menos un proyecto ajeno.\n');
    process.exit(1);
  }

  // Una meta cualquiera del proyecto ajeno, si tiene alguna. Si no tiene
  // ninguna, se prueba con un id inventado — sigue siendo un caso válido:
  // por reglas, ni existir tiene que hacer falta para que se deniegue.
  const metasAjeno = await dbAdmin.collection(`proyectos/${ajeno.id}/metas`).limit(1).get();
  const metaId = metasAjeno.empty ? 'sin-metas-para-probar' : metasAjeno.docs[0].id;

  return { ingeniero, maestro, asignado, ajeno, metaId };
}

async function main() {
  console.log('\n═══ probar-reglas ═══\n');
  console.log('Buscando cuentas y proyectos reales para armar los cuatro casos...\n');

  const { ingeniero, maestro, asignado, ajeno, metaId } = await elegirDatos();

  console.log(`  Ingeniero : ${ingeniero.nombre ?? '(sin nombre)'}  (${ingeniero.uid})`);
  console.log(`  Maestro   : ${maestro.nombre ?? '(sin nombre)'}  (${maestro.uid})`);
  console.log(`  Asignado  : proyectos/${asignado.id}`);
  console.log(`  Ajeno     : proyectos/${ajeno.id}`);
  console.log('');

  const casos = [
    {
      n: 1, esperado: 'permitido',
      etiqueta: `maestro lee su propio proyecto (${asignado.id})`,
      uid: maestro.uid, ruta: `proyectos/${asignado.id}`,
    },
    {
      n: 2, esperado: 'denegado',
      etiqueta: `maestro lee un proyecto ajeno (${ajeno.id})`,
      uid: maestro.uid, ruta: `proyectos/${ajeno.id}`,
    },
    {
      n: 3, esperado: 'denegado',
      etiqueta: `maestro lee una meta del proyecto ajeno`,
      uid: maestro.uid, ruta: `proyectos/${ajeno.id}/metas/${metaId}`,
    },
    {
      n: 4, esperado: 'permitido',
      etiqueta: `ingeniero lee ESE MISMO proyecto ajeno`,
      uid: ingeniero.uid, ruta: `proyectos/${ajeno.id}`,
    },
  ];

  let todoBien = true;

  console.log('  ── Bloque 5b/5c — alcance por proyecto (lecturas) ──\n');
  for (const c of casos) {
    const resultado = await probar(c.uid, c.ruta);
    const ok = resultado === c.esperado;
    todoBien &&= ok;
    console.log(`  ${ok ? '✓' : '✗'}  Prueba ${c.n} — ${c.etiqueta}`);
    console.log(`       esperado: ${c.esperado}   ·   obtenido: ${resultado}`);
  }

  // ── Bloque 5d — el rol no se lo asigna uno mismo (escrituras) ────────
  console.log('\n  ── Bloque 5d — auto-asignación de rol (escrituras) ──');
  console.log(`     uid fabricado: ${UID_PRUEBA}  ·  se borra al terminar\n`);

  await limpiarUidDePrueba();   // por si una corrida anterior murió a la mitad

  const ruta = `usuarios/${UID_PRUEBA}`;
  const base = { nombre: 'Cuenta de prueba — borrar', activo: true };

  const escrituras = [
    {
      n: 5, esperado: 'denegado', modo: 'crear', uid: UID_PRUEBA,
      etiqueta: 'crearse a sí mismo como ingeniero',
      datos: { ...base, rol: 'ingeniero' },
    },
    {
      n: 6, esperado: 'permitido', modo: 'crear', uid: UID_PRUEBA,
      etiqueta: 'crearse a sí mismo como maestro',
      datos: { ...base, rol: 'maestro' },
    },
    {
      // LA QUE IMPORTA. Si esta da 'permitido', la deuda 1 sigue abierta
      // aunque el `create` esté cerrado: el agujero se movió, no se fue.
      n: 7, esperado: 'denegado', modo: 'actualizar', uid: UID_PRUEBA,
      etiqueta: 'promoverse a sí mismo con update de rol',
      datos: { rol: 'ingeniero' },
    },
    {
      n: 8, esperado: 'permitido', modo: 'actualizar', uid: ingeniero.uid,
      etiqueta: 'un ingeniero promoviendo a otra cuenta',
      datos: { rol: 'ingeniero' },
    },
  ];

  try {
    for (const c of escrituras) {
      const resultado = await probarEscritura(c.uid, ruta, c.datos, c.modo);
      const ok = resultado === c.esperado;
      todoBien &&= ok;
      console.log(`  ${ok ? '✓' : '✗'}  Prueba ${c.n} — ${c.etiqueta}`);
      console.log(`       esperado: ${c.esperado}   ·   obtenido: ${resultado}`);
    }
  } finally {
    await limpiarUidDePrueba();
    console.log(`\n  Limpieza: ${UID_PRUEBA} borrado de /usuarios y de Auth.`);
  }

  console.log(todoBien
    ? '\n  ✓ Las ocho pruebas dieron lo esperado. El bloque 5d queda cerrado.\n'
    : '\n  ✗ Algo no coincide. NO des el bloque por cerrado todavía.\n');

  process.exit(todoBien ? 0 : 1);
}

main().catch((e) => {
  console.error('\n✗ Error:', e.message ?? e, '\n');
  process.exit(1);
});
