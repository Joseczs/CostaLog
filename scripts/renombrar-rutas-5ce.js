// ═══════════════════════════════════════════════════════════════════════
// scripts/renombrar-rutas-5ce.js — Bloque 5c/E: /supervisor/→/ingeniero/,
// /jefe/→/maestro/, y el alias ROL_SUPERVISOR→ROL_MAESTRO.
//
//   node scripts/renombrar-rutas-5ce.js              # simulación, no escribe
//   node scripts/renombrar-rutas-5ce.js --escribir   # aplica
//
// Es UNA decisión aplicada muchas veces, no muchas decisiones de diseño —
// mismo criterio que ya usó el plan para no contar esto como "más de cinco
// archivos". Por eso es mecánico y no a mano: a mano, 19+ archivos es
// exactamente donde se cuela un error de tipeo que nadie nota hasta el
// primer 404 en producción.
//
// ── Qué NO toca, y por qué ────────────────────────────────────────────
//
//  · public/js/roles.js — es el archivo que concentra el riesgo. Ya viene
//    editado a mano en este mismo bloque (ver CONTRATOS.md), porque tiene
//    la DECLARACIÓN de ROL_SUPERVISOR (`export const ROL_SUPERVISOR = …`).
//    Si este script lo tocara, reescribiría esa línea a
//    `export const ROL_MAESTRO = ROL_MAESTRO;` — una redeclaración que
//    revienta el módulo entero. Se excluye a propósito.
//
//  · netlify.toml — recibe los redirects a mano, con las rutas VIEJAS
//    como origen. Si este script lo tocara, borraría el origen del
//    redirect y lo dejaria inútil.
//
//  · node_modules, .git — obvio.
//
// ── Por qué /supervisor/ y /jefe/ CON las barras ──────────────────────
//
// El campo `supervisorIds` (bloque 5b) y cualquier identificador que
// contenga la palabra "supervisor" SIN barras a los lados no es una ruta:
// es un nombre de campo y no se toca. Buscar el string exacto `/supervisor/`
// —barra, palabra, barra— es lo que separa una cosa de la otra. Verificado
// contra el repo real: no hay falsos positivos.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ESCRIBIR = process.argv.includes('--escribir');

const RAIZ = process.cwd();
const EXTENSIONES = new Set(['.html', '.js', '.mjs']);
const EXCLUIR_DIRS = new Set(['node_modules', '.git', '.netlify']);
const EXCLUIR_ARCHIVOS = new Set([
  join(RAIZ, 'public', 'js', 'roles.js'),
  join(RAIZ, 'netlify.toml'),
  // Ya editado a mano: retiraba pruebas que testeaban la EXISTENCIA de
  // ROL_SUPERVISOR y esSupervisor. Un reemplazo ciego los habría vuelto
  // tautológicos (assert.equal(ROL_MAESTRO, ROL_MAESTRO)) en vez de
  // retirarlos, y además habría duplicado el import de ROL_MAESTRO.
  join(RAIZ, 'test', 'bloque5c.mjs'),
  // El propio script: sus comentarios y patrones contienen los strings
  // literales '/supervisor/', '/jefe/' y 'ROL_SUPERVISOR' a propósito.
  // Corriendo sobre sí mismo se comería sus propias reglas.
  join(RAIZ, 'scripts', 'renombrar-rutas-5ce.js'),
  // La suite nueva del propio bloque: verifica CONTRA esos mismos strings
  // (que netlify.toml los conserve, que public/ no los tenga). Tocarla
  // invalidaría lo que está probando.
  join(RAIZ, 'test', 'bloque5ce.mjs'),
  // Sus dos "coincidencias" son delimitadores de regex —/supervisor/i—,
  // no rutas. Comprobado a mano: un reemplazo ciego las habría vuelto
  // /ingeniero/i, cambiando lo que la prueba verifica SIN ningún error de
  // sintaxis que lo delatara. Cero rutas reales que perder al excluirlo.
  join(RAIZ, 'test', 'bloque5c-bis.mjs'),
  // Su ROL_SUPERVISOR es el nombre de una variable LOCAL dentro de
  // scripts/migrar-supervisor-ids.js —del bloque 5c/D, ya cerrado—, sin
  // relación con el export de roles.js que acá se retira. Cero rutas
  // reales que perder al excluirlo (verificado).
  join(RAIZ, 'test', 'bloque5cd.mjs'),
  // Mismo motivo desde el otro lado: su propia variable local, fuera de
  // alcance de este bloque.
  join(RAIZ, 'scripts', 'migrar-supervisor-ids.js'),
]);

// Directorios que se escanean. public/ es el grueso; test/ y scripts/
// tienen imports de módulos (`from '../public/supervisor/...'`) y rutas
// embebidas en aserciones que son la MISMA categoría de cambio.
const DIRS_A_ESCANEAR = ['public', 'test', 'scripts'];

// Orden importa: el identificador primero, las rutas después. No se pisan
// entre sí (uno es \bROL_SUPERVISOR\b, los otros llevan barras), pero
// mantenerlo explícito evita sorpresas si algún día se agrega una tercera.
const REEMPLAZOS = [
  { patron: /\bROL_SUPERVISOR\b/g, con: 'ROL_MAESTRO', etiqueta: 'ROL_SUPERVISOR → ROL_MAESTRO' },
  { patron: /\/supervisor\//g,     con: '/ingeniero/',  etiqueta: '/supervisor/ → /ingeniero/' },
  { patron: /\/jefe\//g,           con: '/maestro/',    etiqueta: '/jefe/ → /maestro/' },
];

function listarArchivos(dir, acc = []) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    const info = statSync(ruta);
    if (info.isDirectory()) {
      if (!EXCLUIR_DIRS.has(nombre)) listarArchivos(ruta, acc);
    } else if (EXTENSIONES.has(extname(nombre)) && !EXCLUIR_ARCHIVOS.has(ruta)) {
      acc.push(ruta);
    }
  }
  return acc;
}

function main() {
  console.log(`\n═══ renombrar-rutas-5ce ═══  (${ESCRIBIR ? 'ESCRIBIENDO' : 'simulación'})\n`);

  const archivos = DIRS_A_ESCANEAR
    .map((d) => join(RAIZ, d))
    .filter((d) => { try { return statSync(d).isDirectory(); } catch { return false; } })
    .flatMap((d) => listarArchivos(d));
  let totalArchivosTocados = 0;
  let totalReemplazos = 0;
  const porEtiqueta = Object.fromEntries(REEMPLAZOS.map((r) => [r.etiqueta, 0]));

  for (const ruta of archivos) {
    const original = readFileSync(ruta, 'utf8');
    let nuevo = original;
    let tocado = false;

    for (const { patron, con, etiqueta } of REEMPLAZOS) {
      const coincidencias = nuevo.match(patron);
      if (coincidencias) {
        porEtiqueta[etiqueta] += coincidencias.length;
        totalReemplazos += coincidencias.length;
        nuevo = nuevo.replace(patron, con);
        tocado = true;
      }
    }

    if (tocado) {
      totalArchivosTocados++;
      const relativa = ruta.slice(RAIZ.length + 1).replace(/\\/g, '/');
      console.log(`  ${relativa}`);
      if (ESCRIBIR) writeFileSync(ruta, nuevo, 'utf8');
    }
  }

  console.log(`\n  Archivos tocados:    ${totalArchivosTocados}`);
  console.log(`  Reemplazos totales:  ${totalReemplazos}`);
  for (const [etiqueta, n] of Object.entries(porEtiqueta)) {
    console.log(`    · ${etiqueta}: ${n}`);
  }

  if (!ESCRIBIR) {
    console.log(`\n  Simulación. Nada se escribió.`);
    console.log(`  Si el conteo se ve razonable, correr con --escribir.\n`);
  } else {
    console.log(`\n  Escrito. Correr ahora:`);
    console.log(`    node test/bloque5ce.mjs`);
    console.log(`    grep -rn "/supervisor/\\|/jefe/" public --include=*.html --include=*.js\n`);
  }
}

main();
