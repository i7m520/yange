// Assistant - 校友小助手 (悬浮挂件拖拽版)
const Assistant = (() => {
    let state = { level: 'init', period: null, department: null };

    // 拖拽相关变量
    let isDragging = false;
    let dragStartX, dragStartY, objStartX, objStartY;

// 在 assistant.js 中找到 init 函数并替换
    function init() {
        const floatingContainer = document.getElementById('floating-assistant');
        const trigger = document.getElementById('assistant-trigger');
        const closeBtn = document.getElementById('close-assistant');
        const sendBtn = document.getElementById('assistant-send');
        const input = document.getElementById('assistant-input');
        const bubble = document.querySelector('.assistant-bubble');

        // 1. 发送按钮安全检查
        if (sendBtn) {
            sendBtn.addEventListener('click', handleUserInput);
        }

        // 2. 输入框安全检查
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleUserInput();
            });
        }

        // 3. 悬浮蛋触发器检查
        if (trigger && floatingContainer) {
            trigger.addEventListener('click', (e) => {
                // 原有的展开收起逻辑...
                floatingContainer.classList.toggle('collapsed');
                if (!floatingContainer.classList.contains('collapsed') &&
                    document.getElementById('assistant-messages').children.length === 0) {
                    startConversation();
                }
            });
        }

        // 3.5 点击气泡也能展开
        if (bubble && floatingContainer) {
            bubble.addEventListener('click', () => {
                floatingContainer.classList.remove('collapsed');
                if (document.getElementById('assistant-messages').children.length === 0) {
                    startConversation();
                }
            });
        }

        // 4. 关闭按钮检查
        if (closeBtn && floatingContainer) {
            closeBtn.addEventListener('click', () => {
                floatingContainer.classList.add('collapsed');
            });
        }
    }

    // --- 以下保留并优化你原有的业务逻辑 ---

    function addMessage(text, type = 'bot', scrollToBottom = false) {
        const messages = document.getElementById('assistant-messages');
        const msg = document.createElement('div');
        msg.className = `msg ${type}`;
        msg.innerHTML = text;
        messages.appendChild(msg);
        // 只在对话进行中滚动到底部
        if (scrollToBottom) {
            messages.scrollTop = messages.scrollHeight;
        }
        return msg;
    }

    function addChoices(items, onClick, scrollToBottom = false) {
        const messages = document.getElementById('assistant-messages');
        const msg = document.createElement('div');
        msg.className = 'msg bot';
        let html = '<div class="choice-list">';
        items.forEach((item) => {
            const label = typeof item === 'string' ? item : item.label;
            const value = typeof item === 'string' ? item : item.value;
            html += `<button class="choice-btn" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
        });
        html += '</div>';
        msg.innerHTML = html;
        messages.appendChild(msg);
        // 只在对话进行中滚动到底部
        if (scrollToBottom) {
            messages.scrollTop = messages.scrollHeight;
        }

        msg.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', () => onClick(btn.dataset.value));
        });
    }

    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function startConversation() {
        state = { level: 'init', period: null, department: null };
        
        // 清空消息区域并滚动到顶部
        const messages = document.getElementById('assistant-messages');
        if (messages) {
            messages.innerHTML = '';
            messages.scrollTop = 0;
        }
        
        addMessage('你好！我是校友小助手，可以帮你查询成都理工大学各时期的院系和专业信息。<br><br>请选择你感兴趣的学校时期：');

        fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        })
        .then(r => r.json())
        .then(data => {
            if (data.items) {
                const items = data.items.map(h => ({
                    label: `${h.name} (${h.start}-${h.end})`,
                    value: h.name
                }));
                addChoices(items, selectPeriod);
                state.level = 'school';
            }
        });
    }

    function selectPeriod(name) {
        state.period = name;
        state.level = 'department';
        addMessage(name, 'user', true);
        addMessage(`正在查询 <b>${name}</b> 时期的院系...`, 'bot', true);

        fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period: name })
        })
        .then(r => r.json())
        .then(data => {
            if (data.items && data.items.length) {
                addMessage(`${name} 时期共有 <b>${data.items.length}</b> 个院系，请选择：`, 'bot', true);
                const items = data.items.map(d => ({ label: d.name, value: d.name }));
                addChoices(items, selectDepartment, true);
            } else {
                addMessage('该时期暂无院系数据。', 'bot', true);
                addChoices([{ label: '返回选择时期', value: '__back__' }], () => { startConversation(); }, true);
            }
        });
    }

    function selectDepartment(name) {
        state.department = name;
        state.level = 'major';
        addMessage(name, 'user', true);
        addMessage(`正在查询 <b>${name}</b> 的专业...`, 'bot', true);

        fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period: state.period, department: name })
        })
        .then(r => r.json())
        .then(data => {
            if (data.items && data.items.length) {
                addMessage(`<b>${name}</b> 共有 <b>${data.items.length}</b> 个专业：`, 'bot', true);
                let html = '<div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:6px;color:#e0e0e0">';
                html += '<tr style="color:#38bdf8"><th style="text-align:left;padding:3px">专业</th><th>代码</th></tr>';
                data.items.forEach(m => {
                    html += `<tr style="border-top:1px solid rgba(255,255,255,0.1);cursor:pointer" onclick="Assistant.showMajorDetail('${escapeHtml(m.name)}')">
                        <td style="padding:5px 3px">${m.name}</td>
                        <td style="text-align:center">${m.code}</td></tr>`;
                });
                html += '</table></div>';
                addMessage(html, 'bot', true);
                addChoices([{ label: '返回选择院系', value: '__back_dept__' }, { label: '重新开始', value: '__restart__' }],
                (v) => { if (v === '__back_dept__') selectPeriod(state.period); else startConversation(); }, true);
            } else {
                addMessage('该院系暂无专业数据。', 'bot', true);
                addChoices([{ label: '返回选择院系', value: '__back_dept__' }, { label: '重新开始', value: '__restart__' }],
                (v) => { if (v === '__back_dept__') selectPeriod(state.period); else startConversation(); }, true);
            }
        });
    }

    function showMajorDetail(name) {
        // 这里的 Timeline.getCurrentYear() 依赖你的 timeline.js
        const year = typeof Timeline !== 'undefined' ? Timeline.getCurrentYear() : 2025;
        fetch(`/api/detail?name=${encodeURIComponent(name)}&year=${year}`)
            .then(r => r.json())
            .then(detail => {
                if (detail.type === 'major') {
                    let html = `<b>${detail.name}</b><br>`;
                    html += `代码: ${detail.code || '暂无'}<br>`;
                    html += `学制: ${detail.duration || '暂无'}<br>`;
                    html += `院系: ${detail.department || '暂无'}<br>`;
                    if (detail.direction) html += `方向: ${detail.direction}<br>`;
                    if (detail.year_range) html += `存续: ${detail.year_range}<br>`;
                    if (detail.note) html += `说明: ${detail.note}<br>`;
                    addMessage(html, 'bot', true);
                } else {
                    addMessage(formatDetail(detail), 'bot', true);
                }
            });
    }

    function handleUserInput() {
        const input = document.getElementById('assistant-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        addMessage(text, 'user', true);

        fetch(`/api/search?keyword=${encodeURIComponent(text)}`)
            .then(r => r.json())
            .then(results => {
                if (results.length === 0) {
                    addMessage('未找到相关结果，请尝试其他关键词。', 'bot', true);
                    return;
                }
                addMessage(`找到 <b>${results.length}</b> 条相关结果：`, 'bot', true);
                const items = results.slice(0, 10).map(r => ({
                    label: `[${r.type === 'department' ? '院系' : '专业'}] ${r.name}`,
                    value: r.name
                }));
                addChoices(items, (name) => {
                    addMessage(name, 'user', true);
                    const year = typeof Timeline !== 'undefined' ? Timeline.getCurrentYear() : 2025;
                    fetch(`/api/detail?name=${encodeURIComponent(name)}&year=${year}`)
                        .then(r => r.json())
                        .then(detail => { addMessage(formatDetail(detail), 'bot', true); });
                }, true);
            });
    }

    function formatDetail(d) {
        let html = `<b>${d.name}</b><br>`;
        if (d.school) html += `学校: ${d.school}<br>`;
        if (d.department) html += `院系: ${d.department}<br>`;
        if (d.code) html += `代码: ${d.code}<br>`;
        if (d.duration) html += `学制: ${d.duration}<br>`;
        if (d.direction) html += `方向: ${d.direction}<br>`;
        if (d.year_range) html += `存续: ${d.year_range}<br>`;
        if (d.note) html += `说明: ${d.note}<br>`;
        return html;
    }

    return { init, showMajorDetail };
})();

document.addEventListener('DOMContentLoaded', () => {
    Assistant.init();
});