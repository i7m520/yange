# CSS 样式文件导出

> 文件路径：`static/css/style.css`
> 导出时间：2026-03-29

---

```css
/* Reset & Base */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    background: #0a0e27;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
}

/* ========================================
   加载动画 - 晶体碎片动画
   ======================================== */
#loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #050810 0%, #0a1020 50%, #050810 100%);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.8s ease, visibility 0.8s ease;
}

#loading-overlay.hidden {
    opacity: 0;
    visibility: hidden;
}

.loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 25px;
}

/* 晶体碎片加载动画 */
.loading-crystals {
    position: relative;
    width: 120px;
    height: 120px;
    margin: 0 auto;
}

.crystal {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    animation: crystal-float 2s ease-in-out infinite;
}

.crystal::before {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
}

/* 晶体1 - 大菱形 */
.crystal-1 {
    top: 20px;
    left: 30px;
    animation-delay: 0s;
}
.crystal-1::before {
    border-width: 25px 15px 25px 15px;
    border-color: rgba(100, 200, 255, 0.8) transparent rgba(50, 150, 220, 0.6) transparent;
    filter: drop-shadow(0 0 8px rgba(100, 200, 255, 0.6));
}

/* 晶体2 - 小菱形 */
.crystal-2 {
    top: 10px;
    left: 70px;
    animation-delay: 0.3s;
}
.crystal-2::before {
    border-width: 18px 10px 18px 10px;
    border-color: rgba(150, 220, 255, 0.9) transparent rgba(80, 180, 240, 0.7) transparent;
    filter: drop-shadow(0 0 6px rgba(150, 220, 255, 0.5));
}

/* 晶体3 - 中菱形 */
.crystal-3 {
    top: 60px;
    left: 10px;
    animation-delay: 0.6s;
}
.crystal-3::before {
    border-width: 20px 12px 20px 12px;
    border-color: rgba(120, 210, 255, 0.85) transparent rgba(60, 160, 230, 0.65) transparent;
    filter: drop-shadow(0 0 7px rgba(120, 210, 255, 0.55));
}

/* 晶体4 - 小菱形 */
.crystal-4 {
    top: 70px;
    left: 60px;
    animation-delay: 0.9s;
}
.crystal-4::before {
    border-width: 15px 9px 15px 9px;
    border-color: rgba(180, 230, 255, 0.9) transparent rgba(100, 190, 250, 0.7) transparent;
    filter: drop-shadow(0 0 5px rgba(180, 230, 255, 0.5));
}

/* 晶体5 - 微小菱形 */
.crystal-5 {
    top: 40px;
    left: 85px;
    animation-delay: 1.2s;
}
.crystal-5::before {
    border-width: 12px 7px 12px 7px;
    border-color: rgba(200, 240, 255, 0.95) transparent rgba(120, 200, 255, 0.75) transparent;
    filter: drop-shadow(0 0 4px rgba(200, 240, 255, 0.5));
}

/* 晶体6 - 小菱形 */
.crystal-6 {
    top: 85px;
    left: 35px;
    animation-delay: 1.5s;
}
.crystal-6::before {
    border-width: 14px 8px 14px 8px;
    border-color: rgba(140, 215, 255, 0.88) transparent rgba(70, 170, 245, 0.68) transparent;
    filter: drop-shadow(0 0 5px rgba(140, 215, 255, 0.45));
}

@keyframes crystal-float {
    0% {
        opacity: 0;
        transform: translateY(20px) rotate(0deg) scale(0.5);
    }
    50% {
        opacity: 1;
        transform: translateY(-10px) rotate(180deg) scale(1);
    }
    100% {
        opacity: 0;
        transform: translateY(-30px) rotate(360deg) scale(0.5);
    }
}

/* 加载文字 */
.loading-text {
    font-size: 22px;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 3px;
    text-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
}

/* 跳动的句号 */
.loading-text .dot {
    display: inline-block;
    animation: dot-bounce 1.4s ease-in-out infinite;
}

.loading-text .dot1 { animation-delay: 0s; }
.loading-text .dot2 { animation-delay: 0.2s; }
.loading-text .dot3 { animation-delay: 0.4s; }

@keyframes dot-bounce {
    0%, 60%, 100% { 
        transform: translateY(0);
        color: rgba(255, 255, 255, 0.6);
    }
    30% { 
        transform: translateY(-8px);
        color: #60A5FA;
        text-shadow: 0 0 10px rgba(96, 165, 250, 0.8);
    }
}

/* 进度条 */
.loading-progress {
    width: 200px;
    height: 4px;
    background: rgba(59, 130, 246, 0.2);
    border-radius: 2px;
    overflow: hidden;
}

.loading-progress-bar {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #1E3A8A, #3B82F6, #60A5FA);
    border-radius: 2px;
    animation: progress-animate 2s ease-in-out infinite;
}

@keyframes progress-animate {
    0% { width: 0%; }
    50% { width: 70%; }
    100% { width: 100%; }
}

/* ... 其余样式省略，完整内容见原文件 ... */
```

---

## CSS 文件说明

### 1. 加载动画 (晶体碎片)
- **6个菱形晶体**：使用 CSS `border` 技术创建菱形
- **浮动旋转动画**：`crystal-float` keyframes 实现上下浮动 + 360°旋转
- **渐变透明度**：每个晶体有不同的透明度和发光效果
- **错开动画延迟**：0s ~ 1.5s 依次启动，形成瀑布效果

### 2. 主要功能模块
- 顶部标题栏（校徽 + 晶体装饰）
- 左侧抽屉式搜索栏
- 中央3D图谱展示区
- 右侧详情面板
- 底部时间轴控制
- 右下角悬浮小助手

### 3. 响应式设计
- 使用 `fit-content` 和 `flex` 布局
- 支持抽屉式展开/收缩
- 滚动条自定义美化
