export class CircuitCanvas {
  constructor(circuit, options = {}) {
    this._init(circuit, options);
    this.#fixDPI();
    this.draw();
  }

  // ================== Novo método interno para inicialização/reset ==================
  _init(circuit, options = {}) {
    // Canvas e contexto
    this.canvas = document.getElementById(options.canvasId);
    this.ctx = this.canvas.getContext("2d");

    // opções
    this.follow = options.follow ?? true;
    this.rotateToHeading = options.rotateToHeading ?? true;
    this.paddingPx = options.paddingPx ?? 40;
    this.lineWidth = options.lineWidth ?? 3;
    this.trailMax = options.trailMax ?? 500;

    // estado
    this.circuit = circuit;
    this.trail = [];
    this.current = null;
    this.headingDeg = 0;

    // projeção
    this.projector = this.#makeProjector(circuit.pontos);
    this.center = { x: 0, y: 0 };
    this.scale = 1;

    // DPI e fit view
    this._resizeHandler ??= () => this.#fixDPI(); // só cria se não existir
    this._clickHandler ??= (e) => this.#handleClick(e); // só cria se não existir
    this.#fitView();
    this.draw();

    // adiciona listener uma vez
    if (!this._resizeListenerAdded) {
      window.addEventListener("resize", this._resizeHandler);
      this._resizeListenerAdded = true;
    }
    if (!this._clickListenerAdded) {
      this.canvas.addEventListener("click", this._clickHandler);
      this._clickListenerAdded = true;
    }
  }

  // ================== Novo método público ==================
  reset(circuit, options = {}) {
    this._init(circuit, options);
  }

  // ================== API pública ==================
  destroy() {
    if (this._resizeHandler && this._resizeListenerAdded) {
      window.removeEventListener("resize", this._resizeHandler);
      this._resizeListenerAdded = false;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.ctx = null;
    this.canvas = null;
    this.projector = null;
    this.circuit = null;
    this.trail = [];
    this.current = null;
  }

  updateLive({ lat, lon, heading }) {
    if (!this.projector) return;
    const validHeading = (typeof heading === "number") ? heading : this.headingDeg;
    this.current = { lat, lon, heading: validHeading };
    this.#addTrail(lat, lon);
    this.headingDeg = validHeading;
    this.draw();
  }

  setFollow(v) {
    this.follow = v;
  }

  zoom(factor) {
    this.scale = Math.max(1e-5, Math.min(this.scale * factor, 1e6));
    this.draw();
  }

  recenterTo(lat, lon) {
    const p = this.projector.toXY(lat, lon);
    this.center = { x: p.x, y: p.y };
    this.draw();
  }

  draw() {
    if (!this.projector) return;
    this.#clear();

    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;

    this.ctx.save();
    if (this.rotateToHeading && this.current?.heading !== undefined) {
      const rad = -this.current.heading * Math.PI / 180;
      this.ctx.translate(W / 2, H / 2);
      this.ctx.rotate(rad);
      this.ctx.translate(-W / 2, -H / 2);
    }

    this.#drawCircuit();
    this.#drawTrail();
    this.#drawBoat();
    this.ctx.restore();

    this.#drawCompass();
    this.#drawScaleBar();
  }

  // ================== Internos ==================
  #handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mid = rect.width / 2;
    if (x > mid) {
      this.zoom(1.2); // lado direito → zoom in
    } else {
      this.zoom(0.8); // lado esquerdo → zoom out
    }
  }

  #fixDPI() {
    const ratio = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || this.canvas.width;
    const cssH = this.canvas.clientHeight || this.canvas.height;
    this.canvas.width = Math.round(cssW * ratio);
    this.canvas.height = Math.round(cssH * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  #makeProjector(points) {
    const lats = points.map(p => p.lat);
    const lons = points.map(p => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const lat0 = (minLat + maxLat) / 2;
    const cosLat = Math.cos(lat0 * Math.PI / 180);

    const toXY = (lat, lon) => ({
      x: (lon - minLon) * cosLat,
//      y: (lat - minLat)
      y: (maxLat - lat)
    });

    const xy = points.map(p => toXY(p.lat, p.lon));
    const xs = xy.map(p => p.x), ys = xy.map(p => p.y);
    const bbox = {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys)
    };

    return { toXY, bbox, ref: { minLat, minLon, cosLat } };
  }

  #fitView() {
    const { bbox } = this.projector;
    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;

    const wXY = bbox.maxX - bbox.minX;
    const hXY = bbox.maxY - bbox.minY;

    const sx = (W - 2 * this.paddingPx) / (wXY || 1e-6);
    const sy = (H - 2 * this.paddingPx) / (hXY || 1e-6);
    this.scale = Math.max(1e-6, Math.min(sx, sy));

    this.center = {
      x: (bbox.minX + bbox.maxX) / 2,
      y: (bbox.minY + bbox.maxY) / 2
    };
  }

  #worldToScreen(ptXY) {
    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;
    return {
      x: (ptXY.x - this.center.x) * this.scale + W / 2,
      y: (ptXY.y - this.center.y) * this.scale + H / 2
    };
  }

  #addTrail(lat, lon) {
    const { toXY } = this.projector;
    const p = toXY(lat, lon);
    this.trail.push(p);
    if (this.trail.length > this.trailMax) this.trail.shift();
    if (this.follow) {
      this.center = { x: p.x, y: p.y };
    }
  }

  #drawCircuit() {
    const pts = this.circuit.pontos;
    if (!pts || pts.length < 2) return;

    this.ctx.lineWidth = this.lineWidth;
    this.ctx.beginPath();
    let s0 = this.#worldToScreen(this.projector.toXY(pts[0].lat, pts[0].lon));
    this.ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < pts.length; i++) {
      const s = this.#worldToScreen(this.projector.toXY(pts[i].lat, pts[i].lon));
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();

    this.ctx.save();
    this.ctx.font = "12px Arial";
    for (let i = 0; i < pts.length; i++) {
      const p = this.#worldToScreen(this.projector.toXY(pts[i].lat, pts[i].lon));
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
      const oldcor = this.ctx.fillStyle;
      this.ctx.fillStyle = "red";
      this.ctx.fillText(`${i}`, p.x + 6, p.y - 6);
      this.ctx.fillStyle = oldcor;
    }
    this.ctx.restore();
  }

  #drawTrail() {
    if (this.trail.length < 2) return;
    this.ctx.save();
    this.ctx.globalAlpha = 0.85;
    this.ctx.lineWidth = Math.max(2, this.lineWidth - 1);
    this.ctx.beginPath();
    const s0 = this.#worldToScreen(this.trail[0]);
    this.ctx.moveTo(s0.x, s0.y);
    this.ctx.strokeStyle = "lightcoral";
    for (let i = 1; i < this.trail.length; i++) {
      const s = this.#worldToScreen(this.trail[i]);
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  #drawBoat() {
    if (!this.current) return;
    const p = this.#worldToScreen(this.projector.toXY(this.current.lat, this.current.lon));

    let x = p.x, y = p.y;
    if (this.follow) {
      x = (this.canvas.clientWidth || this.canvas.width) / 2;
      y = (this.canvas.clientHeight || this.canvas.height) / 2;
    }

    this.ctx.save();
    this.ctx.translate(x, y);
    const size = 12;
    if (this.rotateToHeading && typeof this.current.heading === "number")
      this.ctx.rotate(this.current.heading * Math.PI / 180);
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(size * 0.6, size);
    this.ctx.lineTo(-size * 0.6, size);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  #clear() {
    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;
    this.ctx.clearRect(0, 0, W, H);
  }

  #drawCompass() {
    if (!this.rotateToHeading) return;
    if (!this.current || typeof this.current.heading !== "number") return;
    const W = this.canvas.clientWidth || this.canvas.width;
    this.ctx.save();
    this.ctx.translate(W - 50, 50);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 22, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.save();
    this.ctx.rotate(this.current.heading * Math.PI / 180);
    this.ctx.beginPath();
    this.ctx.moveTo(0, -18);  // ponta
    this.ctx.lineTo(6, 6);
    this.ctx.lineTo(-6, 6);
    this.ctx.closePath();
    this.ctx.fillStyle = "blue";
    this.ctx.fill();
    this.ctx.restore();
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText("N", 0, -26);
    this.ctx.restore();
  }

  #drawScaleBar() {
    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;

    const margin = 20;        // distância das bordas
    const barPx = 100;        // tamanho da barra em pixels (na tela)

    // conversão pixel → mundo (unidades XY da projeção)
    const worldUnits = barPx / this.scale;

    // conversão mundo → metros aproximados
    // referência do projector (1 unidade X = deltaLon * cosLat; 1 unidade Y = deltaLat)
    const { cosLat } = this.projector.ref;

    // assumimos que o eixo X domina a escala horizontal
    // 1 unidade de X corresponde a (deltaLon * cosLat) graus
    // cada grau vale 111320 metros
    const meters = worldUnits * 111320;

    // desenha a barra
    this.ctx.save();
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 2;

    const x0 = W - margin - barPx;
    const y0 = H - margin;

    this.ctx.beginPath();
    this.ctx.moveTo(x0, y0);
    this.ctx.lineTo(x0 + barPx, y0);
    this.ctx.stroke();

    // texto (arredondar para metros inteiros)
    const txt = `${Math.round(meters)} m`;
    this.ctx.font = "14px Arial";
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillStyle = "black";
    this.ctx.fillText(txt, x0 + barPx, y0 - 6);

    this.ctx.restore();
  }
}
