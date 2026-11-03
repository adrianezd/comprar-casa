// Comprar casa: gastos de la compra e hipoteca fija, variable o mixta con el euríbor del día (euribor.json).
var INF = Infinity;

// Tipos generales 2026. itp: tramos [hasta, %] que se aplican por escala, o una función.
var CCAA = [
  { n: 'Andalucía', itp: [[INF, 7]], ajd: 1.2 },
  { n: 'Aragón', itp: [[400000, 8], [450000, 8.5], [500000, 9], [750000, 9.5], [INF, 10]], ajd: 1.5 },
  { n: 'Asturias', itp: [[300000, 8], [500000, 9], [INF, 10]], ajd: 1.2 },
  { n: 'Illes Balears', itp: [[400000, 8], [600000, 9], [1000000, 10], [2000000, 12], [INF, 13]], ajd: 1.5 },
  { n: 'Canarias', itp: [[INF, 6.5]], ajd: 0.75, iva: 7, ivaEtq: 'IGIC' },
  { n: 'Cantabria', itp: [[INF, 9]], ajd: 1.5 },
  { n: 'Castilla y León', itp: [[250000, 8], [INF, 10]], ajd: 1.5 },
  { n: 'Castilla-La Mancha', itp: [[INF, 9]], ajd: 1.5 },
  { n: 'Cataluña', itp: [[600000, 10], [900000, 11], [1500000, 12], [INF, 13]], ajd: 1.5 },
  { n: 'Comunitat Valenciana', itp: function (p) { return p * (p > 1000000 ? 0.11 : 0.09); }, ajd: 1.4 },
  { n: 'Extremadura', itp: [[360000, 8], [600000, 10], [INF, 11]], ajd: 1.5 },
  { n: 'Galicia', itp: [[INF, 8]], ajd: 1.5 },
  { n: 'Comunidad de Madrid', itp: [[INF, 6]], ajd: 0.75 },
  { n: 'Región de Murcia', itp: [[INF, 7.75]], ajd: 1.5 },
  { n: 'Navarra', itp: [[INF, 6]], ajd: 0.5 },
  { n: 'País Vasco', itp: [[INF, 4]], ajd: 0 },
  { n: 'La Rioja', itp: [[INF, 7]], ajd: 1 },
  { n: 'Ceuta', itp: [[INF, 3]], ajd: 0.25, iva: 4, ivaEtq: 'IPSI' },
  { n: 'Melilla', itp: [[INF, 3]], ajd: 0.25, iva: 4, ivaEtq: 'IPSI' }
];

// Por si no carga euribor.json.
var EUR = { diario: [{ fecha: '2026-10-30', valor: 3.306 }], mensual: [{ mes: '2026-10', valor: 3.239 }] };

var S = { estado: 'segunda', tipo: 'fijo', tendencia: 'igual', reducir: 'plazo', vista: 'anios' };
var CLAVE = 'comprar-casa-v1';
var COLORES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)', 'var(--muted)'];
var TIPOS = { fijo: 'Fijo', variable: 'Variable', mixto: 'Mixto' };

function $(id) { return document.getElementById(id); }
function v(id) { var x = parseFloat(String($(id).value).replace(',', '.')); return isFinite(x) ? x : 0; }
function num(x, d) { return (+x || 0).toLocaleString('es-ES', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0, useGrouping: 'always' }); }
function eur(x) { return num(Math.round(x)) + ' €'; }
function pct(x, d) { return num(x, d == null ? 2 : d) + ' %'; }
function redondea(x, a) { return Math.round(x / a) * a; }
function fechaCorta(iso) {
  var p = iso.split('-');
  return +p[2] + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+p[1] - 1];
}
function mesLargo(ym) {
  var p = ym.split('-');
  return ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][+p[1] - 1] + ' de ' + p[0];
}
function eurHoy() { var d = EUR.diario; return d && d.length ? d[d.length - 1] : { fecha: EUR.mensual[EUR.mensual.length - 1].mes + '-15', valor: EUR.mensual[EUR.mensual.length - 1].valor }; }

// Ancho real de la gráfica, para que los textos no encojan en el móvil.
function ancho(id) { return Math.max(280, Math.round($(id).getBoundingClientRect().width) || 700); }

// Valor del campo, o la estimación si está vacío (la estimación se muestra como pista).
function auto(id, est) {
  var el = $(id);
  el.placeholder = 'Auto ' + num(est);
  return el.value === '' ? est : v(id);
}

function ccaa() { return CCAA[+$('ccaa').value] || CCAA[0]; }
function itp(c, p) {
  if (typeof c.itp === 'function') return c.itp(p);
  var prev = 0, t = 0;
  c.itp.forEach(function (tr) { if (p > prev) t += (Math.min(p, tr[0]) - prev) * tr[1] / 100; prev = tr[0]; });
  return t;
}

// ---------- Hipoteca ----------
function frances(D, i, n) { if (n <= 0) return D; return i ? D * i / (1 - Math.pow(1 + i, -n)) : D / n; }
function nper(D, i, C) {
  if (D <= 0) return 0;
  if (!i) return Math.ceil(D / C);
  var x = 1 - D * i / C;
  return x <= 0 ? 9999 : Math.ceil(-Math.log(x) / Math.log(1 + i));
}
function euriborAnio(o, k) {
  if (S.tendencia === 'sube') return o.eur + Math.min(2.5, 0.15 * k);
  if (S.tendencia === 'baja') return o.eur - Math.min(2.5, 0.15 * k);
  return o.eur;
}
function tasa(o, tipo, m, shift) {
  var y = Math.floor(m / 12);
  if (tipo === 'fijo') return o.tinFijo;
  if (tipo === 'variable') return y < 1 ? o.tinInicial : Math.max(0, euriborAnio(o, y - 1) + shift + o.dif);
  return y < o.aniosMixto ? o.tinMixto : Math.max(0, euriborAnio(o, y - o.aniosMixto) + shift + o.dif);
}
function sim(o, tipo, shift, deudaInicial, sinExtra) {
  shift = shift || 0;
  var deuda = deudaInicial == null ? o.deuda : deudaInicial, n = o.plazo * 12, rest = n;
  var cuota = 0, prev = null, anios = [], filas = [], r = { int: 0, pag: 0, extra: 0, meses: 0, anios: anios, filas: filas };
  var extra = sinExtra ? 0 : o.extra;
  for (var m = 0; m < n && deuda > 0.005; m++) {
    var y = Math.floor(m / 12), t = tasa(o, tipo, m, shift), i = t / 1200;
    if (t !== prev) { cuota = frances(deuda, i, rest); prev = t; }
    var a = anios[y] || (anios[y] = { anio: y + 1, cuota: cuota, tasa: t, int: 0, cap: 0, extra: 0, deuda: 0, n: 0 });
    var inte = deuda * i, cap = Math.min(deuda, cuota - inte);
    deuda -= cap; rest--;
    a.int += inte; a.cap += cap; a.n++; r.int += inte; r.pag += inte + cap; r.meses++;
    var fila = { mes: m + 1, tasa: t, cuota: inte + cap, int: inte, cap: cap, extra: 0, deuda: 0 };
    filas.push(fila);
    if ((m + 1) % 12 === 0 && extra > 0 && deuda > 0.005) {
      var e = Math.min(extra, deuda);
      deuda -= e; a.extra += e; r.extra += e; r.pag += e; fila.extra = e;
      if (S.reducir === 'cuota') cuota = frances(deuda, i, rest);
      else rest = Math.min(rest, nper(deuda, i, cuota));
    }
    a.deuda = fila.deuda = Math.max(0, deuda);
  }
  r.cuota0 = anios.length ? anios[0].cuota : 0;
  var revision = tipo === 'variable' ? 1 : tipo === 'mixto' ? o.aniosMixto : -1;
  r.cuotaRev = revision > 0 && anios[revision] ? anios[revision].cuota : null;
  r.cuotaMax = anios.reduce(function (mx, a) { return Math.max(mx, a.cuota); }, 0);
  return r;
}

// ---------- Datos del formulario ----------
function leer() {
  var precio = Math.max(0, v('precio'));
  var entradaPct = Math.max(0, Math.min(100, v('entrada')));
  var entrada = precio * entradaPct / 100;
  return {
    precio: precio, entradaPct: entradaPct, entrada: entrada, deuda: precio - entrada,
    plazo: Math.max(1, Math.min(40, Math.round(v('plazo')) || 30)),
    tinFijo: v('tinFijo'), tinInicial: v('tinInicial'), tinMixto: v('tinMixto'),
    aniosMixto: Math.max(1, Math.round(v('aniosMixto')) || 1), dif: v('diferencial'),
    eur: $('eurFuturo').value === '' ? eurHoy().valor : v('eurFuturo'),
    segVida: v('segVida'), segHogar: v('segHogar'), apertura: v('apertura'), extra: Math.max(0, v('extra')),
    comunidad: v('comunidad'), ingresos: v('ingresos'), ahorros: v('ahorros')
  };
}

function gastos(o, precio, entradaPct, manual) {
  var c = ccaa(), hipoteca = entradaPct < 100, lista = [];
  var f = manual ? auto : function (id, est) { return est; };
  var deuda = precio * (1 - entradaPct / 100);
  if (S.estado === 'segunda') {
    lista.push({ k: 'ITP', v: f('impuesto', Math.round(itp(c, precio))) });
  } else {
    lista.push({ k: c.ivaEtq || 'IVA', v: f('impuesto', Math.round(precio * (c.iva || 10) / 100)) });
    lista.push({ k: 'AJD', v: f('ajd', Math.round(precio * c.ajd / 100)) });
  }
  lista.push({ k: 'Notaría', v: f('notaria', redondea(Math.min(1500, 450 + precio * 0.0015), 10)) });
  lista.push({ k: 'Registro', v: f('registro', redondea(Math.min(1100, 200 + precio * 0.0012), 10)) });
  lista.push({ k: 'Gestoría', v: f('gestoria', hipoteca ? 0 : 350) });
  lista.push({ k: 'Tasación', v: f('tasacion', hipoteca ? 400 : 0) });
  if (o.apertura > 0 && hipoteca) lista.push({ k: 'Comisión de apertura', v: deuda * o.apertura / 100 });
  if (manual) {
    lista.push({ k: 'Agencia', v: v('agencia') });
    lista.push({ k: 'Reforma y muebles', v: v('reforma') });
  }
  return lista.filter(function (g) { return g.v > 0; });
}
function suma(l) { return l.reduce(function (s, g) { return s + g.v; }, 0); }

// Precio máximo: la entrada del 20 % y los gastos caben en los ahorros, y la cuota más alta no pasa del 35 % de los ingresos.
function maximo(o, tipo) {
  function busca(ok) {
    var lo = 0, hi = 5000000;
    if (!ok(1000)) return 0;
    for (var k = 0; k < 40; k++) { var mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
    return lo;
  }
  var porAhorro = busca(function (p) { return o.ahorros >= p * 0.2 + suma(gastos(o, p, 20, false)); });
  var porSueldo = o.ingresos > 0 ? busca(function (p) { return sim(o, tipo, 0, p * 0.8, true).cuotaMax <= o.ingresos * 0.35; }) : 0;
  return { ahorro: porAhorro, sueldo: porSueldo, max: Math.min(porAhorro, porSueldo) };
}

// ---------- Pintar ----------
function pintarEuribor() {
  var hoy = eurHoy(), mens = EUR.mensual, ult = mens[mens.length - 1];
  $('eurHoy').textContent = pct(hoy.valor, 3);
  $('eurHoyFecha').textContent = EUR.diario && EUR.diario.length ? 'el ' + fechaCorta(hoy.fecha) : '';
  $('eurMedia').textContent = 'Media de ' + mesLargo(ult.mes) + ': ' + pct(ult.valor, 3) + '. Es la que usan las hipotecas al revisarse.';
  var hace = mens.length > 12 ? mens[mens.length - 13] : null;
  if (hace) {
    var dif = ult.valor - hace.valor;
    $('eurVar').innerHTML = 'Hace un año<b>' + pct(hace.valor, 3) + '</b>' + (dif >= 0 ? '+' : '−') + num(Math.abs(dif), 2) + ' puntos';
  }
  if ($('eurFuturo').value === '') $('eurFuturo').placeholder = num(hoy.valor, 3);

  var W = ancho('eurGrafica'), H = W < 500 ? 120 : 140, pl = 34, pr = 10, pt = 10, pb = 22;
  $('eurGrafica').setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  var vals = mens.map(function (m) { return m.valor; }).concat([hoy.valor]);
  var mn = Math.floor(Math.min.apply(null, vals) * 2) / 2, mx = Math.ceil(Math.max.apply(null, vals) * 2) / 2;
  if (mx - mn < 1) mx = mn + 1;
  var nPts = mens.length;
  var x = function (k) { return pl + k / Math.max(1, nPts) * (W - pl - pr); };
  var y = function (val) { return pt + (mx - val) / (mx - mn) * (H - pt - pb); };
  var svg = '';
  var pasoEje = mx - mn > 3 ? 1 : 0.5;
  for (var g = mn; g <= mx + 1e-9; g += pasoEje) {
    svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="currentColor" opacity=".1"/>' +
      '<text x="' + (pl - 6) + '" y="' + (y(g) + 4) + '" font-size="11" text-anchor="end" fill="currentColor" opacity=".55">' + num(g, g % 1 ? 1 : 0) + '</text>';
  }
  mens.forEach(function (m, k) {
    if (m.mes.slice(5) === '01') svg += '<text x="' + x(k) + '" y="' + (H - 6) + '" font-size="11" text-anchor="middle" fill="currentColor" opacity=".55">' + m.mes.slice(0, 4) + '</text>';
  });
  var pts = mens.map(function (m, k) { return x(k).toFixed(1) + ',' + y(m.valor).toFixed(1); });
  pts.push(x(nPts).toFixed(1) + ',' + y(hoy.valor).toFixed(1));
  svg += '<polygon fill="var(--accent)" opacity=".12" points="' + x(0) + ',' + y(mn) + ' ' + pts.join(' ') + ' ' + x(nPts) + ',' + y(mn) + '"/>';
  svg += '<polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="' + pts.join(' ') + '"/>';
  svg += '<circle cx="' + x(nPts) + '" cy="' + y(hoy.valor) + '" r="4.5" fill="var(--accent)"><title>Hoy: ' + pct(hoy.valor, 3) + '</title></circle>';
  $('eurGrafica').innerHTML = svg;
}

function visibles() {
  document.querySelectorAll('[data-tipo]').forEach(function (el) { el.hidden = el.getAttribute('data-tipo').split(' ').indexOf(S.tipo) < 0; });
  document.querySelectorAll('[data-estado]').forEach(function (el) { el.hidden = el.getAttribute('data-estado') !== S.estado; });
}

function pintar() {
  visibles();
  var o = leer(), c = ccaa();
  var hayHip = o.deuda > 0;
  $('entradaEur').textContent = eur(o.entrada) + (hayHip ? ', hipoteca de ' + eur(o.deuda) : ', sin hipoteca');

  // Gastos
  var g = gastos(o, o.precio, o.entradaPct, true);
  if (S.estado === 'segunda') {
    $('impEtq').textContent = 'ITP, €';
    var cuotaItp = itp(c, o.precio);
    $('impTxt').textContent = 'Tipo en ' + c.n + ': ' + pct(o.precio ? cuotaItp / o.precio * 100 : 0, 2);
  } else {
    $('impEtq').textContent = (c.ivaEtq || 'IVA') + ', €';
    $('impTxt').textContent = pct(c.iva || 10, 0) + ' del precio. AJD en ' + c.n + ': ' + pct(c.ajd, 2);
  }
  var gastosTot = suma(g), necesitas = o.entrada + gastosTot;
  $('firma').textContent = eur(necesitas);
  var falta = necesitas - o.ahorros;
  var gastosSinReforma = suma(g.filter(function (x) { return x.k !== 'Reforma y muebles'; }));
  $('firmaTxt').innerHTML = 'entrada, impuestos y gastos. Los impuestos y gastos son el ' + pct(o.precio ? gastosSinReforma / o.precio * 100 : 0, 1) + ' del precio. ' +
    (falta > 0 ? '<span class="alto">Con tus ahorros te faltan ' + eur(falta) + '.</span>' : '<span class="bien">Con tus ahorros te sobran ' + eur(-falta) + '.</span>');
  $('pegFirma').textContent = eur(necesitas);
  var partes = [{ k: 'Entrada', v: o.entrada }].concat(g);
  $('firmaBarra').innerHTML = partes.map(function (p, k) { return p.v > 0 ? '<div style="flex:' + p.v + ';background:' + COLORES[k % COLORES.length] + '" title="' + p.k + ': ' + eur(p.v) + '"></div>' : ''; }).join('');
  $('firmaLeyenda').innerHTML = partes.map(function (p, k) { return '<li><i style="background:' + COLORES[k % COLORES.length] + '"></i><span>' + p.k + '</span><b>' + eur(p.v) + '</b></li>'; }).join('');

  // Hipoteca elegida y las otras dos
  var res = {};
  Object.keys(TIPOS).forEach(function (t) { res[t] = sim(o, t, 0); res[t].mas2 = sim(o, t, 2).cuotaMax; });
  var r = res[S.tipo];
  var ibi = auto('ibi', redondea(o.precio * 0.0025, 10)), mant = auto('mant', redondea(o.precio * 0.004, 50));
  var fijosMes = (o.segVida + o.segHogar + ibi + mant) / 12 + o.comunidad;

  $('cuota').textContent = hayHip ? eur(r.cuota0) : '0 €';
  $('cuotaTxt').textContent = !hayHip ? 'sin hipoteca' : S.tipo === 'fijo' ? 'al mes, siempre igual' :
    (S.tipo === 'variable' ? 'el primer año' : 'los ' + o.aniosMixto + ' primeros años') + (r.cuotaRev != null ? ', luego ' + eur(r.cuotaRev) : '');
  desglose(o, r, ibi, mant);
  $('banco').textContent = eur(r.pag);
  $('bancoTxt').textContent = hayHip ? eur(o.deuda) + ' prestados y ' + eur(r.int) + ' de intereses' : 'sin hipoteca';
  var esf = o.ingresos > 0 ? r.cuota0 / o.ingresos * 100 : 0, esfMax = o.ingresos > 0 ? r.cuotaMax / o.ingresos * 100 : 0;
  $('esfuerzo').textContent = o.ingresos > 0 ? pct(esf, 0) : '–';
  $('esfuerzo').className = esf <= 30 ? 'bien' : esf <= 35 ? 'justo' : 'alto';
  $('esfuerzoTxt').textContent = o.ingresos <= 0 ? 'pon tus ingresos' : esfMax > esf + 0.5 ? 'de tus ingresos; ' + pct(esfMax, 0) + ' tras revisar' : esf <= 30 ? 'de tus ingresos, holgado' : esf <= 35 ? 'de tus ingresos, justo' : 'de tus ingresos, alto';
  $('intereses').textContent = eur(r.int);
  var aniosReal = r.meses / 12;
  $('interesesTxt').textContent = hayHip ? 'en ' + num(aniosReal, aniosReal % 1 ? 1 : 0) + ' años' + (aniosReal < o.plazo - 0.05 ? ' en vez de ' + o.plazo : '') : 'sin hipoteca';

  // Avisos
  var av = [];
  if (hayHip && o.entradaPct < 20) av.push('Los bancos suelen financiar como mucho el 80 % del precio o de la tasación. Por encima, solo con aval: el ICO avala hasta el 20 % a menores de 36 años y familias con hijos, según ingresos.');
  if (falta > 0) av.push('Con tus ahorros no llegas: te faltan ' + eur(falta) + '. Prueba con menos precio, más entrada o una comunidad con menos ITP.');
  if (o.ingresos > 0 && esfMax > 35) av.push('La cuota llega al ' + pct(esfMax, 0) + ' de tus ingresos. Los bancos suelen poner el límite entre el 30 y el 40 %.');
  if (hayHip && o.plazo > 30) av.push('Muchos bancos no dan más de 30 años, ni que acabes de pagar después de los 70 o 75.');
  $('avisos').innerHTML = av.map(function (t) { return '<p>' + t + '</p>'; }).join('');
  $('avisos').hidden = !av.length;

  // Comparativa
  var filas = [
    ['Cuota al principio', function (x) { return x.cuota0; }],
    ['Cuota al revisar', function (x, t) { return t === 'fijo' ? x.cuota0 : x.cuotaRev; }],
    ['Si el euríbor sube 2 puntos', function (x) { return x.mas2; }],
    ['Intereses', function (x) { return x.int; }, true],
    ['Total pagado al banco', function (x) { return x.pag; }]
  ];
  var cols = Object.keys(TIPOS);
  var html = '<thead><tr><th></th>' + cols.map(function (t) { return '<th class="n' + (t === S.tipo ? ' selcol' : '') + '">' + TIPOS[t] + '</th>'; }).join('') + '</tr></thead><tbody>';
  filas.forEach(function (f) {
    var vals = cols.map(function (t) { return f[1](res[t], t); });
    var minV = Math.min.apply(null, vals.filter(function (x) { return x != null; }));
    html += '<tr><td>' + f[0] + '</td>' + vals.map(function (x, k) {
      return '<td class="n' + (f[2] && x === minV && hayHip ? ' mejor' : '') + '"' + (cols[k] === S.tipo ? ' style="background:var(--accent-suave)"' : '') + '>' + (x == null ? '–' : eur(x)) + '</td>';
    }).join('') + '</tr>';
  });
  $('comparar').innerHTML = html + '</tbody>';
  if (S.tipo === 'fijo') $('estres').textContent = 'Con tipo fijo la cuota no cambia aunque suba el euríbor.';
  else {
    var menos1 = sim(o, S.tipo, -1).cuotaMax;
    $('estres').textContent = 'Si el euríbor sube 2 puntos tu cuota llegaría a ' + eur(r.mas2) + ' (' + (r.mas2 - r.cuotaMax >= 0 ? '+' : '') + eur(r.mas2 - r.cuotaMax) + ' al mes). Si baja 1 punto, ' + eur(menos1) + '.';
  }

  grafica(r.anios);
  tabla(r, fijosMes);

  // Máximo
  var mx = maximo(o, S.tipo);
  $('max').textContent = mx.max > 0 ? eur(redondea(mx.max, 1000)) : '–';
  $('maxTxt').textContent = mx.max <= 0 ? 'Pon tus ahorros y tus ingresos.' :
    mx.ahorro <= mx.sueldo ? 'Te limitan los ahorros. Por sueldo podrías llegar a ' + eur(redondea(mx.sueldo, 1000)) + '.' :
      'Te limita el sueldo. Con tus ahorros llegarías a ' + eur(redondea(mx.ahorro, 1000)) + '.';

  // Todo lo que pagas
  var horiz = hayHip ? aniosReal : o.plazo, hTxt = num(horiz, horiz % 1 ? 1 : 0);
  var grupos = [
    { g: 'Al comprar', l: [{ k: 'Entrada', v: o.entrada }].concat(g) },
    { g: 'Hipoteca', l: hayHip ? [{ k: 'Capital que devuelves', v: o.deuda }, { k: 'Intereses', v: r.int }] : [] },
    { g: 'En ' + hTxt + ' años de tener la casa', l: [
      { k: 'Seguro de vida', v: hayHip ? o.segVida * horiz : 0 }, { k: 'Seguro de hogar', v: o.segHogar * horiz },
      { k: 'IBI', v: ibi * horiz }, { k: 'Comunidad', v: o.comunidad * 12 * horiz }, { k: 'Arreglos y mantenimiento', v: mant * horiz }] }
  ];
  var granTotal = 0, t = '<thead><tr><th></th><th class="n">Total</th></tr></thead><tbody>';
  grupos.forEach(function (gr) {
    var l = gr.l.filter(function (x) { return x.v > 0; });
    if (!l.length) return;
    var st = suma(l); granTotal += st;
    t += '<tr class="grupo"><td>' + gr.g + '</td><td class="n">' + eur(st) + '</td></tr>' +
      l.map(function (x) { return '<tr><td>' + x.k + '</td><td class="n">' + eur(x.v) + '</td></tr>'; }).join('');
  });
  t += '<tr class="suma"><td>Total</td><td class="n">' + eur(granTotal) + '</td></tr>';
  $('total').innerHTML = t + '</tbody>';
  $('totalTxt').textContent = 'Todo junto durante ' + (hayHip ? 'los ' + hTxt + ' años de hipoteca' : hTxt + ' años') + '. Por una casa de ' + eur(o.precio) + ' acabas pagando ' + eur(granTotal) + (o.precio ? ', ' + num(granTotal / o.precio, 2) + ' veces su precio.' : '.');
  guardar();
}

function grafica(anios) {
  var W = ancho('grafica'), H = W < 500 ? 220 : 260, pl = 48, pr = 8, pt = 10, pb = 24, svg = '';
  $('grafica').setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  if (!anios.length) { $('grafica').innerHTML = '<text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" fill="currentColor" opacity=".6">Sin hipoteca</text>'; return; }
  var mx = Math.max.apply(null, anios.map(function (a) { return a.int + a.cap + a.extra; })) || 1;
  var paso = Math.pow(10, Math.floor(Math.log10(mx / 4)));
  paso = [1, 2, 2.5, 5, 10].map(function (f) { return f * paso; }).filter(function (s) { return mx / s <= 5; })[0];
  var top = Math.ceil(mx / paso) * paso;
  var y = function (val) { return pt + (1 - val / top) * (H - pt - pb); };
  for (var g = 0; g <= top + 1e-6; g += paso) {
    svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="currentColor" opacity=".1"/>' +
      '<text x="' + (pl - 6) + '" y="' + (y(g) + 4) + '" font-size="11" text-anchor="end" fill="currentColor" opacity=".55">' + (g >= 1000 ? num(g / 1000, g % 1000 ? 1 : 0) + ' mil' : num(g)) + '</text>';
  }
  var n = anios.length, bw = (W - pl - pr) / n, gap = Math.min(4, bw * 0.2);
  var cada = Math.ceil(n / 10);
  anios.forEach(function (a, k) {
    var x = pl + k * bw + gap / 2, w = bw - gap, base = H - pb;
    var hc = (H - pt - pb) * a.cap / top, hi = (H - pt - pb) * a.int / top, he = (H - pt - pb) * a.extra / top;
    var tip = '<title>Año ' + a.anio + ': cuota ' + eur(a.cuota) + ', capital ' + eur(a.cap) + ', intereses ' + eur(a.int) + (a.extra ? ', amortizado ' + eur(a.extra) : '') + ', te queda ' + eur(a.deuda) + '</title>';
    svg += '<g>' + tip +
      '<rect x="' + x.toFixed(1) + '" y="' + (base - hc).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hc.toFixed(1) + '" fill="var(--capital)"/>' +
      '<rect x="' + x.toFixed(1) + '" y="' + (base - hc - hi).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hi.toFixed(1) + '" fill="var(--interes)"/>' +
      (he ? '<rect x="' + x.toFixed(1) + '" y="' + (base - hc - hi - he).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + he.toFixed(1) + '" fill="var(--extra)"/>' : '') + '</g>';
    if ((k + 1) % cada === 0 || k === 0) svg += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 6) + '" font-size="11" text-anchor="middle" fill="currentColor" opacity=".55">' + a.anio + '</text>';
  });
  $('grafica').innerHTML = svg;
  $('legExtra').hidden = !anios.some(function (a) { return a.extra > 0; });
}

function tabla(r, fijosMes) {
  var extra = r.extra > 0, h, filas;
  var cab = '<th class="n">Interés</th><th class="n">Cuota</th><th class="n">Capital</th><th class="n">Intereses</th>' + (extra ? '<th class="n">Amortizado</th>' : '') + '<th class="n">Con gastos</th><th class="n">Te queda</th>';
  var celdas = function (tasa, cuota, cap, inte, ex, deuda) {
    return '<td class="n">' + pct(tasa, 2) + '</td><td class="n">' + eur(cuota) + '</td><td class="n">' + eur(cap) + '</td><td class="n">' + eur(inte) + '</td>' +
      (extra ? '<td class="n">' + (ex ? eur(ex) : '') + '</td>' : '') + '<td class="n">' + eur(cuota + fijosMes) + '</td><td class="n">' + eur(deuda) + '</td>';
  };
  if (S.vista === 'meses') {
    h = '<th>Mes</th>' + cab;
    filas = r.filas.map(function (f) {
      var a = Math.ceil(f.mes / 12), m = (f.mes - 1) % 12 + 1;
      return '<tr' + (m === 1 ? ' class="inicio"' : '') + '><td>Año ' + a + ', mes ' + m + '</td>' + celdas(f.tasa, f.cuota, f.cap, f.int, f.extra, f.deuda) + '</tr>';
    });
  } else {
    h = '<th>Año</th>' + cab.replace('<th class="n">Cuota</th>', '<th class="n">Cuota al mes</th>').replace('Con gastos', 'Al mes con gastos').replace('<th class="n">Capital</th><th class="n">Intereses</th>', '<th class="n">Capital del año</th><th class="n">Intereses del año</th>');
    filas = r.anios.map(function (a) {
      return '<tr><td>' + a.anio + '</td>' + celdas(a.tasa, (a.cap + a.int) / a.n, a.cap, a.int, a.extra, a.deuda) + '</tr>';
    });
  }
  $('tabla').innerHTML = '<thead><tr>' + h + '</tr></thead><tbody>' + filas.join('') + '</tbody>';
}

// Desglose de un año: lo que se paga al mes y al año por cada concepto.
function desglose(o, r, ibi, mant) {
  var n = r.anios.length, inp = $('anioVer');
  inp.max = Math.max(1, n);
  $('anioCaja').hidden = n <= 1;
  var y = Math.min(Math.max(1, Math.round(+inp.value) || 1), Math.max(1, n));
  inp.value = y; $('anioVal').textContent = y;
  var a = r.anios[y - 1], nm = a ? a.n : 12;
  var grupos = [
    { g: 'Hipoteca', l: [{ k: 'Intereses para el banco', m: a ? a.int / nm : 0, y: a ? a.int : 0, c: 'var(--interes)' }, { k: 'Capital que devuelves', m: a ? a.cap / nm : 0, y: a ? a.cap : 0, c: 'var(--capital)' }] },
    { g: 'Seguros', l: [{ k: 'Seguro de vida', m: a ? o.segVida / 12 : 0, y: a ? o.segVida : 0, c: 'var(--c3)' }, { k: 'Seguro de hogar', m: o.segHogar / 12, y: o.segHogar, c: 'var(--c7)' }] },
    { g: 'La casa', l: [{ k: 'IBI', m: ibi / 12, y: ibi, c: 'var(--c4)' }, { k: 'Comunidad', m: o.comunidad, y: o.comunidad * 12, c: 'var(--c5)' }, { k: 'Arreglos y mantenimiento', m: mant / 12, y: mant, c: 'var(--c6)' }] }
  ];
  var tot = 0, totY = 0, items = [], t = '<thead><tr><th></th><th class="n">Al mes</th><th class="n">Al año</th></tr></thead><tbody>';
  grupos.forEach(function (gr) {
    var l = gr.l.filter(function (x) { return x.m > 0.004; });
    if (!l.length) return;
    var sm = l.reduce(function (s, x) { return s + x.m; }, 0), sy = l.reduce(function (s, x) { return s + x.y; }, 0);
    tot += sm; totY += sy; items = items.concat(l);
    t += '<tr class="grupo"><td>' + gr.g + '</td><td class="n">' + eur(sm) + '</td><td class="n">' + eur(sy) + '</td></tr>' +
      l.map(function (x) { return '<tr><td><i style="background:' + x.c + '"></i>' + x.k + '</td><td class="n">' + eur(x.m) + '</td><td class="n">' + eur(x.y) + '</td></tr>'; }).join('');
  });
  t += '<tr class="suma"><td>Total</td><td class="n">' + eur(tot) + '</td><td class="n">' + eur(totY) + '</td></tr>';
  $('mesTabla').innerHTML = t + '</tbody>';
  $('mesTotal').textContent = eur(tot);
  $('pegMes').textContent = eur(tot);
  var cuotaMes = a ? (a.int + a.cap) / nm : 0;
  $('mesTxt').textContent = n ? 'al mes el año ' + y + ': ' + eur(cuotaMes) + ' de hipoteca y ' + eur(tot - cuotaMes) + ' de seguros y gastos de la casa' : 'al mes en seguros y gastos de la casa';
  $('mesBarra').innerHTML = items.map(function (x) { return '<div style="flex:' + x.m + ';background:' + x.c + '" title="' + x.k + ': ' + eur(x.m) + '"></div>'; }).join('');
  var nota = '';
  if (a) {
    nota = 'El año ' + y + ', de cada 100 € de cuota ' + num(a.int / (a.int + a.cap) * 100) + ' son intereses y ' + num(a.cap / (a.int + a.cap) * 100) + ' van a quitar deuda. ';
    nota += 'Interés ese año: ' + pct(a.tasa, 2) + '. Al acabarlo te quedan ' + eur(a.deuda) + ' por pagar.';
    if (a.extra) nota += ' Además amortizas ' + eur(a.extra) + ' aparte.';
  }
  $('mesNota').textContent = nota;
}

// ---------- Guardado local ----------
var CAMPOS = ['precio', 'ccaa', 'entrada', 'plazo', 'tinFijo', 'tinInicial', 'aniosMixto', 'tinMixto', 'diferencial', 'segVida', 'segHogar', 'apertura', 'extra',
  'impuesto', 'ajd', 'notaria', 'registro', 'gestoria', 'tasacion', 'agencia', 'reforma', 'ibi', 'comunidad', 'mant', 'ingresos', 'ahorros'];
function guardar() {
  try {
    var d = { s: S, c: {} };
    CAMPOS.forEach(function (id) { d.c[id] = $(id).value; });
    localStorage.setItem(CLAVE, JSON.stringify(d));
  } catch (e) { /* sin almacenamiento */ }
}
function cargar() {
  try {
    var d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!d) return;
    Object.keys(d.s || {}).forEach(function (k) { if (k in S) S[k] = d.s[k]; });
    Object.keys(d.c || {}).forEach(function (id) { if ($(id) && CAMPOS.indexOf(id) >= 0) $(id).value = d.c[id]; });
  } catch (e) { /* sin almacenamiento */ }
}

// ---------- Arranque ----------
$('ccaa').innerHTML = CCAA.map(function (c, k) { return '<option value="' + k + '">' + c.n + '</option>'; }).join('');
$('ccaa').value = String(CCAA.findIndex(function (c) { return c.n === 'Comunidad de Madrid'; }));
cargar();
document.querySelectorAll('.seg').forEach(function (grupo) {
  var clave = grupo.getAttribute('data-seg');
  var marcar = function () { grupo.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-val') === S[clave]); b.setAttribute('aria-pressed', b.getAttribute('data-val') === S[clave]); }); };
  grupo.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    S[clave] = b.getAttribute('data-val');
    marcar();
    // El impuesto cambia de naturaleza al pasar de segunda mano a obra nueva.
    if (clave === 'estado') $('impuesto').value = '';
    pintar();
  });
  marcar();
});
document.querySelectorAll('main input, main select').forEach(function (el) { el.addEventListener('input', pintar); });
pintarEuribor();
pintar();
// En el móvil, una barra abajo con lo que pagas al mes mientras rellenas el formulario.
if ('IntersectionObserver' in window) {
  var vistos = {};
  document.querySelector('footer').id = 'pie';
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { vistos[e.target.id] = e.isIntersecting; });
    $('pegajoso').classList.toggle('fuera', !!(vistos.desglose || vistos.pie));
  });
  io.observe($('desglose'));
  io.observe($('pie'));
}
var anchoPrev = window.innerWidth;
window.addEventListener('resize', function () {
  if (Math.abs(window.innerWidth - anchoPrev) < 30) return;
  anchoPrev = window.innerWidth; pintarEuribor(); pintar();
});
fetch('euribor.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
  if (d && d.mensual && d.mensual.length) { EUR = d; pintarEuribor(); pintar(); }
}).catch(function () { /* se queda con el valor de respaldo */ });
