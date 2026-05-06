/**
 * 动态背景着色器 - 根据学校4个历史时期切换风格
 * 使用独立的 WebGL 渲染器，画布放在 ForceGraph3D 之下
 * 
 * 1956-1958: 成都地质勘探学院 - 黑白颗粒，质朴建设感
 * 1958-1993: 成都地质学院 - 深蓝星尘，沉稳学术感
 * 1993-2001: 成都理工学院 - 暖橙流光，生机活力感
 * 2001-2025: 成都理工大学 - 紫蓝星云，科技感
 */

const DynamicBackground = (function() {
    let renderer, scene, camera, mesh, uniforms;
    let animationId;
    let canvas;

    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        precision highp float;
        
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform float uNoiseScale;
        uniform float uFlowSpeed;
        uniform float uGrain;
        uniform float uWaveAmp;
        uniform float uGlow;
        uniform float uBrightness;
        
        varying vec2 vUv;
        
        // Simplex 2D 噪声
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                               -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1;
            i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                + i.x + vec3(0.0, i1.x, 1.0));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                dot(x12.zw,x12.zw)), 0.0);
            m = m*m;
            m = m*m;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
            vec3 g;
            g.x = a0.x * x0.x + h.x * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }
        
        float fbm(vec2 p) {
            float f = 0.0;
            float w = 0.5;
            for(int i = 0; i < 5; i++) {
                f += w * snoise(p);
                p *= 2.0;
                w *= 0.5;
            }
            return f;
        }
        
        float grain(vec2 uv, float t) {
            return fract(sin(dot(uv, vec2(12.9898, 78.233)) + t) * 43758.5453);
        }
        
        void main() {
            vec2 uv = vUv;
            float t = uTime * uFlowSpeed;
            
            // 基础噪声层
            float n1 = fbm(uv * uNoiseScale + vec2(t * 0.3, t * 0.2));
            float n2 = fbm(uv * uNoiseScale * 1.5 + vec2(-t * 0.2, t * 0.15) + n1 * 0.5);
            float n3 = fbm(uv * uNoiseScale * 0.8 + vec2(t * 0.1, -t * 0.25) + n2 * 0.3);
            
            // 波浪层
            float wave = sin(uv.x * 3.0 + t + n1 * uWaveAmp) * 0.5 + 0.5;
            float wave2 = sin(uv.y * 2.5 - t * 0.7 + n2 * uWaveAmp * 0.8) * 0.5 + 0.5;
            
            // 颜色混合
            vec3 col = mix(uColor1, uColor2, smoothstep(-0.3, 0.7, n2));
            col = mix(col, uColor3, smoothstep(0.1, 0.9, n3 * wave) * 0.5);
            
            // 发光效果
            float glowEffect = smoothstep(0.3, 0.8, n1 * wave2) * uGlow;
            col += uColor3 * glowEffect * 0.4;
            
            // 中心亮光
            float centerGlow = smoothstep(0.8, 0.0, length(uv - 0.5)) * 0.15 * uBrightness;
            col += centerGlow * uColor3;
            
            // 边缘暗角
            float vignette = 1.0 - smoothstep(0.3, 1.2, length(uv - 0.5) * 1.4);
            col *= mix(0.5, 1.0, vignette);
            
            // 颗粒感
            float grainAmount = grain(uv * 500.0, uTime * 0.5);
            col += (grainAmount - 0.5) * uGrain * 0.12;
            
            // 整体亮度
            col *= uBrightness;
            
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    // 4个历史时期参数 - 颜色大幅提亮
    const periodConfigs = {
        0: { // 1956-1958 成都地质勘探学院 - 黑白颗粒，质朴建设感
            color1: [0.08, 0.07, 0.10],       // 暗紫灰
            color2: [0.22, 0.20, 0.26],       // 灰紫
            color3: [0.45, 0.42, 0.38],       // 暖灰亮
            noiseScale: 3.0,
            flowSpeed: 0.15,
            grain: 1.0,
            waveAmp: 0.3,
            glow: 0.3,
            brightness: 1.2
        },
        1: { // 1958-1993 成都地质学院 - 深蓝星尘，沉稳学术感
            color1: [0.03, 0.06, 0.15],       // 深蓝
            color2: [0.10, 0.18, 0.35],       // 中蓝
            color3: [0.20, 0.35, 0.55],       // 亮蓝
            noiseScale: 4.0,
            flowSpeed: 0.12,
            grain: 0.3,
            waveAmp: 0.5,
            glow: 0.6,
            brightness: 1.3
        },
        2: { // 1993-2001 成都理工学院 - 暖橙流光，生机活力感
            color1: [0.10, 0.06, 0.02],       // 暗棕
            color2: [0.25, 0.15, 0.05],       // 暖棕
            color3: [0.50, 0.30, 0.10],       // 亮橙
            noiseScale: 3.5,
            flowSpeed: 0.2,
            grain: 0.2,
            waveAmp: 0.6,
            glow: 0.8,
            brightness: 1.4
        },
        3: { // 2001-2025 成都理工大学 - 紫蓝星云，科技感
            color1: [0.06, 0.03, 0.14],       // 深紫
            color2: [0.15, 0.08, 0.30],       // 中紫
            color3: [0.25, 0.40, 0.55],       // 亮青蓝
            noiseScale: 5.0,
            flowSpeed: 0.18,
            grain: 0.15,
            waveAmp: 0.4,
            glow: 1.0,
            brightness: 1.3
        }
    };

    function getPeriodIndex(year) {
        if (year < 1958) return 0;
        if (year < 1993) return 1;
        if (year < 2001) return 2;
        return 3;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function lerpArr(a, b, t) { return a.map((v, i) => lerp(v, b[i], t)); }

    let currentPeriod = 3;
    let targetPeriod = 3;
    let transitionProgress = 1.0;

    function init(containerEl) {
        // 创建独立 canvas 放在 ForceGraph3D 画布后面
        canvas = document.createElement('canvas');
        canvas.id = 'dynamic-bg-canvas';
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
        containerEl.insertBefore(canvas, containerEl.firstChild);

        // ForceGraph3D 的画布提到上层
        const fgCanvas = containerEl.querySelector('canvas');
        if (fgCanvas) {
            fgCanvas.style.position = 'relative';
            fgCanvas.style.zIndex = '1';
        }

        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const cfg = periodConfigs[3];
        uniforms = {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Vector3(...cfg.color1) },
            uColor2: { value: new THREE.Vector3(...cfg.color2) },
            uColor3: { value: new THREE.Vector3(...cfg.color3) },
            uNoiseScale: { value: cfg.noiseScale },
            uFlowSpeed: { value: cfg.flowSpeed },
            uGrain: { value: cfg.grain },
            uWaveAmp: { value: cfg.waveAmp },
            uGlow: { value: cfg.glow },
            uBrightness: { value: cfg.brightness }
        };

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: uniforms,
            depthWrite: false,
            depthTest: false
        });

        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false });
        renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        window.addEventListener('resize', onResize);
        animate();
    }

    function onResize() {
        const parent = canvas.parentElement;
        if (!parent || !renderer) return;
        renderer.setSize(parent.clientWidth, parent.clientHeight);
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        uniforms.uTime.value = performance.now() * 0.001;

        if (transitionProgress < 1.0) {
            transitionProgress = Math.min(1.0, transitionProgress + 0.008);
            const t = smoothstep(transitionProgress);
            const from = periodConfigs[currentPeriod];
            const to = periodConfigs[targetPeriod];

            uniforms.uColor1.value.set(...lerpArr(from.color1, to.color1, t));
            uniforms.uColor2.value.set(...lerpArr(from.color2, to.color2, t));
            uniforms.uColor3.value.set(...lerpArr(from.color3, to.color3, t));
            uniforms.uNoiseScale.value = lerp(from.noiseScale, to.noiseScale, t);
            uniforms.uFlowSpeed.value = lerp(from.flowSpeed, to.flowSpeed, t);
            uniforms.uGrain.value = lerp(from.grain, to.grain, t);
            uniforms.uWaveAmp.value = lerp(from.waveAmp, to.waveAmp, t);
            uniforms.uGlow.value = lerp(from.glow, to.glow, t);
            uniforms.uBrightness.value = lerp(from.brightness, to.brightness, t);

            if (transitionProgress >= 1.0) {
                currentPeriod = targetPeriod;
            }
        }

        renderer.render(scene, camera);
    }

    function smoothstep(t) { return t * t * (3 - 2 * t); }

    function setYear(year) {
        const newPeriod = getPeriodIndex(year);
        if (newPeriod !== targetPeriod && transitionProgress >= 0.5) {
            currentPeriod = targetPeriod;
            targetPeriod = newPeriod;
            transitionProgress = 0.0;
        }
    }

    function makeGraphTransparent(graphInstance) {
        // 让 ForceGraph3D 的渲染器透明，露出后面的背景画布
        const fgRenderer = graphInstance.renderer();
        if (fgRenderer) {
            fgRenderer.setClearColor(0x000000, 0);
        }
        const fgScene = graphInstance.scene();
        if (fgScene) {
            fgScene.background = null;
        }
        // ForceGraph3D 的 canvas 也要设置透明
        const fgCanvas = fgRenderer ? fgRenderer.domElement : null;
        if (fgCanvas) {
            fgCanvas.style.position = 'relative';
            fgCanvas.style.zIndex = '1';
        }
    }

    function destroy() {
        if (animationId) cancelAnimationFrame(animationId);
        if (renderer) {
            renderer.dispose();
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }
        window.removeEventListener('resize', onResize);
    }

    return {
        init: init,
        setYear: setYear,
        destroy: destroy
    };
})();
