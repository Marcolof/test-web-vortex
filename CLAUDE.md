# Vortex IT · Rediseño web

## Propósito

Rediseño del sitio https://vortex-it.com/. El Hub reúne el análisis del sitio actual y las propuestas de rediseño.

## Cómo trabajar en este proyecto

- Leer `.project/project.yaml` para conocer escenario, entrega y estado actuales.
- Distinguir requisitos confirmados, supuestos y preguntas abiertas.
- Propuesta paralela: el sitio original no se modifica.
- No mover ni reorganizar archivos originales; lo nuevo va en `modules/`.
- Excluir datos personales de los entregables al cliente.
- Diseñar y validar primero en local.
- Git y publicación: nunca crear repositorios remotos ni proyectos de despliegue; cada acción (git local, conectar, commit, push, publicar) requiere su propia autorización.

## Trabajo y entrega

- Escenario: rediseño UX (web)
- Entrega: Hub (`index.html` en la raíz)
- Entregable principal: Hub

## Fuentes de verdad

- Estado del proyecto: `.project/project.yaml`
- Documentación narrativa: HTML de cada documento en `modules/analisis/`
- Evidencia: snapshot del sitio en `modules/analisis/fuentes/snapshot-2026-10-26/` (uso interno)
- Prototipo: `modules/propuestas/propuesta-01/` (landing estática; hero en `assets/js/hero.js` con three.js r128). Assets propios en `assets/`; cambios sobre logos en `assets/logos/CHANGES.md`.
- Assets de marca descargados: `modules/analisis/fuentes/assets-2026-10-26/` (uso interno, ver `MANIFEST.md`)
- Diseño/Figma: ninguno

## Hub y módulos

- Hub: `index.html` (estilos en `hub.css`)
- Propuestas: `modules/propuestas/index.html` (estilos propios) → `propuesta-01/index.html` y `propuesta-01/en-construccion.html#<seccion>`
- Análisis: `modules/analisis/index.html` → sitemap, mapa-de-contenido, relevamiento-secciones, observaciones (estilos en `modules/analisis/assets/`)
- Todos los enlaces son relativos y apuntan a `index.html` explícito para que funcionen también abriendo los archivos sin servidor.
