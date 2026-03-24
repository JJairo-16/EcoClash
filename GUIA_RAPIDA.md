# 🚀 GUÍA RÁPIDA - ECOCLASH

## Arquitectura Implementada

### Vistas (5 secciones principales)
1. **Dashboard** - Panel inicial con progreso y retos
2. **Leaderboard** - Tabla de clasificación global
3. **Social** - Feed de comunidad
4. **Marketplace** - Tienda de recompensas
5. **Profile** - Configuración de usuario

### Navegación
```javascript
// Navegar programáticamente:
window.router.navigateTo('dashboard');
window.router.navigateTo('leaderboard');
window.router.navigateTo('social');
window.router.navigateTo('marketplace');
window.router.navigateTo('profile');
```

## Paleta de Colores (Variables CSS)

```css
--deep-forest: #1A2F25          /* Fondo oscuro principal */
--electric-lime: #CCFF00         /* Resaltado/CTA */
--eco-mint: #4ADE80              /* Success/Positivo */
--carbon-grey: #374151           /* Elementos secundarios */
--pure-white: #FFFFFF            /* Texto principal */
--grey-light: #9CA3AF            /* Texto secundario */
```

## Componentes CSS Principales

### Tarjetas
```html
<article class="card">Contenido</article>
<article class="card card-accent">Especial</article>
<article class="card card-post">Post social</article>
```

### Botones
```html
<button class="btn btn-primary">Primario (Lime)</button>
<button class="btn btn-secondary">Secundario (Gris)</button>
<button class="btn btn-eco-like">Eco-Like (Mint)</button>
<button class="btn btn-danger">Peligro (Rojo)</button>
```

### Barras de Progreso
```html
<div class="progress-bar">
  <div class="progress-fill" style="width: 60%;"></div>
</div>
```

### Formularios
```html
<form class="form-group">
  <div class="form-row">
    <label for="input" class="form-label">Etiqueta</label>
    <input type="text" id="input" class="form-input">
  </div>
</form>
```

### Grillas
```html
<div class="grid-2"><!-- 2 columnas responsive --></div>
<div class="grid-3"><!-- 3 columnas responsive --></div>
<div class="marketplace-grid"><!-- Grid de productos --></div>
```

## Funcionalidades JavaScript

### Calculadora de Huella
```javascript
// Automátic-cálculo en form submit
// Fórmula:
// CO2 Transporte = km × 0.15 (promedio)
// CO2 Energía = kWh × 0.233
// Total = CO2 Transporte + CO2 Energía
```

### Gestión de Estado
```javascript
// Datos de usuario
window.app.userData = {
  name: 'Nombre',
  points: 3850,
  level: 5,
  tokens: 2450
};

// Obtener datos
window.app.getUserData();

// Actualizar datos
window.app.setUserData({ points: 4000 });
```

### Publicar Logros
```javascript
// Automático en form submit
// Guardado en localStorage['communityPosts']
// Máximo 100 posts
```

### Notificaciones
```javascript
window.app.showNotification('Mensaje', 'success');
// Tipos: 'success', 'warning', 'info'
```

### Tema
```javascript
// Cambiar tema
window.app.applyTheme('dark'); // o 'light'
// Guardado en localStorage['theme']
```

## LocalStorage

```javascript
// Datos del usuario
localStorage.getItem('userData')
localStorage.getItem('userProfile')

// Configuración privacidad
localStorage.getItem('privacySettings')

// Posts comunidad
localStorage.getItem('communityPosts')

// Huellas de carbono
localStorage.getItem('carbonFootprints')

// Tema
localStorage.getItem('theme')
```

## Responsive Media Queries

```css
@media (max-width: 1024px) { /* Tablets grandes */ }
@media (max-width: 768px)  { /* Tablets/Móviles */ }
@media (max-width: 480px)  { /* Móviles pequeños */ }
```

## Accesibilidad

- Contraste: Pure White sobre Deep Forest = 10.3:1 (WCAG AAA)
- ARIA labels en elementos interactivos
- Focus visible en navegación con teclado
- Estructura semántica HTML5
- Mobile-friendly

## Performance (Green IT)

### Fuentes
- Solo Inter 400 y 700
- Cargas con `display=swap`

### Imágenes
- `loading="lazy"` en todas
- Preparadas para SVG/WebP (no JPEG)

### JavaScript
- Event delegation
- Sin dependencias externas
- LocalStorage para estado local

## Próximos Pasos

1. **Crear Assets SVG**
   - Logo, avatares, iconos

2. **Firebase Integration**
   - Autenticación
   - Firestore database
   - Storage

3. **Refinamiento**
   - Modales
   - Más interactividad
   - Animaciones avanzadas

4. **Testing**
   - Lighthouse (performance)
   - Accesibilidad
   - Tests unitarios

5. **Deploy**
   - Firebase Hosting
   - Optimización CDN

## Comandos Útiles

```bash
# Desarrollo
npm run watch              # Deploy automático en cambios

# Production
npm run deploy             # Deploy a Firebase
```

## Estructura de Archivos

```
EcoClash/
├── App/
│   ├── index.html         # Todas las vistas
│   ├── css/
│   │   └── styles.css     # Estilos principales
│   ├── js/
│   │   ├── router.js      # Enrutamiento SPA
│   │   └── app.js         # Lógica principal
│   └── assets/            # SVG, imágenes (por crear)
├── public/
│   └── js/
│       ├── config.js      # Configuración Firebase
│       └── firestore.js   # Queries Firestore
└── firebase.json
```

## Tips y Trucos

### Agregar nueva vista
1. Crear `<section id="view-name-view" class="view">`
2. Pasar nombre a router en `routes` object
3. Agregar link en navbar con `data-view="view-name"`

### Crear componente reutilizable
```html
<article class="card">
  <!-- tu contenido aquí -->
</article>
```

### Formularios con validación local
```javascript
document.addEventListener('submit', (e) => {
  e.preventDefault();
  // Tu lógica de validación
});
```

### Debuging
```javascript
console.log(window.app);      // Acceso a app
console.log(window.router);   // Acceso a router
console.log(window.app.userData); // Datos usuario
```

---

**Versión**: 1.0.0  
**Última actualización**: 24/03/2026  
**Proyecto**: EcoClash - Retos Sostenibles 🌱
