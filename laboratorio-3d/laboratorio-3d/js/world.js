/* Escena 3D del laboratorio: sala, mobiliario, vasos, bureta, mechero y efectos. Unidades: metros (perfiles de vidrio en cm, escala 0,01). */
(function (root) {
  'use strict';
  const T = THREE;
  const BENCH_Y = 0.94;
  const PROFILES = {
    beaker: { top: 9, r: () => 3.0 },
    tube: { top: 12, r: y => (y < 1.2 ? Math.sqrt(Math.max(0, 1.44 - (1.2 - y) ** 2)) : 1.2) },
    flask: { top: 14, r: y => (y <= 5 ? 4.5 : (y <= 9 ? 4.5 - 3 * (y - 5) / 4 : 1.5)) }
  };
  const BOTTLE_COLORS = {
    HCl: '#cfe9f7', NaOH: '#e9eef5', CuSO4: '#3c7fd6', FeCl3: '#e8b832', KSCN: '#dfe9f2',
    AgNO3: '#d8d8d8', NaCl: '#eef7fb', Na2CO3: '#eaf7ef', H2O: '#bfe3f5', PHE: '#f1c6dd', UNI: '#e8723a'
  };
  const SHELF_1 = ['HCl', 'NaOH', 'CuSO4', 'FeCl3', 'KSCN', 'AgNO3', 'NaCl'];
  const SHELF_2 = ['Na2CO3', 'PHE', 'UNI', 'Zn', 'H2O'];

  const PICK = [];
  const anims = [];
  const bubblePool = [];
  let scene, camera, renderer, floorPlane, sphereGeo, time = 0;
  const vessels = {};
  const bottles = {};
  const burette = {};
  const flame = {};
  let selectedDisc = null;

  function mat(color, extra) {
    return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, extra || {}));
  }

  function mark(obj, action) {
    obj.traverse(c => { if (c.isMesh) { c.userData.action = action; PICK.push(c); } });
  }

  function labelTexture(text, bg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = bg || '#f7f7f2'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#1b2430'; g.font = 'bold 44px IBM Plex Sans, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 80);
    const t = new T.CanvasTexture(c);
    return t;
  }

  function floorTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#cfd6d2'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#c4ccc7'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
    g.strokeStyle = '#aab4ae'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(7, 5);
    return t;
  }

  function buildRoom() {
    const floor = new T.Mesh(new T.PlaneGeometry(14, 10), mat(0xffffff, { map: floorTexture(), roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.floor = true;
    scene.add(floor);
    floorPlane = floor;

    const wallMat = mat(0xdfe7e1, { side: T.DoubleSide, roughness: 0.9 });
    const back = new T.Mesh(new T.PlaneGeometry(14, 3.6), wallMat);
    back.position.set(0, 1.8, -5); back.receiveShadow = true; scene.add(back);
    const front = new T.Mesh(new T.PlaneGeometry(14, 3.6), wallMat);
    front.position.set(0, 1.8, 5); front.rotation.y = Math.PI; scene.add(front);
    const left = new T.Mesh(new T.PlaneGeometry(10, 3.6), wallMat);
    left.position.set(-7, 1.8, 0); left.rotation.y = Math.PI / 2; left.receiveShadow = true; scene.add(left);
    const right = new T.Mesh(new T.PlaneGeometry(10, 3.6), wallMat);
    right.position.set(7, 1.8, 0); right.rotation.y = -Math.PI / 2; scene.add(right);
    const ceil = new T.Mesh(new T.PlaneGeometry(14, 10), mat(0xf6f8f7, { side: T.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.6; scene.add(ceil);

    // Zócalo oscuro en las paredes
    const base = mat(0x8fa39a);
    [[0, 0.1, -4.98, 14, 0.2, 0.02], [-6.98, 0.1, 0, 0.02, 0.2, 10], [6.98, 0.1, 0, 0.02, 0.2, 10]].forEach(([x, y, z, w, h, d]) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), base); m.position.set(x, y, z); scene.add(m);
    });

    // Ventana con luz de día en la pared izquierda
    const win = new T.Mesh(new T.PlaneGeometry(2.4, 1.6), new T.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0xbfe0ff, emissiveIntensity: 0.9 }));
    win.position.set(-6.97, 2.1, 1.5); win.rotation.y = Math.PI / 2; scene.add(win);

    // Lámparas de techo
    const lampMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
    [[-4, 0], [0, 0], [4, 0], [0, -3]].forEach(([x, z]) => {
      const lamp = new T.Mesh(new T.BoxGeometry(1.4, 0.04, 0.5), lampMat);
      lamp.position.set(x, 3.56, z); scene.add(lamp);
      const pl = new T.PointLight(0xfff6ea, 0.55, 12, 1.5);
      pl.position.set(x, 3.2, z); scene.add(pl);
    });

    // Mesada trasera con fregadero
    const cab = mat(0xf0f0ee);
    const resin = mat(0x1f2326, { roughness: 0.35 });
    const counter = new T.Mesh(new T.BoxGeometry(12, 0.9, 1.0), cab);
    counter.position.set(0, 0.45, -4.5); counter.castShadow = counter.receiveShadow = true; scene.add(counter);
    const top = new T.Mesh(new T.BoxGeometry(12, 0.04, 1.0), resin);
    top.position.set(0, BENCH_Y + 0.02, -4.5); top.receiveShadow = true; scene.add(top);
    const basin = new T.Mesh(new T.BoxGeometry(1.0, 0.02, 0.6), mat(0x2b3237, { metalness: 0.5 }));
    basin.position.set(4.2, BENCH_Y + 0.01, -4.5); scene.add(basin);

    // Mesa central
    const island = new T.Mesh(new T.BoxGeometry(7, 0.9, 1.2), cab);
    island.position.set(0, 0.45, 0); island.castShadow = island.receiveShadow = true; scene.add(island);
    const itop = new T.Mesh(new T.BoxGeometry(7.2, 0.04, 1.3), resin);
    itop.position.set(0, BENCH_Y + 0.02, 0); itop.receiveShadow = true; scene.add(itop);

    // Estantes con reactivos
    const shelfMat = mat(0xb9c4bf, { roughness: 0.4 });
    [1.44, 2.04].forEach(y => {
      const s = new T.Mesh(new T.BoxGeometry(12, 0.04, 0.4), shelfMat);
      s.position.set(0, y, -4.8); s.castShadow = true; scene.add(s);
    });

    // Taburetes frente a la mesa
    [-2.4, 0, 2.4].forEach(x => {
      const seat = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.06, 20), mat(0x2d6e6f));
      seat.position.set(x, 0.66, 1.4); seat.castShadow = true; scene.add(seat);
      const leg = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.62, 8), mat(0x6d7378, { metalness: 0.6 }));
      leg.position.set(x, 0.33, 1.4); scene.add(leg);
    });

    // Grifo
    const tap = new T.Group();
    const pipe = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.3, 10), mat(0xc8ced2, { metalness: 0.8, roughness: 0.25 }));
    pipe.position.set(4.2, BENCH_Y + 0.15, -4.85);
    const spout = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 0.25), pipe.material);
    spout.position.set(4.2, BENCH_Y + 0.28, -4.7);
    tap.add(pipe, spout);
    scene.add(tap);
    mark(tap, { kind: 'tap' });
  }

  function buildBottles() {
    const keys = SHELF_1.map((k, i) => [k, -4.8 + i * 1.6, 1.46]).concat(SHELF_2.map((k, i) => [k, -4.8 + i * 1.6, 2.06]));
    keys.forEach(([key, x, shelfTop]) => {
      const g = new T.Group();
      if (key === 'Zn') {
        const jar = new T.Mesh(new T.BoxGeometry(0.12, 0.16, 0.12), mat(0xc3c8cf, { metalness: 0.6, roughness: 0.3 }));
        jar.position.y = 0.08; jar.castShadow = true; g.add(jar);
      } else {
        const body = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.16, 20), mat(BOTTLE_COLORS[key], { transparent: true, opacity: 0.85, roughness: 0.2 }));
        body.position.y = 0.08; body.castShadow = true; g.add(body);
        const neck = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.04, 12), mat(0xdddddd));
        neck.position.y = 0.18; g.add(neck);
        const cap = new T.Mesh(new T.CylinderGeometry(0.019, 0.019, 0.03, 12), mat(0x1d1f22));
        cap.position.y = 0.215; g.add(cap);
      }
      const R = root.Chem.REAGENTS[key];
      const label = new T.Mesh(new T.PlaneGeometry(0.06, 0.04), new T.MeshStandardMaterial({ map: labelTexture(R.name), roughness: 0.7 }));
      label.position.set(0, 0.08, key === 'Zn' ? 0.061 : 0.041);
      g.add(label);
      g.position.set(x, shelfTop, -4.8);
      scene.add(g);
      mark(g, { kind: 'bottle', key });
      bottles[key] = g;
    });
  }

  function buildSink() {
    // Nada extra: el grifo y la pila ya están construidos en buildRoom.
  }

  function liquidPts(p, h) {
    const pts = [new T.Vector2(0, 0)];
    for (let y = 0; y < h; y += 0.2) pts.push(new T.Vector2(Math.max(0.01, p.r(y) - 0.05), y));
    pts.push(new T.Vector2(Math.max(0.01, p.r(h) - 0.05), h));
    pts.push(new T.Vector2(0, h));
    return pts;
  }

  function glassPts(p) {
    const pts = [];
    for (let y = 0; y <= p.top; y += 0.5) pts.push(new T.Vector2(p.r(y) + 0.12, y));
    pts.push(new T.Vector2(p.r(p.top) + 0.12, p.top));
    return pts;
  }

  function volumeTable(p) {
    const ys = [0], vs = [0];
    let v = 0;
    for (let y = 0; y < p.top; y += 0.05) {
      const r = p.r(y + 0.025);
      v += Math.PI * r * r * 0.05;
      ys.push(y + 0.05); vs.push(v);
    }
    return { ys, vs, max: v };
  }

  function heightFor(tb, vol) {
    if (vol <= 0) return 0;
    if (vol >= tb.max) return tb.ys[tb.ys.length - 1];
    let lo = 0, hi = tb.vs.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (tb.vs[m] < vol) lo = m; else hi = m;
    }
    const t = (vol - tb.vs[lo]) / (tb.vs[hi] - tb.vs[lo]);
    return tb.ys[lo] + (tb.ys[hi] - tb.ys[lo]) * t;
  }

  function makeVessel(id, type, x, lift, action) {
    const p = PROFILES[type];
    const group = new T.Group();
    group.position.set(x, BENCH_Y + lift, 0);
    group.scale.setScalar(0.01);
    const glass = new T.Mesh(new T.LatheGeometry(glassPts(p), 24), new T.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, side: T.DoubleSide, depthWrite: false
    }));
    const liquid = new T.Mesh(new T.LatheGeometry(liquidPts(p, 0.1), 24), new T.MeshStandardMaterial({
      color: 0xe9f6ff, transparent: true, opacity: 0.6, roughness: 0.1, side: T.DoubleSide
    }));
    liquid.visible = false;
    const sed = new T.Group();
    const disc = new T.Mesh(new T.CircleGeometry(7, 32), new T.MeshBasicMaterial({ color: 0x3ea8ff, transparent: true, opacity: 0.5, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; disc.visible = false;
    group.add(glass, liquid, sed, disc);
    scene.add(group);
    mark(group, action);
    const V = { id, type, p, tb: volumeTable(p), group, liquid, sed, disc, lift, h: 0, solidKey: '', topY: p.top };
    vessels[id] = V;
    return V;
  }

  function buildVessels() {
    makeVessel('v1', 'beaker', -2.4, 0, { kind: 'vessel', id: 'v1' });
    makeVessel('v2', 'flask', -0.8, 0, { kind: 'vessel', id: 'v2' });
    makeVessel('v3', 'tube', 0.8, 0, { kind: 'vessel', id: 'v3' });
    makeVessel('v4', 'beaker', 2.4, 0.1, { kind: 'vessel', id: 'v4' });
  }

  function buildBurner() {
    const g = new T.Group();
    g.position.set(2.4, BENCH_Y, 0);
    const base = new T.Mesh(new T.CylinderGeometry(0.06, 0.065, 0.03, 20), mat(0x3a3f44, { metalness: 0.5 }));
    base.position.y = 0.015;
    const body = new T.Mesh(new T.CylinderGeometry(0.02, 0.025, 0.07, 16), mat(0x9aa3aa, { metalness: 0.7, roughness: 0.3 }));
    body.position.y = 0.065;
    const fl = new T.Mesh(new T.ConeGeometry(0.018, 0.06, 12), new T.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85 }));
    fl.position.y = 0.1; fl.visible = false;
    g.add(base, body, fl);
    scene.add(g);
    mark(g, { kind: 'burner' });
    flame.mesh = fl;
  }

  function buildBurette() {
    const g = new T.Group();
    g.position.set(-0.8, 0, 0);
    const rod = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1.6, 10), mat(0x6d7378, { metalness: 0.7 }));
    rod.position.set(0, BENCH_Y + 0.8, -0.5);
    const foot = new T.Mesh(new T.BoxGeometry(0.3, 0.02, 0.3), rod.material);
    foot.position.set(0, BENCH_Y + 0.01, -0.5);
    const arm = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 0.5), rod.material);
    arm.position.set(0, 1.75, -0.25);
    const tube = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.6, 16), new T.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false
    }));
    tube.position.set(0, 1.75, 0);
    const liquid = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.6, 16), mat(0x9fd3f0, { transparent: true, opacity: 0.7 }));
    liquid.geometry.translate(0, 0.3, 0);
    liquid.position.set(0, 1.45, 0);
    const tip = new T.Mesh(new T.CylinderGeometry(0.004, 0.003, 0.04, 8), mat(0x6d7378));
    tip.position.set(0, 1.43, 0);
    g.add(rod, foot, arm, tube, liquid, tip);
    scene.add(g);
    mark(tube, { kind: 'burette' });
    mark(liquid, { kind: 'burette' });
    mark(tip, { kind: 'burette' });
    burette.liquid = liquid;
    burette.tipWorld = new T.Vector3(-0.8, 1.43, 0);
  }

  function disposeObj(o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  }

  function bubbleAt(V, dx, dz, dy, color) {
    const p = bubblePool.find(b => b.life <= 0);
    if (!p) return;
    const pos = V.group.localToWorld(new T.Vector3(dx, dy, dz));
    p.m.position.copy(pos);
    p.m.material.color.set(color || 0xdff3ff);
    p.m.visible = true;
    p.life = 1.2 + Math.random() * 1.2;
    p.vy = 0.12 + Math.random() * 0.15;
  }

  function line(a, b, color, dur, kind) {
    const len = a.distanceTo(b);
    const m = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 1, 6), new T.MeshStandardMaterial({ color, transparent: true, opacity: 0.85 }));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.scale.set(1, Math.max(len, 0.001), 1);
    scene.add(m);
    anims.push({ m, t: 0, dur, kind, a, b });
  }

  function finishAnim(an) {
    scene.remove(an.m);
    disposeObj(an.m);
  }

  function fallingDrop(V, color) {
    const start = burette.tipWorld.clone();
    const surfaceY = V.group.position.y + V.h * 0.01;
    const end = new T.Vector3(V.group.position.x, surfaceY, 0);
    const m = new T.Mesh(sphereGeo, new T.MeshStandardMaterial({ color: color || 0x9fd3f0, transparent: true, opacity: 0.9 }));
    m.scale.setScalar(1.6);
    m.position.copy(start);
    scene.add(m);
    anims.push({ m, t: 0, dur: 0.28, kind: 'drop', a: start, b: end, color: color || 0x9fd3f0 });
  }

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color(0x0e1518);
    scene.fog = new T.Fog(0x0e1518, 12, 26);
    camera = new T.PerspectiveCamera(60, 1, 0.05, 50);
    camera.position.set(0, 1.6, 4.2);
    camera.rotation.order = 'YXZ';

    scene.add(new T.HemisphereLight(0xffffff, 0x556070, 0.6));
    const sun = new T.DirectionalLight(0xfff5e6, 0.7);
    sun.position.set(-3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, far: 20 });
    scene.add(sun);

    sphereGeo = new T.SphereGeometry(0.004, 8, 8);
    for (let i = 0; i < 160; i++) {
      const m = new T.Mesh(sphereGeo, new T.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.6 }));
      m.visible = false;
      scene.add(m);
      bubblePool.push({ m, life: 0, vy: 0 });
    }

    buildRoom();
    buildBottles();
    buildVessels();
    buildBurner();
    buildBurette();
    buildSink();
    scene.traverse(o => { if (o.isMesh && !o.userData.floor) o.receiveShadow = true; });
  }

  function refresh(id, state) {
    const V = vessels[id];
    const h = heightFor(V.tb, state.vol);
    const color = root.Chem.color(state);
    if (Math.abs(h - V.h) > 0.01 || V.liquid.visible !== h > 0.05) {
      V.h = h;
      V.liquid.geometry.dispose();
      V.liquid.geometry = new T.LatheGeometry(liquidPts(V.p, Math.max(h, 0.1)), 24);
      V.liquid.visible = h > 0.05;
    }
    V.liquid.material.color.setRGB(color.rgb[0], color.rgb[1], color.rgb[2]);
    const sols = root.Chem.solids(state);
    const key = sols.map(s => s.id + Math.round(s.mmol * 100)).join('|');
    if (key !== V.solidKey) {
      V.solidKey = key;
      V.sed.children.slice().forEach(c => { V.sed.remove(c); disposeObj(c); });
      let y = 0;
      sols.forEach(s => {
        const hh = Math.min(0.8, s.mmol * 0.2);
        if (hh < 0.02) return;
        const r = Math.max(0.3, V.p.r(y + 0.1) - 0.2);
        const pts = [new T.Vector2(0, y), new T.Vector2(r, y), new T.Vector2(r, y + hh), new T.Vector2(0, y + hh)];
        V.sed.add(new T.Mesh(new T.LatheGeometry(pts, 20), mat(s.color, { roughness: 0.9 })));
        y += hh;
      });
    }
  }

  function select(id) {
    Object.values(vessels).forEach(V => { V.disc.visible = false; });
    if (id && vessels[id]) vessels[id].disc.visible = true;
  }

  function setBurner(on) {
    flame.on = on;
    flame.mesh.visible = on;
  }

  function setBurette(ml) {
    burette.liquid.scale.y = Math.max(0.001, ml / 50);
    burette.liquid.visible = ml > 0.001;
  }

  function stream(key, id) {
    const b = bottles[key];
    const V = vessels[id];
    if (!b || !V) return;
    const from = b.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 0.18, 0));
    const to = V.group.localToWorld(new T.Vector3(0, V.topY, 0));
    const col = key === 'H2O' ? 0xbfe3f5 : (BOTTLE_COLORS[key] ? new T.Color(BOTTLE_COLORS[key]).getHex() : 0xffffff);
    line(from, to, col, 0.4, 'fade');
  }

  function drip(id, color) {
    const V = vessels[id];
    if (!V) return;
    fallingDrop(V, color);
  }

  function emitBubbles(id, n, color) {
    const V = vessels[id];
    if (!V) return;
    for (let i = 0; i < n; i++) {
      bubbleAt(V, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0.2 + Math.random() * 0.6 * V.h * 0.01 / 0.01, color);
    }
  }

  function pick(ndc) {
    const ray = new T.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(PICK, false);
    if (!hits.length) return null;
    const h = hits[0];
    if (h.distance > 4) return { action: null, point: h.point, far: true };
    return { action: h.object.userData.action || null, point: h.point };
  }

  function floorPoint(ndc) {
    const ray = new T.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hit = new T.Vector3();
    const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return hit;
  }

  function vesselPos(id) {
    const V = vessels[id];
    return V ? new T.Vector3(V.group.position.x, BENCH_Y, 0) : null;
  }

  function frame(dt) {
    time += dt;
    for (let i = anims.length - 1; i >= 0; i--) {
      const an = anims[i];
      an.t += dt;
      const k = Math.min(1, an.t / an.dur);
      if (an.kind === 'fade') {
        an.m.material.opacity = 0.85 * (1 - k);
      } else if (an.kind === 'drop') {
        an.m.position.lerpVectors(an.a, an.b, k * k);
      }
      if (k >= 1) {
        if (an.kind === 'drop') {
          const target = Object.values(vessels).find(V => Math.abs(V.group.position.x - an.b.x) < 0.01);
          if (target) emitBubbles(target.id, 2, 0xdff3ff);
        }
        finishAnim(an);
        anims.splice(i, 1);
      }
    }
    for (const b of bubblePool) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.m.position.y += b.vy * dt;
      if (b.life <= 0) b.m.visible = false;
    }
    if (flame.on) flame.mesh.scale.y = 1 + 0.12 * Math.sin(time * 22);
    if (selectedDisc) selectedDisc.visible = true;
    renderer.render(scene, camera);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  root.World = {
    init, refresh, select, setBurner, setBurette, stream, drip, emitBubbles,
    pick, floorPoint, vesselPos, frame, resize,
    get camera() { return camera; },
    vessels
  };
})(typeof window !== 'undefined' ? window : globalThis);
