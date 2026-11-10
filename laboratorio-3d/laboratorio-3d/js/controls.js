/* Controles: caminar, mirar, usar objetos, bureta, mechero, interfaz y experimentos. */
(function () {
  'use strict';
  const Chem = window.Chem;
  const World = window.World;
  const $ = id => document.getElementById(id);
  const ids = ['v1', 'v2', 'v3', 'v4'];
  const VNAMES = {
    v1: 'Vaso de precipitados 1', v2: 'Matraz Erlenmeyer 2',
    v3: 'Tubo de ensayo 3', v4: 'Vaso 4 (sobre el mechero)'
  };
  const EXPERIMENTS = [
    { title: 'Indicador universal y pH', steps: [
      'Toca el vaso 1 para activarlo.',
      'Selecciona 5 mL y toca el HCl del estante superior: el pH baja a 1.',
      'Toca «Indicador universal» en el estante inferior: el líquido toma color según el pH.',
      'Toca el NaOH: el color pasa a verde y luego a azul al subir el pH.'
    ] },
    { title: 'Valoración ácido-base (HCl con NaOH)', steps: [
      'Toca el matraz 2 para activarlo.',
      'Selecciona 20 mL y toca el HCl.',
      'Toca la fenolftaleína para añadir indicador (sigue incolora).',
      'Toca la bureta: cada clic deja caer 0,5 mL de NaOH.',
      'Hacen falta unas 40 gotas. Al llegar al punto de equivalencia (20 mL de NaOH), la mezcla pasa a rosa persistente.'
    ] },
    { title: 'Precipitado azul de cobre', steps: [
      'Toca el vaso 1 para activarlo.',
      'Selecciona 10 mL y toca el sulfato de cobre(II): la solución es azul.',
      'Selecciona 10 mL y toca el NaOH: se forma un precipitado azul de Cu(OH)₂ en el fondo.'
    ] },
    { title: 'Complejo rojo de hierro(III)', steps: [
      'Toca el tubo 3 para activarlo.',
      'Selecciona 5 mL y toca el cloruro de hierro(III) (amarillo).',
      'Selecciona 5 mL y toca el tiocianato de potasio: aparece el color rojo sangre.'
    ] },
    { title: 'Hidrógeno con zinc', steps: [
      'Toca el vaso 1 y añade 20 mL de HCl.',
      'Toca el zinc dos veces: aparecen burbujas de H₂ y el zinc se consume.'
    ] },
    { title: 'Dióxido de carbono con carbonato', steps: [
      'Toca el matraz 2 y añade 10 mL de HCl.',
      'Añade 10 mL de carbonato de sodio: se desprende CO₂ en burbujas.'
    ] },
    { title: 'Cloruro de plata', steps: [
      'Toca el matraz 2 (vacío) para activarlo.',
      'Añade 5 mL de nitrato de plata y 5 mL de cloruro de sodio.',
      'Se forma un precipitado blanco de AgCl.'
    ] }
  ];

  const S = { active: null, vol: 5, burette: 50, burnerOn: false, target: null, endpoint: {}, boil: 0, chem: {} };
  ids.forEach(id => { S.chem[id] = Chem.newVessel(); S.endpoint[id] = false; });

  function log(msg) {
    const ul = $('log');
    const li = document.createElement('li');
    li.textContent = msg;
    ul.prepend(li);
    while (ul.children.length > 40) ul.lastChild.remove();
  }

  function labelFor(a) {
    if (a.kind === 'bottle') return Chem.REAGENTS[a.key].full;
    if (a.kind === 'vessel') return VNAMES[a.id];
    if (a.kind === 'burette') return 'Bureta de NaOH 0,1 M: clic para dejar caer 0,5 mL';
    if (a.kind === 'burner') return 'Mechero Bunsen: clic para encender o apagar';
    if (a.kind === 'tap') return 'Grifo: añade 10 mL de agua destilada';
    return '';
  }

  function setActive(id) {
    S.active = id;
    World.select(id);
    updateUI();
  }

  // Tras cada cambio: reacciones, mensajes, animación de gases y refresco 3D.
  function settle(id, quietNeutral) {
    const st = S.chem[id];
    const ev = Chem.react(st);
    ev.forEach(e => { if (e.t === 'gas') World.emitBubbles(id, 8, 0xffffff); });
    Chem.messagesFor(ev).forEach(m => {
      if (!(quietNeutral && m.indexOf('Neutralización') === 0)) log(VNAMES[id] + ': ' + m);
    });
    const p = Chem.color(st).pH;
    if (st.PHE && !st.UNI && p !== null) {
      if (p > 8.2 && !S.endpoint[id]) {
        S.endpoint[id] = true;
        log(VNAMES[id] + ': viraje a rosa, pH ' + p.toFixed(1));
      } else if (p < 8) {
        S.endpoint[id] = false;
      }
    }
    World.refresh(id, st);
  }

  function doPour(key, amount) {
    if (!S.active) return log('Primero toca un recipiente para activarlo.');
    const id = S.active;
    const st = S.chem[id];
    if (st.vol + amount > World.vessels[id].tb.max) return log(VNAMES[id] + ' no admite más líquido.');
    Chem.pour(st, key, amount);
    World.stream(key, id);
    settle(id);
    updateUI();
  }

  function doDrip() {
    if (!S.active) return log('Primero toca un recipiente para activarlo.');
    if (S.burette < 0.5 - 1e-9) return log('Bureta vacía. Pulsa «Rellenar bureta».');
    S.burette = Math.max(0, S.burette - 0.5);
    World.setBurette(S.burette);
    const st = S.chem[S.active];
    Chem.pour(st, 'NaOH', 0.5);
    World.drip(S.active);
    settle(S.active, true);
    updateUI();
  }

  function toggleBurner() {
    S.burnerOn = !S.burnerOn;
    World.setBurner(S.burnerOn);
    log(S.burnerOn ? 'Mechero encendido: calienta solo el vaso 4.' : 'Mechero apagado.');
    updateUI();
  }

  function onAction(a, point) {
    if (point && point.distanceTo(World.camera.position) > 3.5) return log('Acércate más para usar este objeto.');
    switch (a.kind) {
      case 'vessel': setActive(a.id); break;
      case 'bottle': doPour(a.key, a.key === 'H2O' ? 10 : S.vol); break;
      case 'burette': doDrip(); break;
      case 'tap': doPour('H2O', 10); break;
      case 'burner': toggleBurner(); break;
    }
  }

  function reset() {
    ids.forEach(id => {
      S.chem[id] = Chem.newVessel();
      S.endpoint[id] = false;
      World.refresh(id, S.chem[id]);
    });
    S.burette = 50; World.setBurette(50);
    S.burnerOn = false; World.setBurner(false);
    S.active = null; World.select(null);
    $('log').innerHTML = '';
    log('Laboratorio reiniciado.');
    updateUI();
  }

  function updateUI() {
    const st = S.active ? S.chem[S.active] : null;
    if (st) {
      const c = Chem.color(st);
      $('vName').textContent = VNAMES[S.active];
      $('vVol').textContent = st.vol.toFixed(1) + ' mL';
      $('vPh').textContent = c.pH === null ? '—' : c.pH.toFixed(2);
      $('vTemp').textContent = Math.round(st.temp) + ' °C';
      $('vSwatch').style.background = st.vol > 0 ? c.hex : 'transparent';
      const sols = Chem.solids(st);
      $('vSolids').textContent = sols.length ? sols.map(s => s.name).join(', ') : 'ninguno';
    } else {
      $('vName').textContent = 'Ningún recipiente activo';
      $('vVol').textContent = '—';
      $('vPh').textContent = '—';
      $('vTemp').textContent = '—';
      $('vSwatch').style.background = 'transparent';
      $('vSolids').textContent = '—';
    }
    $('burLeft').textContent = S.burette.toFixed(1) + ' mL';
    $('burnerState').textContent = S.burnerOn ? 'Encendido' : 'Apagado';
    document.querySelectorAll('[data-vol]').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.vol) === S.vol));
    });
  }

  function buildExperiments() {
    $('expList').innerHTML = EXPERIMENTS.map(e =>
      '<details><summary>' + e.title + '</summary><ol>' +
      e.steps.map(s => '<li>' + s + '</li>').join('') + '</ol></details>'
    ).join('');
  }

  // Movimiento y cámara
  const keys = {};
  const canvas = $('scene');
  const ROOM = { x: 6.5, zMin: -4.6, zMax: 4.6 };

  function blocked(x, z) {
    if (Math.abs(x) > ROOM.x || z < ROOM.zMin || z > ROOM.zMax) return true;
    if (Math.abs(x) < 3.9 && Math.abs(z) < 0.95) return true;
    if (z < -3.7) return true;
    return false;
  }

  function look(mx, my) {
    const cam = World.camera;
    cam.rotation.y -= mx * 0.004;
    cam.rotation.x = Math.max(-1.2, Math.min(1.2, cam.rotation.x - my * 0.004));
  }

  function step(dt) {
    const cam = World.camera;
    const fwd = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const side = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const yaw = cam.rotation.y;
    let dx = 0, dz = 0;
    if (fwd || side) {
      S.target = null;
      dx = -Math.sin(yaw) * fwd + Math.cos(yaw) * side;
      dz = -Math.cos(yaw) * fwd - Math.sin(yaw) * side;
    } else if (S.target) {
      dx = S.target.x - cam.position.x;
      dz = S.target.z - cam.position.z;
      if (Math.hypot(dx, dz) < 0.08) S.target = null;
    }
    const len = Math.hypot(dx, dz);
    if (len > 1e-6 && (fwd || side || S.target)) {
      const sp = 1.8 * dt;
      const nx = cam.position.x + dx / len * sp;
      const nz = cam.position.z + dz / len * sp;
      const mx = !blocked(nx, cam.position.z);
      const mz = !blocked(cam.position.x, nz);
      if (mx) cam.position.x = nx;
      if (mz) cam.position.z = nz;
      if (!mx && !mz) S.target = null;
    }

    ids.forEach(id => Chem.heat(S.chem[id], dt, id === 'v4' && S.burnerOn));
    if (S.burnerOn) {
      const st = S.chem.v4;
      if (st.vol > 0 && st.temp >= 99) {
        S.boil += dt;
        if (S.boil > 0.12) { S.boil = 0; World.emitBubbles('v4', 2, 0xffffff); }
      }
    }
  }

  function ndcOf(e) {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  let down = null;
  const tip = $('tip');
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (down) {
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (down.moved) look(e.movementX, e.movementY);
      return;
    }
    const hit = World.pick(ndcOf(e));
    if (hit && hit.action) {
      tip.textContent = labelFor(hit.action);
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top = (e.clientY + 14) + 'px';
      tip.hidden = false;
      canvas.style.cursor = 'pointer';
    } else {
      tip.hidden = true;
      canvas.style.cursor = 'crosshair';
    }
  });
  canvas.addEventListener('pointerup', e => {
    const wasClick = down && !down.moved;
    down = null;
    if (!wasClick) return;
    const ndc = ndcOf(e);
    const hit = World.pick(ndc);
    if (hit && hit.action) return onAction(hit.action, hit.point);
    const fp = World.floorPoint(ndc);
    if (fp && !blocked(fp.x, fp.z)) S.target = new THREE.Vector3(fp.x, 0, fp.z);
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; });

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k.indexOf('arrow') === 0 || k === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  window.addEventListener('resize', () => World.resize(window.innerWidth, window.innerHeight));

  // Botones de la interfaz
  document.querySelectorAll('[data-vol]').forEach(b => {
    b.addEventListener('click', () => { S.vol = Number(b.dataset.vol); updateUI(); });
  });
  $('refill').addEventListener('click', () => {
    S.burette = 50; World.setBurette(50); log('Bureta rellenada con NaOH 0,1 M.'); updateUI();
  });
  $('resetLab').addEventListener('click', reset);
  $('toggleExp').addEventListener('click', () => document.body.classList.toggle('drawer-open'));
  $('closeExp').addEventListener('click', () => document.body.classList.remove('drawer-open'));

  // Arranque
  World.init(canvas);
  World.resize(window.innerWidth, window.innerHeight);
  ids.forEach(id => World.refresh(id, S.chem[id]));
  World.setBurette(50);
  World.setBurner(false);
  buildExperiments();
  log('Bienvenido. Toca un recipiente para activarlo y úsalo con los reactivos del estante.');
  updateUI();

  let last = performance.now();
  let uiTimer = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    World.frame(dt);
    uiTimer += dt;
    if (uiTimer > 0.2) { uiTimer = 0; updateUI(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
