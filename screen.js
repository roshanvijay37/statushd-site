/* StatusHD — the phone's screen, drawn in 2D.
 *
 * ONE drawer for everything: the 3D phone uses it as a live texture, and the plain phones in
 * the page (shown before WebGL is ready, and for anyone without WebGL or with reduced motion)
 * use it as they are. So the two can never disagree about what the screen shows.
 *
 * Everything is drawn in a 360 x 780 logical screen and scaled.
 */
(function () {
  "use strict";
  var LW = 360, LH = 780;
  var SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
  var FILE = "putta_birthday.mp4";

  // ---------------------------------------------------------------- helpers
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function font(c, weight, size) { c.font = weight + " " + size + "px " + SANS; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function cover(c, img, x, y, w, h, fy) {
    var s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
    fy = fy === undefined ? .5 : fy;                  // where to crop vertically: 0 top, 1 bottom
    c.drawImage(img, (img.width - sw) / 2, (img.height - sh) * fy, sw, sh, x, y, w, h);
  }
  function icon(c, d, x, y, size, stroke, fill, lw) {
    var p = new Path2D(d);
    c.save(); c.translate(x, y); c.scale(size / 24, size / 24);
    if (fill) { c.fillStyle = fill; c.fill(p); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = (lw || 2) * 24 / size; c.lineCap = "round"; c.lineJoin = "round"; c.stroke(p); }
    c.restore();
  }
  var P = {
    back: "M19 12H5m6-7-7 7 7 7",
    cam: "M2.5 7.5a1.5 1.5 0 0 1 1.5-1.5h9.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5zM15 10l6-3.5v11L15 14",
    call: "M6.6 3.5 9 6.2c.5.6.5 1.4 0 2L7.6 9.8a13 13 0 0 0 6.6 6.6l1.6-1.4c.6-.5 1.4-.5 2 0l2.7 2.4c.6.6.6 1.5 0 2.1l-1.4 1.4c-1 1-2.6 1.3-3.9.7C9.7 19.3 4.7 14.3 2.4 8.8c-.6-1.3-.3-2.9.7-3.9L4.5 3.5c.6-.6 1.5-.6 2.1 0z",
    clip: "M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l8-8",
    camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    smile: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01",
    mic: "M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v3",
    down: "M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14",
    eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    doc: "M6 3h8l4 4v14H6zM9 11h6M9 15h6"
  };

  // ---------------------------------------------------------------- the video frame (an illustration)
  function scene(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1f2451"); g.addColorStop(.55, "#e8715a"); g.addColorStop(1, "#f6c27b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.arc(w * .68, h * .42, w * .11, 0, 7); ctx.fill();
    var seed = 7; function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var i;
    for (i = 0; i < 90; i++) { ctx.fillStyle = "rgba(255,255,255," + (0.35 + r() * .6) + ")"; ctx.fillRect(r() * w, r() * h * .35, 1.4, 1.4); }
    ctx.fillStyle = "#3b1f3f"; ctx.beginPath(); ctx.moveTo(0, h * .7);
    for (var x = 0; x <= w; x += w / 12) ctx.lineTo(x, h * (.62 + .06 * Math.sin(x / w * 9)));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    ctx.fillStyle = "#1d1226"; ctx.fillRect(0, h * .82, w, h * .18);
    for (i = 0; i < 26; i++) {
      var lx = w * .04 + i * w * .036, ly = h * .16 + Math.sin(i / 3) * h * .03;
      ctx.fillStyle = ["#ffd166", "#ff6b6b", "#7bdff2", "#b8f2e6"][i % 4];
      ctx.beginPath(); ctx.arc(lx, ly, w * .0085, 0, 7); ctx.fill();
    }
    for (i = 0; i < 70; i++) {
      ctx.save(); ctx.translate(r() * w, h * .2 + r() * h * .55); ctx.rotate(r() * 3);
      ctx.fillStyle = ["#ffd166", "#ef476f", "#06d6a0", "#ffffff", "#118ab2"][i % 5];
      ctx.fillRect(-w * .007, -w * .003, w * .014, w * .006); ctx.restore();
    }
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";
    ctx.font = "italic " + Math.round(w * .1) + "px 'Instrument Serif', Georgia, serif";
    ctx.fillText("Happy Birthday", w / 2, h * .76);
    ctx.font = "600 " + Math.round(w * .045) + "px 'Instrument Sans', sans-serif";
    ctx.fillText("Putta turns 25 · Mangaluru", w / 2, h * .81);
    ctx.font = Math.round(w * .028) + "px 'Instrument Sans', sans-serif"; ctx.globalAlpha = .8;
    ctx.fillText("with love from all of us", w / 2, h * .85); ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
  var frames = null;
  function getFrames() {
    if (frames) return frames;
    var W = 540, H = 960;
    var sharp = document.createElement("canvas"); sharp.width = W; sharp.height = H;
    scene(sharp.getContext("2d"), W, H);
    // The blurry one: drawn tiny, blown back up, colour washed a little - what heavy
    // shrinking does to a video, shown as a drawing.
    var s = document.createElement("canvas"); s.width = Math.round(W / 7); s.height = Math.round(H / 7);
    scene(s.getContext("2d"), s.width, s.height);
    var m = document.createElement("canvas"); m.width = Math.round(W / 3.5); m.height = Math.round(H / 3.5);
    var mc = m.getContext("2d"); mc.imageSmoothingEnabled = false; mc.drawImage(s, 0, 0, m.width, m.height);
    var soft = document.createElement("canvas"); soft.width = W; soft.height = H;
    var sc = soft.getContext("2d"); sc.imageSmoothingEnabled = true;
    try { sc.filter = "saturate(.82) contrast(.92)"; } catch (e) { /* older browsers: no wash */ }
    sc.drawImage(m, 0, 0, W, H); sc.filter = "none";
    frames = {sharp: sharp, soft: soft};
    return frames;
  }

  var tile = null;
  function doodles(c) {
    if (!tile) {
      tile = document.createElement("canvas"); tile.width = tile.height = 120;
      var t = tile.getContext("2d");
      t.fillStyle = "#efeae2"; t.fillRect(0, 0, 120, 120);
      t.strokeStyle = "#ddd5c8"; t.lineWidth = 1.3; t.lineJoin = "round";
      t.beginPath(); t.arc(20, 22, 8, 0, 7); t.stroke();
      t.beginPath();                                                     // star
      for (var k = 0; k < 10; k++) {
        var a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? 5 : 11;
        t[k ? "lineTo" : "moveTo"](76 + Math.cos(a) * rad, 22 + Math.sin(a) * rad);
      }
      t.closePath(); t.stroke();
      rr(t, 14, 70, 18, 14, 3); t.stroke();
      t.beginPath(); t.moveTo(84, 98);                                   // heart
      t.bezierCurveTo(70, 88, 72, 74, 84, 80); t.bezierCurveTo(96, 74, 98, 88, 84, 98); t.stroke();
      t.beginPath(); t.moveTo(50, 104); t.lineTo(62, 104); t.moveTo(56, 98); t.lineTo(56, 110); t.stroke();
      t.beginPath(); t.arc(52, 58, 4, 0, 7); t.stroke();
    }
    return c.createPattern(tile, "repeat");
  }

  // ---------------------------------------------------------------- the state of the screen
  function state(o) {
    var s = {mode: "chat", docIn: 1, upload: 1, ticks: 1, react: "", reactPop: 1, hg: 0,
             typing: 0, work: 0, sharpen: 0, vidIn: 0, split: .5, sv: 0};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) s[k] = o[k];
    return s;
  }
  // What each part of the page shows when it is at rest.
  var PRESETS = {
    hero:   {react: "ok", vidIn: 1},
    problem: {mode: "split", split: .5},
    send:   {},
    work:   {react: "hg", typing: 1, work: 1, sharpen: .7},
    back:   {react: "ok", vidIn: 1},
    status: {mode: "status", sv: .45}
  };

  // ---------------------------------------------------------------- drawing
  function statusBar(c, light) {
    var col = light ? "#fff" : "#111b21";
    c.fillStyle = col; font(c, 600, 13.5); c.fillText("9:41", 26, 27);
    for (var i = 0; i < 4; i++) c.fillRect(276 + i * 5, 26 - (i + 1) * 2.6, 3, (i + 1) * 2.6);
    c.globalAlpha = .9; rr(c, 302, 17, 24, 11, 3); c.lineWidth = 1.2; c.strokeStyle = col; c.stroke();
    c.fillRect(304, 19, 17, 7); c.fillRect(327, 20.5, 1.8, 4); c.globalAlpha = 1;
  }
  function island(c) { c.fillStyle = "#000"; rr(c, 134, 10, 92, 26, 13); c.fill(); }

  function header(c, S) {
    c.fillStyle = "#fff"; c.fillRect(0, 0, LW, 100);
    statusBar(c, false); island(c);
    icon(c, P.back, 12, 56, 22, "#111b21", null, 2.2);
    c.fillStyle = "#e5dcff"; c.beginPath(); c.arc(58, 67, 18, 0, 7); c.fill();
    c.fillStyle = "#5b3fd1"; font(c, 600, 16); c.textAlign = "center"; c.fillText("S", 58, 73); c.textAlign = "left";
    c.fillStyle = "#111b21"; font(c, 600, 17); c.fillText("StatusHD", 85, 63);
    font(c, 400, 12.5);
    if (S.typing > .5) { c.fillStyle = "#00a884"; c.fillText("typing…", 85, 82); }
    else { c.fillStyle = "#667781"; c.fillText("online", 85, 82); }
    icon(c, P.cam, 236, 56, 22, "#111b21", null, 1.9);
    icon(c, P.call, 278, 56, 21, "#111b21", null, 1.9);
    c.fillStyle = "#111b21";
    for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(336, 59 + i * 7, 2, 0, 7); c.fill(); }
    c.fillStyle = "#e9edef"; c.fillRect(0, 99, LW, 1);
  }

  function inputBar(c) {
    c.fillStyle = "#fff"; rr(c, 8, 716, 290, 48, 24); c.fill();
    icon(c, P.smile, 20, 728, 24, "#54656f", null, 1.8);
    c.fillStyle = "#8696a0"; font(c, 400, 16.5); c.fillText("Message", 54, 746);
    icon(c, P.clip, 222, 728, 23, "#54656f", null, 1.8);
    icon(c, P.camera, 258, 728, 23, "#54656f", null, 1.8);
    c.fillStyle = "#00a884"; c.beginPath(); c.arc(328, 740, 24, 0, 7); c.fill();
    icon(c, P.mic, 316, 728, 24, "#fff", null, 2);
  }

  function ticks(c, x, y, blue) {
    c.strokeStyle = blue ? "#53bdeb" : "#8696a0"; c.lineWidth = 1.6; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(x, y + 5); c.lineTo(x + 3.4, y + 8.4); c.lineTo(x + 10, y + 1); c.stroke();
    if (blue) { c.beginPath(); c.moveTo(x + 6.5, y + 7.6); c.lineTo(x + 7.3, y + 8.4); c.lineTo(x + 14, y + 1); c.stroke(); }
  }

  function fileIcon(c, x, y, label) {
    c.fillStyle = "#6b7c85";
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20, y); c.lineTo(x + 28, y + 8); c.lineTo(x + 28, y + 36); c.lineTo(x, y + 36); c.closePath(); c.fill();
    c.fillStyle = "#9aa9b1"; c.beginPath(); c.moveTo(x + 20, y); c.lineTo(x + 28, y + 8); c.lineTo(x + 20, y + 8); c.closePath(); c.fill();
    c.fillStyle = "#fff"; font(c, 700, 7.5); c.textAlign = "center"; c.fillText(label, x + 14, y + 31); c.textAlign = "left";
  }

  function reaction(c, cx, cy, S) {
    if (!S.react) return;
    var s = S.reactPop;
    c.save(); c.translate(cx, cy); c.scale(s, s);
    c.shadowColor = "rgba(11,20,26,.25)"; c.shadowBlur = 4; c.shadowOffsetY = 1;
    c.fillStyle = "#fff"; rr(c, -19, -13, 38, 26, 13); c.fill();
    c.shadowColor = "transparent";
    c.rotate(S.react === "hg" ? S.hg : 0);
    font(c, 400, 15); c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(S.react === "hg" ? "⏳" : "✅", 0, 1);
    c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.restore();
  }

  function outDoc(c, S) {
    if (S.docIn <= 0) return 0;
    var bx = 92, by = 146, bw = 258, bh = 94;
    c.save();
    c.globalAlpha = clamp(S.docIn * 1.4, 0, 1);
    c.translate(0, (1 - S.docIn) * 22);
    c.shadowColor = "rgba(11,20,26,.14)"; c.shadowBlur = 1.5; c.shadowOffsetY = 1;
    c.fillStyle = "#d9fdd3";
    rr(c, bx, by, bw, bh, 10); c.fill();
    c.beginPath(); c.moveTo(bx + bw - 12, by); c.lineTo(bx + bw + 8, by); c.lineTo(bx + bw, by + 12); c.closePath(); c.fill();
    c.shadowColor = "transparent";
    c.fillStyle = "#cdf2c5"; rr(c, bx + 5, by + 5, bw - 10, 64, 8); c.fill();
    fileIcon(c, bx + 16, by + 19, "MP4");
    var textW = S.upload < 1 ? 138 : 176;
    c.fillStyle = "#111b21"; font(c, 400, 14.5);
    var name = FILE;
    while (c.measureText(name).width > textW && name.length > 4) name = name.slice(0, -2);
    if (name !== FILE) name = name.slice(0, -1) + "…";
    c.fillText(name, bx + 54, by + 34);
    c.fillStyle = "#667781"; font(c, 400, 12); c.fillText("186 MB • MP4", bx + 54, by + 54);
    if (S.upload < 1) {
      var cx = bx + bw - 32, cy = by + 37;
      c.lineWidth = 2.6; c.strokeStyle = "rgba(0,168,132,.2)"; c.beginPath(); c.arc(cx, cy, 14, 0, 7); c.stroke();
      c.strokeStyle = "#00a884"; c.lineCap = "round";
      c.beginPath(); c.arc(cx, cy, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * S.upload); c.stroke();
      c.lineWidth = 1.8; c.beginPath(); c.moveTo(cx - 4.5, cy - 4.5); c.lineTo(cx + 4.5, cy + 4.5);
      c.moveTo(cx + 4.5, cy - 4.5); c.lineTo(cx - 4.5, cy + 4.5); c.stroke();
    }
    c.fillStyle = "#667781"; font(c, 400, 11); c.textAlign = "right";
    c.fillText("9:41 pm", bx + bw - 28, by + bh - 9); c.textAlign = "left";
    if (S.upload >= 1) ticks(c, bx + bw - 23, by + bh - 19, S.ticks >= 1);
    else { c.strokeStyle = "#8696a0"; c.lineWidth = 1.2; c.beginPath(); c.arc(bx + bw - 16, by + bh - 13, 5, 0, 7); c.moveTo(bx + bw - 16, by + bh - 16); c.lineTo(bx + bw - 16, by + bh - 13); c.lineTo(bx + bw - 14, by + bh - 12); c.stroke(); }
    reaction(c, bx + bw - 34, by + bh + 4, S);
    c.restore();
    return by + bh;
  }

  function inVideo(c, S, F) {
    if (S.vidIn <= 0) return;
    var vx = 10, vy = 270, vw = 258;
    c.save();
    c.globalAlpha = clamp(S.vidIn * 1.3, 0, 1);
    c.translate(0, (1 - S.vidIn) * 34);
    c.shadowColor = "rgba(11,20,26,.14)"; c.shadowBlur = 1.5; c.shadowOffsetY = 1;
    c.fillStyle = "#fff"; rr(c, vx, vy, vw, 362, 10); c.fill();
    c.beginPath(); c.moveTo(vx + 12, vy); c.lineTo(vx - 8, vy); c.lineTo(vx, vy + 12); c.closePath(); c.fill();
    c.shadowColor = "transparent";
    c.save(); rr(c, vx + 5, vy + 5, vw - 10, 52, 7); c.clip();
    c.fillStyle = "#f5f6f6"; c.fillRect(vx + 5, vy + 5, vw - 10, 52);
    c.fillStyle = "#06cf9c"; c.fillRect(vx + 5, vy + 5, 4, 52);
    c.restore();
    c.fillStyle = "#06a884"; font(c, 600, 13); c.fillText("You", vx + 18, vy + 25);
    icon(c, P.doc, vx + 16, vy + 33, 14, "#667781", null, 2);
    c.fillStyle = "#667781"; font(c, 400, 12.5); c.fillText(FILE, vx + 34, vy + 45);
    c.save(); rr(c, vx + 5, vy + 61, vw - 10, 296, 7); c.clip();
    cover(c, F.sharp, vx + 5, vy + 61, vw - 10, 296, .92);
    var g = c.createLinearGradient(0, vy + 300, 0, vy + 357);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)");
    c.fillStyle = g; c.fillRect(vx + 5, vy + 300, vw - 10, 57);
    c.restore();
    c.fillStyle = "rgba(11,20,26,.62)"; rr(c, vx + 13, vy + 325, 104, 24, 12); c.fill();
    icon(c, P.down, vx + 20, vy + 330, 14, "#fff", null, 2.6);
    c.fillStyle = "#fff"; font(c, 600, 11.5); c.fillText("HD (38 MB)", vx + 39, vy + 341);
    font(c, 400, 11); c.textAlign = "right"; c.fillText("9:43 pm", vx + vw - 14, vy + 343); c.textAlign = "left";
    c.restore();
  }

  function workCard(c, S, F) {
    if (S.work <= 0) return;
    c.save();
    c.globalAlpha = clamp(S.work, 0, 1);
    c.translate(0, (1 - S.work) * 16);
    c.shadowColor = "rgba(11,20,26,.18)"; c.shadowBlur = 18; c.shadowOffsetY = 6;
    c.fillStyle = "#fff"; rr(c, 36, 300, 288, 250, 18); c.fill(); c.shadowColor = "transparent";
    c.fillStyle = "#111b21"; font(c, 600, 14.5); c.fillText("Making it clear…", 54, 330);
    c.fillStyle = "#667781"; font(c, 400, 12); c.fillText(FILE, 54, 348);
    c.save(); rr(c, 52, 362, 256, 158, 10); c.clip();
    cover(c, F.soft, 52, 362, 256, 158);
    c.globalAlpha = clamp(S.sharpen, 0, 1) * clamp(S.work, 0, 1);
    cover(c, F.sharp, 52, 362, 256, 158);
    c.restore();
    c.globalAlpha = clamp(S.work, 0, 1);
    c.fillStyle = "#e9edef"; rr(c, 52, 530, 256, 5, 2.5); c.fill();
    c.fillStyle = "#00a884"; rr(c, 52, 530, Math.max(5, 256 * clamp(S.sharpen, 0, 1)), 5, 2.5); c.fill();
    c.restore();
  }

  function splitView(c, S, F) {
    cover(c, F.soft, 0, 0, LW, LH);
    var x = clamp(S.split, 0, 1) * LW;
    c.save(); c.beginPath(); c.rect(x, 0, LW - x, LH); c.clip(); cover(c, F.sharp, 0, 0, LW, LH); c.restore();
    var g = c.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(0, 0, LW, 120);
    statusBar(c, true); island(c);
    c.fillStyle = "#fff"; c.fillRect(x - 1.25, 0, 2.5, LH);
    c.shadowColor = "rgba(0,0,0,.3)"; c.shadowBlur = 10;
    c.beginPath(); c.arc(x, 470, 22, 0, 7); c.fill(); c.shadowColor = "transparent";
    c.strokeStyle = "#141413"; c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(x - 5, 463); c.lineTo(x - 11, 470); c.lineTo(x - 5, 477);
    c.moveTo(x + 5, 463); c.lineTo(x + 11, 470); c.lineTo(x + 5, 477); c.stroke();
    font(c, 700, 11);
    var lw = c.measureText("WHATSAPP").width + 20;
    c.fillStyle = "rgba(20,20,19,.72)"; rr(c, 14, 58, lw, 26, 13); c.fill();
    c.fillStyle = "#fff"; c.fillText("WHATSAPP", 24, 75);
    var rw = c.measureText("STATUSHD").width + 20;
    c.fillStyle = "#0b5e39"; rr(c, LW - 14 - rw, 58, rw, 26, 13); c.fill();
    c.fillStyle = "#fff"; c.fillText("STATUSHD", LW - 4 - rw, 75);
  }

  function statusViewer(c, S, F) {
    cover(c, F.sharp, 0, 0, LW, LH);
    var g = c.createLinearGradient(0, 0, 0, 150);
    g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(0, 0, LW, 150);
    statusBar(c, true); island(c);
    c.fillStyle = "rgba(255,255,255,.35)"; rr(c, 10, 44, 340, 3, 1.5); c.fill();
    c.fillStyle = "#fff"; rr(c, 10, 44, Math.max(3, 340 * clamp(S.sv, 0, 1)), 3, 1.5); c.fill();
    icon(c, P.back, 8, 60, 22, "#fff", null, 2.2);
    c.fillStyle = "#e5dcff"; c.beginPath(); c.arc(52, 72, 17, 0, 7); c.fill();
    c.fillStyle = "#5b3fd1"; font(c, 600, 14); c.textAlign = "center"; c.fillText("P", 52, 77); c.textAlign = "left";
    c.fillStyle = "#fff"; font(c, 600, 15.5); c.fillText("My status", 78, 69);
    c.globalAlpha = .85; font(c, 400, 12); c.fillText("Just now", 78, 87); c.globalAlpha = 1;
    var b = c.createLinearGradient(0, LH - 120, 0, LH);
    b.addColorStop(0, "rgba(0,0,0,0)"); b.addColorStop(1, "rgba(0,0,0,.5)");
    c.fillStyle = b; c.fillRect(0, LH - 120, LW, 120);
    icon(c, P.eye, LW / 2 - 12, LH - 58, 24, "#fff", null, 1.8);
  }

  // Draw state S onto ctx, which is W x H pixels (any size with the 360:780 shape).
  function draw(ctx, W, H, S) {
    var F = getFrames();
    ctx.setTransform(W / LW, 0, 0, H / LH, 0, 0);
    ctx.clearRect(0, 0, LW, LH);
    if (S.mode === "split") { splitView(ctx, S, F); return; }
    if (S.mode === "status") { statusViewer(ctx, S, F); return; }
    ctx.fillStyle = doodles(ctx); ctx.fillRect(0, 100, LW, LH - 100);
    header(ctx, S);
    ctx.fillStyle = "#fff"; rr(ctx, 152, 112, 56, 24, 8); ctx.fill();
    ctx.fillStyle = "#54656f"; font(ctx, 500, 12); ctx.textAlign = "center"; ctx.fillText("Today", 180, 128); ctx.textAlign = "left";
    outDoc(ctx, S);
    inVideo(ctx, S, F);
    workCard(ctx, S, F);
    inputBar(ctx);
  }

  // ---------------------------------------------------------------- the plain phones in the page
  var flats = [];
  function sizeFlat(f) {
    var r = f.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    f.canvas.width = Math.max(36, Math.round(r.width * dpr));
    f.canvas.height = Math.max(78, Math.round(r.height * dpr));
  }
  function paintFlat(f) { draw(f.canvas.getContext("2d"), f.canvas.width, f.canvas.height, f.state); }
  function paintFlats() { flats.forEach(function (f) { if (f.near) { sizeFlat(f); paintFlat(f); } }); }

  // The split in the problem section - dragged on the phone, or set with the range control.
  var shared = {split: .5, listeners: []};
  function setSplit(v, from) {
    shared.split = clamp(v, .04, .96);
    flats.forEach(function (f) { if (f.state.mode === "split") { f.state.split = shared.split; if (f.near) paintFlat(f); } });
    var range = document.getElementById("splitRange");
    if (range && from !== "range") range.value = Math.round(shared.split * 100);
    shared.listeners.forEach(function (fn) { fn(shared.split, from); });
  }

  function phoneRectIn(el) {
    // Where the phone sits inside its slot: fitted to the slot's height, centred.
    var r = el.getBoundingClientRect(), ratio = 380 / 800;
    var h = Math.min(r.height, r.width / ratio), w = h * ratio;
    return {left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h};
  }

  function wireDrag() {
    // Two surfaces: the plain phone's slot, and - under 3D - the fixed zone the 3D phone sits in.
    var range = document.getElementById("splitRange");
    if (range) range.addEventListener("input", function () { setSplit(range.value / 100, "range"); });
    var active = null;
    function at(e) {
      var pr = phoneRectIn(active);
      var screenL = pr.left + pr.width * .035, screenW = pr.width * .93;
      setSplit((e.clientX - screenL) / screenW, "drag");
    }
    document.querySelectorAll("[data-split-surface]").forEach(function (surface) {
      surface.addEventListener("pointerdown", function (e) { active = surface; at(e); });
    });
    window.addEventListener("pointermove", function (e) { if (active) at(e); });
    window.addEventListener("pointerup", function () { active = null; });
    window.addEventListener("pointercancel", function () { active = null; });
  }

  function init() {
    document.querySelectorAll("canvas[data-preset]").forEach(function (cv) {
      flats.push({canvas: cv, state: state(PRESETS[cv.getAttribute("data-preset")] || {}), near: false});
    });
    // Each plain phone is drawn when it comes near the screen, not all at once on arrival.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var f = flats.filter(function (x) { return x.canvas === e.target; })[0];
          if (f && !f.near) { f.near = true; sizeFlat(f); paintFlat(f); }
          io.unobserve(e.target);
        });
      }, {rootMargin: "400px 0px"});
      flats.forEach(function (f) { io.observe(f.canvas); });
    } else {
      flats.forEach(function (f) { f.near = true; });
      paintFlats();
    }
    wireDrag();
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(paintFlats, 150); });
    // The frame's lettering uses the page fonts, which arrive after the page shows - redraw then.
    function fontsIn() {
      frames = null; paintFlats();
      shared.listeners.forEach(function (fn) { fn(shared.split, "fonts"); });
    }
    if (document.fonts) {
      if (document.fonts.ready) document.fonts.ready.then(fontsIn);
      if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", fontsIn);
    }
  }

  window.SHD = {LW: LW, LH: LH, draw: draw, state: state, PRESETS: PRESETS, getFrames: getFrames,
                shared: shared, setSplit: setSplit, phoneRectIn: phoneRectIn};
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
