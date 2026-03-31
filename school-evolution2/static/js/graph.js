/**
 * 成都理工大学沿革系统 - WebGL 3D 旗舰版 (矿物图谱风格)
 * 目标：实现完美的球体分层、修复搜索定位逻辑
 */
const Graph = (() => {
    let graphInstance;
    let currentYear = 2025;
    const loader = new THREE.TextureLoader();

    // ==========================================
    // 【配色方案 - 参考矿物图谱风格】
    // 蓝色系渐变：深蓝(学校) -> 中蓝(院系) -> 浅蓝(专业)
    // ==========================================
    const COLORS = {
        school: '#1E3A8A',      // 学校：深蓝色
        department: '#3B82F6',   // 院系：中蓝色
        major: '#93C5FD',        // 专业：浅蓝色
        link: 'rgba(180, 190, 210, 0.55)',  // 连线：浅灰色（更明显）
        particle: '#60A5FA',     // 粒子：亮蓝色
        background: '#050810',   // 背景：深近乎纯黑的暗蓝色
        glow: '#3B82F6'          // 发光色：蓝色
    };

    // ==========================================
    // 【字号方案 - 三级层级】匹配矿物图谱风格
    // ==========================================
    const FONT_SIZES = {
        school: 18,       // 学校：最大
        department: 11,    // 院系：中等
        major: 7          // 专业：最小
    };

    function init() {
        const container = document.getElementById('3d-graph');
        if (!container) return;

        // 1. 初始化 3D 引擎
        graphInstance = ForceGraph3D()(container)
            .backgroundColor(COLORS.background)
            .showNavInfo(false)
            .nodeRelSize(4)
            
            // === 浅灰色连线（矿物图谱风格）===
            .linkColor(() => COLORS.link)
            .linkOpacity(0.9)
            .linkWidth(1.0)

            // === 能量流粒子（让连线"动起来"）===
            .linkDirectionalParticles(2)
            .linkDirectionalParticleSpeed(0.003)
            .linkDirectionalParticleWidth(1.2)
            .linkDirectionalParticleColor(() => COLORS.particle)

            .nodeThreeObject(node => {
                const group = new THREE.Group();
                const isSchool = node.type === 'school';
                const isDept = node.type === 'department';
                
                // 蓝色系配色：深蓝(学校) -> 中蓝(院系) -> 浅蓝(专业)
                const nodeColor = isSchool ? COLORS.school : (isDept ? COLORS.department : COLORS.major);
                
                // 节点大小：学校最大，院系中等(学校的1/2)，专业最小(学校的1/4)
                const size = isSchool ? 35 : (isDept ? 18 : 9);

                // A. 创建发光球体（矿物图谱风格：圆形节点 + 外发光）
                const geometry = new THREE.SphereGeometry(size, 32, 32);
                
                // 创建渐变材质
                let material = new THREE.MeshPhongMaterial({
                    color: nodeColor,
                    emissive: nodeColor,
                    emissiveIntensity: isSchool ? 0.6 : (isDept ? 0.4 : 0.25),
                    shininess: 80,
                    specular: '#ffffff',
                    transparent: true,
                    opacity: 0.9
                });

                const sphere = new THREE.Mesh(geometry, material);
                group.add(sphere);

                // C. 创建文字标签（三级字号）- 放在节点上方避免被遮挡
                const sprite = new SpriteText(node.name);
                sprite.color = '#ffffff';
                
                // 字号：学校最大，院系中等，专业最小（参考矿物图谱）
                sprite.textHeight = isSchool ? FONT_SIZES.school : (isDept ? FONT_SIZES.department : FONT_SIZES.major);
                
                // 字体加粗（参考矿物图谱风格）
                sprite.fontWeight = isSchool ? '900' : (isDept ? '800' : '700');
                sprite.fontFace = 'PingFang SC, Microsoft YaHei, sans-serif';
                
                // 文字描边，增强可读性
                sprite.textWidth = sprite.textHeight * node.name.length * 0.8;
                
                // 标签放在节点上方（正Y方向），旋转时不易被遮挡
                sprite.position.set(0, size + 12, 0);
                // 透明背景，更简洁美观
                sprite.backgroundColor = 'transparent';
                sprite.padding = 0;
                sprite.borderRadius = 0;
                // 设置渲染顺序，确保标签在球体之上
                sprite.renderOrder = 999;
                sprite.material.depthTest = false;
                group.add(sprite);

                return group;
            })
            .onNodeClick(node => focusOnNode(node));

        // 2. 场景灯光
        const scene = graphInstance.scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(1, 1, 1);
        scene.add(light);

        // 3. 开启自动旋转（围绕中心学校节点）
        graphInstance.controls().autoRotate = true;
        graphInstance.controls().autoRotateSpeed = 0.5;
        graphInstance.controls().target.set(0, 0, 0); // 旋转中心设为原点（学校节点位置）

        // 4. 修复面板关闭按钮
        const closeBtn = document.getElementById('detail-close');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.preventDefault();
                document.getElementById('detail-panel').classList.add('hidden');
            };
        }

        loadYear(2025);
    }

    // 核心函数：对焦节点并展示深度详情
    function focusOnNode(node) {
        if (!node) return;

        const qn = node.type === 'major' ? node.name : node.id;
        fetch(`/api/detail?name=${encodeURIComponent(qn)}&year=${currentYear}`)
            .then(r => r.json()).then(detail => {
                const panel = document.getElementById('detail-panel');
                const content = document.getElementById('detail-content');
                const title = document.getElementById('detail-title');

                if (panel && content) {
                    panel.classList.remove('hidden');
                    title.textContent = detail.name;

                    let html = `<div class="detail-info">`;

                    // 1. 基础信息行
                    html += `<p><span>类型:</span> ${detail.type === 'school' ? '学校' : detail.type === 'department' ? '院系' : '专业学科'}</p>`;
                    if(detail.year_range) html += `<p><span>存续:</span> ${detail.year_range}</p>`;
                    if(detail.school && detail.type !== 'school') html += `<p><span>隶属:</span> ${detail.school}</p>`;
                    if(detail.code) html += `<p><span>代码:</span> ${detail.code}</p>`;
                    if(detail.duration) html += `<p><span>学制:</span> ${detail.duration}年</p>`;

                    // 2. 学校特有：下辖院系
                    if(detail.departments && detail.departments.length > 0) {
                        html += `<h4>下辖院系 (${detail.departments.length})</h4><div class="tag-list">`;
                        detail.departments.forEach(d => {
                            html += `<span class="tag-item" onclick="Graph.clickTag('${d}')">${d}</span>`;
                        });
                        html += `</div>`;
                    }

                    // 3. 学院特有：下辖专业
                    if(detail.majors && detail.majors.length > 0) {
                        html += `<h4>开设专业 (${detail.majors.length})</h4><div class="tag-list">`;
                        detail.majors.forEach(m => {
                            html += `<span class="tag-item" onclick="Graph.clickTag('${m}')">${m}</span>`;
                        });
                        html += `</div>`;
                    }

                    // 4. 沿革历史 (Timeline)
                    const evolution = detail.history || detail.name_evolution || detail.dept_evolution;
                    if(evolution && evolution.length > 0) {
                        html += `<h4>发展沿革</h4><div class="evolution-timeline">`;
                        evolution.forEach(e => {
                            const time = e.period || e.year;
                            const name = e.name || e.department;
                            const isCurrent = name === detail.name || name === detail.department;
                            html += `
                                <div class="evolution-item ${isCurrent ? 'current' : ''}">
                                    <span class="evolution-year">${time}</span>
                                    <span class="evolution-name">${name}</span>
                                </div>`;
                        });
                        html += `</div>`;
                    }

                    // 5. 说明备注
                    if(detail.note) {
                        html += `<h4>备注说明</h4><p class="detail-note">${detail.note}</p>`;
                    }

                    html += `</div>`;
                    content.innerHTML = html;
                }
            });

        // 镜头飞行逻辑保持不变
        const distance = 500;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graphInstance.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 1500);
    }

function loadYear(year) {
        currentYear = year;
        if (!graphInstance) return;

        // 记录加载开始时间
        const loadStartTime = Date.now();
        const minLoadTime = 2000; // 最少显示2秒加载动画

        fetch(`/api/graph?year=${year}`).then(r => r.json()).then(data => {
            // 在格式化节点数据时，给每个节点一个随机的初始 Z 坐标
            // 这能打破平面的平衡，让力场把它们推向前后空间
            const gData = {
                nodes: data.nodes.map(n => ({
                    id: n.id,
                    name: n.name,
                    type: n.type,
                    // 给一个随机初始位，防止所有点初始都在 Z=0 的平面上
                    z: Math.random() * 100 - 50
                })),
                links: data.links.map(l => ({ source: l.source, target: l.target }))
            };

            graphInstance.graphData(gData);

            // ==========================================
            // 【核心修改：实现球体化布局】
            // ==========================================

            // 1. 电荷力（排斥力）：增加排斥力让专业节点炸开
            graphInstance.d3Force('charge').strength(-900);

            // 2. 径向力：专业节点径向距离加大，有更多空间分散
            graphInstance.d3Force('radial', d3.forceRadial(node => {
                if (node.type === 'school') return 0;
                if (node.type === 'department') return 260;
                return 850;  // 专业节点放在更外圈，有更多空间
            }, 0, 0, 0).strength(0.5));

            // 3. 连线力：保持逻辑结构
            graphInstance.d3Force('link').distance(node => {
                return node.source.type === 'school' ? 350 : 180;
            }).strength(0.5);

            // 4. 中心引力，防止节点散得太乱
            graphInstance.d3Force('center', d3.forceCenter(0, 0));

            // 初始视角
            graphInstance.cameraPosition({ z: 1200 });

            // 设置旋转中心为学校节点位置
            setTimeout(() => {
                const nodes = graphInstance.graphData().nodes;
                const schoolNode = nodes.find(n => n.type === 'school');
                if (schoolNode && !isNaN(schoolNode.x) && !isNaN(schoolNode.y) && !isNaN(schoolNode.z)) {
                    graphInstance.controls().target.set(schoolNode.x, schoolNode.y, schoolNode.z);
                }
            }, 1000);

            const badge = document.getElementById('current-year-badge');
            if(badge) badge.textContent = year;
            
            // 隐藏加载动画（确保至少显示2秒）
            const elapsed = Date.now() - loadStartTime;
            const remainingTime = Math.max(0, minLoadTime - elapsed);
            
            setTimeout(() => {
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                }
            }, remainingTime);
        });
    }

// 在 graph.js 的 return 块中修改：
    return {
        init: init,
        loadYear: loadYear,
        // === 修复版 clickTag：对焦的同时填充右侧面板 ===
        clickTag: (nodeName) => {
            if (!graphInstance) return;

            // 给图谱一点加载时间
            setTimeout(() => {
                const { nodes } = graphInstance.graphData();

                // 1. 寻找目标节点对象
                const target = nodes.find(n =>
                    n.name === nodeName ||
                    n.id === nodeName ||
                    (n.id && n.id.startsWith(nodeName + "("))
                );

                if (target) {
                    // 2. 执行摄像头对焦
                    const distance = 400;
                    const distRatio = 1 + distance / Math.hypot(target.x, target.y, target.z);
                    graphInstance.cameraPosition(
                        { x: target.x * distRatio, y: target.y * distRatio, z: target.z * distRatio },
                        target,
                        2000
                    );

                    // 3. 【核心修复】立即抓取数据并填充右侧详情栏
                    const qn = target.type === 'major' ? target.name : target.id;
                    fetch(`/api/detail?name=${encodeURIComponent(qn)}&year=${currentYear}`)
                        .then(r => r.json())
                        .then(detail => {
                            const panel = document.getElementById('detail-panel');
                            const content = document.getElementById('detail-content');
                            const title = document.getElementById('detail-title');

                            if (panel && content) {
                                // 显示面板
                                panel.classList.remove('hidden');
                                title.textContent = detail.name;

                                // 生成并填充 HTML 内容（这部分逻辑必须和 focusOnNode 保持一致）
                                let html = `<div class="detail-info">`;
                                html += `<p><span>类型:</span> ${detail.type === 'school' ? '学校' : detail.type === 'department' ? '院系' : '专业学科'}</p>`;
                                if(detail.year_range) html += `<p><span>存续:</span> ${detail.year_range}</p>`;
                                if(detail.code) html += `<p><span>代码:</span> ${detail.code}</p>`;

                                // 历史沿革
                                const evolution = detail.history || detail.name_evolution || detail.dept_evolution;
                                if(evolution && evolution.length > 0) {
                                    html += `<h4>发展沿革</h4><div class="evolution-timeline">`;
                                    evolution.forEach(e => {
                                        const time = e.period || e.year;
                                        const name = e.name || e.department;
                                        const isCurrent = name === detail.name || name === detail.department;
                                        html += `
                                            <div class="evolution-item ${isCurrent ? 'current' : ''}">
                                                <span class="evolution-year">${time}</span>
                                                <span class="evolution-name">${name}</span>
                                            </div>`;
                                    });
                                    html += `</div>`;
                                }

                                if(detail.note) html += `<h4>备注说明</h4><p class="detail-note">${detail.note}</p>`;
                                html += `</div>`;

                                // 写入内容，解决"空的"问题
                                content.innerHTML = html;
                            }
                        });
                }
            }, 500);
        }
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    Graph.init();
});
