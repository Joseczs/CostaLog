// ═══════════════════════════════════════════════════════════════════════
// sidebar.js — Menú de navegación lateral, único para toda la app.
// El MISMO componente se usa para ambos roles; solo cambia QUÉ ve cada uno.
// Objetivo: claridad de acceso — etiquetas siempre visibles, agrupadas por
// categoría, sin depender de tooltips.
// ═══════════════════════════════════════════════════════════════════════

import { ROL_INGENIERO, ROL_MAESTRO } from './roles.js';

// Estructura de navegación por rol. Agrupada por categoría.
// Desde el bloque 5c/E los directorios dicen lo que son: /ingeniero/* es
// del Ingeniero Residente y /maestro/* del Maestro de Obras. La deuda 3
// quedó cerrada ahí; este comentario documentaba la inversión y se
// corrige acá porque el archivo ya estaba abierto.
const NAV_POR_ROL = {
  [ROL_INGENIERO]: [
    {
      grupo: 'General',
      items: [
        { label: 'Dashboard', icono: '▤', href: '/ingeniero/dashboard.html' }
      ]
    },
    {
      grupo: 'Gestión',
      items: [
        { label: 'Proyectos', icono: '🏗️', href: '/ingeniero/dashboard.html#seccion-proyectos' },
        // Bloque 4a — deuda 6 pagada. Metas y Configuración se llegaban solo
        // por URL escrita a mano; ahora tienen entrada propia.
        { label: 'Metas', icono: '🎯', href: '/ingeniero/metas.html' },
        // Bloque 5 — la misma pantalla para los dos roles (D-5-01).
        { label: 'Resumen de bono', icono: '💰', href: '/ingeniero/bono-resumen.html' },
        { label: 'Tareas', icono: '📋', href: '/ingeniero/dashboard.html#seccion-tareas' },
        { label: 'Colaboradores', icono: '👷', href: '/ingeniero/gestionar-empleados.html' },
        // Bloque 5b-2 — deuda 16 pagada. Asignar Maestros de Obra a un
        // proyecto era `serviceAccountKey.json` y línea de comandos.
        { label: 'Asignar maestros', icono: '🔗', href: '/ingeniero/asignar-supervisores.html' },
        { label: 'Configuración', icono: '⚙️', href: '/ingeniero/config-proyecto.html' }
      ]
    },
    {
      grupo: 'Datos',
      items: [
        { label: 'Excel', icono: '📊', href: '/ingeniero/dashboard.html?panel=excel' }
      ]
    }
  ],
  [ROL_MAESTRO]: [
    {
      grupo: 'General',
      items: [
        { label: 'Mis tareas', icono: '📋', href: '/maestro/mis-tareas.html' },
        // Bloque 4c — la mitad de PROPONER de D-11. Primero de la lista a
        // propósito: es la única entrada de datos reales del sistema.
        { label: 'Reportar avance', icono: '📈', href: '/maestro/avance.html' },
        // Mismo archivo que ve el ingeniero: mismos numeros, misma cascada.
        // La carpeta /ingeniero/ no es una frontera de permisos — el guardia
        // es protegerPagina, y esa pantalla admite los dos roles.
        { label: 'Resumen de bono', icono: '💰', href: '/ingeniero/bono-resumen.html' },
        { label: 'Mi equipo', icono: '👷', href: '/maestro/mi-cuadrilla.html' }
      ]
    }
  ]
};

function rutaDe(href) {
  // Devuelve solo el pathname (sin hash ni query) para comparar "página actual".
  return href.split('#')[0].split('?')[0];
}

/**
 * Renderiza el menú lateral en la página actual, según el rol del perfil.
 * Llamar desde el callback de protegerPagina(), donde ya se conoce el rol.
 * @param {object} perfil - { rol, nombre, ... }
 */
export function renderSidebar(perfil) {
  if (!perfil || document.querySelector('.sidebar')) return; // ya renderizado

  // Rol desconocido cae al menú de menos alcance, nunca al de más.
  const grupos = NAV_POR_ROL[perfil.rol] || NAV_POR_ROL[ROL_MAESTRO];
  const rutaActual = window.location.pathname;

  const aside = document.createElement('aside');
  aside.className = 'sidebar';

  let html = `
    <div class="sidebar-brand">
      <span class="sidebar-logo">COSTACON</span>
    </div>
    <nav class="sidebar-nav">`;

  grupos.forEach(g => {
    html += `<div class="sidebar-grupo">${g.grupo}</div>`;
    g.items.forEach(it => {
      const activo = rutaDe(it.href) === rutaActual ? ' activo' : '';
      html += `
        <a class="sidebar-item${activo}" href="${it.href}">
          <span class="sidebar-icono" aria-hidden="true">${it.icono}</span>
          <span class="sidebar-label">${it.label}</span>
        </a>`;
    });
  });

  html += `</nav>`;
  aside.innerHTML = html;

  document.body.insertBefore(aside, document.body.firstChild);
  document.body.classList.add('has-sidebar');
}
