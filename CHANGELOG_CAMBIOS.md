# COSTACON — Cambios aplicados

Implementación de los 7 puntos del spec acordado.

## 1. Auto-creación de proyectos desde Excel
- `js/importarExcel.js`: un proyecto inexistente ya **no bloquea** la importación; se crea automáticamente con `estado: "incompleto"`, `activo: true` y `codigo` = OT# de la fila (o `AUTO-00N`). Se crea **una sola vez** por nombre aunque lo referencien varias filas.
- Las filas de proyectos nuevos se muestran como **advertencia ámbar** ("se creará automáticamente"), no como error rojo.
- `js/validaciones.js` (**nuevo**): función reutilizable `validarCamposProyecto()` + `etiquetasCamposFaltantes()`. Ampliar aquí cuando el Excel traiga más columnas.
- Dashboard: los proyectos `incompleto` muestran **⚠️** junto al nombre con tooltip "Faltan datos: Ubicación". Al editarlos y completar Ubicación, pasan solos a `activo`.

## 2. UI de Excel — botón único
- Se eliminaron los botones sueltos "Exportar/Importar" del header. Ahora hay un **dropdown "📊 Excel ▾"** junto a "+ Nueva Tarea" con: Descargar plantilla / Importar tareas / Exportar tareas.

## 3. Borrado + separación de tareas cerradas
- **Soft-delete** (`activo: false`) para Proyectos y Tareas, con confirmación. Se filtran de las listas (`activo !== false`).
- Borrar un Proyecto marca **recursivamente** todas sus tareas como `activo: false` (no deja huérfanas).
- **Tabs "Abiertas / Cerradas / Todas"** en la tabla de tareas; por defecto **Abiertas**. Al cerrar una tarea (`terminada`/`pagada`) sale de la vista Abiertas.

## 4. Bug visual del modal (RESUELTO)
- Causa real: el `<th>` sticky de la tabla tenía `z-index:5` y el modal "Nuevo Proyecto" **no declaraba z-index**, por eso el header atravesaba el modal.
- Fix: clase `.modal-overlay` con `z-index:1000` para ambos modales.

## 5. Eliminar colaboradores (Supervisor)
- En "Colaboradores", el Supervisor ahora **Elimina/Restaura** (soft-delete `activo:false`) con confirmación. Los eliminados se ocultan de las listas de selección de tareas y de "Mi Equipo", pero su historial de bonos queda intacto.

## 6. Menú lateral por rol
- `js/sidebar.js` (**nuevo**): mismo componente para ambos roles, contenido filtrado por rol, etiquetas siempre visibles, agrupado por categoría. En móvil se vuelve barra horizontal.
  - Supervisor: General (Dashboard) · Gestión (Proyectos, Tareas, Colaboradores) · Datos (Excel)
  - Jefe de Cuadrilla: General (Mis tareas, Mi equipo)

## 7. "Mi Equipo" (Jefe de Cuadrilla)
- La antigua "Mi Cuadrilla" ahora es **"Mi Equipo"**: lista solo colaboradores `activo:true` y el Jefe marca **Disponible / No disponible** (campo `disponible`, distinto de `activo`).
- Modelo de dos campos: `activo` (Supervisor, estado maestro) vs `disponible` (Jefe, asistencia diaria).

---

## ⚠️ Despliegue requerido

1. **Código** → push a GitHub (Netlify auto-deploy).
2. **Reglas de Firestore** → hay cambios en `firestore.rules` (el Jefe ahora edita `disponible`, no `activo`). Ejecutar:
   ```
   firebase deploy --only firestore
   ```
   Sin esto, el toggle de "Mi Equipo" fallará con permisos.

## Notas de datos
- Proyectos/tareas/colaboradores **existentes** sin campo `activo` se tratan como activos (`activo !== false`), así que no hay que migrar nada.
- No se usa `collectionGroup` ni índices compuestos nuevos (los filtros `activo` son del lado del cliente, siguiendo los principios del proyecto).

## Archivos nuevos
- `public/js/validaciones.js`
- `public/js/sidebar.js`

## Archivos modificados
- `public/css/styles.css`
- `public/js/importarExcel.js`
- `public/supervisor/dashboard.html` · `dashboard-controller.js`
- `public/supervisor/gestionar-empleados.html` · `gestionar-empleados-controller.js`
- `public/supervisor/nueva-tarea.html` · `nueva-tarea-controller.js`
- `public/supervisor/tarea-detalle.html` · `tarea-detalle-controller.js`
- `public/jefe/mis-tareas.html` · `mis-tareas-controller.js`
- `public/jefe/mi-cuadrilla.html` · `mi-cuadrilla-controller.js`
- `public/jefe/horas.html` · `horas-controller.js`
- `firestore.rules`
