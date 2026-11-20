/*
  Set-list engine.
  A show page only needs:  <body data-show="show.json" data-root="../../">
  Everything else (layout, staff animation, pencil marks, stage mode, QR) is built here.

  Routes (location.hash):
    (none)      set list
    #song-N     song N with lyrics
    #stage      iPad stage view: big list + QR; tap anywhere = next song
  Query:
    ?theme=NAME preview another theme without editing show.json
*/
(async () => {
  const body = document.body;
  const ROOT = body.dataset.root || '../../';
  const show = await (await fetch(body.dataset.show || 'show.json', {cache: 'no-cache'})).json();
  const songs = show.songs || [];
  const N = songs.length;

  // ---------- theme + fonts ----------
  const themeName = new URLSearchParams(location.search).get('theme') || show.theme || 'paper';
  await new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = `${ROOT}themes/${themeName}.css`;
    l.onload = l.onerror = res; document.head.appendChild(l);
  });
  const fontVar = getComputedStyle(document.documentElement).getPropertyValue('--lyrics-font').trim().replace(/["']/g, '');
  const font = show.lyricsFont || fontVar;
  if (show.lyricsFont) document.documentElement.style.setProperty('--lyrics-font', `"${show.lyricsFont}"`);
  if (font) {
    const f = document.createElement('link'); f.rel = 'stylesheet';
    f.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}&display=swap`;
    document.head.appendChild(f);
  }
  document.title = show.title ? `${show.title} · 셋리스트` : '셋리스트';

  // ---------- image sizes ----------
  const size = src => new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([600, 160]); i.src = src; });
  // CSS resolves url() inside custom properties against the stylesheet, so pass absolute URLs
  const abs = src => new URL(src, location.href).href;
  const ink = (src, [w, h], cls = '', alt = '') =>
    `<span class="ink ${cls}" ${alt ? `role="img" aria-label="${esc(alt)}"` : ''} style="--src:url('${abs(src)}');--w:${w};--h:${h}"></span>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const songSizes = await Promise.all(songs.map(s => size(s.src)));
  const subjSizes = await Promise.all((show.subject?.words || []).map(size));
  const headSize = show.heading ? await size(show.heading.src) : null;
  const maxw = Math.max(...songSizes.map(s => s[0]), 600);
  body.style.setProperty('--maxw', maxw);
  body.style.setProperty('--n', N);

  // ---------- markup ----------
  const handle = show.instagram ? `@${show.instagram}` : '';
  body.insertAdjacentHTML('afterbegin', `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="pencil" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 1.85" result="ga"/><feComposite in="d" in2="ga" operator="in"/></filter></svg>
<main>
  <section id="home">
    ${show.heading ? `<h1 class="heading">${ink(show.heading.src, headSize, '', show.heading.alt)}</h1>` : ''}
    ${show.subject ? `<p class="subject" role="img" aria-label="${esc(show.subject.alt || '')}">${show.subject.words.map((w, i) => ink(w, subjSizes[i])).join('')}</p>` : ''}
    ${handle ? `<a class="insta hand" href="https://www.instagram.com/${encodeURIComponent(show.instagram)}/"><b class="w">${esc(handle)}</b></a>` : ''}
    <ul class="list" id="list">${songs.map((s, i) => `<li><button type="button" data-i="${i}" aria-label="${i + 1}. ${esc(s.title)}">${ink(s.src, songSizes[i])}<svg class="mark" aria-hidden="true"><path class="ul"/><path class="ov"/></svg></button></li>`).join('')}</ul>
    <canvas id="gl" class="staff" aria-hidden="true"></canvas>
  </section>
  <section id="song" aria-live="polite">
    <button id="close" class="navbtn" type="button" aria-label="셋리스트로 돌아가기"><svg viewBox="0 0 30 30"><path d="M7 7 23 23M23 7 7 23"/></svg></button>
    <span class="ink big" id="bigTitle" role="img"></span>
    <div class="lyrics hand" id="lyrics"></div>
    <div class="nav">
      <button class="navbtn" id="prev" type="button" aria-label="이전 곡"><svg viewBox="0 0 30 30"><path d="M25 15H6M12 8 5 15l7 7"/></svg></button>
      <button class="navbtn" id="next" type="button" aria-label="다음 곡"><svg viewBox="0 0 30 30"><path d="M5 15h19M18 8l7 7-7 7"/></svg></button>
    </div>
  </section>
  <aside class="qr" aria-label="이 페이지로 접속하는 QR 코드"><div class="qrbox" id="qrbox"></div>${handle ? `<span class="hand handle"><b class="w">${esc(handle)}</b></span>` : ''}</aside>
</main>`);
  const $ = id => document.getElementById(id);
  const list = $('list');
  const btns = [...list.querySelectorAll('button')];

  // ---------- hand-drawn pencil marks ----------
  const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const f1 = v => v.toFixed(1);
  function oval(i, sx, sy) {
    const pts = [], a0 = 3.4 + rnd(i * 7) * .5, turn = Math.PI * 2 * (1.09 + rnd(i + 3) * .05), K = 46;
    for (let k = 0; k <= K; k++) {
      const p = k / K, a = a0 + turn * p;
      const rx = 97 * (1 - .035 * p) + (rnd(i * 50 + k) - .5) * 2, ry = 27 * (1 - .09 * p) + (rnd(i * 90 + k) - .5) * 1.6;
      pts.push([(100 + Math.cos(a) * rx + p * 3) * sx, (31 + Math.sin(a) * ry + p * 3.5 - 2) * sy]);
    }
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let k = 1; k < pts.length - 1; k++) d += ` Q${f1(pts[k][0])} ${f1(pts[k][1])} ${f1((pts[k][0] + pts[k + 1][0]) / 2)} ${f1((pts[k][1] + pts[k + 1][1]) / 2)}`;
    return d;
  }
  function under(i, sx, sy) {
    const y = 50 + rnd(i + 11) * 3;
    return `M${f1(8 * sx)} ${f1((y + 1) * sy)} Q${f1(70 * sx)} ${f1((y + 3 + rnd(i) * 2) * sy)} ${f1(120 * sx)} ${f1(y * sy)} T${f1(194 * sx)} ${f1((y - 2 - rnd(i + 5) * 2) * sy)}`;
  }
  function drawMarks() {
    btns.forEach((b, i) => {
      const sv = b.querySelector('svg'), W = sv.clientWidth, H = sv.clientHeight; if (!W) return;
      sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const [u, o] = sv.querySelectorAll('path');
      u.setAttribute('d', under(i, W / 200, H / 60)); o.setAttribute('d', oval(i, W / 200, H / 60));
      u.style.setProperty('--l', Math.ceil(u.getTotalLength() + 2)); o.style.setProperty('--l', Math.ceil(o.getTotalLength() + 2));
    });
  }
  const markRO = new ResizeObserver(drawMarks); markRO.observe(list);

  // ---------- lyrics in hand style ----------
  function hand(text) {
    let n = 0;
    return text.split(/\n\s*\n/).map(v => '<p>' + v.split('\n').map(line => line.split(' ').map(w => '<b class="w">' + [...w].map(ch => {
      n++;
      const r = (rnd(n) - .5) * 4.5, y = (rnd(n + 99) - .5) * 2.6, sc = .95 + rnd(n + 7) * .1;
      return `<i style="transform:translateY(${f1(y)}px) rotate(${f1(r)}deg) scale(${sc.toFixed(2)})">${esc(ch)}</i>`;
    }).join('') + '</b>').join(' ')).join('<br>') + '</p>').join('');
  }

  // ---------- state + routing ----------
  const LEVEL = show.staff?.levels || songs.map((_, i) => .1 + .26 * i / Math.max(1, N - 1));
  let cur = -1, target = .08, stage = false;
  function mark(i) { cur = i; btns.forEach((b, j) => b.classList.toggle('on', j === i)); target = i < 0 ? .08 : (LEVEL[i] ?? .2); }
  function openSong(i) {
    const s = songs[i], [w, h] = songSizes[i], b = $('bigTitle');
    b.style.cssText = `--src:url('${abs(s.src)}');--w:${w};--h:${h}`; b.setAttribute('aria-label', `${i + 1}. ${s.title}`);
    const L = $('lyrics'); L.innerHTML = s.lyrics ? hand(s.lyrics) : ''; L.hidden = !s.lyrics;
    mark(i); body.classList.add('song'); $('song').appendChild($('gl')); scrollTo(0, 0);
  }
  function route() {
    const h = location.hash.slice(1);
    stage = h === 'stage'; body.classList.toggle('stage', stage);
    const m = /^song-(\d+)$/.exec(h), i = m ? +m[1] - 1 : -1;
    if (i >= 0 && i < N && !stage) openSong(i);
    else { body.classList.remove('song'); $('home').appendChild($('gl')); if (!stage) mark(-1); else if (cur < 0) mark(0); }
    if (stage) wake();
  }
  list.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (stage) { mark((cur + 1) % N); return; }
    const i = +b.dataset.i; mark(i);
    setTimeout(() => { location.hash = 'song-' + (i + 1); }, 420);
  });
  $('prev').onclick = () => { location.hash = 'song-' + ((cur + N - 1) % N + 1); };
  $('next').onclick = () => { location.hash = 'song-' + ((cur + 1) % N + 1); };
  $('close').onclick = () => { location.hash = 'list'; };
  document.addEventListener('click', e => { if (stage && !e.target.closest('button,a')) mark((cur + 1) % N); });
  addEventListener('keydown', e => {
    if (!stage) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); mark((cur + 1) % N); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); mark((cur + N - 1) % N); }
  });
  addEventListener('hashchange', route);

  // keep the iPad screen on in stage mode
  let lock = null;
  function wake() { if (!('wakeLock' in navigator) || lock) return; navigator.wakeLock.request('screen').then(l => { lock = l; l.onrelease = () => { lock = null; }; }).catch(() => {}); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && stage) wake(); });

  // ---------- QR (vendored generator, works offline) ----------
  if (window.qrcode) {
    const url = show.url || location.href.split('#')[0].split('?')[0];
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    $('qrbox').innerHTML = `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="${esc(url)}"><path d="${d}"/></svg>`;
  }

  route();

  // ---------- the five-line staff (WebGL) ----------
  const cv = $('gl'), gl = cv.getContext('webgl', {alpha: true, premultipliedAlpha: false, antialias: true});
  if (!gl) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision highp float;uniform vec2 r;uniform float t,k,d,al;uniform vec3 c;
  void main(){
    vec2 px=gl_FragCoord.xy/d;float H=r.y/d;
    float gap=14.;float base=H*.5-2.*gap;float a=0.;
    for(int i=0;i<5;i++){float l=float(i);
      float y=base+l*gap
        +sin(px.x*.012+t*.55+l*.7)*k*16.*(1.+l*.15)
        +sin(px.x*.037-t*.8*(1.+l*.2))*k*5.
        +sin(px.x*.15+t*2.1+l*2.)*k*1.2;
      a+=smoothstep(1.4,.2,abs(px.y-y))*(al+.08*l);}
    gl_FragColor=vec4(c,clamp(a,0.,.9));}`;
  const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pl = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['r', 't', 'k', 'd', 'c', 'al'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  let dpr = 1;
  const resize = () => { dpr = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(cv.clientWidth * dpr) || 1; cv.height = Math.round(cv.clientHeight * dpr) || 1; gl.viewport(0, 0, cv.width, cv.height); };
  const glRO = new ResizeObserver(resize); glRO.observe(cv); resize();
  const probe = document.createElement('span'); probe.style.cssText = 'position:absolute;width:0;height:0;color:var(--staff)'; body.appendChild(probe);
  const col = () => { const v = getComputedStyle(probe).color, n = (v.match(/[\d.]+/g) || [153, 53, 86]).map(Number).slice(0, 3); return v.startsWith('color(') ? n : n.map(z => z / 255); };
  const alpha = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--staff-alpha')) || .55;
  let rgb = col(), al = alpha();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { rgb = col(); });
  let k = .08; const t0 = performance.now();
  const frame = now => {
    k += (target - k) * .025;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.r, cv.width, cv.height); gl.uniform1f(U.t, still ? 0 : (now - t0) / 1000); gl.uniform1f(U.k, k);
    gl.uniform1f(U.d, dpr); gl.uniform3f(U.c, ...rgb); gl.uniform1f(U.al, al);
    gl.drawArrays(gl.TRIANGLES, 0, 3); requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
