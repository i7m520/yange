// Sidebar - 抽屉式搜索模块 (优化版)
const Sidebar = (() => {
    let collegeList = [];
    let majorList = [];
    let currentTab = 'year';

    function init() {
        // 启用抽屉开关逻辑
        setupDrawer();

        setupTabs();
        setupYearSearch();
        setupCollegeSearch();
        setupMajorSearch();
        loadAutocompleteLists();

        // 这里的 setupToggle 是原本的小箭头逻辑，如果 index.html 删了该 ID，函数内部有安全检查
        setupToggle();
    }

    // --- 1. 抽屉式侧边栏开关逻辑 (点击条形拉手) ---
    function setupDrawer() {
        const sidebar = document.getElementById('sidebar');
        const handle = document.getElementById('search-drawer-handle');

        if (handle && sidebar) {
            handle.onclick = (e) => {
                e.stopPropagation();
                // 切换 drawer-closed 类
                sidebar.classList.toggle('drawer-closed');

                // 变换图标
                const icon = handle.querySelector('i');
                if (sidebar.classList.contains('drawer-closed')) {
                    icon.className = 'fas fa-search';
                } else {
                    icon.className = 'fas fa-chevron-left';
                }
            };
        }
    }

    // 在 Sidebar.init() 的最后一行调用 setupDrawer();

    // --- 2. 原有的折叠按钮逻辑 (保留兼容性) ---
    function setupToggle() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebar-toggle');
        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('drawer-closed'); // 统一使用 drawer-closed 类名
                setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 400);
            });
        }
    }

    // --- 3. 搜索选项卡切换 ---
    function setupTabs() {
        const tabs = document.querySelectorAll('.search-tab');
        const panels = document.querySelectorAll('.search-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                currentTab = targetTab;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                panels.forEach(p => {
                    p.classList.remove('active');
                    if (p.id === 'search-' + targetTab) {
                        p.classList.add('active');
                    }
                });

                // 切换标签时清空之前的结果
                document.getElementById('sidebar-search-results').innerHTML = '';
            });
        });
    }

    // --- 4. 年份跳转 ---
    function setupYearSearch() {
        const input = document.getElementById('sidebar-year-input');
        const btn = document.getElementById('sidebar-year-btn');
        if (btn && input) {
            btn.addEventListener('click', () => {
                const year = parseInt(input.value);
                if (!isNaN(year)) {
                    if (typeof Timeline !== 'undefined') Timeline.setYear(year);
                    showYearResult(year);
                }
            });
        }
    }

    function showYearResult(year) {
        const container = document.getElementById('sidebar-search-results');
        container.innerHTML = `<div class="result-card">
            <div class="result-card-header">
                <span class="result-card-title">已跳转到 ${year} 年</span>
            </div>
            <p style="font-size:12px;color:#8890c0;margin-top:4px">图谱已切换到 ${year} 年的组织架构</p>
        </div>`;
    }

    // --- 5. 自动补全与搜索加载 ---
    function loadAutocompleteLists() {
        fetch('/api/colleges').then(r => r.json()).then(data => { collegeList = data; });
        fetch('/api/majors').then(r => r.json()).then(data => { majorList = data; });
    }

    function highlightMatch(text, keyword) {
        const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
        if (idx === -1) return text;
        const before = text.substring(0, idx);
        const match = text.substring(idx, idx + keyword.length);
        const after = text.substring(idx + keyword.length);
        return `${before}<span class="highlight">${match}</span>${after}`;
    }

    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    // --- 6. 学院与专业搜索执行 ---
    function setupCollegeSearch() {
        const btn = document.getElementById('sidebar-college-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                const input = document.getElementById('sidebar-college-input');
                if (input) doCollegeSearch(input.value.trim());
            });
        }
    }

    function doCollegeSearch(keyword) {
        const container = document.getElementById('sidebar-search-results');
        if (!keyword) return;
        container.innerHTML = '<div class="search-result-empty">搜索中...</div>';

        fetch(`/api/search/college?keyword=${encodeURIComponent(keyword)}`)
            .then(r => r.json())
            .then(data => renderCollegeResult(data))
            .catch(() => { container.innerHTML = '<div class="search-result-empty">未找到相关学院</div>'; });
    }

    function renderCollegeResult(data) {
        const container = document.getElementById('sidebar-search-results');
        let html = `<div class="result-card">
            <div class="result-card-header">
                <span class="result-card-badge college">学院</span>
                <span class="result-card-title">${escapeHtml(data.attribution)}</span>
            </div>
            <p style="font-size:12px;color:#c0c8ff;">历程: ${data.first_year}-${data.last_year}</p>`;

        if (data.majors && data.majors.length > 0) {
            html += `<h5>开设专业 (${data.majors.length})</h5><div class="card-major-list">`;
            data.majors.slice(0, 10).forEach(m => {
                html += `<div class="card-major-item"><span class="card-major-name">${escapeHtml(m.name)}</span></div>`;
            });
            if (data.majors.length > 10) {
                html += `<div class="card-major-item" style="color:#8890c0">...等${data.majors.length}个专业</div>`;
            }
            html += '</div>';
        }

        // 显示发展沿革
        if (data.name_evolution && data.name_evolution.length > 0) {
            html += `<h5>发展沿革</h5><div class="card-evolution-list">`;
            data.name_evolution.slice(0, 5).forEach(e => {
                html += `<div class="evolution-item"><span class="evolution-year">${e.start}-${e.end}</span><span class="evolution-name">${escapeHtml(e.name)}</span></div>`;
            });
            if (data.name_evolution.length > 5) {
                html += `<div style="color:#8890c0;font-size:11px">...共${data.name_evolution.length}次变更</div>`;
            }
            html += '</div>';
        }

        html += `<button class="view-in-graph-btn" onclick="Sidebar.viewInGraph('${escapeHtml(data.attribution)}')">在图中查看</button></div>`;
        container.innerHTML = html;
    }

    function setupMajorSearch() {
        const btn = document.getElementById('sidebar-major-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                const input = document.getElementById('sidebar-major-input');
                if (input) doMajorSearch(input.value.trim());
            });
        }
    }

    function doMajorSearch(keyword) {
        const container = document.getElementById('sidebar-search-results');
        if (!keyword) return;
        container.innerHTML = '<div class="search-result-empty">搜索中...</div>';

        fetch(`/api/search/major?keyword=${encodeURIComponent(keyword)}`)
            .then(r => r.json())
            .then(data => renderMajorResult(data))
            .catch(() => { container.innerHTML = '<div class="search-result-empty">未找到相关专业</div>'; });
    }

    function renderMajorResult(data) {
        const container = document.getElementById('sidebar-search-results');
        let html = `<div class="result-card">
            <div class="result-card-header">
                <span class="result-card-badge major">专业</span>
                <span class="result-card-title">${escapeHtml(data.name)}</span>
            </div>
            <p style="font-size:12px;color:#c0c8ff;">代码: ${data.code || '暂无'} | 历程: ${data.first_year}-${data.last_year}</p>`;

        if (data.department) {
            html += `<p style="font-size:12px;color:#c0c8ff;">所属院系: ${escapeHtml(data.department)}</p>`;
        }

        // 显示发展沿革
        if (data.dept_evolution && data.dept_evolution.length > 0) {
            html += `<h5>发展沿革</h5><div class="card-evolution-list">`;
            data.dept_evolution.forEach(e => {
                html += `<div class="evolution-item"><span class="evolution-year">${e.year}</span><span class="evolution-name">${escapeHtml(e.department)}</span></div>`;
            });
            html += '</div>';
        }

        html += `<button class="view-in-graph-btn" onclick="Sidebar.viewInGraph('${escapeHtml(data.name)}')">在图中查看</button></div>`;
        container.innerHTML = html;
    }

    // --- 7. 联动跳转逻辑 ---
    function viewInGraph(name) {
        // 点击跳转后，自动收起抽屉
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('drawer-closed');

        if (typeof Graph !== 'undefined' && Graph.clickTag) {
            Graph.clickTag(name);
        }
    }

    function setupAssistantToggle() {
        // 此逻辑针对旧版小助手，若 index.html 已改，此函数会自动安全退出
        const toggle = document.getElementById('assistant-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const body = document.getElementById('assistant-body');
                if (body) body.classList.toggle('collapsed');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        init();
        setupAssistantToggle();
    });

    return { init: () => {}, viewInGraph };
})();