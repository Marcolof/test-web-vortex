// Comportamiento general de la landing: barra de navegación y aparición de bloques.
(() => {
  const nav = document.getElementById('nav');
  if (nav) {
    const toggle = nav.querySelector('.vx-nav-toggle');
    const use = toggle && toggle.querySelector('use');
    const setOpen = open => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      if (use) use.setAttribute('href', open ? '#i-close' : '#i-menu');
    };
    if (toggle) {
      toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });
    }
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Aparición suave de bloques al entrar en pantalla
  const items = document.querySelectorAll('.vx-reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      // escalonado entre hermanos de una misma grilla
      const siblings = el.parentElement ? [...el.parentElement.children].filter(c => c.classList.contains('vx-reveal')) : [];
      el.style.transitionDelay = Math.max(0, siblings.indexOf(el)) * 80 + 'ms';
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  items.forEach(el => io.observe(el));
})();
