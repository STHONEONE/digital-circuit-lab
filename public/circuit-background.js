(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvases = document.querySelectorAll("[data-circuit-background]");

  function roundedRect(ctx, x, y, width, height, radius) {
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, width, height, radius);
      return;
    }

    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  function createCircuitBackground(canvas) {
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let nodes = [];
    let pulses = [];
    let binaries = [];
    let waves = [];
    let frameId = 0;

    function resizeCanvas() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      init();
    }

    function init() {
      nodes = [];
      pulses = [];
      binaries = [];
      waves = [];
      createCircuitNodes();
      createPulses();
      createBinaryRain();
      createWaves();
    }

    function createCircuitNodes() {
      const gap = 120;
      for (let x = 80; x < width; x += gap) {
        for (let y = 80; y < height; y += gap) {
          if (Math.random() > 0.35) {
            nodes.push({
              x: x + Math.random() * 30 - 15,
              y: y + Math.random() * 30 - 15,
              r: 2 + Math.random() * 2
            });
          }
        }
      }
    }

    function createPulses() {
      for (let i = 0; i < 35; i += 1) {
        pulses.push({
          x: Math.random() * width,
          y: Math.random() * height,
          len: 80 + Math.random() * 120,
          speed: 0.6 + Math.random() * 1.5,
          dir: Math.random() > 0.5 ? "x" : "y",
          alpha: 0.25 + Math.random() * 0.45
        });
      }
    }

    function createBinaryRain() {
      for (let i = 0; i < 90; i += 1) {
        binaries.push({
          x: Math.random() * width,
          y: Math.random() * height,
          value: Math.random() > 0.5 ? "1" : "0",
          speed: 0.25 + Math.random() * 0.8,
          size: 12 + Math.random() * 10,
          alpha: 0.1 + Math.random() * 0.35,
          changeTimer: Math.random() * 100
        });
      }
    }

    function createWaves() {
      const startY = height * 0.72;
      ["CLK", "Q0", "Q1", "Q2"].forEach((name, index) => {
        waves.push({
          name,
          y: startY + index * 42,
          offset: Math.random() * 100,
          speed: 0.6 + index * 0.15
        });
      });
    }

    function drawGlow() {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.55
      );
      gradient.addColorStop(0, "rgba(50, 150, 255, 0.12)");
      gradient.addColorStop(0.5, "rgba(20, 80, 160, 0.08)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    function drawCircuitLines() {
      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = Math.abs(a.x - b.x);
          const dy = Math.abs(a.y - b.y);
          if ((dx < 135 && dy < 25) || (dy < 135 && dx < 25)) {
            ctx.strokeStyle = "rgba(90, 200, 255, 0.11)";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            if (dx > dy) {
              ctx.lineTo(b.x, a.y);
              ctx.lineTo(b.x, b.y);
            } else {
              ctx.lineTo(a.x, b.y);
              ctx.lineTo(b.x, b.y);
            }
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    function drawNodesAndChips() {
      nodes.forEach((node, index) => {
        const flash = 0.15 + Math.sin(Date.now() * 0.003 + index) * 0.12;
        ctx.beginPath();
        ctx.fillStyle = `rgba(120, 230, 255, ${0.25 + flash})`;
        ctx.shadowColor = "rgba(90, 220, 255, 0.9)";
        ctx.shadowBlur = 12;
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      drawChip(width * 0.18, height * 0.25, "74LS08");
      drawChip(width * 0.78, height * 0.22, "DECODER");
      drawChip(width * 0.72, height * 0.62, "RAM");
      drawChip(width * 0.22, height * 0.65, "JK-FF");
    }

    function drawChip(x, y, text) {
      const chipWidth = 120;
      const chipHeight = 62;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "rgba(5, 20, 40, 0.65)";
      ctx.strokeStyle = "rgba(110, 220, 255, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "rgba(70, 200, 255, 0.35)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      roundedRect(ctx, -chipWidth / 2, -chipHeight / 2, chipWidth, chipHeight, 10);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      for (let i = 0; i < 5; i += 1) {
        const pinY = -22 + i * 11;
        ctx.strokeStyle = "rgba(120, 220, 255, 0.35)";
        ctx.beginPath();
        ctx.moveTo(-chipWidth / 2 - 12, pinY);
        ctx.lineTo(-chipWidth / 2, pinY);
        ctx.moveTo(chipWidth / 2, pinY);
        ctx.lineTo(chipWidth / 2 + 12, pinY);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(180, 245, 255, 0.85)";
      ctx.font = "14px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    function drawPulses() {
      pulses.forEach((pulse) => {
        ctx.save();
        const gradient = pulse.dir === "x"
          ? ctx.createLinearGradient(pulse.x - pulse.len, pulse.y, pulse.x, pulse.y)
          : ctx.createLinearGradient(pulse.x, pulse.y - pulse.len, pulse.x, pulse.y);
        gradient.addColorStop(0, "rgba(80, 220, 255, 0)");
        gradient.addColorStop(1, `rgba(110, 240, 255, ${pulse.alpha})`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(80, 220, 255, 0.9)";
        ctx.shadowBlur = 10;
        ctx.beginPath();

        if (pulse.dir === "x") {
          ctx.moveTo(pulse.x - pulse.len, pulse.y);
          ctx.lineTo(pulse.x, pulse.y);
          pulse.x += pulse.speed;
          if (pulse.x - pulse.len > width) {
            pulse.x = -20;
            pulse.y = Math.random() * height;
          }
        } else {
          ctx.moveTo(pulse.x, pulse.y - pulse.len);
          ctx.lineTo(pulse.x, pulse.y);
          pulse.y += pulse.speed;
          if (pulse.y - pulse.len > height) {
            pulse.y = -20;
            pulse.x = Math.random() * width;
          }
        }

        ctx.stroke();
        ctx.restore();
      });
    }

    function drawBinaries() {
      ctx.save();
      binaries.forEach((binary) => {
        binary.y += binary.speed;
        binary.changeTimer += 1;
        if (binary.changeTimer > 80) {
          binary.value = Math.random() > 0.5 ? "1" : "0";
          binary.changeTimer = 0;
        }
        if (binary.y > height + 20) {
          binary.y = -20;
          binary.x = Math.random() * width;
        }
        ctx.font = `${binary.size}px Consolas, monospace`;
        ctx.fillStyle = `rgba(130, 235, 255, ${binary.alpha})`;
        ctx.fillText(binary.value, binary.x, binary.y);
      });
      ctx.restore();
    }

    function drawWaves() {
      ctx.save();
      waves.forEach((wave, index) => {
        const y = wave.y;
        wave.offset += wave.speed;
        ctx.font = "14px Consolas, monospace";
        ctx.fillStyle = "rgba(180, 235, 255, 0.45)";
        ctx.fillText(wave.name, 40, y + 4);
        ctx.strokeStyle = "rgba(120, 230, 255, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "rgba(90, 220, 255, 0.35)";
        ctx.shadowBlur = 6;
        ctx.beginPath();

        let x = 85;
        const high = y - 12;
        const low = y + 12;
        let currentY = index === 0 ? high : low;
        const step = 38 + index * 10;
        ctx.moveTo(x, currentY);

        while (x < width - 60) {
          const nextX = x + step;
          const shouldFlip = Math.floor((x + wave.offset) / step) % (index + 2) === 0;
          ctx.lineTo(nextX, currentY);
          if (shouldFlip) {
            currentY = currentY === high ? low : high;
            ctx.lineTo(nextX, currentY);
          }
          x = nextX;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      ctx.restore();
    }

    function render() {
      ctx.clearRect(0, 0, width, height);
      drawGlow();
      drawCircuitLines();
      drawPulses();
      drawBinaries();
      drawNodesAndChips();
      drawWaves();
    }

    function animate() {
      if (document.hidden) {
        frameId = 0;
        return;
      }
      render();
      if (!prefersReducedMotion) {
        frameId = requestAnimationFrame(animate);
      }
    }

    function start() {
      resizeCanvas();
      animate();
    }

    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
        return;
      }
      if (!frameId) animate();
    });
    window.addEventListener("beforeunload", () => cancelAnimationFrame(frameId));
    start();
  }

  canvases.forEach(createCircuitBackground);
})();
