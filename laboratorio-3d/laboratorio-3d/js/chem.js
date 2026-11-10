/* Modelo químico simplificado: neutralización, precipitación, gases,
   complejos, pH y color. Cantidades en mmol y volúmenes en mL. */
(function (root) {
  'use strict';
  const EPS = 1e-9;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  const REAGENTS = {
    HCl:    { name: 'HCl 0,1 M', full: 'Ácido clorhídrico 0,1 M', kind: 'liquid', add: { H: 0.1, Cl: 0.1 } },
    NaOH:   { name: 'NaOH 0,1 M', full: 'Hidróxido de sodio 0,1 M', kind: 'liquid', add: { OH: 0.1 } },
    CuSO4:  { name: 'CuSO₄ 0,1 M', full: 'Sulfato de cobre(II) 0,1 M', kind: 'liquid', add: { Cu: 0.1 } },
    FeCl3:  { name: 'FeCl₃ 0,1 M', full: 'Cloruro de hierro(III) 0,1 M', kind: 'liquid', add: { Fe: 0.1, Cl: 0.3 } },
    KSCN:   { name: 'KSCN 0,1 M', full: 'Tiocianato de potasio 0,1 M', kind: 'liquid', add: { SCN: 0.1 } },
    AgNO3:  { name: 'AgNO₃ 0,1 M', full: 'Nitrato de plata 0,1 M', kind: 'liquid', add: { Ag: 0.1 } },
    NaCl:   { name: 'NaCl 0,1 M', full: 'Cloruro de sodio 0,1 M', kind: 'liquid', add: { Cl: 0.1 } },
    Na2CO3: { name: 'Na₂CO₃ 0,1 M', full: 'Carbonato de sodio 0,1 M', kind: 'liquid', add: { CO3: 0.1 } },
    H2O:    { name: 'Agua destilada', full: 'Agua destilada', kind: 'liquid', add: {} },
    PHE:    { name: 'Fenolftaleína', full: 'Fenolftaleína (0,5 mL)', kind: 'indicator', flag: 'PHE' },
    UNI:    { name: 'Indicador universal', full: 'Indicador universal (0,5 mL)', kind: 'indicator', flag: 'UNI' },
    Zn:     { name: 'Zinc', full: 'Zinc en granalla (0,5 mmol por clic)', kind: 'solid', add: { Zn: 0.5 } }
  };

  const SOLID_INFO = {
    Zn:   { name: 'Zinc metálico', color: '#c3c8cf' },
    CuOH: { name: 'Cu(OH)₂ azul', color: '#7fb2ea' },
    AgCl: { name: 'AgCl blanco', color: '#f2f2ee' },
    FeOH: { name: 'Fe(OH)₃ pardo', color: '#a4552c' }
  };

  const UNI_STOPS = [
    [0, '#e0282c'], [2, '#f0591e'], [4, '#f6b52b'], [6, '#e6e04a'],
    [7, '#3fbf5a'], [8, '#2bb7a8'], [10, '#2f6fd6'], [12, '#5a33b8'], [14, '#4a1b7a']
  ];

  function hexToRgb(h) {
    return [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255);
  }

  function uniRgb(p) {
    for (let i = 0; i < UNI_STOPS.length - 1; i++) {
      const [p0, c0] = UNI_STOPS[i];
      const [p1, c1] = UNI_STOPS[i + 1];
      if (p <= p1) {
        const t = (p - p0) / (p1 - p0);
        const a = hexToRgb(c0), b = hexToRgb(c1);
        return a.map((x, k) => x + (b[k] - x) * t);
      }
    }
    return hexToRgb(UNI_STOPS[UNI_STOPS.length - 1][1]);
  }

  function rgbToHex(c) {
    return '#' + c.map(x => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  }

  function newVessel() {
    return {
      vol: 0, H: 0, OH: 0, Cl: 0, Cu: 0, Fe: 0, SCN: 0, Ag: 0, CO3: 0,
      Zn: 0, Zn2: 0, FeSCN: 0, CuOH: 0, FeOH: 0, AgCl: 0, UNI: 0, PHE: 0,
      temp: 22, gas: { H2: 0, CO2: 0 }
    };
  }

  function pour(v, key, ml) {
    const R = REAGENTS[key];
    if (!R) return;
    if (R.kind === 'solid') { v.Zn += R.add.Zn; return; }
    if (R.kind === 'indicator') { v[R.flag] = 1; v.vol += 0.5; return; }
    for (const s in R.add) v[s] += R.add[s] * ml;
    v.vol += ml;
  }

  function clean(v) {
    for (const k in v) {
      if (typeof v[k] === 'number' && Math.abs(v[k]) < EPS) v[k] = 0;
    }
    for (const g in v.gas) if (Math.abs(v.gas[g]) < EPS) v.gas[g] = 0;
  }

  // Reacciones en orden de prioridad. Devuelve eventos para la interfaz y el 3D.
  function react(v) {
    const ev = [];
    let x;

    x = Math.min(v.H, v.OH);
    if (x > EPS) {
      v.H -= x; v.OH -= x;
      const dT = x * 1.2;
      v.temp += dT;
      ev.push({ t: 'neutral', mmol: x, dT });
    }

    x = Math.min(v.CO3, v.H / 2);
    if (x > EPS) {
      v.CO3 -= x; v.H -= 2 * x; v.gas.CO2 += x;
      ev.push({ t: 'gas', gas: 'CO2', mmol: x });
    }

    x = Math.min(v.Zn, v.H / 2);
    if (x > EPS) {
      v.Zn -= x; v.H -= 2 * x; v.Zn2 += x; v.gas.H2 += x;
      ev.push({ t: 'gas', gas: 'H2', mmol: x });
    }

    x = Math.min(v.Ag, v.Cl);
    if (x > EPS) {
      v.Ag -= x; v.Cl -= x; v.AgCl += x;
      ev.push({ t: 'precip', sub: 'AgCl', mmol: x });
    }

    x = Math.min(v.Cu, v.OH / 2);
    if (x > EPS) {
      v.Cu -= x; v.OH -= 2 * x; v.CuOH += x;
      ev.push({ t: 'precip', sub: 'CuOH', mmol: x });
    }

    x = Math.min(v.Fe, v.OH / 3);
    if (x > EPS) {
      v.Fe -= x; v.OH -= 3 * x; v.FeOH += x;
      ev.push({ t: 'precip', sub: 'FeOH', mmol: x });
    }

    x = Math.min(v.Fe, v.SCN);
    if (x > EPS) {
      v.Fe -= x; v.SCN -= x; v.FeSCN += x;
      ev.push({ t: 'complex', mmol: x });
    }

    clean(v);
    return ev;
  }

  // Calentamiento con mechero (on) o enfriamiento lento hacia 22 °C.
  function heat(v, dt, on) {
    if (on && v.vol > 0) v.temp = Math.min(100, v.temp + 14 * dt);
    else v.temp = Math.max(22, v.temp - 0.6 * dt);
  }

  // pH aproximado para ácidos y bases fuertes (modelo simplificado).
  function pH(v) {
    if (v.vol <= EPS) return null;
    const net = v.H - v.OH;
    if (Math.abs(net) < 1e-7) return 7;
    const c = Math.abs(net) / v.vol;
    const p = net > 0 ? -Math.log10(c) : 14 + Math.log10(c);
    return clamp(p, 0, 14);
  }

  function color(v) {
    const p = pH(v);
    const c = (v.UNI && p !== null) ? uniRgb(p) : [1, 1, 1];
    const conc = (n) => n / Math.max(v.vol, EPS);
    const tint = (tc, f) => { for (let i = 0; i < 3; i++) c[i] *= 1 - (1 - tc[i]) * f; };
    tint([0.35, 0.62, 1.0], 1 - Math.exp(-conc(v.Cu) / 0.02));
    tint([0.95, 0.75, 0.25], 1 - Math.exp(-conc(v.Fe) / 0.02));
    tint([1.0, 0.22, 0.16], 1 - Math.exp(-conc(v.FeSCN) / 0.004));
    if (!v.UNI && v.PHE && p !== null) {
      tint([1.0, 0.45, 0.78], clamp((p - 8.2) / 1.2, 0, 1));
    }
    return { hex: rgbToHex(c), rgb: c, pH: p };
  }

  function solids(v) {
    return [
      { id: 'Zn', mmol: v.Zn },
      { id: 'CuOH', mmol: v.CuOH },
      { id: 'AgCl', mmol: v.AgCl },
      { id: 'FeOH', mmol: v.FeOH }
    ].filter(s => s.mmol > EPS).map(s => ({ id: s.id, mmol: s.mmol, name: SOLID_INFO[s.id].name, color: SOLID_INFO[s.id].color }));
  }

  function messagesFor(events) {
    const out = [];
    for (const e of events) {
      if (e.t === 'neutral') out.push('Neutralización ácido-base: +' + e.dT.toFixed(1) + ' °C');
      else if (e.t === 'gas') out.push('Desprendimiento de ' + (e.gas === 'H2' ? 'H₂' : 'CO₂') + ' (gas)');
      else if (e.t === 'precip') out.push('Se forma precipitado: ' + SOLID_INFO[e.sub].name);
      else if (e.t === 'complex') out.push('Complejo rojo sangre [Fe(SCN)]²⁺ formado');
    }
    return out;
  }

  root.Chem = { REAGENTS, SOLID_INFO, newVessel, pour, react, heat, pH, color, solids, messagesFor };
})(typeof window !== 'undefined' ? window : globalThis);
