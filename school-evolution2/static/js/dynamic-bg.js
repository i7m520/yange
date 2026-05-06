/**
 * 动态背景着色器 - 根据学校4个历史时期切换风格
 * 
 * 方案：在 ForceGraph3D 场景中添加背景 Shader Mesh
 * - 创建一个覆盖全屏的 PlaneGeometry + ShaderMaterial
 * - 放在相机最远处，设置 renderOrder = -9999
 * - 清除 ForceGraph3D 的 scene.background
 * - 通过 onRenderFrame 回调更新 shader 时间
 * 
 * 1956-1958: 成都地质勘探学院 - 黑白颗粒，质朴建设感
 * 1958-1993: 成都地质学院 - 深蓝星尘，沉稳学术感
 * 1993-2001: 成都理工学院 - 暖橙流光，生机活力感
 * 2001-2025: 成都理工大学 - 紫蓝星云，科技感
 */

const DynamicBackground = (function() {
    let bgMesh, uniforms, scene;
    let initialized = false;

    // 4个历史时期参数 - 大幅提亮确保可见
    const periodConfigs = {
        0: { // 1956-1958 成都地质勘探学院 - 黑白颗粒
            color1: [0.12, 0.11, 0.15],
            color2: [0.30, 0.28, 0.34],
            color3: [0.55, 0.52, 0.48],
            noiseScale: 3.0,
            flowSpeed: 0.15,
            grain: 0.8,
            waveAmp: 0.3,
            glow: 0.4,
            brightness: 1.5
        },
        1: { // 1958-1993 成都地质学院 - 深蓝星尘
            color1: [0.05, 0.08, 0.22],
            color2: [0.15, 0.25, 0.45],
            color3: [0.30, 0.45, 0.65],
            noiseScale: 4.0,
            flowSpeed: 0.12,
            grain: 0.3,
            waveAmp: 0.5,
            glow: 0.7,
            brightness: 1.5
        },
        2: { // 1993-2001 成都理工学院 - 暖橙流光
            color1: [0.15, 0.08, 0.03],
            color2: [0.35, 0.20, 0.08],
            color3: [0.60, 0.38, 0.15],
            noiseScale: 3.5,
            flowSpeed: 0.2,
            grain: 0.2,
            waveAmp: 0.6,
            glow: 0.9,
            brightness: 1.6
        },
        3: { // 2001-2025 成都理工大学 - 紫蓝星云
            color1: [0.08, 0.04, 0.18],
            color2: [0.20, 0.10, 0.38],
            color3: [0.35, 0.50, 0.70],
            noiseScale: 5.0,
            flowSpeed: 0.18,
            grain: 0.15,
            waveAmp: 0.4,
            glow: 1.2,
            brightness: 1.5
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
        if (initialized) return;

        console.log('[DynamicBackground] 开始初始化...');

        function tryInit() {
            try {
                const renderer = graphInstance.renderer();
                const fgScene = graphInstance.scene();

                console.log('[DynamicBackground] renderer:', renderer ? 'OK' : 'NULL');
                console.log('[DynamicBackground] scene:', fgScene ? 'OK' : 'NULL');

                if (!renderer || !fgScene) {
                    console.log('[DynamicBackground] 等待渲染器初始化...');
                    setTimeout(tryInit, 300);
                    return;
                }

                scene = fgScene;

                // 1. 创建全屏背景 mesh
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

                const geometry = new THREE.PlaneGeometry(1, 1);
                const material = new THREE.ShaderMaterial({
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    uniforms: uniforms,
                    depthWrite: false,
                    depthTest: false
                });

                bgMesh = new THREE.Mesh(geometry, material);
                bgMesh.frustumCulled = false;
                bgMesh.renderOrder = -9999;

                // 让 mesh 每帧覆盖全屏（在透视相机下）
                bgMesh.onBeforeRender = function(renderer, scene, camera) {
                    if (!camera) return;
                    // 计算相机远平面尺寸
                    const dist = camera.far * 0.95;
                    const vFov = camera.fov * Math.PI / 180;
                    const height = 2 * Math.tan(vFov / 2) * dist;
                    const width = height * camera.aspect;

                    bgMesh.scale.set(width, height, 1);
                    bgMesh.position.copy(camera.position);
                    bgMesh.quaternion.copy(camera.quaternion);
                    bgMesh.translateZ(-dist);
                };

                // 2. 添加到 ForceGraph3D 场景
                fgScene.add(bgMesh);

                // 3. 移除场景纯色背景（持续守护，防止 ForceGraph3D 重设）
                setInterval(() => {
                    if (fgScene.background) fgScene.background = null;
                }, 100);
                fgScene.background = null;

                // 4. 每帧更新 shader 时间
                function updateBg() {
                    if (!initialized) return;
                    uniforms.uTime.value = performance.now() * 0.001;
                    updateTransition();
                    requestAnimationFrame(updateBg);
                }

                initialized = true;
                updateBg();

                console.log('[DynamicBackground] 初始化完成 - 场景内 mesh 方案');

            } catch (e) {
                console.error('[DynamicBackground] 初始化失败:', e);
                setTimeout(tryInit, 500);
            }
        }

        // 延迟启动，确保 ForceGraph3D 已完全初始化
        setTimeout(tryInit, 800);
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
        if (bgMesh && scene) {
            scene.remove(bgMesh);
            bgMesh.geometry.dispose();
            bgMesh.material.dispose();
        }
        initialized = false;
    }

    return {
        init: init,
        setYear: setYear,
        destroy: destroy
    };
})();
