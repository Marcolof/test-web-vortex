// Hero de la propuesta 01. Secuencia en fases y en loop (~15 s). Toda la escena cuelga de un "nulo"
// de cámara (rig): los zooms y paneos lo mueven a él, y las píldoras del DOM se anclan a puntos del rig.
//   1. La píldora "Necesidad del cliente" nace de un punto, se abre y se escribe el pedido.
//      Al girar su loader la cámara hace zoom sobre él; la píldora se cierra y el loader revienta
//      en una nube de partículas.
//   2. Con la cámara todavía cerca, la red (capas 4-6-6-2) se arma esfera por esfera mientras la cámara
//      se aleja en arco pasando por la primera capa. La nube acompaña ese movimiento.
//   3. Antes de que termine el armado ya salen los puntos de información; cada esfera que los recibe
//      brilla y vibra levemente con su propia aberración cromática. Al salir, los puntos orbitan un
//      núcleo verde que va formando el output.
//   4. La cámara hace zoom en arco hacia el núcleo verde y la red colapsa ahí: segunda nube.
//   5. Ahí nace el loader del output en grande y se encoge, con la cámara alejándose, hasta el tamaño
//      de la píldora "Propuesta de valor"; se sostiene y al final se cierra en un punto.
// three.js r128. La escena se dibuja en un render target y un pase final aplica aberración cromática,
// leve desenfoque, halo y onda de choque. Las nubes de partículas se animan en la GPU.
(() => {
  const hero = document.getElementById('inicio');
  const canvas = document.getElementById('hero-gl');
  const stage = document.getElementById('hero-stage');
  const pillIn = document.getElementById('pill-in');
  const pillOut = document.getElementById('pill-out');
  if (!hero || !canvas || !stage || !pillIn || !pillOut) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fail = () => hero.classList.add('no-gl');
  if (!window.THREE) return fail();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { return fail(); }
  if (!renderer.getContext()) return fail();

  // ---------- utilidades ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const win = (t, a, b, fi = 0.2, fo = 0.2) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));
  const eOutExpo = x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const eInExpo = x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
  const eIO = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // resorte amortiguado: se estira, se pasa ~3 % y vuelve
  const eSpring = x => (x >= 1 ? 1 : 1 - Math.exp(-9 * x) * Math.cos(2.6 * Math.PI * x));
  const eOutBack = x => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- guion (segundos dentro de cada ciclo) ----------
  const S = {
    // input · al girar el loader la cámara hace zoom sobre él
    inPop: 0.2, inOpen: 0.5, inOpenEnd: 1.15, typeA: 1.2, typeB: 2.1,
    inSpinA: 2.1, inSpinB: 3.05, inClose: 2.5, inCircle: 2.95, inGone: 3.25,
    zoomInA: 2.1, zoomInB: 3.2, zoomIn: 3.4,
    // estallido del loader y armado de la red mientras la cámara se aleja en arco
    cloud1: 3.2, cloud1Dur: 2.8,
    pullA: 3.25, camMid: 7.1,                 // llave del medio: red completa, centrada y con zoom 1
    bubble: 4.2, nodes: 3.4, nodeStep: 0.1, nodeDur: 0.55,
    // ondas de datos: más cortas y con más puntos; la primera sale antes de que termine el armado
    waves: [4.4, 5.25, 6.1, 6.95, 7.8], waveDur: 1.45,
    // zoom en arco hacia el núcleo verde; la red colapsa ahí
    pushZoom: 3.0,
    collapse: 9.2, collapseEnd: 9.85, cloud2: 9.8, cloud2Dur: 2.4,
    // output · el loader nace grande y se encoge mientras la cámara se aleja
    outPop: 9.85, zoomOutA: 10.0, zoomOutB: 11.7,
    outOpen: 11.25, outOpenEnd: 11.85, typeOutA: 11.7, typeOutB: 12.5,
    outSpinA: 9.85, outSpinB: 12.55, outFillB: 13.0,
    outClose: 14.3, outCircle: 14.7, outGone: 15.0, cycle: 15.3,
  };

  // ---------- píldoras ----------
  const pills = [pillIn, pillOut].map(el => {
    const txt = el.querySelector('.vx-pill-txt');
    return {
      el, txt, body: el.querySelector('.vx-pill-body'), caret: el.querySelector('.vx-pill-caret'),
      svg: el.querySelector('.vx-pill-dot svg'), arc: el.querySelector('.vx-ld-arc'), gem: el.querySelector('.vx-ld-gem'),
      full: txt.dataset.text || txt.textContent, n: -1, w: 0, h: 0,
    };
  });
  const [PIN, POUT] = pills;
  pills.forEach(p => { p.w = Math.ceil(p.el.offsetWidth) + 2; p.h = p.el.offsetHeight; p.txt.textContent = ''; });
  const typeTo = (p, k) => { const n = Math.round(p.full.length * clamp(k)); if (n !== p.n) { p.n = n; p.txt.textContent = p.full.slice(0, n); } };

  // ---------- escena ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 16);
  // "nulo" de cámara: toda la escena cuelga de rig. Los zooms y paneos mueven rig, así la red,
  // las partículas, el punto de luz y las píldoras (ancladas a puntos del rig) se mueven juntos.
  const rig = new THREE.Group();
  scene.add(rig);
  const net = new THREE.Group();
  rig.add(net);

  const rtOpts = { format: THREE.RGBAFormat };
  const rt = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget
    ? new THREE.WebGLMultisampleRenderTarget(4, 4, rtOpts)
    : new THREE.WebGLRenderTarget(4, 4, rtOpts);

  const VIOLET = new THREE.Color('#9d5cff');
  const LIME = new THREE.Color('#bdf04e');
  const WHITE = new THREE.Color('#ffffff');

  const NOISE = `
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  const GLASS_VERT = `
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
      gl_Position = projectionMatrix * mv;
    }`;
  // Esfera de vidrio con volumen. uMask permite dibujar "fantasmas" rojo/cian para la aberración por esfera.
  const sphereMat = (mix, mask, additive) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 }, uAlpha: { value: 0 }, uMix: { value: mix }, uA: { value: VIOLET }, uB: { value: LIME }, uMask: { value: mask || new THREE.Vector3(1, 1, 1) } },
    vertexShader: GLASS_VERT,
    fragmentShader: `
      uniform float uTime, uGlow, uAlpha, uMix; uniform vec3 uA, uB, uMask;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec3 N = normalize(vN), V = normalize(vV);
        float ndv = max(dot(N, V), 0.0);
        float fr = pow(1.0 - ndv, 2.6);
        vec3 base = mix(uA, uB, clamp(uMix + vP.y * 0.6, 0.0, 1.0));
        vec3 L = normalize(vec3(-0.5, 0.65, 0.6));
        float diff = max(dot(N, L), 0.0);
        vec3 body = base * (0.12 + 0.62 * diff) + base * pow(ndv, 4.0) * 0.28;
        body += base * pow(max(dot(N, -L), 0.0), 2.0) * 0.35;
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fr * 1.25 + vP.x * 1.4 + vec3(0.0, 0.33, 0.67) + uTime * 0.05));
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 70.0);
        float spec2 = pow(max(dot(reflect(-normalize(vec3(0.55, -0.45, 0.5)), N), V), 0.0), 18.0) * 0.22;
        vec3 col = body + base * fr * 1.15 + irid * fr * 0.4 + vec3(spec) * 1.3 + vec3(spec2) + base * uGlow * 0.85;
        float a = clamp(0.5 + fr * 0.5 + spec + uGlow * 0.25, 0.0, 1.0) * uAlpha;
        gl_FragColor = vec4(col * uMask, a);
      }`,
  });
  const bubbleMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: GLASS_VERT,
    fragmentShader: `
      uniform float uTime, uAlpha;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec3 N = normalize(vN), V = normalize(vV);
        float fr = pow(1.0 - abs(dot(N, V)), 3.0);
        vec3 p = normalize(vP);
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fr * 1.4 + p.y * 0.35 + vec3(0.0, 0.33, 0.67) + uTime * 0.03));
        vec3 tint = mix(vec3(0.56, 0.32, 1.0), vec3(0.74, 0.96, 0.32), smoothstep(-0.8, 0.9, p.x + p.y * 0.4));
        vec3 L = normalize(vec3(-0.5, 0.65, 0.7));
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 70.0);
        vec3 col = tint * fr * 0.8 + irid * fr * 0.55 + spec * 0.8;
        float a = (fr * 0.45 + spec * 0.5 + 0.01) * uAlpha;
        gl_FragColor = vec4(col, a);
      }`,
  });

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.18, 'rgba(255,255,255,.6)');
    grd.addColorStop(0.45, 'rgba(255,255,255,.1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.renderOrder = 6;
  rig.add(core);                          // el punto de luz entre fases

  // ---------- red ----------
  const LX = [-3.3, -1.1, 1.1, 3.3], LN = [4, 6, 6, 2], GAP = 0.86, R = 4.15;
  const sphereGeo = new THREE.SphereGeometry(0.23, 40, 28);
  const GHOST_R = new THREE.Vector3(1, 0.12, 0.25), GHOST_C = new THREE.Vector3(0.1, 0.75, 1);
  const nodes = [];
  LX.forEach((x, L) => {
    for (let i = 0; i < LN[L]; i++) {
      const mix = L / (LX.length - 1);
      const mesh = new THREE.Mesh(sphereGeo, sphereMat(mix));
      const ghosts = [GHOST_R, GHOST_C].map(m => { const g = new THREE.Mesh(sphereGeo, sphereMat(mix, m, true)); g.renderOrder = 2; net.add(g); return g; });
      net.add(mesh);
      nodes.push({
        L, i, mesh, ghosts, act: 0, k: nodes.length,
        target: new THREE.Vector3(x, (i - (LN[L] - 1) / 2) * GAP, 0),
        pos: new THREE.Vector3(),
        color: VIOLET.clone().lerp(LIME, mix),
      });
    }
  });
  const byLayer = L => nodes.filter(n => n.L === L);
  const nodeStart = n => S.nodes + n.k * S.nodeStep;
  const inAnchorT = new THREE.Vector3(LX[0] - 0.95, 0, 0), outAnchorT = new THREE.Vector3(LX[3] + 1.0, 0, 0);
  const inAnchor = new THREE.Vector3(), outAnchor = new THREE.Vector3();

  const bubble = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 54), bubbleMat);
  bubble.renderOrder = -1;
  net.add(bubble);

  // aristas: cada una se dibuja cuando nace el nodo de destino
  const edges = [];
  byLayer(0).forEach(b => edges.push({ a: null, b, start: nodeStart(b) + 0.12 }));
  for (let L = 0; L < LX.length - 1; L++) byLayer(L).forEach(a => byLayer(L + 1).forEach(b => edges.push({ a, b, start: nodeStart(b) + 0.12 })));
  byLayer(LX.length - 1).forEach(a => edges.push({ a, b: null, start: nodeStart(a) + 0.2 }));
  const ePos = new Float32Array(edges.length * 6), eCol = new Float32Array(edges.length * 6);
  edges.forEach((e, k) => {
    const ca = e.a ? e.a.color : VIOLET, cb = e.b ? e.b.color : LIME;
    eCol.set([ca.r, ca.g, ca.b, cb.r, cb.g, cb.b], k * 6);
  });
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  const eMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const eLines = new THREE.LineSegments(eGeo, eMat);
  eLines.frustumCulled = false;
  net.add(eLines);

  // luces: halo de cada nodo + pulsos con estela (los pulsos que llegan quedan orbitando el núcleo de salida)
  const PER_WAVE = 12, TRAIL = 4, NP = S.waves.length * PER_WAVE;
  const PT = nodes.length + NP * TRAIL;
  const pPos = new Float32Array(PT * 3), pCol = new Float32Array(PT * 3), pSize = new Float32Array(PT), pAlpha = new Float32Array(PT);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 1 } },
    vertexShader: `
      attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale;
      varying float vA; varying vec3 vC;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv; vA = aAlpha; vC = aColor;
      }`,
    fragmentShader: `
      varying float vA; varying vec3 vC;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = exp(-d * d * 12.0), halo = exp(-d * d * 2.6) * 0.5;
        float a = (core + halo) * vA * (1.0 - smoothstep(0.8, 1.0, d));
        gl_FragColor = vec4(vC + vec3(core * 0.35), a);
      }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false; points.renderOrder = 4;
  net.add(points);

  // ---------- nube de partículas (GPU) ----------
  // Miles de partículas diminutas; la posición se calcula en el vertex shader a partir de un progreso
  // uK, con un campo de ruido que deforma la expansión para que no salga como un círculo perfecto.
  const CN = (window.innerWidth < 720 ? 6000 : 12000);
  const cDir = new Float32Array(CN * 3), cSpd = new Float32Array(CN), cSeed = new Float32Array(CN), cSize = new Float32Array(CN), cCol = new Float32Array(CN * 3);
  const R3 = rng(7);
  const cPal = [VIOLET, VIOLET.clone().lerp(WHITE, 0.6), LIME, new THREE.Color('#c9a8ff'), WHITE];
  for (let i = 0; i < CN; i++) {
    const u = R3() * 2 - 1, th = R3() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = Math.pow(R3(), 0.45);
    cDir.set([s * Math.cos(th) * rr, s * Math.sin(th) * rr, u * rr * 0.6], i * 3);
    cSpd[i] = 0.5 + Math.pow(R3(), 1.8) * 2.6;
    cSeed[i] = R3();
    cSize[i] = 0.8 + Math.pow(R3(), 2.5) * 1.6;
    const c = cPal[Math.floor(R3() * cPal.length)];
    cCol.set([c.r, c.g, c.b], i * 3);
  }
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CN * 3), 3));
  cGeo.setAttribute('aDir', new THREE.BufferAttribute(cDir, 3));
  cGeo.setAttribute('aSpd', new THREE.BufferAttribute(cSpd, 1));
  cGeo.setAttribute('aSeed', new THREE.BufferAttribute(cSeed, 1));
  cGeo.setAttribute('aSize', new THREE.BufferAttribute(cSize, 1));
  cGeo.setAttribute('aColor', new THREE.BufferAttribute(cCol, 3));
  const cMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uK: { value: 0 }, uSpread: { value: 1 }, uTime: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: 1 } },
    vertexShader: NOISE + `
      attribute vec3 aDir; attribute float aSpd; attribute float aSeed; attribute float aSize; attribute vec3 aColor;
      uniform float uK, uSpread, uTime, uPx;
      varying float vA; varying vec3 vC;
      void main(){
        float life = 0.45 + aSeed * 0.55;                 // cada partícula se apaga a su tiempo
        float k = clamp(uK / life, 0.0, 1.0);
        float e = 1.0 - pow(1.0 - k, 3.0);
        vec3 p = aDir * aSpd * e * uSpread;
        // campo de distorsión: el ruido empuja cada partícula según dónde está, más lejos del centro, más fuerte
        vec3 q = p * 0.55 + vec3(aSeed * 7.0, uTime * 0.15, 3.0);
        vec3 n = vec3(snoise(q), snoise(q + 17.1), snoise(q + 31.7));
        p += n * (0.25 + length(p) * 0.5) * e * uSpread;
        p.y += e * e * 0.3 * uSpread;                     // deriva vaporosa hacia arriba
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPx;
        vA = (1.0 - smoothstep(0.3, 1.0, k)) * smoothstep(0.0, 0.03, uK);
        vC = aColor;
      }`,
    fragmentShader: `
      uniform float uAlpha;
      varying float vA; varying vec3 vC;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(vC, (1.0 - smoothstep(0.2, 1.0, d)) * vA * uAlpha * 0.55);
      }`,
  });
  const cloud = new THREE.Points(cGeo, cMat);
  cloud.frustumCulled = false; cloud.renderOrder = 7;
  rig.add(cloud);                        // se mueve con la cámara, como el resto de la escena

  // pulsos: rutas fijas por ciclo (se regeneran en cada vuelta)
  const pulses = [];
  S.waves.forEach((w, wi) => { for (let k = 0; k < PER_WAVE; k++) pulses.push({ wave: wi, slot: nodes.length + pulses.length * TRAIL, t0: 0, dur: S.waveDur, path: [], orbit: 0, orbitR: 0, orbitTilt: 0 }); });
  let cycleSeed = -1;
  function planPulses(cycle) {
    const r = rng(1000 + cycle);
    const pick = L => { const l = byLayer(L); return l[Math.floor(r() * l.length)]; };
    pulses.forEach((p, idx) => {
      const k = idx % PER_WAVE;
      p.t0 = S.waves[p.wave] + k * 0.055 + r() * 0.05;
      p.dur = S.waveDur * (0.92 + r() * 0.16);
      p.path = [null, pick(0), pick(1), pick(2), pick(3), null];
      p.orbit = r() * Math.PI * 2; p.orbitR = 0.16 + r() * 0.26; p.orbitTilt = (r() - 0.5) * 1.4;
    });
  }
  const pathPoint = (p, k) => (k === 0 ? inAnchor : k === 5 ? outAnchor : p.path[k].pos);
  const tmpA = new THREE.Vector3();
  function pulseAt(p, u, out) {
    const s = clamp(u) * 5, k = Math.min(4, Math.floor(s));
    let f = s - k;
    f = f + (f * f * (3 - 2 * f) - f) * 0.65;   // se detiene levemente en cada nodo: "procesa"
    return out.copy(pathPoint(p, k)).lerp(pathPoint(p, k + 1), f);
  }

  // ---------- pase final ----------
  const post = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uC: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 }, uCA: { value: 0.0045 }, uAspect: { value: 1 }, uRays: { value: 0 },
      uWaveR: { value: 0 }, uWaveAmp: { value: 0 }, uFlash: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tScene; uniform vec2 uRes, uC; uniform float uTime, uCA, uAspect, uRays, uWaveR, uWaveAmp, uFlash;
      varying vec2 vUv;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
      vec3 background(vec2 uv){
        vec2 p = uv - uC; p.x *= uAspect; float d = length(p);
        vec3 col = mix(vec3(0.036, 0.016, 0.078), vec3(0.012, 0.007, 0.028), uv.y);
        col += vec3(0.30, 0.11, 0.62) * 0.16 * exp(-d * d * 3.2);
        // rayos: sólo un instante durante cada estallido
        if (uRays > 0.001) {
          vec2 dir = d > 1e-4 ? p / d : vec2(1.0, 0.0);
          float rl = pow(vnoise(dir * 2.4 + vec2(uTime * 0.035, 3.0)), 5.0);
          float rv = pow(vnoise(dir * 3.1 + vec2(-uTime * 0.03, 11.0)), 5.0);
          float fall = smoothstep(0.04, 0.3, d) * exp(-d * 1.8);
          col += (vec3(0.62, 0.86, 0.22) * rl + vec3(0.60, 0.30, 0.98) * rv * 1.2) * fall * 0.4 * uRays;
        }
        float v = length((uv - 0.5) * vec2(1.0, 1.1));
        col *= 1.0 - 0.5 * smoothstep(0.4, 0.95, v);
        col += (h21(uv * uRes + fract(uTime)) - 0.5) * 0.01;
        return col;
      }
      void main(){
        vec2 uv = vUv;
        vec2 d = uv - uC; d.x *= uAspect;
        float dist = length(d);
        vec2 dir = dist > 1e-4 ? d / dist : vec2(0.0);
        vec2 dirUv = vec2(dir.x / uAspect, dir.y);
        float w = exp(-pow((dist - uWaveR) * 12.0, 2.0));
        uv -= dirUv * w * uWaveAmp;
        vec2 off = dirUv * (uCA * (0.4 + dist * 1.6) + w * uWaveAmp * 0.6);
        vec4 cr = texture2D(tScene, uv + off), cg = texture2D(tScene, uv), cb = texture2D(tScene, uv - off);
        vec3 sc = vec3(cr.r, cg.g, cb.b);
        float sa = clamp((cr.a + cg.a + cb.a) / 3.0, 0.0, 1.0);
        vec2 px = 1.0 / uRes;
        vec3 soft = (texture2D(tScene, uv + vec2(px.x, 0.0) * 1.6).rgb + texture2D(tScene, uv - vec2(px.x, 0.0) * 1.6).rgb
                   + texture2D(tScene, uv + vec2(0.0, px.y) * 1.6).rgb + texture2D(tScene, uv - vec2(0.0, px.y) * 1.6).rgb) * 0.25;
        vec3 halo = vec3(0.0);
        for (int i = 0; i < 4; i++) {
          float a = float(i) * 1.5708 + 0.785;
          vec2 o = vec2(cos(a), sin(a)) * px;
          halo += texture2D(tScene, uv + o * 7.0).rgb + texture2D(tScene, uv + o.yx * vec2(-1.0, 1.0) * 15.0).rgb;
        }
        halo /= 8.0;
        sc = mix(sc, soft, 0.3);
        vec3 col = background(uv) * (1.0 - sa * 0.85) + sc + halo * 0.4;
        col += vec3(0.75, 0.62, 1.0) * w * uWaveAmp * 4.0;
        col += vec3(0.92, 0.88, 1.0) * uFlash * exp(-dist * dist * 40.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

  // ---------- disposición ----------
  // El origen del rig es el centro del escenario. Con zoom 1 y foco 0, una unidad del rig mide view.upp px⁻¹.
  const view = { w: 1, h: 1, stageTop: 0, stageLeft: 0, stageH: 1, cx: 0, cy: 0, scale: 1, pxScale: 1, upp: 1, center: new THREE.Vector3() };
  function layout() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    rt.setSize(Math.round(w * pr), Math.round(h * pr));
    camera.aspect = w / h; camera.updateProjectionMatrix();
    post.uniforms.uRes.value.set(w * pr, h * pr);
    post.uniforms.uAspect.value = w / h;

    const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    view.w = w; view.h = h; view.stageTop = sr.top - hr.top; view.stageLeft = sr.left - hr.left; view.stageH = sr.height;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.upp = (2 * tanH * camera.position.z) / h;                  // unidades de mundo por píxel en z = 0
    view.scale = Math.max(0.2, Math.min(sr.height * 0.94, w * 0.94) * view.upp / (2 * R));
    view.cx = w / 2; view.cy = view.stageTop + sr.height / 2;
    view.center.set(0, (h / 2 - view.cy) * view.upp, 0);
    view.pxScale = (h * pr) / (2 * tanH);
    cMat.uniforms.uPx.value = pr;
    post.uniforms.uC.value.set(0.5, 1 - view.cy / h);   // la cámara siempre centra la acción en el escenario
    if (reduce) { update(7.6, 0); draw(); staticOut(); }
  }
  // sin movimiento: la red armada y la propuesta de valor visible debajo
  function staticOut() {
    POUT.el.style.cssText = `opacity:1;width:${POUT.w}px;left:${Math.round(view.cx - POUT.w / 2 - view.stageLeft)}px;top:${Math.round(view.stageH - POUT.h - 8)}px`;
    POUT.txt.textContent = POUT.full; POUT.n = POUT.full.length; POUT.caret.style.opacity = 0; POUT.body.style.opacity = 1;
    POUT.arc.style.strokeDasharray = '100 0';
  }

  // ---------- cámara (nulo) ----------
  // focus = punto del rig que queda en el centro del escenario; zoom = escala del rig.
  const cam = { zoom: 1, focus: new THREE.Vector3() };
  const eSine = x => -(Math.cos(Math.PI * x) - 1) / 2;      // la curva más suave para la cámara
  const V0 = new THREE.Vector3(), entry = new THREE.Vector3(), collector = new THREE.Vector3(), loaderPt = new THREE.Vector3();
  // Interpolación cúbica monótona por tres llaves (Fritsch–Carlson): pasa por las llaves sin rebotar,
  // arranca y termina con velocidad cero y en la llave del medio no frena si el valor sigue avanzando.
  function mono3(t, t0, t1, t2, v0, v1, v2) {
    const h0 = t1 - t0, h1 = t2 - t1, d0 = (v1 - v0) / h0, d1 = (v2 - v1) / h1;
    const m1 = d0 * d1 <= 0 ? 0 : (3 * h0 + 3 * h1) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
    const herm = (a, b, ma, mb, h, u) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * a + (u3 - 2 * u2 + u) * h * ma + (-2 * u3 + 3 * u2) * b + (u3 - u2) * h * mb; };
    return t <= t1 ? herm(v0, v1, 0, m1, h0, clamp((t - t0) / h0)) : herm(v1, v2, m1, 0, h1, clamp((t - t1) / h1));
  }
  function applyCamera(T) {
    // deriva suave permanente, sólo horizontal: el horizonte nunca cambia de altura
    const dx = Math.sin(T * 0.23) * 0.03 * view.scale;
    rig.scale.setScalar(cam.zoom);
    rig.position.set(view.center.x - (cam.focus.x + dx) * cam.zoom, view.center.y, 0);
    rig.updateMatrixWorld();
  }
  // punto del rig → píxeles del hero
  const proj = new THREE.Vector3();
  const toScreen = v => { proj.copy(v); rig.localToWorld(proj); proj.project(camera); return [(proj.x + 1) / 2 * view.w, (1 - proj.y) / 2 * view.h]; };

  // ---------- píldoras ----------
  // closed = 0 abierta, 1 cerrada en círculo; el padding y el gap se ajustan para que el loader quede centrado.
  // at = punto del rig donde se ancla el centro de la píldora; la escala incluye el zoom de la cámara.
  function pillWidth(p, closed) { return lerp(p.w, p.h, closed); }
  function drawPill(p, { at, scale, closed, alpha, body, type, spin, arcLen, gem }) {
    const el = p.el, side = p === PIN ? 'Left' : 'Right';
    const width = pillWidth(p, closed);
    el.style.opacity = alpha.toFixed(3);
    if (alpha <= 0.001) return;
    const [sx, sy] = toScreen(at);
    el.style.width = Math.round(width) + 'px';
    el.style['padding' + side] = lerp(20, 11, closed).toFixed(1) + 'px';
    el.style.gap = lerp(12, 0, closed).toFixed(1) + 'px';
    el.style.transform = `scale(${Math.max(scale * cam.zoom, 0.001).toFixed(3)})`;
    el.style.left = (sx - width / 2 - view.stageLeft).toFixed(1) + 'px';
    el.style.top = (sy - p.h / 2 - view.stageTop).toFixed(1) + 'px';
    p.body.style.opacity = body.toFixed(3);
    typeTo(p, type);
    p.svg.style.transform = `rotate(${spin.toFixed(1)}deg)`;
    p.arc.style.strokeDasharray = `${arcLen.toFixed(1)} ${(100 - arcLen).toFixed(1)}`;
    p.gem.style.transform = `rotate(45deg) scale(${gem.toFixed(3)})`;
  }

  // ---------- cuadro ----------
  function update(t, T) {
    // posición del núcleo verde (salida de la red) en coordenadas del rig
    // giro fijo y sin inclinación: entrada y núcleo verde quedan exactamente sobre el mismo eje horizontal
    net.rotation.set(0, -0.16, 0);
    net.scale.setScalar(view.scale);
    net.updateMatrix();
    collector.copy(outAnchorT).applyMatrix4(net.matrix);
    entry.copy(inAnchorT).applyMatrix4(net.matrix);       // punto de entrada: ahí explota el loader del input

    // ----- 1 · input -----
    const inPop = eOutBack(seg(t, S.inPop, S.inOpen));
    const inOpen = eSpring(seg(t, S.inOpen, S.inOpenEnd));
    const inClose = eIO(seg(t, S.inClose, S.inCircle));
    const inShrink = eInExpo(seg(t, S.inCircle, S.inGone));
    const inSpin = eIO(seg(t, S.inSpinA, S.inSpinB));
    const inClosed = (1 - inOpen) + inClose;            // el resorte puede pasarse apenas de 1: rebote mínimo
    const inScale = lerp(0.12, 1, inPop) * (1 - 0.9 * inShrink);
    // el loader está a la derecha de la píldora; al cerrarse en círculo vuelve al centro
    loaderPt.set((pillWidth(PIN, inClosed) / 2 - 26) * view.upp * inScale, 0, 0);

    // ----- cámara: una sola trayectoria continua -----
    // La píldora del input vive en el punto de entrada de la red: su loader revienta justo ahí y de ese
    // mismo punto salen las conexiones y los datos. Desde la explosión hasta el output la cámara hace un
    // único movimiento: se aleja, pasa por la red completa y entra al núcleo verde, sin cortes intermedios.
    // El foco vertical no se mueve nunca.
    if (t < S.pullA) {
      // zoom amplio siguiendo al loader mientras gira y se cierra sobre el punto de entrada
      const k = eSine(seg(t, S.zoomInA, S.zoomInB));
      cam.zoom = lerp(1 + 0.04 * seg(t, S.inPop, S.zoomInA), S.zoomIn, k);
      cam.focus.set(entry.x + loaderPt.x * k, 0, 0);
    } else if (t < S.outPop) {
      // zoom en escala logarítmica (se percibe parejo) y foco horizontal, interpolados con las mismas llaves
      cam.zoom = Math.exp(mono3(t, S.pullA, S.camMid, S.outPop, Math.log(S.zoomIn), 0, Math.log(S.pushZoom)));
      cam.focus.set(mono3(t, S.pullA, S.camMid, S.outPop, entry.x, 0, collector.x), 0, 0);
    } else {
      // el loader nace grande sobre el núcleo; la cámara se aleja hasta el tamaño final del output
      const k = eSine(seg(t, S.zoomOutA, S.zoomOutB));
      cam.zoom = lerp(S.pushZoom, 1, k) * (1 + 0.04 * eSine(seg(t, S.zoomOutB, S.outGone)));
      cam.focus.copy(collector);
    }
    applyCamera(T);
    net.updateMatrixWorld();
    pMat.uniforms.uScale.value = view.pxScale * view.scale * cam.zoom;

    drawPill(PIN, {
      at: entry, scale: inScale, closed: inClosed,
      alpha: seg(t, S.inPop, S.inPop + 0.12) * (1 - seg(t, S.inGone - 0.06, S.inGone)),
      body: seg(t, S.inOpen + 0.35, S.inOpenEnd) * (1 - seg(t, S.inClose - 0.15, S.inClose + 0.05)),
      type: seg(t, S.typeA, S.typeB),
      spin: inSpin * 900 + t * 20,
      arcLen: 24 + 46 * Math.sin(Math.PI * inSpin),
      gem: 1 - 0.55 * inShrink,
    });
    PIN.caret.style.opacity = t > S.typeA - 0.3 && t < S.typeB + 0.1 && (t < S.typeB || Math.floor(T * 2.5) % 2 === 0) ? 1 : 0;

    // punto de luz: recoge el loader que se encoge (centro) y el colapso (núcleo verde)
    const coreA = win(t, S.inCircle + 0.1, S.cloud1 + 0.35, 0.15, 0.3);
    const coreB = win(t, S.collapse + 0.35, S.outPop + 0.2, 0.3, 0.2);
    const coreK = Math.max(coreA, coreB);
    core.visible = coreK > 0.002;
    core.material.opacity = coreK;
    core.material.color.copy(coreB > coreA ? LIME.clone().lerp(WHITE, 0.45) : VIOLET.clone().lerp(WHITE, 0.5));
    core.position.copy(coreB > coreA ? collector : entry);
    core.scale.setScalar(view.scale * (0.3 + 0.7 * coreK));

    // ----- 2 · burbuja y red -----
    const collapse = eInExpo(seg(t, S.collapse, S.collapseEnd));
    const bOpen = eOutExpo(seg(t, S.bubble, S.bubble + 1.6));
    bubble.scale.setScalar(Math.max(0.001, (0.3 + 0.7 * bOpen) * (1 - collapse * 0.97)));
    bubble.position.copy(outAnchorT).multiplyScalar(collapse);
    bubbleMat.uniforms.uAlpha.value = bOpen * (1 - seg(t, S.collapse + 0.3, S.collapseEnd));
    bubbleMat.uniforms.uTime.value = T;
    bubble.rotation.y = T * 0.05;

    // todo colapsa hacia el núcleo verde
    inAnchor.copy(inAnchorT).lerp(outAnchorT, collapse);
    outAnchor.copy(outAnchorT);

    // actividad de cada nodo: suma de los pulsos que ya lo atravesaron
    nodes.forEach(n => { n.act = 0; });
    pulses.forEach(p => {
      for (let j = 1; j <= 4; j++) {
        const hitT = p.t0 + p.dur * (j / 5);
        if (t >= hitT) p.path[j].act += Math.exp(-(t - hitT) * 3.2);
      }
    });

    // esferas: nacen en su lugar con un pequeño ascenso; al recibir datos brillan, vibran y se separan en RGB
    nodes.forEach((n, k) => {
      const s0 = nodeStart(n);
      const born = seg(t, s0, s0 + S.nodeDur);
      const ap = born > 0 ? eOutBack(born) : 0;
      const act = t < S.collapseEnd ? Math.min(1, n.act) : 0;
      const jx = act * 0.0175 * Math.sin(T * 57 + k * 1.3), jy = act * 0.0175 * Math.cos(T * 63 + k * 2.1);
      n.pos.copy(n.target);
      n.pos.y -= 0.3 * (1 - eOutExpo(born));
      n.pos.lerp(outAnchorT, collapse);
      const visible = born > 0 && t < S.collapseEnd;
      const sc = Math.max(0.001, ap * (1 - collapse * 0.85) * (1 + act * 0.08));
      n.mesh.position.set(n.pos.x + jx, n.pos.y + jy, n.pos.z);
      n.mesh.scale.setScalar(sc);
      n.mesh.visible = visible;
      const u = n.mesh.material.uniforms;
      u.uAlpha.value = clamp(born * 3); u.uGlow.value = act * 0.3; u.uTime.value = T;
      const split = act * (0.025 + 0.015 * Math.sin(T * 41 + k));
      n.ghosts.forEach((g, gi) => {
        const dir = gi === 0 ? -1 : 1;
        g.visible = visible && act > 0.02;
        g.position.set(n.mesh.position.x + dir * split, n.mesh.position.y - dir * split * 0.35, n.pos.z);
        g.scale.setScalar(sc * 1.02);
        const gu = g.material.uniforms;
        gu.uAlpha.value = act * 0.3; gu.uGlow.value = act * 0.15; gu.uTime.value = T;
      });
      pPos.set([n.pos.x, n.pos.y, n.pos.z], k * 3);
      const c = n.color.clone().lerp(WHITE, act * 0.06);
      pCol.set([c.r * 0.8, c.g * 0.8, c.b * 0.8], k * 3);
      const spark = win(born, 0, 0.6, 0.05, 0.5);
      pSize[k] = 0.62 + act * 0.18 + 0.22 * spark;
      pAlpha[k] = visible ? clamp(born * 3) * (0.14 + act * 0.13 + 0.35 * spark) : 0;
    });

    edges.forEach((e, k) => {
      const a = e.a ? e.a.pos : inAnchor, b = e.b ? e.b.pos : outAnchor;
      const p = eIO(seg(t, e.start, e.start + 0.45)) * (t < S.collapseEnd ? 1 : 0);
      ePos[k * 6] = a.x; ePos[k * 6 + 1] = a.y; ePos[k * 6 + 2] = a.z;
      ePos[k * 6 + 3] = a.x + (b.x - a.x) * p; ePos[k * 6 + 4] = a.y + (b.y - a.y) * p; ePos[k * 6 + 5] = a.z + (b.z - a.z) * p;
    });
    eGeo.attributes.position.needsUpdate = true;
    eMat.opacity = 0.3 * (1 - seg(t, S.collapse, S.collapse + 0.45));

    // ----- 3 · pulsos; al llegar orbitan el núcleo verde que va formando el output -----
    pulses.forEach(p => {
      const u = (t - p.t0) / p.dur;
      for (let j = 0; j < TRAIL; j++) {
        const s = p.slot + j;
        if (u < 0 || t > S.collapseEnd) { pAlpha[s] = 0; continue; }
        if (u >= 1) {
          if (j > 0) { pAlpha[s] = 0; continue; }
          const a = p.orbit + (t - p.t0 - p.dur) * 2.6, r = p.orbitR * (1 - collapse * 0.9);
          pPos.set([outAnchor.x + Math.cos(a) * r, outAnchor.y + Math.sin(a) * r * Math.cos(p.orbitTilt), Math.sin(a) * r * Math.sin(p.orbitTilt) + 0.3], s * 3);
          pCol.set([LIME.r, LIME.g, LIME.b], s * 3);
          pSize[s] = 0.3; pAlpha[s] = 0.7;
          continue;
        }
        const uj = u - j * 0.02;
        if (uj < 0) { pAlpha[s] = 0; continue; }
        pulseAt(p, uj, tmpA);
        pPos.set([tmpA.x, tmpA.y, tmpA.z + 0.3], s * 3);
        const c = VIOLET.clone().lerp(LIME, eIO(clamp(uj * 1.15))).lerp(WHITE, j === 0 ? 0.15 : 0);
        pCol.set([c.r, c.g, c.b], s * 3);
        pSize[s] = j === 0 ? 0.42 : 0.32 - j * 0.06;
        pAlpha[s] = seg(u, 0, 0.05) * (j === 0 ? 0.85 : 0.45 - j * 0.1);
      }
    });
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.aColor.needsUpdate = true;
    pGeo.attributes.aSize.needsUpdate = true;
    pGeo.attributes.aAlpha.needsUpdate = true;

    // ----- 4 · nubes de partículas: viven en el rig, así acompañan el movimiento de cámara -----
    const c1 = seg(t, S.cloud1, S.cloud1 + S.cloud1Dur), c2 = seg(t, S.cloud2, S.cloud2 + S.cloud2Dur);
    const second = c2 > 0;
    const ck = second ? c2 : c1;
    cloud.visible = ck > 0 && ck < 1;
    cloud.position.copy(second ? collector : entry);
    cMat.uniforms.uK.value = ck;
    // la primera nace con la cámara muy cerca: en el rig es más chica, en pantalla ocupa mucho
    cMat.uniforms.uSpread.value = view.scale * (second ? 0.55 : 0.7);
    cMat.uniforms.uAlpha.value = 1;
    cMat.uniforms.uTime.value = T;

    // onda de choque, destello y rayos: breves, se apagan rápido
    const shockA = seg(t, S.cloud1, S.cloud1 + 0.8), shockB = seg(t, S.cloud2, S.cloud2 + 1.0);
    const shock = shockB > 0 ? shockB : shockA, amp = shockB > 0 ? 0.02 : 0.016;
    post.uniforms.uWaveR.value = eOutExpo(shock) * 0.85;
    post.uniforms.uWaveAmp.value = shock > 0 && shock < 1 ? amp * (1 - shock) : 0;
    post.uniforms.uFlash.value = 0.3 * win(t, S.cloud2 - 0.04, S.cloud2 + 0.3, 0.04, 0.24) + 0.22 * win(t, S.cloud1 - 0.04, S.cloud1 + 0.3, 0.04, 0.24);
    post.uniforms.uRays.value = win(t, S.cloud2 - 0.05, S.cloud2 + 0.6, 0.05, 0.5) + 0.7 * win(t, S.cloud1 - 0.05, S.cloud1 + 0.55, 0.05, 0.45);

    // ----- 5 · output: nace sobre el núcleo verde -----
    const outPop = eOutBack(seg(t, S.outPop, S.outPop + 0.35));
    const outOpen = eSpring(seg(t, S.outOpen, S.outOpenEnd));
    const outClose = eIO(seg(t, S.outClose, S.outCircle));
    const outShrink = eInExpo(seg(t, S.outCircle, S.outGone));
    const outSpin = eIO(seg(t, S.outSpinA, S.outSpinB));
    const fill = eIO(seg(t, S.outSpinB, S.outFillB));
    drawPill(POUT, {
      at: collector,
      scale: lerp(0.12, 1, outPop) * (1 - 0.9 * outShrink),
      closed: (1 - outOpen) + outClose,
      alpha: seg(t, S.outPop, S.outPop + 0.1) * (1 - seg(t, S.outGone - 0.06, S.outGone)),
      body: seg(t, S.outOpen + 0.3, S.outOpenEnd + 0.1) * (1 - seg(t, S.outClose - 0.15, S.outClose + 0.05)),
      type: seg(t, S.typeOutA, S.typeOutB),
      spin: outSpin * 1260 + t * 20,
      arcLen: lerp(24 + 46 * Math.sin(Math.PI * outSpin), 100, fill) * (1 - outClose) + 24 * outClose,
      gem: 1 - 0.55 * outShrink,
    });
    POUT.caret.style.opacity = t > S.typeOutA - 0.2 && t < S.typeOutB + 0.7 && (t < S.typeOutB || Math.floor(T * 2.5) % 2 === 0) ? 1 : 0;

    post.uniforms.uTime.value = T;
    post.uniforms.uCA.value = 0.0042 + 0.0018 * Math.sin(T * 0.7);
  }

  function draw() {
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  // ---------- ciclo ----------
  // ?t=6.2 congela la animación en ese segundo del guion (para revisar una fase puntual)
  const freezeAt = parseFloat(new URLSearchParams(location.search).get('t'));
  let T = 0, inView = true, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (inView && !document.hidden) {
      T += dt;
      const cycle = Math.floor(T / S.cycle);
      if (cycle !== cycleSeed) { cycleSeed = cycle; planPulses(cycle); }
      update(Number.isFinite(freezeAt) ? clamp(freezeAt, 0, S.cycle) : T - cycle * S.cycle, T);
      draw();
    }
    requestAnimationFrame(frame);
  }
  planPulses(0); cycleSeed = 0;
  new ResizeObserver(layout).observe(hero);
  layout();
  if (reduce) return;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: 0.01 }).observe(hero);
  requestAnimationFrame(frame);
})();
