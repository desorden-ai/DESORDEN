(()=>{
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CONTACT = Object.freeze({
    whatsapp: '34640925788',
    email: 'desorden.help@gmail.com'
  });

  const canvas = $('#canvas');
  const context = canvas?.getContext?.('2d', { alpha: false }) || null;
  const hero = $('#hero');
  const title = $('#hero-title');
  const boot = $('#boot');
  const frameElement = $('#frame');
  const TOTAL_FRAMES = 97;
  const cache = new Map();
  const pending = new Map();
  let target = 0;
  let last = -1;
  let animationFrame = 0;
  let objectPixelRatio = 1;

  const frameUrl = (index) =>
    `/frames/v1/frame_${String(index + 1).padStart(4, '0')}.webp`;

  function resizeCanvas() {
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    objectPixelRatio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * objectPixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * objectPixelRatio));
    drawFrame(target);
  }

  function drawCover(image) {
    if (!context || !canvas || !image) return;
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(
      image,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height
    );
  }

  function touchCache(index, bitmap) {
    cache.delete(index);
    cache.set(index, bitmap);
    while (cache.size > 24) {
      const [key, value] = cache.entries().next().value;
      if (Math.abs(key - target) < 5) {
        cache.delete(key);
        cache.set(key, value);
        continue;
      }
      value.close?.();
      cache.delete(key);
    }
  }

  async function loadFrame(index) {
    if (index < 0 || index >= TOTAL_FRAMES) return null;
    if (cache.has(index)) {
      const bitmap = cache.get(index);
      touchCache(index, bitmap);
      return bitmap;
    }
    if (pending.has(index)) return pending.get(index);

    const request = fetch(frameUrl(index), { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Frame ${index + 1}: HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if ('createImageBitmap' in window) return createImageBitmap(blob);
        return new Promise((resolve, reject) => {
          const image = new Image();
          const objectUrl = URL.createObjectURL(blob);
          image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
          };
          image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`No s'ha pogut decodificar el fotograma ${index + 1}`));
          };
          image.src = objectUrl;
        });
      })
      .then((bitmap) => {
        touchCache(index, bitmap);
        return bitmap;
      })
      .finally(() => pending.delete(index));

    pending.set(index, request);
    return request;
  }

  async function drawFrame(index) {
    if (!context) return;
    try {
      const bitmap = await loadFrame(index);
      if (index !== target || !bitmap) return;
      drawCover(bitmap);
      last = index;
      if (frameElement) frameElement.textContent = String(index + 1).padStart(3, '0');
      hero?.classList.add('ready');
    } catch {
      if (last < 0) hero?.classList.remove('ready');
    }
  }

  function queueFrame(index) {
    target = Math.max(0, Math.min(TOTAL_FRAMES - 1, index));
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = 0;
      drawFrame(target);
      [-2, -1, 1, 2, 3].forEach((offset) => loadFrame(target + offset).catch(() => {}));
    });
  }

  function updateHero() {
    if (reduceMotion || !hero) return;
    const rect = hero.getBoundingClientRect();
    const distance = Math.max(1, hero.offsetHeight - innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / distance));
    queueFrame(Math.round(progress * (TOTAL_FRAMES - 1)));
    title?.classList.toggle('on', progress > 0.54);
  }

  async function bootUp() {
    if (!context) {
      if ($('#boot-copy')) $('#boot-copy').textContent = 'MODE DE RESERVA ACTIVAT';
      setTimeout(() => boot?.classList.add('off'), 220);
      return;
    }
    try {
      await loadFrame(0);
      drawFrame(0);
      for (let index = 1; index < 8; index += 1) loadFrame(index).catch(() => {});
      if ($('#boot-copy')) $('#boot-copy').textContent = 'EXPERIÈNCIA PREPARADA';
    } catch {
      if ($('#boot-copy')) $('#boot-copy').textContent = 'MODE DE RESERVA ACTIVAT';
    } finally {
      setTimeout(() => boot?.classList.add('off'), 220);
    }
  }

  const sections = $$('[data-n]');
  const current = $('#current');
  const progressBar = $('#progress');
  const sectionObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (current) current.textContent = entry.target.dataset.n;
        if (progressBar) progressBar.style.height = `${Number(entry.target.dataset.n) * 20}%`;
      }),
    { rootMargin: '-42% 0px -42%', threshold: 0 }
  );
  sections.forEach((section) => sectionObserver.observe(section));

  const services = ['VÍDEO', 'FOTOGRAFIA', 'DRON', 'IA VISUAL', 'WEB'];
  const serviceSection = $('#que-faig');
  const cube = $('#cube');
  const front = $('#front');
  const top = $('#top');
  const serviceIndex = $('#service-index');

  function updateServices() {
    if (reduceMotion || !serviceSection || !cube || !front || !top) return;
    const rect = serviceSection.getBoundingClientRect();
    const distance = Math.max(1, serviceSection.offsetHeight - innerHeight);
    const progress = Math.max(0, Math.min(0.999, -rect.top / distance));
    const raw = progress * (services.length - 1);
    const index = Math.floor(raw);
    const fraction = raw - index;
    front.textContent = services[index];
    top.textContent = services[Math.min(index + 1, services.length - 1)];
    cube.style.transform = `rotateX(${-90 * fraction}deg) translateZ(${8 * Math.sin(Math.PI * fraction)}px)`;
    if (serviceIndex) serviceIndex.textContent = String(index + 1).padStart(2, '0');
  }

  let ticking = false;
  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      requestAnimationFrame(() => {
        updateHero();
        updateServices();
        ticking = false;
      });
      ticking = true;
    },
    { passive: true }
  );
  addEventListener('resize', resizeCanvas, { passive: true });

  const evidence = {
    leire: {
      title: 'LEIRE MARTÍNEZ',
      img: '/assets/thumb-leire.webp',
      copy: 'Reacció pública visible a una peça audiovisual de DESORDEN.'
    },
    rosalia: {
      title: 'ROSALÍA',
      img: '/assets/thumb-rosalia.webp',
      copy: 'Evidència visual pública associada a una peça publicada per DESORDEN.'
    }
  };
  const dialog = $('#dialog');
  const dialogImage = $('#dialog-img');
  const dialogTitle = $('#dialog-title');
  const dialogCopy = $('#dialog-copy');
  const closeDialog = $('#close');

  $$('[data-e]').forEach((button) =>
    button.addEventListener('click', () => {
      const item = evidence[button.dataset.e];
      if (!item || !dialog) return;
      dialogTitle.textContent = item.title;
      dialogImage.src = item.img;
      dialogCopy.textContent = item.copy;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    })
  );
  closeDialog?.addEventListener('click', () => dialog?.close?.());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close?.();
  });

  function buildMessage() {
    return `DESORDEN — Nova consulta\nNom: ${$('#name').value.trim()}\nContacte: ${$('#contact').value.trim()}\nObjectiu: ${$('#objective').value.trim()}`;
  }

  function openWhatsApp(message = 'Hola DESORDEN, vull parlar d’un projecte.') {
    const url = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
  }

  function openEmail(message = '') {
    const subject = encodeURIComponent('Nou projecte — DESORDEN');
    const body = encodeURIComponent(message || 'Hola DESORDEN, vull parlar d’un projecte.');
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
  }

  const form = $('#form');
  const status = $('#status');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    let valid = true;
    [
      ['name', 2, 'Escriu el teu nom.'],
      ['contact', 5, 'Indica una via de contacte.'],
      ['objective', 10, 'Explica breument el projecte.']
    ].forEach(([id, minimum, message]) => {
      const input = $(`#${id}`);
      const error = $(`#${id}-error`);
      if (input.value.trim().length < minimum) {
        error.textContent = message;
        input.setAttribute('aria-invalid', 'true');
        valid = false;
      } else {
        error.textContent = '';
        input.removeAttribute('aria-invalid');
      }
    });

    if (!valid) {
      if (status) status.textContent = 'Revisa els camps indicats.';
      return;
    }

    const message = buildMessage();
    if (status) status.textContent = 'Obrint WhatsApp amb la consulta preparada…';
    openWhatsApp(message);
  });

  $('#whatsapp-button')?.addEventListener('click', () => openWhatsApp());
  $('#email-button')?.addEventListener('click', () => openEmail());

  if ($('#year')) $('#year').textContent = new Date().getFullYear();
  resizeCanvas();
  bootUp();
  updateHero();
  updateServices();
})();
