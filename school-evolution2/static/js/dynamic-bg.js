/**
 * 动态背景着色器 - 根据学校4个历史时期切换风格
 * 1956-1958: 成都地质勘探学院 - 黑白灰调，质朴建设感，颗粒感
 * 1958-1993: 成都地质学院 - 深蓝灰调，沉稳学术感，层叠波浪
 * 1993-2001: 成都理工学院 - 暖棕绿调，生机活力感，流动光晕
 * 2001-2025: 成都理工大学 - 现代紫青调，科技感，粒子星云
 */

const DynamicBackground = (function() {
    let renderer, scene, camera, mesh, uniforms;
    let animationId;
    let container;

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
        uniform float uTransition;  // 0-1 过渡进度
        uniform vec3 uColor1;       // 当前时期主色
        uniform vec3 uColor2;       // 当前时期副色
        uniform vec3 uColor3;       // 当前时期点缀色
        uniform float uNoiseScale;  // 噪声缩放
        uniform float uFlowSpeed;   // 流动速度
        uniform float uGrain;       // 颗粒感强度
        uniform float uWaveAmp;     // 波浪振幅
        uniform float uGlow;        // 发光强度
        
        varying vec2 vUv;
        
        // 简化版 Simplex 2D 噪声
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
        
        // FBM（分形布朗运动）
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
        
        // 颗粒感（胶片噪点）
        float grain(vec2 uv, float t) {
            return fract(sin(dot(uv, vec2(12.9898, 78.233)) + t) * 43758.5453);
        }
        
        void main() {
            vec2 uv = vUv;
            float t = uTime * uFlowSpeed;
            
            // === 基础噪声层 ===
            float n1 = fbm(uv * uNoiseScale + vec2(t * 0.3, t * 0.2));
            float n2 = fbm(uv * uNoiseScale * 1.5 + vec2(-t * 0.2, t * 0.15) + n1 * 0.5);
            float n3 = fbm(uv * uNoiseScale * 0.8 + vec2(t * 0.1, -t * 0.25) + n2 * 0.3);
            
            // === 波浪层 ===
            float wave = sin(uv.x * 3.0 + t + n1 * uWaveAmp) * 0.5 + 0.5;
            float wave2 = sin(uv.y * 2.5 - t * 0.7 + n2 * uWaveAmp * 0.8) * 0.5 + 0.5;
            
            // === 颜色混合 ===
            vec3 col = mix(uColor1, uColor2, smoothstep(-0.3, 0.7, n2));
            col = mix(col, uColor3, smoothstep(0.1, 0.9, n3 * wave) * 0.4);
            
            // === 发光效果 ===
            float glowEffect = smoothstep(0.3, 0.8, n1 * wave2) * uGlow;
            col += uColor3 * glowEffect * 0.3;
            
            // === 边缘暗角 ===
            float vignette = 1.0 - smoothstep(0.3, 1.2, length(uv - 0.5) * 1.4);
            col *= mix(0.6, 1.0, vignette);
            
            // === 颗粒感 ===
            float grainAmount = grain(uv * 500.0, uTime * 0.5);
            col += (grainAmount - 0.5) * uGrain * 0.15;
            
            // === 中心微亮 ===
            float centerGlow = smoothstep(0.8, 0.0, length(uv - 0.5)) * 0.1;
            col += centerGlow;
            
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    // 4个历史时期的参数配置
    const periodConfigs = {
        0: { // 1956-1958 成都地质勘探学院 - 黑白灰调，质朴建设感
            color1: [0.03, 0.03, 0.05],      // 近黑
            color2: [0.12, 0.11, 0.14],       // 深灰紫
            color3: [0.25, 0.24, 0.22],       // 暖灰
            noiseScale: 3.0,
            flowSpeed: 0.15,
            grain: 1.0,
            waveAmp: 0.3,
            glow: 0.2
        },
        1: { // 1958-1993 成都地质学院 - 深蓝灰调，沉稳学术感
            color1: [0.02, 0.04, 0.08],       // 深蓝黑
            color2: [0.06, 0.10, 0.18],       // 深蓝灰
            color3: [0.12, 0.18, 0.30],       // 中蓝
            noiseScale: 4.0,
            flowSpeed: 0.12,
            grain: 0.3,
            waveAmp: 0.5,
            glow: 0.4
        },
        2: { // 1993-2001 成都理工学院 - 暖棕绿调，生机活力感
            color1: [0.04, 0.05, 0.03],       // 深绿黑
            color2: [0.10, 0.12, 0.06],       // 深橄榄
            color3: [0.18, 0.22, 0.10],       // 暖绿棕
            noiseScale: 3.5,
            flowSpeed: 0.2,
            grain: 0.2,
            waveAmp: 0.6,
            glow: 0.6
        },
        3: { // 2001-2025 成都理工大学 - 现代紫青调，科技感
            color1: [0.03, 0.02, 0.06],       // 深紫黑
            color2: [0.08, 0.05, 0.15],       // 深紫
            color3: [0.15, 0.25, 0.35],       // 青蓝
            noiseScale: 5.0,
            flowSpeed: 0.18,
            grain: 0.15,
            waveAmp: 0.4,
            glow: 0.8
        }
    };

    function getPeriodIndex(year) {
        if (year < 1958) return 0;       // 成都地质勘探学院
        if (year < 1993) return 1;       // 成都地质学院
        if (year < 2001) return 2;       // 成都理工学院
        return 3;                         // 成都理工大学
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function lerpArr(a, b, t) {
        return a.map((v, i) => lerp(v, b[i], t));
    }

    let currentPeriod = 3;
    let targetPeriod = 3;
    let transitionProgress = 1.0;

    function init(containerEl) {
        container = containerEl;

        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        uniforms = {
            uTime: { value: 0 },
            uTransition: { value: 1.0 },
            uColor1: { value: new THREE.Vector3(...periodConfigs[3].color1) },
            uColor2: { value: new THREE.Vector3(...periodConfigs[3].color2) },
            uColor3: { value: new THREE.Vector3(...periodConfigs[3].color3) },
            uNoiseScale: { value: periodConfigs[3].noiseScale },
            uFlowSpeed: { value: periodConfigs[3].flowSpeed },
            uGrain: { value: periodConfigs[3].grain },
            uWaveAmp: { value: periodConfigs[3].waveAmp },
            uGlow: { value: periodConfigs[3].glow }
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

        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '0';
        renderer.domElement.style.pointerEvents = 'none';
        container.insertBefore(renderer.domElement, container.firstChild);

        window.addEventListener('resize', onResize);
        animate();
    }

    function onResize() {
        if (!container || !renderer) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        
        uniforms.uTime.value = performance.now() * 0.001;

        // 处理过渡
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

            if (transitionProgress >= 1.0) {
                currentPeriod = targetPeriod;
            }
        }

        renderer.render(scene, camera);
    }

    function smoothstep(t) {
        return t * t * (3 - 2 * t);
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
        if (animationId) cancelAnimationFrame(animationId);
        if (renderer) {
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
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
