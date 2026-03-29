/**
 * 成都理工大学沿革系统 - WebGL 3D 旗舰版 (最终调优版)
 * 目标：实现完美的球体分层、修复搜索定位逻辑
 */
const Graph = (() => {
    let graphInstance;
    let currentYear = 2025;
    const loader = new THREE.TextureLoader();

    function init() {
        const container = document.getElementById('3d-graph');
        if (!container) return;

        // 1. 初始化 3D 引擎
        graphInstance = ForceGraph3D()(container)
            .backgroundColor('#010208')
            .showNavInfo(false)
            .nodeRelSize(4)
            // === 强化连线视觉效果 ===
            .linkColor(() => '#00ffff')           // 1. 使用高饱和度的亮青色
            .linkOpacity(0.8)                     // 2. 提高不透明度 (从0.3调到0.7)
            .linkWidth(1.5)                       // 3. 增加线条宽度 (从0.5调到1.5)

            // === 强化能量流粒子 (让连线“动起来”更显眼) ===
            .linkDirectionalParticles(4)          // 4. 增加粒子数量
            .linkDirectionalParticleSpeed(0.008)
            .linkDirectionalParticleWidth(3.0)    // 5. 增大粒子尺寸，使其产生霓虹闪烁感

            .nodeThreeObject(node => {
                const group = new THREE.Group();
                const isSchool = node.type === 'school';
                const isDept = node.type === 'department';
                const nodeColor = isSchool ? '#4a6cf7' : (isDept ? '#2ecc71' : '#e67e22');
                const size = isSchool ? 16 : (isDept ? 9 : 4.5);

                // A. 创建宝石球体 (MeshPhongMaterial 提供高光立体感)
                const geometry = new THREE.SphereGeometry(size, 32, 32);
                let material = new THREE.MeshPhongMaterial({
                    color: nodeColor,
                    emissive: nodeColor,
                    emissiveIntensity: 0.5,
                    shininess: 100,
                    specular: '#ffffff'
                });

                // 处理重要节点贴图
                const isVip = isSchool || ["环境", "体育", "计算机", "软件"].some(k => node.name.includes(k));
                if (isVip) {
                    let imgPath = '/static/images/school-badge.jpg';
                    if(node.name.includes("体育")) imgPath = '/static/images/PE-badge.jpg';
                    if(node.name.includes("环境")) imgPath = '/static/images/college-badge.jpg';
                    if(node.name.includes("计算机") || node.name.includes("软件")) imgPath = '/static/images/computer-badge.jpg';

                    loader.load(imgPath, (texture) => {
                        sphere.material = new THREE.MeshBasicMaterial({ map: texture });
                    });
                }

                const sphere = new THREE.Mesh(geometry, material);
                group.add(sphere);

                // B. 创建文字标签 (始终面向观众)
                const sprite = new SpriteText(node.name);
                sprite.color = '#ffffff';
                sprite.textHeight = isSchool ? 8 : 4.5;
                sprite.position.set(0, -(size + 12), 0);
                sprite.backgroundColor = 'rgba(0,0,0,0.4)';
                sprite.padding = 1.5;
                sprite.borderRadius = 4;
                group.add(sprite);

                return group;
            })
            // === 模拟矿物图谱的极细发光连线 ===
            .linkColor(() => 'rgba(0, 255, 255, 0.4)')
            .linkWidth(0.6)
            .linkDirectionalParticles(3)
            .linkDirectionalParticleSpeed(0.007)
            .linkDirectionalParticleWidth(2.5)
            .onNodeClick(node => focusOnNode(node));

        // 2. 场景灯光
        const scene = graphInstance.scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(1, 1, 1);
        scene.add(light);

        // 3. 开启自动旋转
        graphInstance.controls().autoRotate = true;
        graphInstance.controls().autoRotateSpeed = 0.5;

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

    // 核心函数：对焦节点
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
        const distance = 350;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graphInstance.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 1500);
    }

function loadYear(year) {
        currentYear = year;
        if (!graphInstance) return;

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

            // 1. 强力电荷力（排斥力）：在 3D 空间中全方位推开节点
            // 数值越负，球体越“膨胀”
            graphInstance.d3Force('charge').strength(-800);

            // 2. 弱化径向力：不要让它像“钢圈”一样死死勒住节点
            // 把 strength 从 1.5 调低到 0.5 左右，允许节点在前后方向偏离轨道
            graphInstance.d3Force('radial', d3.forceRadial(node => {
                if (node.type === 'school') return 0;
                if (node.type === 'department') return 300;
                return 700;
            }, 0, 0, 0).strength(0.5)); // 降低强度，让节点可以向前后扩散

            // 3. 连线力：保持逻辑结构
            graphInstance.d3Force('link').distance(node => {
                return node.source.type === 'school' ? 400 : 150;
            }).strength(0.5);

            // 4. 【新增】增加中心引力，防止节点散得太乱找不到
            graphInstance.d3Force('center', d3.forceCenter(0, 0));

            // 初始视角
            graphInstance.cameraPosition({ z: 1000 });

            const badge = document.getElementById('current-year-badge');
            if(badge) badge.textContent = year;
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
                    const distance = 250;
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

                                // 写入内容，解决“空的”问题
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