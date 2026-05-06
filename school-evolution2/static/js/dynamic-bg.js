/**
 * 动态背景模块 - 校门照片 + 动态效果
 * 使用校门口照片作为背景，叠加动态光效、粒子等效果
 * 通过 scene.background = CanvasTexture 设置，始终覆盖全视口
 */
const DynamicBackground = (function () {
  // 4个历史时期对应的校门照片
  const GATE_IMAGES = {
    1956: '/static/images/gate_1956.png',  // 成都地质勘探学院 1956-1958
    1958: '/static/images/gate_1958.png',  // 成都地质学院 1958-1993
    1993: '/static/images/gate_1993.png',  // 成都理工学院 1993-2001
    2001: '/static/images/gate_2001.png',  // 成都理工大学 2001-2025
  };

  // 各时期叠加效果参数
  const PERIOD_STYLES = {
    1956: {
      tint: 'rgba(40, 35, 25, 0.25)',      // 暗黄褐色调（老照片感）
      glowColor: 'rgba(200, 180, 120, 0.08)',
      particleColor: 'rgba(220, 200, 150, 0.4)',
      lineColor: 'rgba(180, 160, 100, 0.06)',
    },
    1958: {
      tint: 'rgba(15, 25, 55, 0.35)',       // 深蓝灰色调
      glowColor: 'rgba(60, 100, 180, 0.1)',
      particleColor: 'rgba(100, 150, 220, 0.5)',
      lineColor: 'rgba(60, 100, 180, 0.06)',
    },
    1993: {
      tint: 'rgba(55, 25, 10, 0.3)',        // 暖橙红色调
      glowColor: 'rgba(220, 140, 60, 0.1)',
      particleColor: 'rgba(240, 170, 80, 0.5)',
      lineColor: 'rgba(220, 140, 60, 0.06)',
    },
    2001: {
      tint: 'rgba(20, 10, 45, 0.35)',       // 深紫蓝色调
      glowColor: 'rgba(100, 60, 200, 0.12)',
      particleColor: 'rgba(150, 100, 255, 0.5)',
      lineColor: 'rgba(100, 60, 200, 0.08)',
    },
  };

  let canvas, ctx;
  let texture;
  let scene;
  let currentPeriod = 2001;
  let loadedImages = {};
  let currentImage = null;
  let animId = null;
  let particles = [];
  let time = 0;
  let width = 0, height = 0;
  let active = false;
  let guardInterval = null;

  // 获取年份对应时期
  function getPeriod(year) {
    if (year < 1958) return 1956;
    if (year < 1993) return 1958;
    if (year < 2001) return 1993;
    return 2001;
  }

  // 加载图片
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // 预加载所有图片
  async function preloadImages() {
    const entries = Object.entries(GATE_IMAGES);
    for (const [period, src] of entries) {
      try {
        loadedImages[period] = await loadImage(src);
        console.log(`[DynamicBackground] 已加载: ${period} 时期校门照片`);
      } catch (e) {
        console.warn(`[DynamicBackground] 加载失败: ${period}`, e);
      }
    }
  }

  // 初始化粒子
  function initParticles(count) {
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        r: Math.random() * 2.5 + 0.5,
        alpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  // 绘制一帧
  function drawFrame() {
    if (!active) return;
    time += 0.016;

    const style = PERIOD_STYLES[currentPeriod] || PERIOD_STYLES[2001];

    // 1. 清空
    ctx.clearRect(0, 0, width, height);

    // 2. 绘制校门照片（cover模式填充）
    if (currentImage) {
      const imgRatio = currentImage.width / currentImage.height;
      const canvasRatio = width / height;
      let sx = 0, sy = 0, sw = currentImage.width, sh = currentImage.height;

      if (imgRatio > canvasRatio) {
        // 图片更宽，裁剪左右
        sw = currentImage.height * canvasRatio;
        sx = (currentImage.width - sw) / 2;
      } else {
        // 图片更高，裁剪上下
        sh = currentImage.width / canvasRatio;
        sy = (currentImage.height - sh) / 2;
      }

      ctx.drawImage(currentImage, sx, sy, sw, sh, 0, 0, width, height);
    } else {
      // 如果图片没加载成功，用纯色替代
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, width, height);
    }

    // 3. 叠加色调
    ctx.fillStyle = style.tint;
    ctx.fillRect(0, 0, width, height);

    // 4. 绘制移动的光晕
    drawGlow(style);

    // 5. 绘制粒子
    drawParticles(style);

    // 6. 绘制流光线条（仅现代时期）
    if (currentPeriod >= 1993) {
      drawFlowLines(style);
    }

    // 7. 轻微暗角效果
    drawVignette();

    // 更新纹理
    if (texture) {
      texture.needsUpdate = true;
    }

    animId = requestAnimationFrame(drawFrame);
  }

  // 绘制移动光晕
  function drawGlow(style) {
    const glow1X = width * 0.3 + Math.sin(time * 0.5) * width * 0.15;
    const glow1Y = height * 0.4 + Math.cos(time * 0.3) * height * 0.1;
    const r1 = Math.max(width, height) * 0.35;

    const grad1 = ctx.createRadialGradient(glow1X, glow1Y, 0, glow1X, glow1Y, r1);
    grad1.addColorStop(0, style.glowColor);
    grad1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, width, height);

    const glow2X = width * 0.7 + Math.cos(time * 0.4) * width * 0.12;
    const glow2Y = height * 0.6 + Math.sin(time * 0.6) * height * 0.08;
    const r2 = Math.max(width, height) * 0.28;

    const grad2 = ctx.createRadialGradient(glow2X, glow2Y, 0, glow2X, glow2Y, r2);
    grad2.addColorStop(0, style.glowColor);
    grad2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, width, height);
  }

  // 绘制粒子
  function drawParticles(style) {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha = 0.2 + 0.3 * Math.sin(time * 1.5 + p.phase);

      // 边界循环
      if (p.y < -5) { p.y = height + 5; p.x = Math.random() * width; }
      if (p.x < -5) p.x = width + 5;
      if (p.x > width + 5) p.x = -5;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = style.particleColor.replace(/[\d.]+\)$/, `${p.alpha})`);
      ctx.fill();
    }
  }

  // 绘制流光线条
  function drawFlowLines(style) {
    const lineCount = 6;
    for (let i = 0; i < lineCount; i++) {
      const baseY = height * (0.15 + i * 0.14);
      const offset = time * (40 + i * 15);

      ctx.beginPath();
      ctx.moveTo(0, baseY + Math.sin(offset * 0.01 + i) * 20);

      for (let x = 0; x < width; x += 40) {
        const y = baseY + Math.sin((x + offset) * 0.008 + i * 0.7) * 18;
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = style.lineColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // 绘制暗角
  function drawVignette() {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.max(width, height) * 0.7;

    const grad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 调整canvas大小
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initParticles(40);
  }

  // 守护 scene.background
  function startGuard(targetScene) {
    if (guardInterval) clearInterval(guardInterval);
    guardInterval = setInterval(() => {
      if (targetScene && targetScene.background !== texture) {
        targetScene.background = texture;
      }
    }, 500);
  }

  return {
    /**
     * 初始化动态背景
     * @param {object} graphInstance - ForceGraph3D 实例
     */
    async init(graphInstance) {
      console.log('[DynamicBackground] 初始化中...');

      // 获取 Three.js 场景
      scene = graphInstance.scene();
      console.log('[DynamicBackground] 已获取 scene');

      // 创建离屏 Canvas
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);

      // 创建 CanvasTexture
      texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      // 预加载所有校门照片
      await preloadImages();

      // 设置初始背景
      currentPeriod = getPeriod(2001);
      currentImage = loadedImages[currentPeriod] || null;
      scene.background = texture;
      console.log('[DynamicBackground] 已设置 scene.background = CanvasTexture');

      // 启动守护
      startGuard(scene);

      // 启动动画循环
      active = true;
      drawFrame();

      console.log('[DynamicBackground] 初始化完成');
    },

    /**
     * 设置年份，自动切换校门照片和效果风格
     * @param {number} year
     */
    setYear(year) {
      const period = getPeriod(year);
      if (period === currentPeriod) return;

      currentPeriod = period;
      currentImage = loadedImages[period] || null;
      console.log(`[DynamicBackground] 切换到 ${period} 时期 (year=${year})`);
    },

    /**
     * 销毁
     */
    destroy() {
      active = false;
      if (animId) cancelAnimationFrame(animId);
      if (guardInterval) clearInterval(guardInterval);
      window.removeEventListener('resize', resize);
      if (texture) texture.dispose();
      if (scene) scene.background = null;
    }
  };
})();
