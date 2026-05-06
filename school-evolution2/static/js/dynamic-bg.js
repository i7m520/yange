/**
 * 动态背景着色器 - 根据学校4个历史时期切换风格
 * 
 * 核心方案：monkey-patch ForceGraph3D 渲染器的 render 方法
 * 在同一 WebGL 上下文中：先渲染背景场景，清除深度，再渲染图谱场景
 * 无需独立 canvas、无需透明、无需 z-index 分层
 * 
 * 1956-1958: 成都地质勘探学院 - 黑白颗粒，质朴建设感
 * 1958-1993: 成都地质学院 - 深蓝星尘，沉稳学术感
 * 1993-2001: 成都理工学院 - 暖橙流光，生机活力感
 * 2001-2025: 成都理工大学 - 紫蓝星云，科技感
 */

const DynamicBackground = (function() {
    let bgScene, bgCamera, mesh, uniforms;
    let patched = false;

    // 4个历史时期参数
    const periodConfigs = {
        0: { // 1956-1958 成都地质勘探学院 - 黑白颗粒
            color1: [0.08, 0.07, 0.10],
            color2: [0.22, 0.20, 0.26],
            color3: [0.45, 0.42, 0.38],
            noiseScale: 3.0,
            flowSpeed: 0.15,
            grain: 1.0,
            waveAmp: 0.3,
            glow: 0.3,
            brightness: 1.2
        },
        1: { // 1958-1993 成都地质学院 - 深蓝星尘
            color1: [0.03, 0.06, 0.15],
            color2: [0.10, 0.18, 0.35],
            color3: [0.20, 0.35, 0.55],
            noiseScale: 4.0,
            flowSpeed: 0.12,
            grain: 0.3,
            waveAmp: 0.5,
            glow: 0.6,
            brightness: 1.3
        },
        2: { // 1993-2001 成都理工学院 - 暖橙流光
            color1: [0.10, 0.06, 0.02],
            color2: [0.25, 0.15, 0.05],
            color3: [0.50, 0.30, 0.10],
            noiseScale: 3.5,
            flowSpeed: 0.2,
            grain: 0.2,
            waveAmp: 0.6,
            glow: 0.8,
            brightness: 1.4
        },
        3: { // 2001-2025 成都理工大学 - 紫蓝星云
            color1: [0.06, 0.03, 0.14],
            color2: [0.15, 0.08, 0.30],
            color3: [0.25, 0.40, 0.55],
            noiseScale: 5.0,
            flowSpeed: 0.18,
            grain: 0.15,
            waveAmp: 0.4,
            glow: 1.0,
            brightness: 1.3
        }
    };

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
            m = m*m; m = m*m;
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
            float f = 0.0, w = 0.5;
            for(int i = 0; i < 5; i++) { f += w * snoise(p); p *= 2.0; w *= 0.5; }
            return f;
        }
        
        float grain(vec2 uv, float t) {
            return fract(sin(dot(uv, vec2(12.9898, 78.233)) + t) * 43758.5453);
        }
        
        void main() {
            vec2 uv = vUv;
            float t = uTime * uFlowSpeed;
            
            float n1 = fbm(uv * uNoiseScale + vec2(t * 0.3, t * 0.2));
            float n2 = fbm(uv * uNoiseScale * 1.5 + vec2(-t * 0.2, t * 0.15) + n1 * 0.5);
            float n3 = fbm(uv * uNoiseScale * 0.8 + vec2(t * 0.1, -t * 0.25) + n2 * 0.3);
            
            float wave = sin(uv.x * 3.0 + t + n1 * uWaveAmp) * 0.5 + 0.5;
            float wave2 = sin(uv.y * 2.5 - t * 0.7 + n2 * uWaveAmp * 0.8) * 0.5 + 0.5;
            
            vec3 col = mix(uColor1, uColor2, smoothstep(-0.3, 0.7, n2));
            col = mix(col, uColor3, smoothstep(0.1, 0.9, n3 * wave) * 0.5);
            
            float glowEffect = smoothstep(0.3, 0.8, n1 * wave2) * uGlow;
            col += uColor3 * glowEffect * 0.4;
            
            float centerGlow = smoothstep(0.8, 0.0, length(uv - 0.5)) * 0.15 * uBrightness;
            col += centerGlow * uColor3;
            
            float vignette = 1.0 - smoothstep(0.3, 1.2, length(uv - 0.5) * 1.4);
            col *= mix(0.5, 1.0, vignette);
            
            float grainAmount = grain(uv * 500.0, uTime * 0.5);
            col += (grainAmount - 0.5) * uGrain * 0.12;
            
            col *= uBrightness;
            
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function getPeriodIndex(year) {
        if (year < 1958) return 0;
        if (year < 1993) return 1;
        if (year < 2001) return 2;
        return 3;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function lerpArr(a, b, t) { return a.map((v, i) => lerp(v, b[i], t)); }
    function smoothstep(t) { return t * t * (3 - 2 * t); }

    let currentPeriod = 3;
    let targetPeriod = 3;
    let transitionProgress = 1.0;

    function init(graphInstance) {
        if (patched) return;

        // ForceGraph3D 延迟创建渲染器，需要等待
        function tryInit() {
            const renderer = graphInstance.renderer();
            const fgScene = graphInstance.scene();

            if (!renderer || !fgScene) {
                console.log('[DynamicBackground] 等待渲染器初始化...');
                setTimeout(tryInit, 200);
                return;
            }

            console.log('[DynamicBackground] 渲染器已就绪，开始初始化');

            // 1. 创建背景场景（独立的 Three.js 场景 + 正交相机）
            bgScene = new THREE.Scene();
            bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

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
            mesh.frustumCulled = false;
            bgScene.add(mesh);

            // 2. 移除 ForceGraph3D 场景的纯色背景
            fgScene.background = null;

            // 3. Monkey-patch 渲染器：先画背景场景，再画图谱场景
            renderer.autoClear = false;
            const origRender = renderer.render.bind(renderer);

            renderer.render = function(scene, camera) {
                // 更新 shader 时间
                uniforms.uTime.value = performance.now() * 0.001;

                // 更新过渡动画
                updateTransition();

                // 确保主场景无纯色背景覆盖
                if (scene.background) scene.background = null;

                // 先清除所有缓冲
                this.clear();
                // 渲染背景场景（填满屏幕的 shader）
                origRender.call(this, bgScene, bgCamera);
                // 只清除深度缓冲，保留颜色缓冲（背景颜色保留）
                this.clearDepth();
                // 渲染主场景（图谱节点画在背景之上）
                origRender.call(this, scene, camera);
            };

            patched = true;
            console.log('[DynamicBackground] 初始化完成，monkey-patch 已应用');
        }

        // 延迟尝试初始化
        setTimeout(tryInit, 500);
    }

    function updateTransition() {
        if (transitionProgress >= 1.0) return;

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

    function setYear(year) {
        const newPeriod = getPeriodIndex(year);
        if (newPeriod !== targetPeriod && transitionProgress >= 0.5) {
            currentPeriod = targetPeriod;
            targetPeriod = newPeriod;
            transitionProgress = 0.0;
        }
    }

    function destroy() {
        if (mesh) {
            bgScene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        patched = false;
    }

    return {
        init: init,
        setYear: setYear,
        destroy: destroy
    };
})();
