/**
 * 动态背景模块 - 使用 Canvas 2D 绘制 + Three.js scene.background
 * 
 * 原理：在 Canvas 2D 上绘制动态背景效果，生成 CanvasTexture，
 * 通过 scene.background 设置，始终覆盖全视口，不会因旋转产生黑边。
 */
const DynamicBackground = (() => {
    let canvas2d = null;    // 离屏 2D canvas
    let ctx = null;         // 2D 绑定上下文
    let texture = null;     // Three.js CanvasTexture
    let scene = null;       // ForceGraph3D 的 scene
    let currentYear = 2025;
    let animFrame = null;
    let startTime = Date.now();
    let particles = [];     // 粒子数组
    let width = 1920;
    let height = 1080;

    // ============ 四个历史时期配色 ============
    const PERIODS = [
        {
            // 1956-1958 成都地质勘探学院：黑白颗粒感+暖黄底片色调
            name: '成都地质勘探学院',
            bg1: '#1a1610', bg2: '#2d2418', bg3: '#0d0b08',
            accent: '#c9a84c', accent2: '#8b7335',
            particleColor: 'rgba(180,160,100,', grain: true, grainAlpha: 0.15
        },
        {
            // 1958-1993 成都地质学院：深蓝灰冷色调+星尘粒子
            name: '成都地质学院',
            bg1: '#0a0e1a', bg2: '#141e3a', bg3: '#060810',
            accent: '#4a6fa5', accent2: '#2d4a7a',
            particleColor: 'rgba(100,150,220,', grain: false, grainAlpha: 0
        },
        {
            // 1993-2001 成都理工学院：暖橙红光晕+彩色渐变
            name: '成都理工学院',
            bg1: '#1a0e08', bg2: '#2d1a0a', bg3: '#100804',
            accent: '#e86830', accent2: '#c44a1a',
            particleColor: 'rgba(230,140,60,', grain: false, grainAlpha: 0
        },
        {
            // 2001-2025 成都理工大学：深紫蓝+科技光效
            name: '成都理工大学',
            bg1: '#0c0820', bg2: '#1a1040', bg3: '#060412',
            accent: '#7c3aed', accent2: '#4f46e5',
            particleColor: 'rgba(140,100,240,', grain: false, grainAlpha: 0
        }
    ];

    function getPeriodIndex(year) {
        if (year < 1958) return 0;
        if (year < 1993) return 1;
        if (year < 2001) return 2;
        return 3;
    }

    function getPeriod(year) {
        return PERIODS[getPeriodIndex(year)];
    }

    // ============ 粒子系统 ============
    function initParticles(count) {
        particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.6,
                size: Math.random() * 3 + 1,
                alpha: Math.random() * 0.6 + 0.2,
                pulse: Math.random() * Math.PI * 2
            });
        }
    }

    function updateParticles(period) {
        const t = (Date.now() - startTime) * 0.001;
        for (let p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.pulse += 0.02;

            // 边界循环
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
        }
    }

    function drawParticles(period) {
        for (let p of particles) {
            const alpha = p.alpha * (0.5 + 0.5 * Math.sin(p.pulse));
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = period.particleColor + alpha.toFixed(2) + ')';
            ctx.fill();

            // 光晕
            if (p.size > 2) {
                const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
                glow.addColorStop(0, period.particleColor + (alpha * 0.3).toFixed(2) + ')');
                glow.addColorStop(1, period.particleColor + '0)');
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();
            }
        }
    }

    // ============ 颗粒噪点（1956时期）============
    function drawGrain(alpha) {
        if (alpha <= 0) return;
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        // 每隔几个像素画噪点（性能优化）
        for (let i = 0; i < data.length; i += 16) {
            const v = Math.random() * 255;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
            data[i + 3] = alpha * 255;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // ============ 光晕效果 ============
    function drawGlows(period, t) {
        // 主光晕 - 缓慢移动
        const gx1 = width * 0.3 + Math.sin(t * 0.3) * width * 0.15;
        const gy1 = height * 0.4 + Math.cos(t * 0.2) * height * 0.1;
        const gr1 = Math.max(1, width * 0.35);
        const glow1 = ctx.createRadialGradient(gx1, gy1, 0, gx1, gy1, gr1);
        glow1.addColorStop(0, period.accent + '40');
        glow1.addColorStop(0.4, period.accent + '18');
        glow1.addColorStop(1, period.accent + '00');
        ctx.fillStyle = glow1;
        ctx.fillRect(0, 0, width, height);

        // 次光晕
        const gx2 = width * 0.7 + Math.cos(t * 0.25) * width * 0.12;
        const gy2 = height * 0.6 + Math.sin(t * 0.35) * height * 0.08;
        const gr2 = Math.max(1, width * 0.25);
        const glow2 = ctx.createRadialGradient(gx2, gy2, 0, gx2, gy2, gr2);
        glow2.addColorStop(0, period.accent2 + '30');
        glow2.addColorStop(0.5, period.accent2 + '10');
        glow2.addColorStop(1, period.accent2 + '00');
        ctx.fillStyle = glow2;
        ctx.fillRect(0, 0, width, height);

        // 第三光晕（小而亮）
        const gx3 = width * 0.5 + Math.sin(t * 0.4 + 1) * width * 0.2;
        const gy3 = height * 0.3 + Math.cos(t * 0.3 + 2) * height * 0.15;
        const gr3 = Math.max(1, width * 0.15);
        const glow3 = ctx.createRadialGradient(gx3, gy3, 0, gx3, gy3, gr3);
        glow3.addColorStop(0, period.accent + '25');
        glow3.addColorStop(0.6, period.accent + '08');
        glow3.addColorStop(1, period.accent + '00');
        ctx.fillStyle = glow3;
        ctx.fillRect(0, 0, width, height);
    }

    // ============ 科技网格线（2001时期）============
    function drawTechGrid(period, t) {
        if (getPeriodIndex(currentYear) !== 3) return;

        ctx.strokeStyle = period.accent + '0a';
        ctx.lineWidth = 1;

        // 水平线
        const spacing = 80;
        for (let y = 0; y < height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        // 垂直线
        for (let x = 0; x < width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    // ============ 流光线条 ============
    function drawFlowLines(period, t) {
        const idx = getPeriodIndex(currentYear);
        ctx.lineWidth = 1.5;

        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            const baseY = height * (0.2 + i * 0.15);
            const speed = 0.5 + i * 0.1;

            for (let x = 0; x < width; x += 4) {
                const y = baseY +
                    Math.sin(x * 0.005 + t * speed + i) * 40 +
                    Math.sin(x * 0.01 + t * speed * 0.7) * 20;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            const alpha = 0.08 + 0.04 * Math.sin(t + i);
            ctx.strokeStyle = period.accent + Math.round(alpha * 255).toString(16).padStart(2, '0');
            ctx.stroke();
        }
    }

    // ============ 主绘制函数 ============
    function draw() {
        const t = (Date.now() - startTime) * 0.001;
        const period = getPeriod(currentYear);

        // 1. 基础渐变背景
        const grad = ctx.createRadialGradient(
            width * 0.5, height * 0.5, 0,
            width * 0.5, height * 0.5, Math.max(1, width * 0.8)
        );
        grad.addColorStop(0, period.bg2);
        grad.addColorStop(0.6, period.bg1);
        grad.addColorStop(1, period.bg3);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. 光晕效果
        drawGlows(period, t);

        // 3. 科技网格（仅2001后）
        drawTechGrid(period, t);

        // 4. 流光线条
        drawFlowLines(period, t);

        // 5. 粒子
        updateParticles(period);
        drawParticles(period);

        // 6. 颗粒噪点（仅1956-1958）
        if (period.grain) {
            drawGrain(period.grainAlpha);
        }

        // 7. 更新纹理
        if (texture) {
            texture.needsUpdate = true;
        }
    }

    // ============ 动画循环 ============
    function animate() {
        draw();
        animFrame = requestAnimationFrame(animate);
    }

    // ============ 公开 API ============
    return {
        /**
         * 初始化动态背景
         * @param {object} graphInstance - ForceGraph3D 实例
         */
        init: function(graphInstance) {
            // 获取 ForceGraph3D 的 scene
            scene = graphInstance.scene();

            // 创建离屏 2D canvas
            canvas2d = document.createElement('canvas');
            canvas2d.width = width;
            canvas2d.height = height;
            ctx = canvas2d.getContext('2d');

            // 创建 Three.js CanvasTexture
            texture = new THREE.CanvasTexture(canvas2d);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            // 设置为场景背景（Three.js 官方方式，始终覆盖全视口）
            scene.background = texture;

            // 初始化粒子
            initParticles(120);

            // 启动动画
            startTime = Date.now();
            animate();

            console.log('[DynamicBackground] 初始化完成，使用 CanvasTexture + scene.background');
        },

        /**
         * 设置当前年份，切换历史时期风格
         * @param {number} year
         */
        setYear: function(year) {
            currentYear = year;
        },

        /**
         * 销毁资源
         */
        dispose: function() {
            if (animFrame) cancelAnimationFrame(animFrame);
            if (texture) texture.dispose();
            if (scene) scene.background = null;
            canvas2d = null;
            ctx = null;
            texture = null;
            scene = null;
            particles = [];
        }
    };
})();
