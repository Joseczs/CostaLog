// ═══════════════════════════════════════════════════════════════════════
// sidebar.js — Menú de navegación lateral, único para toda la app.
// El MISMO componente se usa para ambos roles; solo cambia QUÉ ve cada uno.
// Objetivo: claridad de acceso — etiquetas siempre visibles, agrupadas por
// categoría, sin depender de tooltips.
// ═══════════════════════════════════════════════════════════════════════

import { ROL_INGENIERO, ROL_SUPERVISOR } from './roles.js';

// Estructura de navegación por rol. Agrupada por categoría.
// ⚠️ Los directorios /supervisor/ y /jefe/ conservan el nombre viejo:
// /supervisor/* pertenece al INGENIERO, /jefe/* al SUPERVISOR (Maestro
// de Obras). Deuda declarada en CONTRATOS.md.
const NAV_POR_ROL = {
  [ROL_INGENIERO]: [
    {
      grupo: 'General',
      items: [
        { label: 'Dashboard', icono: '▤', href: '/supervisor/dashboard.html' }
      ]
    },
    {
      grupo: 'Gestión',
      items: [
        { label: 'Proyectos', icono: '🏗️', href: '/supervisor/dashboard.html#seccion-proyectos' },
        // Bloque 4a — deuda 6 pagada. Metas y Configuración se llegaban solo
        // por URL escrita a mano; ahora tienen entrada propia.
        { label: 'Metas', icono: '🎯', href: '/supervisor/metas.html' },
        { label: 'Tareas', icono: '📋', href: '/supervisor/dashboard.html#seccion-tareas' },
        { label: 'Colaboradores', icono: '👷', href: '/supervisor/gestionar-empleados.html' },
        { label: 'Configuración', icono: '⚙️', href: '/supervisor/config-proyecto.html' }
      ]
    },
    {
      grupo: 'Datos',
      items: [
        { label: 'Excel', icono: '📊', href: '/supervisor/dashboard.html?panel=excel' }
      ]
    }
  ],
  [ROL_SUPERVISOR]: [
    {
      grupo: 'General',
      items: [
        { label: 'Mis tareas', icono: '📋', href: '/jefe/mis-tareas.html' },
        // Bloque 4c — la mitad de PROPONER de D-11. Primero de la lista a
        // propósito: es la única entrada de datos reales del sistema.
        { label: 'Reportar avance', icono: '📈', href: '/jefe/avance.html' },
        { label: 'Mi equipo', icono: '👷', href: '/jefe/mi-cuadrilla.html' }
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
  const grupos = NAV_POR_ROL[perfil.rol] || NAV_POR_ROL[ROL_SUPERVISOR];
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
