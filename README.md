# COSTACON – Tickets de Bono (App Web)

Digitaliza el proceso físico de los Tickets de Bono: el Supervisor crea
Tareas (frente del ticket) y el Jefe de Cuadrilla registra horas diarias
(reverso del ticket). Todo queda ligado y consolidable en un reporte Excel.

## Stack
- **Frontend**: HTML + JS vanilla (ES Modules), sin build step
- **Backend**: Firebase (Auth + Firestore)
- **Reportes**: ExcelJS (vía CDN, 100% client-side)
- **Hosting**: Netlify

## Estructura de carpetas

```
costacon-app/
├── firestore.rules              ← reglas de seguridad (subir a Firebase)
├── netlify.toml                 ← config de deploy
├── package.json
└── public/                      ← esto es lo que se publica (Netlify "publish dir")
    ├── index.html                Login / Registro
    ├── css/styles.css
    ├── js/
    │   ├── firebase-config.js    ⚠️ credenciales a completar
    │   ├── auth.js                lógica de sesión y roles
    │   ├── login-controller.js
    │   ├── reglasBono.config.js   ⚠️ ÚNICA fuente de verdad del cálculo
    │   ├── calcularBono.js        función pura de cálculo
    │   ├── estilosExcel.js        paleta y estilos del reporte
    │   └── exportarExcel.js       genera el .xlsx
    ├── jefe/
    │   ├── mis-tareas.html + controller
    │   ├── mi-cuadrilla.html + controller    (roster de empleados)
    │   └── horas.html + controller            (grid de horas — reverso digital)
    └── supervisor/
        ├── dashboard.html + controller
        └── nueva-tarea.html + controller       (crear tarea — frente digital)
```

## Puesta en marcha

### 1. Crear proyecto en Firebase
1. Ve a https://console.firebase.google.com → crear proyecto
2. Habilita **Authentication** → método **Email/Password**
3. Habilita **Authentication** → método **Teléfono** (Phone)
   - ⚠️ Firebase requiere el plan **Blaze** (pago por uso) para enviar SMS en producción.
     El plan gratuito (Spark) permite configurar **números de prueba** sin costo
     para desarrollo: Authentication → Sign-in method → Teléfono →
     "Números de teléfono para pruebas".
4. Habilita **Firestore Database** → modo producción

### 2. Completar credenciales
Edita `public/js/firebase-config.js` con los valores reales
(Project Settings → General → Your apps → Web app → SDK config).

### 3. Subir las reglas de seguridad
```bash
firebase deploy --only firestore:rules
```
(o pega el contenido de `firestore.rules` directamente en la consola de Firebase → Firestore → Reglas)

### 4. Probar en local
```bash
npm run dev
```
Abre `http://localhost:3000`

### 5. Deploy a Netlify
Conecta el repo en netlify.com y apunta el **Publish directory** a `public`.
El archivo `netlify.toml` ya trae la configuración base.

## Lógica de negocio — cómo modificarla

Todo el cálculo del bono vive en **un solo archivo**:
`public/js/reglasBono.config.js`

Si cambia el valor por HH economizada, el tope del 30%, el criterio de
no-pago, o el factor de peso Operario/Ayudante — se edita solo ese
archivo. El resto de la app (grid de horas, reporte Excel) usa siempre
la misma función `calcularBono()`, así que un cambio ahí se refleja
automáticamente en toda la aplicación.

## Decisiones de arquitectura tomadas

| Tema | Decisión |
|---|---|
| Método de login | Correo/contraseña **o** Teléfono/SMS — toggle en la misma pantalla |
| Identidad de usuario | El **nombre completo** siempre es obligatorio y es lo que se muestra en la app (el teléfono solo verifica identidad, no reemplaza el nombre) |
| Selección de rol | El usuario elige su rol libremente al registrarse (sin aprobación previa) |
| Visibilidad de proyectos | Todos los Supervisores ven todos los proyectos |
| Empleados | Roster exclusivo de cada Jefe de Cuadrilla, gestionado libremente |
| Asignación a tareas | Implícita — el Jefe agrega empleados directamente al loguear horas |
| Peso del bono | Operario = 1.0, Ayudante = 0.5 (modificable en config) |
| Costo de actividad | Ingresado manualmente por el Supervisor al crear la tarea |

## Pendientes conocidos (no bloqueantes para un primer despliegue)

- El campo `rol` del usuario no está protegido por un flujo de aprobación
  (ver README sección "Opción A vs B" discutida en el diseño). Si más
  adelante se requiere mayor control, migrar el rol a un **custom claim**
  de Firebase Auth vía Cloud Function.
- El flujo de "cerrar tarea" (marcar condiciones + fecha/hora de término)
  no tiene pantalla dedicada todavía — actualmente solo existe el campo
  en el modelo de datos.
- No hay pantalla de administración de usuarios (activar/desactivar
  cuentas) más allá del campo `activo` en Firestore.
