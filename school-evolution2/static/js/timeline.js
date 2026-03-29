// Timeline Control
const Timeline = (() => {
    let minYear = 1955, maxYear = 2025;
    let availableYears = [];
    let milestones = {};
    let currentYear = 2025;
    let playing = false;
    let playTimer = null;
    let debounceTimer = null;

    function init() {
        fetch('/api/years')
            .then(r => r.json())
            .then(data => {
                minYear = data.min_year;
                maxYear = data.max_year;
                availableYears = data.available_years;
                milestones = data.school_milestones || {};
                setupTimeline();
                setYear(maxYear);
            });
    }

    function setupTimeline() {
        const track = document.getElementById('timeline-track');
        const labels = document.getElementById('timeline-labels');

        // Add milestone markers
        Object.entries(milestones).forEach(([yr, name]) => {
            const pct = ((yr - minYear) / (maxYear - minYear)) * 100;
            const marker = document.createElement('div');
            marker.className = 'milestone-marker';
            marker.style.left = pct + '%';
            marker.setAttribute('data-label', name.replace(/（.*）/, ''));
            marker.title = `${yr}: ${name}`;
            track.appendChild(marker);
        });

        // Labels
        const labelYears = [minYear, 1970, 1985, 2000, 2015, maxYear];
        labelYears.forEach(y => {
            const span = document.createElement('span');
            span.textContent = y;
            labels.appendChild(span);
        });

        // Track click
        track.addEventListener('click', (e) => {
            const rect = track.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const yr = Math.round(minYear + pct * (maxYear - minYear));
            setYear(findClosestYear(yr));
        });

        // Thumb drag
        const thumb = document.getElementById('timeline-thumb');
        let dragging = false;

        thumb.addEventListener('mousedown', (e) => {
            dragging = true;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const rect = track.getBoundingClientRect();
            let pct = (e.clientX - rect.left) / rect.width;
            pct = Math.max(0, Math.min(1, pct));
            const yr = Math.round(minYear + pct * (maxYear - minYear));
            setYearVisual(yr);
            debouncedLoad(findClosestYear(yr));
        });
        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
            }
        });

        // Keyboard
        thumb.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                const idx = availableYears.indexOf(currentYear);
                if (idx < availableYears.length - 1) setYear(availableYears[idx + 1]);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                const idx = availableYears.indexOf(currentYear);
                if (idx > 0) setYear(availableYears[idx - 1]);
            }
        });

        // Play button
        document.getElementById('play-btn').addEventListener('click', togglePlay);

        // Goto
        document.getElementById('goto-btn').addEventListener('click', () => {
            const yr = parseInt(document.getElementById('year-input').value);
            if (yr >= minYear && yr <= maxYear) {
                setYear(findClosestYear(yr));
            }
        });
        document.getElementById('year-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('goto-btn').click();
        });
    }

    function findClosestYear(yr) {
        if (availableYears.includes(yr)) return yr;
        let closest = availableYears[0];
        let minDiff = Math.abs(yr - closest);
        for (const y of availableYears) {
            const diff = Math.abs(yr - y);
            if (diff < minDiff) { closest = y; minDiff = diff; }
        }
        return closest;
    }

    function setYear(year) {
        currentYear = year;
        setYearVisual(year);
        Graph.loadYear(year);
        document.getElementById('year-input').value = year;
    }

    function setYearVisual(year) {
        const pct = ((year - minYear) / (maxYear - minYear)) * 100;
        document.getElementById('timeline-fill').style.width = pct + '%';
        document.getElementById('timeline-thumb').style.left = pct + '%';

        // 核心修复：防止元素不存在时报错
        const badge = document.getElementById('current-year-badge');
        if (badge) {
            badge.textContent = year;
        }
    }

    function debouncedLoad(year) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentYear = year;
            Graph.loadYear(year);
            document.getElementById('year-input').value = year;
        }, 150);
    }

    function togglePlay() {
        playing = !playing;
        const btn = document.getElementById('play-btn');
        if (playing) {
            btn.textContent = '⏸';
            btn.classList.add('playing');
            playNext();
        } else {
            btn.textContent = '▶';
            btn.classList.remove('playing');
            clearTimeout(playTimer);
        }
    }

    function playNext() {
        if (!playing) return;
        const idx = availableYears.indexOf(currentYear);
        if (idx < availableYears.length - 1) {
            setYear(availableYears[idx + 1]);
            playTimer = setTimeout(playNext, 1000);
        } else {
            // Loop back
            playing = false;
            document.getElementById('play-btn').textContent = '▶';
            document.getElementById('play-btn').classList.remove('playing');
        }
    }

    function getCurrentYear() { return currentYear; }

    return { init, setYear, getCurrentYear };
})();

document.addEventListener('DOMContentLoaded', () => {
    Timeline.init();
});
