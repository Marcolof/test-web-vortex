/* ============================================================
   VORTEX IT — JAVASCRIPT COMPARTIDO
   Perfil de rendimiento, loop único de animación, resize controlado,
   menú hamburguesa, campo de estrellas y cursor personalizado.
   Lo cargan todas las páginas del sitio, antes de su propio script.
============================================================ */

if (window.ScrollTrigger) ScrollTrigger.config({ ignoreMobileResize: true, fastScrollEnd: true });

/* ── PERFIL DE RENDIMIENTO ──
   Ya está calculado: lo define partes/perfil.php, inline en el <head>, para
   que la clase .es-mac exista ANTES del primer pintado. Acá abajo queda solo
   la red de seguridad por si alguna página se olvida de incluirlo. */
if (typeof MODO_LIGERO === 'undefined') {
  console.warn('Vortex: falta <?php include \'partes/perfil.php\'; ?> en el <head>. ' +
               'El perfil se calcula igual, pero tarde.');
  window.ES_MOVIL = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  window.CPU_BAJA = (navigator.hardwareConcurrency || 4) <= 4;
  window.CALIDAD  = ES_MOVIL ? (CPU_BAJA ? 0.18 : 0.3) : (CPU_BAJA ? 0.65 : 1);
  window.ES_MAC   = /Mac|iPad|iPhone|iPod/.test(navigator.platform || '') ||
                    (navigator.userAgent.indexOf('Mac') !== -1) ||
                    /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent || '');
  var _p = new URLSearchParams(location.search).get('perfil');
  if (_p === 'mac')    window.ES_MAC = true;
  if (_p === 'normal') window.ES_MAC = false;
  window.MODO_LIGERO = ES_MAC || CPU_BAJA;
  window.DPR_MAX     = ES_MOVIL ? 1 : (MODO_LIGERO ? 1.35 : (window.devicePixelRatio > 1.5 ? 1.5 : 2));
  window.FACTOR_PART = MODO_LIGERO ? 0.6 : (ES_MOVIL ? 0.4 : 1);
  window.cuantasPart = function(n) { return Math.max(3, Math.round(n * FACTOR_PART)); };
  if (ES_MAC) document.documentElement.classList.add('es-mac');
}

/* ── UN SOLO LOOP DE ANIMACIÓN ──
   Cada canvas tenía su propio requestAnimationFrame: seis loops
   independientes compitiendo por el hilo principal, varios dibujando
   aunque su sección estuviera fuera de pantalla. Ahora hay uno solo que
   recorre los trabajos registrados y saltea los que no hacen falta. */
var LOOP = (function() {
  var trabajos = [], corriendo = false;
  /* En modo ligero los canvas se dibujan a 40 fps en vez de 60: son fondos
     que se mueven despacio y no se nota, pero es un tercio menos de trabajo.
     Las animaciones de scroll no pasan por acá: siguen a pantalla llena. */
  var MS_MIN = MODO_LIGERO ? 24 : 0;
  var ultimo = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    /* El tope de cuadros vale para los fondos, no para todo: hay trabajos
       marcados como "rápidos" —el cursor— que tienen que correr siempre,
       porque cualquier retraso ahí se siente en la mano. */
    var frenado = MS_MIN && (t - ultimo) < MS_MIN;
    if (!frenado) ultimo = t;
    for (var i = 0; i < trabajos.length; i++) {
      var j = trabajos[i];
      if (frenado && !j.rapido) continue;
      if (j.activo && !j.activo()) continue;
      j.fn(t);
    }
  }
  return {
    add: function(fn, activo) {
      trabajos.push({ fn: fn, activo: activo, rapido: false });
      if (!corriendo) { corriendo = true; requestAnimationFrame(frame); }
    },
    /* Igual que add, pero exento del tope de cuadros */
    addRapido: function(fn, activo) {
      trabajos.push({ fn: fn, activo: activo, rapido: true });
      if (!corriendo) { corriendo = true; requestAnimationFrame(frame); }
    }
  };
})();

/* ── RESIZE CONTROLADO ──
   En móvil, mostrar u ocultar la barra de direcciones dispara un resize
   por cambio de alto: recalcular ahí todos los canvas (y que GSAP
   recalcule sus triggers) es lo que produce el salto de scroll. Solo se
   atienden los cambios de ancho, y con retardo. */
var _anchoPrev = window.innerWidth;
var _tResize = null;
var _tareasResize = [];
function alRedimensionar(fn) { _tareasResize.push(fn); }
window.addEventListener('resize', function() {
  var soloAlto = window.innerWidth === _anchoPrev;
  _anchoPrev = window.innerWidth;
  if (soloAlto && ES_MOVIL) return;
  clearTimeout(_tResize);
  _tResize = setTimeout(function() {
    for (var i = 0; i < _tareasResize.length; i++) _tareasResize[i]();
  }, 200);
}, { passive: true });

/* Que ScrollTrigger tampoco se refresque por el alto de la barra */
if (window.ScrollTrigger && ScrollTrigger.config) {
  ScrollTrigger.config({ ignoreMobileResize: true });
}

/* Tabla de senos: evita miles de Math.sin por frame */
var SIN_LUT = new Float32Array(1024);
for (var _i = 0; _i < 1024; _i++) SIN_LUT[_i] = Math.sin(_i * 6.283185307 / 1024);
function senoRapido(x) { return SIN_LUT[(x * 162.9746617 | 0) & 1023]; }

/* ── FLECHA FLOTANTE: LLEVA A LA SECCIÓN SIGUIENTE ──
   Sirve en todas las páginas sin configurar nada: junta los bloques
   grandes de la página, ordenados por posición, y salta al primero que
   esté por debajo de donde estás. Al llegar al final, gira y vuelve
   al principio. */
(function() {
  var flecha = document.getElementById('flecha-baja');
  if (!flecha) return;

  var MIN_ALTO = 0.3;        /* solo cuentan los bloques de cierta altura */

  function paradas() {
    var lista = [];
    var vh = window.innerHeight;
    /* Solo bloques de primer nivel. No se usan selectores amplios como
       'main [id]': varios interiores llevan transform de GSAP y su posición
       real no coincide con la de su sección. */
    var cands = document.querySelectorAll(
      'main > section, main > div, .solucion-bloque, .sol-cierre, .site-footer');

    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (el.offsetParent === null && el.tagName !== 'BODY') continue;   /* oculto */
      var esPie = el.classList.contains('site-footer');
      if (!esPie && el.offsetHeight < vh * MIN_ALTO) continue;
      var top = el.getBoundingClientRect().top + window.pageYOffset;
      lista.push(Math.round(top));
    }

    /* El pie siempre cierra la lista */
    var pie = document.querySelector('.site-footer');
    if (pie) lista.push(Math.round(pie.getBoundingClientRect().top + window.pageYOffset));

    lista.sort(function(a, b) { return a - b; });

    /* Se quitan los que caen casi en el mismo lugar */
    var limpia = [];
    for (var j = 0; j < lista.length; j++) {
      if (!limpia.length || lista[j] - limpia[limpia.length - 1] > 80) limpia.push(lista[j]);
    }
    return limpia;
  }

  function irA(y) {
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  flecha.addEventListener('click', function() {
    if (flecha.classList.contains('arriba')) { irA(0); return; }
    var y = window.pageYOffset;
    var ps = paradas();
    for (var i = 0; i < ps.length; i++) {
      if (ps[i] > y + 60) { irA(ps[i]); return; }
    }
    irA(document.documentElement.scrollHeight);   /* nada abajo: al final */
  });

  /* Cerca del final, la flecha se da vuelta */
  function revisarSentido() {
    var falta = document.documentElement.scrollHeight
              - (window.pageYOffset + window.innerHeight);
    flecha.classList.toggle('arriba', falta < 120);
    flecha.setAttribute('aria-label',
      flecha.classList.contains('arriba') ? 'Volver al principio' : 'Ir a la sección siguiente');
    flecha.setAttribute('data-cursor',
      flecha.classList.contains('arriba') ? 'Subir' : 'Bajar');
  }
  window.addEventListener('scroll', revisarSentido, { passive: true });
  revisarSentido();
})();

/* ── HEADER HAMBURGER ──
   Con guarda: si una página no trae el botón, esta línea tiraba un error y
   moría TODO lo que viene después (estrellas y cursor incluidos). */
var _hamb = document.getElementById('hamburger');
if (_hamb) _hamb.addEventListener('click', function() {
  var nav = document.getElementById('header-nav');
  if (nav) nav.classList.toggle('open');
});

/* ── FONDO: CAMPO DE ESTRELLAS (de Nuestra Propuesta en adelante) ── */
(function() {
  var cv = document.createElement('canvas');
  cv.id = 'estrellas-canvas';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.opacity = '1';   /* visible desde el hero, acompaña al orbe */
  document.body.insertBefore(cv, document.body.firstChild);
  var cx = cv.getContext('2d');

  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  var estrellas = [];
  var COLORES = ['255,255,255', '200,170,255', '160,210,50', '138,80,220'];

  function crear() {
    var n = cuantasPart(Math.min(520, (W * H) / 5200) * (ES_MOVIL ? 0.55 : 1));
    estrellas = [];
    for (var i = 0; i < n; i++) {
      var z = Math.random();
      estrellas.push({
        x: Math.random(), y: Math.random(), z: z,
        r: 0.35 + z * 1.5,
        vx: (Math.random() - 0.5) * 0.00006,
        vy: (Math.random() - 0.5) * 0.00006,
        col: COLORES[Math.random() < 0.82 ? 0 : 1 + Math.floor(Math.random() * 3)],
        base: 0.25 + z * 0.6,
        fase: Math.random() * 6.2832,
        vel: 0.6 + Math.random() * 1.4
      });
    }
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    crear();
    if (MODO_LIGERO) dibujarFijo();
  }

  /* ── MODO LIGERO: EL CAMPO SE DIBUJA UNA SOLA VEZ ──
     La deriva de las estrellas avanza 0.00006 de pantalla por cuadro: unos
     seis píxeles cada dos minutos. Nadie lo ve. Pero para producir eso el
     navegador estaba recorriendo cientos de estrellas y pintando dos arcos
     por cada una, en cada cuadro, de punta a punta del sitio —porque la
     condición de actividad mira cv.style.opacity, que vale '1' y nunca
     cambia—. Acá se pinta una vez, con el brillo de cada estrella congelado
     en su fase inicial, y el canvas no se vuelve a tocar hasta un resize. */
  function dibujarFijo() {
    cx.clearRect(0, 0, W, H);
    for (var i = 0; i < estrellas.length; i++) {
      var s = estrellas[i];
      var x = s.x * W, y = s.y * H;
      var a = s.base * (0.62 + 0.38 * Math.sin(s.fase));
      cx.beginPath();
      cx.arc(x, y, s.r, 0, 6.2832);
      cx.fillStyle = 'rgba(' + s.col + ',' + a.toFixed(3) + ')';
      cx.fill();
      if (s.z > 0.86) {
        cx.beginPath();
        cx.arc(x, y, s.r * 3.4, 0, 6.2832);
        cx.fillStyle = 'rgba(' + s.col + ',' + (a * 0.1).toFixed(3) + ')';
        cx.fill();
      }
    }
  }

  resize();
  alRedimensionar(resize);

  /* En modo ligero no hay bucle, ni parallax, ni escucha de mousemove */
  if (MODO_LIGERO) return;

  var pX = 0, pY = 0, tX = 0, tY = 0;
  window.addEventListener('mousemove', function(e) {
    tX = e.clientX / window.innerWidth  - 0.5;
    tY = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  function tick(t) {
    pX += (tX - pX) * 0.045;
    pY += (tY - pY) * 0.045;
    var tt = t * 0.001;

    cx.clearRect(0, 0, W, H);
    for (var i = 0; i < estrellas.length; i++) {
      var s = estrellas[i];
      s.x += s.vx; s.y += s.vy;
      if (s.x < -0.05) s.x = 1.05; else if (s.x > 1.05) s.x = -0.05;
      if (s.y < -0.05) s.y = 1.05; else if (s.y > 1.05) s.y = -0.05;

      var desp = 26 + s.z * 84;
      var x = s.x * W - pX * desp;
      var y = s.y * H - pY * desp;
      if (x < -8 || x > W + 8 || y < -8 || y > H + 8) continue;

      var a = s.base * (0.62 + 0.38 * Math.sin(tt * s.vel + s.fase));
      cx.beginPath();
      cx.arc(x, y, s.r, 0, 6.2832);
      cx.fillStyle = 'rgba(' + s.col + ',' + a.toFixed(3) + ')';
      cx.fill();

      if (s.z > 0.86) {
        cx.beginPath();
        cx.arc(x, y, s.r * 3.4, 0, 6.2832);
        cx.fillStyle = 'rgba(' + s.col + ',' + (a * 0.1).toFixed(3) + ')';
        cx.fill();
      }
    }
  }
  LOOP.add(tick, function() {
    return parseFloat(cv.style.opacity || '1') >= 0.01;
  });

})();

/* ── CURSOR PERSONALIZADO ──
   Contorno que persigue al puntero con inercia y se estira en la
   dirección del movimiento (efecto gota). Sobre elementos con
   [data-cursor] se expande y muestra la instrucción de ese atributo. */
(function() {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  var punto  = document.createElement('div');
  var anillo = document.createElement('div');
  var aro    = document.createElement('div');
  var texto  = document.createElement('span');
  punto.className  = 'cursor-punto';
  anillo.className = 'cursor-anillo';
  aro.className    = 'cursor-aro';
  anillo.appendChild(aro);
  anillo.appendChild(texto);
  document.body.appendChild(anillo);
  document.body.appendChild(punto);
  document.body.classList.add('cursor-on');

  var mx = window.innerWidth / 2, my = window.innerHeight / 2;
  var ax = mx, ay = my;                 /* anillo, con retardo */
  var estira = 0, angulo = 0, presion = 1;
  var visible = false;

  window.addEventListener('mousemove', function(e) {
    mx = e.clientX; my = e.clientY;
    if (!visible) {
      visible = true;
      ax = mx; ay = my;
      punto.style.opacity = '1';
      anillo.style.opacity = '1';
    }
    /* Este handler NO escribe estilos: en un trackpad de Mac llega cientos
       de veces por segundo y cada escritura era trabajo repetido que el
       navegador iba a descartar igual. Solo guarda dónde está el puntero;
       dibujar es tarea del cuadro. */
  }, { passive: true });

  document.addEventListener('mouseleave', function() {
    visible = false;
    punto.style.opacity = '0';
    anillo.style.opacity = '0';
  });

  window.addEventListener('mousedown', function() { presion = 0.78; });
  window.addEventListener('mouseup',   function() { presion = 1; });

  /* Instrucción según el elemento bajo el puntero */
  var etiquetaActual = '';
  document.addEventListener('mouseover', function(e) {
    var destino = e.target.closest ? e.target.closest('[data-cursor]') : null;
    var etiqueta = destino ? destino.getAttribute('data-cursor') : '';
    if (etiqueta === etiquetaActual) return;
    etiquetaActual = etiqueta;
    if (etiqueta) {
      texto.textContent = etiqueta;
      document.body.classList.add('cursor-etiqueta');
    } else {
      document.body.classList.remove('cursor-etiqueta');
    }
  }, { passive: true });

  var escalaPres = 1, tPrev = 0, ultimoCursor = 0, pxPrev = -1, pyPrev = -1;

  /* Sin tope: el cursor se dibuja en cada cuadro de pantalla. Se probó
     limitarlo a 90 por segundo y se sentía pesado. Son dos escrituras de
     transform sobre capas ya promovidas —del orden de microsegundos—, así
     que no es de acá de donde hay que recortar. */
  var MS_CURSOR = 0;

  /* Cuánto se acerca el anillo al puntero en un cuadro de 60 fps. Subirlo
     lo hace más pegado al mouse; bajarlo, más perezoso.
       0.14 → cola de ~330 ms (el original, se sentía pesado)
       0.24 → ~180 ms
       0.34 → ~120 ms  ← acá estamos
       0.50 → ~70 ms, casi sin inercia */
  var SEGUIMIENTO = 0.34;

  function tick(t) {
    if (MS_CURSOR && t - ultimoCursor < MS_CURSOR) return;
    ultimoCursor = t;

    /* El punto va exactamente donde está el puntero, sin perseguirlo: es el
       elemento de precisión. Solo se escribe si de verdad se movió. */
    if (mx !== pxPrev || my !== pyPrev) {
      pxPrev = mx; pyPrev = my;
      punto.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
    }

    /* Cuántos cuadros de 60 fps pasaron desde el anterior. Sin esto, a 40
       fps se aplicaba el mismo avance pero un tercio menos de veces, y el
       anillo quedaba el doble de rezagado. El tope de 4 evita un salto
       enorme al volver de otra pestaña. */
    var dt = tPrev ? Math.min((t - tPrev) / 16.667, 4) : 1;
    tPrev = t;

    /* Si el puntero está quieto y todo llegó a destino, no hay nada que
       dibujar: se ahorra el trabajo por cuadro */
    if (Math.abs(mx - ax) < 0.05 && Math.abs(my - ay) < 0.05 &&
        estira < 0.002 && Math.abs(presion - escalaPres) < 0.004) return;

    var k = 1 - Math.pow(1 - SEGUIMIENTO, dt);
    var vx = mx - ax, vy = my - ay;
    ax += vx * k;
    ay += vy * k;

    /* Deformación tipo gota: se estira en la dirección del movimiento
       y se afina en la perpendicular, proporcional a la velocidad */
    var vel = Math.sqrt(vx * vx + vy * vy);
    var objetivo = Math.min(vel / 220, 0.42);
    estira += (objetivo - estira) * (1 - Math.pow(1 - 0.18, dt));
    if (vel > 1) angulo = Math.atan2(vy, vx) * 180 / Math.PI;
    escalaPres += (presion - escalaPres) * (1 - Math.pow(1 - 0.2, dt));

    anillo.style.transform =
      'translate3d(' + ax.toFixed(1) + 'px,' + ay.toFixed(1) + 'px,0)';

    /* La deformación va solo en el aro: el texto queda derecho */
    aro.style.transform =
      'rotate(' + angulo.toFixed(1) + 'deg)' +
      ' scale(' + ((1 + estira) * escalaPres).toFixed(3) + ',' +
                  ((1 - estira * 0.62) * escalaPres).toFixed(3) + ')';
  }
  /* Rápido: el cursor no se saltea cuadros aunque el resto sí */
  LOOP.addRapido(tick);
})();
