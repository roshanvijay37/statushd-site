// StatusHD — the 3D layer.
//
// One renderer, one phone, one fixed canvas behind the page. The page scrolls normally - nothing
// is pinned. Each part of the page has a "slot" where the phone belongs; as you scroll from one
// part to the next the phone glides from one slot (and pose) to the next. What the phone's
// screen does in each part plays on a short timeline the moment that part arrives, and can be
// replayed with a tap - so nothing waits on a long stretch of scrolling.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function start() {
  const SHD = window.SHD, gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, Lenis = window.Lenis;
  const root = document.documentElement;
  gsap.registerPlugin(ScrollTrigger);

  // ------------------------------------------------------------------ renderer
  const canvas = document.getElementById("gl");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: dpr < 2, powerPreference: "high-performance"});
  } catch (e) {
    root.classList.add("static");
    return;
  }
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  camera.position.set(0, 0, 10);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff1dc, 0.9);
  rim.position.set(4, -1, -3);
  scene.add(rim);

  // ------------------------------------------------------------------ the phone
  const SH = 2.05, SW = SH * SHD.LW / SHD.LH;       // the screen, same shape as the drawing
  const BEZ = 0.05, PW = SW + 2 * BEZ, PH = SH + 2 * BEZ;
  const DEPTH = 0.075, BEV = 0.03;
  const OUTER_H = PH + 2 * BEV;
  const FRONT = DEPTH / 2 + BEV;

  function roundRect(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function planeFrom(shape, w, h, segs) {
    const g = new THREE.ShapeGeometry(shape, segs);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
    uv.needsUpdate = true;
    return g;
  }

  const phone = new THREE.Group();
  const bodyGeo = new THREE.ExtrudeGeometry(roundRect(PW, PH, 0.17), {
    depth: DEPTH, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 6, curveSegments: 28});
  bodyGeo.translate(0, 0, -DEPTH / 2);
  const bodyMat = new THREE.MeshStandardMaterial({color: 0x2a2926, metalness: 0.85, roughness: 0.28});
  phone.add(new THREE.Mesh(bodyGeo, bodyMat));

  const glass = new THREE.Mesh(planeFrom(roundRect(PW - 0.004, PH - 0.004, 0.165), PW, PH, 28),
    new THREE.MeshPhysicalMaterial({color: 0x050505, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05}));
  glass.position.z = FRONT + 0.001;
  phone.add(glass);

  // The screen: the 2D drawing, live.
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 720; texCanvas.height = Math.round(720 * SHD.LH / SHD.LW);
  const tctx = texCanvas.getContext("2d");
  const tex = new THREE.CanvasTexture(texCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const screen = new THREE.Mesh(planeFrom(roundRect(SW, SH, 0.13), SW, SH, 28),
                                new THREE.MeshBasicMaterial({map: tex, toneMapped: false}));
  screen.position.z = FRONT + 0.002;
  phone.add(screen);

  // A faint sheen across the glass that moves as the phone turns.
  const sheenCv = document.createElement("canvas"); sheenCv.width = 256; sheenCv.height = 512;
  {
    const c = sheenCv.getContext("2d");
    const g = c.createLinearGradient(0, 0, 256, 512);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.42, "rgba(255,255,255,0)");
    g.addColorStop(.5, "rgba(255,255,255,.55)"); g.addColorStop(.58, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 256, 512);
  }
  const sheenTex = new THREE.CanvasTexture(sheenCv);
  const sheen = new THREE.Mesh(planeFrom(roundRect(SW, SH, 0.13), SW, SH, 12),
    new THREE.MeshBasicMaterial({map: sheenTex, transparent: true, opacity: 0.1, depthWrite: false,
                                 blending: THREE.AdditiveBlending, toneMapped: false}));
  sheen.position.z = FRONT + 0.004;
  phone.add(sheen);

  // Back: a camera block and three lenses, side buttons.
  const back = -FRONT;
  const camBlock = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.46, 0.05, 4, 0.1), bodyMat);
  camBlock.position.set(-PW / 2 + 0.33, PH / 2 - 0.33, back - 0.02);
  phone.add(camBlock);
  const lensMat = new THREE.MeshPhysicalMaterial({color: 0x0a0a0c, metalness: 0.2, roughness: 0.05, clearcoat: 1});
  const ringMat = new THREE.MeshStandardMaterial({color: 0x8a8780, metalness: 1, roughness: 0.25});
  [[-0.1, 0.1], [0.1, -0.02], [-0.1, -0.13]].forEach(([dx, dy]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.035, 32), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(camBlock.position.x + dx, camBlock.position.y + dy, back - 0.055);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.04, 32), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(ring.position.x, ring.position.y, back - 0.06);
    phone.add(ring, lens);
  });
  const btnGeo = new RoundedBoxGeometry(0.02, 0.22, 0.04, 2, 0.008);
  [[PH / 2 - 0.55], [PH / 2 - 0.85]].forEach(([y]) => {
    const b = new THREE.Mesh(btnGeo, bodyMat);
    b.position.set(PW / 2 + BEV + 0.004, y, 0);
    phone.add(b);
  });

  // The rig carries position and size; the phone inside it turns.
  const rig = new THREE.Group();
  rig.add(phone);
  // A soft shadow under it, which does not turn.
  const shCv = document.createElement("canvas"); shCv.width = shCv.height = 128;
  {
    const c = shCv.getContext("2d"), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(20,20,19,.5)"); g.addColorStop(1, "rgba(20,20,19,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.36),
    new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(shCv), transparent: true, depthWrite: false, opacity: 0.55}));
  shadow.position.set(0, -OUTER_H / 2 - 0.2, -0.6);
  rig.add(shadow);
  scene.add(rig);

  // ------------------------------------------------------------------ the screen's state
  let S = SHD.state(SHD.PRESETS.hero);
  let dirty = true, lastDraw = 0;
  function paintScreen(now) {
    if (!dirty || now - lastDraw < 32) return;          // ~30 fps is plenty for a screen
    SHD.draw(tctx, texCanvas.width, texCanvas.height, S);
    tex.needsUpdate = true;
    dirty = false; lastDraw = now;
  }
  const mark = () => { dirty = true; };
  SHD.shared.listeners.push((v, from) => {
    S.split = v; dirty = true;
    if ((from === "drag" || from === "range") && splitTween) { splitTween.kill(); splitTween = null; }
  });

  // ------------------------------------------------------------------ the parts of the page
  const beats = Array.from(document.querySelectorAll("[data-beat]")).map((el) => ({
    el, slot: el.querySelector(".slot"), top: 0, h: 0, cx: 0, cy: 0, ph: 0}));
  const mobile = () => window.innerWidth < 900;
  // How the phone is turned in each part (radians). Gentler on a phone screen, where the
  // chat has to stay readable.
  const POSE = [
    {ry: -0.46, rx: 0.12, rz: 0.03, s: 1},
    {ry: 0, rx: 0, rz: 0, s: 1.04},
    {ry: 0.3, rx: 0.06, rz: -0.02, s: 1},
    {ry: -0.28, rx: 0.05, rz: 0.02, s: 1},
    {ry: 0.24, rx: 0.04, rz: -0.015, s: 1},
    {ry: -0.14, rx: 0.04, rz: 0, s: 1},
  ];
  let vw = 1, vh = 1, visH = 1, visW = 1;
  const railEl = document.getElementById("rail");
  const zone = document.getElementById("zone");
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    visW = visH * camera.aspect;
    const sy = window.scrollY;
    const bar = document.getElementById("nav").offsetHeight + railEl.offsetHeight;
    const zr = zone.getBoundingClientRect(), zp = SHD.phoneRectIn(zone);
    beats.forEach((b, k) => {
      const r = b.el.getBoundingClientRect();
      b.h = r.height;
      if (k === 0) {
        // The hero: the phone sits in the hero's own slot, the page at the very top.
        const pr = SHD.phoneRectIn(b.slot);
        b.top = r.top + sy;
        b.cx = pr.left + pr.width / 2; b.cy = pr.top + sy - b.top + pr.height / 2; b.ph = pr.height;
        return;
      }
      // Every other part: the phone is in the fixed zone. The part is "at rest" when its words
      // meet the phone - just under it on a phone, level with its middle on a wide screen.
      const cap = b.el.querySelector(".cap").getBoundingClientRect();
      b.top = mobile() ? cap.top + sy - (zr.bottom + 14)
                       : cap.top + sy + cap.height / 2 - (bar + (vh - bar) / 2);
      b.cx = zp.left + zp.width / 2; b.cy = zp.top + zp.height / 2; b.ph = zp.height;
    });
  }

  // ------------------------------------------------------------------ what each part plays
  let tl = null, splitTween = null, active = -1;
  const spin = {v: 0};
  function play(n) {
    active = n;
    if (tl) tl.kill();
    if (splitTween) { splitTween.kill(); splitTween = null; }
    gsap.killTweensOf(spin);
    if (n !== 5) gsap.to(spin, {v: 0, duration: 0.5, ease: "power2.out"});
    tl = gsap.timeline({onUpdate: mark});
    if (n === 0) {
      S = SHD.state(Object.assign({}, SHD.PRESETS.hero, {reactPop: 0}));
      tl.to(S, {reactPop: 1, duration: 0.5, ease: "back.out(3)"}, 0.5);
    } else if (n === 1) {
      S = SHD.state({mode: "split", split: SHD.shared.split});
      const o = {v: 0.12};
      SHD.setSplit(o.v, "tl");
      splitTween = gsap.timeline()
        .to(o, {v: 0.88, duration: 1.3, ease: "power2.inOut", onUpdate: () => SHD.setSplit(o.v, "tl")})
        .to(o, {v: 0.5, duration: 0.9, ease: "power2.inOut", onUpdate: () => SHD.setSplit(o.v, "tl")});
    } else if (n === 2) {
      S = SHD.state({docIn: 0, upload: 0, ticks: 0});
      tl.to(S, {docIn: 1, duration: 0.55, ease: "power3.out"}, 0.2)
        .to(S, {upload: 1, duration: 1.5, ease: "power1.inOut"}, 0.6)
        .set(S, {ticks: 1}, 2.5);
    } else if (n === 3) {
      S = SHD.state({react: "hg", reactPop: 0, typing: 1, work: 0, sharpen: 0});
      tl.to(S, {reactPop: 1, duration: 0.5, ease: "back.out(3)"}, 0.2)
        .to(S, {work: 1, duration: 0.5, ease: "power2.out"}, 0.6)
        .to(S, {sharpen: 1, duration: 2.4, ease: "power1.inOut"}, 1.0);
    } else if (n === 4) {
      S = SHD.state({react: "hg", typing: 1, vidIn: 0});
      tl.set(S, {typing: 0}, 0.6)
        .to(S, {vidIn: 1, duration: 0.75, ease: "power3.out"}, 0.6)
        .set(S, {react: "ok", reactPop: 0}, 1.3)
        .to(S, {reactPop: 1, duration: 0.5, ease: "back.out(3)"}, 1.3);
    } else if (n === 5) {
      S = SHD.state({react: "ok", vidIn: 1});
      spin.v = 0;
      tl.to(spin, {v: Math.PI * 2, duration: 1.6, ease: "power2.inOut", onComplete: () => { spin.v = 0; }}, 0.1)
        .call(() => { S.mode = "status"; S.sv = 0; dirty = true; }, null, 0.9)
        .to(S, {sv: 1, duration: 5, ease: "none", repeat: -1}, 0.9);
    }
    dirty = true;
    zone.classList.toggle("live", n === 1);
    rail.forEach((b) => b.toggleAttribute("aria-current", false));
    const cur = rail[n - 1];
    if (cur) cur.setAttribute("aria-current", "step");
  }

  // ------------------------------------------------------------------ smooth scroll + triggers
  const lenis = new Lenis({lerp: 0.12, smoothWheel: true});
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, {duration: 1.2});
  }));

  const rail = Array.from(document.querySelectorAll("#rail button"));
  const railBars = rail.map((b) => b.querySelector("b"));
  function goTo(n) {
    const b = beats[n];
    if (!b) return;
    if (active === n) play(n);
    lenis.scrollTo(b.top, {duration: 1.1});
  }
  rail.forEach((b) => b.addEventListener("click", () => goTo(+b.getAttribute("data-go"))));
  document.querySelectorAll("[data-replay]").forEach((b) => b.addEventListener("click", () => {
    const n = +b.getAttribute("data-replay");
    if (active !== n) goTo(n); else play(n);
  }));

  // On a phone the words sit under the phone, so the words of the part you are leaving fade
  // as they slide up across it. On a wide screen the words have their own column.
  const mm = gsap.matchMedia();
  mm.add("(max-width: 899px)", () => {
    beats.slice(1).forEach((b) => {
      const cap = b.el.querySelector(".cap");
      gsap.fromTo(cap, {opacity: 1}, {opacity: 0, ease: "none",
        scrollTrigger: {trigger: cap, start: "top 63%", end: "top 53%", scrub: true}});
    });
    gsap.fromTo(beats[0].el.querySelector(".cap"), {opacity: 1}, {opacity: 0, ease: "none",
      scrollTrigger: {trigger: beats[0].el, start: "top top", end: "40% top", scrub: true}});
  });
  mm.add("(min-width: 900px)", () => {
    beats.slice(1).forEach((b) => {
      const cap = b.el.querySelector(".cap");
      gsap.fromTo(cap, {opacity: 1}, {opacity: 0, ease: "none",
        scrollTrigger: {trigger: cap, start: "top 26%", end: "top 6%", scrub: true}});
    });
  });
  // Everything after the story: plain HTML, eased in.
  ScrollTrigger.batch(".rv", {start: "top 88%", once: true,
    onEnter: (els) => gsap.to(els, {opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08})});

  // ------------------------------------------------------------------ touch and pointer
  const tilt = {x: 0, y: 0, tx: 0, ty: 0};
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tilt.tx = (e.clientX / vw) * 2 - 1;
    tilt.ty = (e.clientY / vh) * 2 - 1;
  }, {passive: true});
  const heroSurface = document.querySelector("[data-hero-surface]");
  let drag = null;
  heroSurface.addEventListener("pointerdown", (e) => { drag = {x: e.clientX, y: e.clientY, tx: tilt.tx, ty: tilt.ty}; });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    tilt.tx = Math.max(-1.6, Math.min(1.6, drag.tx + (e.clientX - drag.x) / 120));
    tilt.ty = Math.max(-1, Math.min(1, drag.ty + (e.clientY - drag.y) / 200));
  }, {passive: true});
  const endDrag = () => { if (drag) { drag = null; gsap.to(tilt, {tx: 0, ty: 0, duration: 1.6, ease: "power2.out", delay: 0.6}); } };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // ------------------------------------------------------------------ every frame
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let visible = true, fade = 1;
  function frame(time) {
    const t = time;                                       // seconds, from gsap's ticker
    const y = window.scrollY;
    let i = 0;
    while (i < beats.length - 1 && y >= beats[i + 1].top) i++;
    const A = beats[i], B = beats[i + 1];
    let f = 0, e = 0, cx, cy, ph, pose;
    const soft = mobile() ? 0.72 : 1;
    if (B) {
      f = clamp((y - A.top) / (B.top - A.top), 0, 1);
      e = smooth(0.18, 0.9, f);
      cx = lerp(A.cx, B.cx, e); cy = lerp(A.cy, B.cy, e); ph = lerp(A.ph, B.ph, e);
      const P = POSE[i], Q = POSE[i + 1];
      pose = {ry: lerp(P.ry, Q.ry, e), rx: lerp(P.rx, Q.rx, e), rz: lerp(P.rz, Q.rz, e), s: lerp(P.s, Q.s, e)};
      fade = 1;
    } else {
      // Past the last part: the phone leaves with the page and the scene goes quiet.
      const past = Math.max(0, y - A.top);
      f = clamp(past / vh, 0, 1);
      cx = A.cx; cy = A.cy - past; ph = A.ph; pose = POSE[i];
      fade = clamp(1 - f * 2.6, 0, 1);
    }
    if (y < beats[0].top) { cx = beats[0].cx; cy = beats[0].cy - (y - beats[0].top); }

    // Which part is showing: the one past the halfway mark.
    const now = B && f >= 0.5 ? i + 1 : i;
    if (now !== active && fade > 0) play(now);

    // The rail: shown during the story, each segment filling as you go.
    const pos = i + (B ? f : 0);
    railEl.classList.toggle("show", pos > 0.55 && fade > 0.8);
    railBars.forEach((b, k) => { b.style.transform = "scaleX(" + clamp(pos - k, 0, 1) + ")"; });

    // Stop drawing when there is nothing to see.
    const show = fade > 0.001;
    if (show !== visible) { visible = show; canvas.style.visibility = show ? "visible" : "hidden"; }
    if (!visible) return;
    canvas.style.opacity = fade;

    // Place the rig so the phone fills its slot.
    const s = ((ph / vh) * visH / OUTER_H) * pose.s * 0.93;
    rig.scale.setScalar(s);
    const heroW = i === 0 ? 1 - e : 0;
    const bob = Math.sin(t * 1.1) * 0.035 * (0.4 + heroW);
    rig.position.set(((cx / vw) * 2 - 1) * visW / 2, (1 - (cy / vh) * 2) * visH / 2 + bob * s, 0);

    tilt.x = lerp(tilt.x, tilt.tx, 0.07); tilt.y = lerp(tilt.y, tilt.ty, 0.07);
    const w = 0.28 + 0.72 * heroW;
    phone.rotation.set(
      pose.rx * soft + tilt.y * 0.22 * w + Math.sin(t * 0.8) * 0.015,
      pose.ry * soft + tilt.x * 0.45 * w + Math.sin(t * 0.55) * 0.03 * (0.5 + heroW) + spin.v,
      pose.rz + Math.sin(t * 0.7) * 0.008);
    sheen.material.opacity = 0.025 + 0.05 * Math.abs(Math.sin(phone.rotation.y * 1.4));
    sheenTex.offset.set(phone.rotation.y * 0.35, -phone.rotation.x * 0.3);
    shadow.material.opacity = 0.5 * fade;

    // The hourglass turns while we work.
    if (S.mode === "chat" && S.react === "hg") {
      const ph2 = (t % 1.7) / 1.7;
      const k = ph2 < 0.45 ? 0 : smooth(0, 1, (ph2 - 0.45) / 0.55);
      const hg = k * Math.PI;
      if (Math.abs(hg - S.hg) > 0.01) { S.hg = hg; dirty = true; }
    }
    paintScreen(performance.now());
    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------------ go
  // The 3D layout first (on a phone the parts are laid out differently), then measure it.
  root.classList.add("gl");
  measure();
  ScrollTrigger.refresh();
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { measure(); ScrollTrigger.refresh(); }, 120); });
  ScrollTrigger.addEventListener("refresh", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); dirty = true; });
  SHD.draw(tctx, texCanvas.width, texCanvas.height, S);
  tex.needsUpdate = true;
  gsap.ticker.add(frame);
  frame(gsap.ticker.time);
  window.__shd = {beats, play, lenis};
}
