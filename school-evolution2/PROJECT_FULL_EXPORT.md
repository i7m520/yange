# 成都理工大学沿革图谱 - 完整项目代码

> 导出时间：2026-03-29
> 项目路径：`/workspace/projects/school-evolution2/`

---

# ============================================
# 文件 1: app.py (Flask 主程序)
# ============================================

```python
# -*- coding: utf-8 -*-
from flask import Flask, render_template, request, jsonify
import data_loader

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/graph')
def api_graph():
    year = request.args.get('year', 2025, type=int)
    return jsonify(data_loader.get_graph_data(year))


@app.route('/api/detail')
def api_detail():
    name = request.args.get('name', '')
    year = request.args.get('year', 2025, type=int)
    if not name:
        return jsonify({'error': '缺少name参数'}), 400
    return jsonify(data_loader.get_node_detail(name, year))


@app.route('/api/years')
def api_years():
    return jsonify(data_loader.get_year_range())


@app.route('/api/search')
def api_search():
    keyword = request.args.get('keyword', '')
    if not keyword:
        return jsonify([])
    return jsonify(data_loader.search(keyword))


@app.route('/api/assistant', methods=['POST'])
def api_assistant():
    data = request.get_json(silent=True) or {}
    period = data.get('period')
    department = data.get('department')
    return jsonify(data_loader.get_assistant_data(period, department))


@app.route('/api/schools')
def api_schools():
    return jsonify(data_loader.get_school_names())


@app.route('/api/colleges')
def api_colleges():
    return jsonify(data_loader.get_all_colleges())


@app.route('/api/majors')
def api_majors():
    return jsonify(data_loader.get_all_majors())


@app.route('/api/search/college')
def api_search_college():
    keyword = request.args.get('keyword', '')
    if not keyword:
        return jsonify({'error': '缺少keyword参数'}), 400
    result = data_loader.search_college_detail(keyword)
    if result is None:
        return jsonify({'error': '未找到相关学院'}), 404
    return jsonify(result)


@app.route('/api/search/major')
def api_search_major():
    keyword = request.args.get('keyword', '')
    if not keyword:
        return jsonify({'error': '缺少keyword参数'}), 400
    result = data_loader.search_major_detail(keyword)
    if result is None:
        return jsonify({'error': '未找到相关专业'}), 404
    return jsonify(result)


if __name__ == '__main__':
    # Preload data on startup
    print("正在加载数据...")
    data_loader._load()
    print("数据加载完成！")
    app.run(debug=False, host='0.0.0.0', port=5000)
```

---
---

# ============================================
# 文件 2: data_loader.py (数据加载模块)
# ============================================

```python
# -*- coding: utf-8 -*-
import pandas as pd
import os

# School name change milestones
SCHOOL_HISTORY = [
    {'name': '北京地质学院', 'start': 1955, 'end': 1955},
    {'name': '重庆大学', 'start': 1955, 'end': 1955},
    {'name': '成都地质勘探学院', 'start': 1956, 'end': 1958},
    {'name': '成都地质学院', 'start': 1959, 'end': 1992},
    {'name': '成都理工学院', 'start': 1993, 'end': 2001},
    {'name': '成都理工大学（成都校区）', 'start': 2002, 'end': 2025},
]

# Milestone years where school name changed
SCHOOL_MILESTONES = {
    1956: '成都地质勘探学院',
    1959: '成都地质学院',
    1993: '成都理工学院',
    2002: '成都理工大学（成都校区）',
}

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', '本科专业发展-导出数据.xlsx')

_df = None


def _load():
    global _df
    if _df is not None:
        return _df
    df = pd.read_excel(DATA_FILE, header=2)
    cols = [
        '确定', '专业', '专业代码', '年度', '学制', '学校名称',
        '所在院系', '院系简称', '院系代码', '归属学院', '专业方向',
        '说明', '证明材料', '归属部门', '结束年度',
        '创建时间', '更新时间', '创建成员', '记录ID'
    ]
    df.columns = cols
    df['年度'] = pd.to_numeric(df['年度'], errors='coerce')
    df = df.dropna(subset=['年度'])
    df['年度'] = df['年度'].astype(int)
    _df = df
    return _df


def get_year_range():
    df = _load()
    years = sorted(df['年度'].unique().tolist())
    return {
        'min_year': int(min(years)),
        'max_year': int(max(years)),
        'available_years': [int(y) for y in years],
        'school_milestones': SCHOOL_MILESTONES,
    }


def get_school_names():
    return SCHOOL_HISTORY


def _get_school_name_for_year(year):
    """Get the primary school name for a given year."""
    df = _load()
    year_data = df[df['年度'] == year]
    if year_data.empty:
        # Find closest year
        for h in reversed(SCHOOL_HISTORY):
            if h['start'] <= year <= h['end']:
                return h['name']
        return '成都理工大学（成都校区）'
    # Return the most common school name for that year
    names = year_data['学校名称'].value_counts()
    return names.index[0] if len(names) > 0 else '成都理工大学（成都校区）'


def get_graph_data(year):
    """Return {nodes, links, school_name} for a given year."""
    df = _load()
    year_data = df[df['年度'] == year]

    if year_data.empty:
        school_name = _get_school_name_for_year(year)
        return {'nodes': [{'id': school_name, 'type': 'school', 'name': school_name}],
                'links': [], 'school_name': school_name}

    nodes = []
    links = []
    node_ids = set()

    # Get all school names for this year (could be multiple during transition)
    school_names = year_data['学校名称'].dropna().unique().tolist()
    primary_school = school_names[0] if school_names else _get_school_name_for_year(year)

    for sn in school_names:
        if sn not in node_ids:
            nodes.append({'id': sn, 'type': 'school', 'name': sn})
            node_ids.add(sn)

    # Get departments and majors
    for _, row in year_data.iterrows():
        school = row['学校名称'] if pd.notna(row['学校名称']) else primary_school
        dept = row['所在院系'] if pd.notna(row['所在院系']) else None
        major = row['专业'] if pd.notna(row['专业']) else None
        major_code = row['专业代码'] if pd.notna(row['专业代码']) else ''
        attribution = row['归属学院'] if pd.notna(row['归属学院']) else ''

        if dept and dept not in node_ids:
            nodes.append({
                'id': dept, 'type': 'department', 'name': dept,
                'attribution': attribution
            })
            node_ids.add(dept)
            links.append({'source': school, 'target': dept})

        if major and dept:
            major_id = f"{major}({major_code})" if major_code else major
            if major_id not in node_ids:
                nodes.append({
                    'id': major_id, 'type': 'major', 'name': major,
                    'code': str(major_code), 'direction': str(row.get('专业方向', '') or '')
                })
                node_ids.add(major_id)
                links.append({'source': dept, 'target': major_id})

    return {
        'nodes': nodes,
        'links': links,
        'school_name': primary_school,
    }


def get_node_detail(name, year):
    """Return detailed information about a node at a given year."""
    df = _load()

    # Try to find as department
    dept_data = df[df['所在院系'] == name]
    if not dept_data.empty:
        return _get_department_detail(name, year, df, dept_data)

    # Try to find as major (may include code suffix)
    pure_name = name.split('(')[0] if '(' in name else name
    major_data = df[df['专业'] == pure_name]
    if not major_data.empty:
        return _get_major_detail(pure_name, year, df, major_data)

    # Try as school
    school_data = df[df['学校名称'] == name]
    if not school_data.empty:
        return _get_school_detail(name, year, df, school_data)

    # Try to find as 归属学院
    attr_data = df[df['归属学院'] == name]
    if not attr_data.empty:
        return _get_attribution_detail(name, year, df, attr_data)

    return {'type': 'unknown', 'name': name, 'message': '未找到相关信息'}


def _get_school_detail(name, year, df, school_data):
    """Detail for a school node."""
    year_data = school_data[school_data['年度'] == year]
    depts = sorted(year_data['所在院系'].dropna().unique().tolist()) if not year_data.empty else []
    majors_count = year_data['专业'].nunique() if not year_data.empty else 0
    all_years = sorted(school_data['年度'].unique().tolist())

    history = []
    for h in SCHOOL_HISTORY:
        history.append({
            'name': h['name'],
            'period': f"{h['start']}-{h['end']}",
            'current': h['start'] <= year <= h['end'] and h['name'] == name
        })

    return {
        'type': 'school',
        'name': name,
        'year': year,
        'departments': depts,
        'departments_count': len(depts),
        'majors_count': majors_count,
        'year_range': f"{min(all_years)}-{max(all_years)}",
        'history': history,
    }


def _get_department_detail(name, year, df, dept_data):
    """Detail for a department node."""
    year_data = dept_data[dept_data['年度'] == year]

    school = year_data['学校名称'].iloc[0] if not year_data.empty and pd.notna(year_data['学校名称'].iloc[0]) else ''
    attribution = year_data['归属学院'].iloc[0] if not year_data.empty and pd.notna(year_data['归属学院'].iloc[0]) else ''
    majors = sorted(year_data['专业'].dropna().unique().tolist()) if not year_data.empty else []

    dept_evolution = []
    if attribution:
        attr_data = df[df['归属学院'] == attribution]
        dept_names_by_year = attr_data.groupby('年度')['所在院系'].first().sort_index()
        prev_name = None
        for y, dname in dept_names_by_year.items():
            if dname != prev_name:
                dept_evolution.append({'year': int(y), 'name': dname})
                prev_name = dname

    all_years = sorted(dept_data['年度'].unique().tolist())

    return {
        'type': 'department',
        'name': name,
        'year': year,
        'school': school,
        'attribution': attribution,
        'majors': majors,
        'majors_count': len(majors),
        'year_range': f"{min(all_years)}-{max(all_years)}" if all_years else '',
        'name_evolution': dept_evolution,
    }


def _get_major_detail(name, year, df, major_data):
    """Detail for a major node."""
    year_data = major_data[major_data['年度'] == year]

    school = year_data['学校名称'].iloc[0] if not year_data.empty and pd.notna(year_data['学校名称'].iloc[0]) else ''
    dept = year_data['所在院系'].iloc[0] if not year_data.empty and pd.notna(year_data['所在院系'].iloc[0]) else ''
    code = str(year_data['专业代码'].iloc[0]) if not year_data.empty and pd.notna(year_data['专业代码'].iloc[0]) else ''
    duration = year_data['学制'].iloc[0] if not year_data.empty and pd.notna(year_data['学制'].iloc[0]) else ''
    note = year_data['说明'].iloc[0] if not year_data.empty and pd.notna(year_data['说明'].iloc[0]) else ''
    direction = year_data['专业方向'].iloc[0] if not year_data.empty and pd.notna(year_data['专业方向'].iloc[0]) else ''

    dept_changes = []
    sorted_data = major_data.sort_values('年度')
    prev_dept = None
    for _, row in sorted_data.iterrows():
        d = row['所在院系'] if pd.notna(row['所在院系']) else ''
        if d != prev_dept:
            dept_changes.append({
                'year': int(row['年度']),
                'department': d,
                'school': row['学校名称'] if pd.notna(row['学校名称']) else ''
            })
            prev_dept = d

    code_changes = []
    prev_code = None
    for _, row in sorted_data.iterrows():
        c = str(row['专业代码']) if pd.notna(row['专业代码']) else ''
        if c != prev_code:
            code_changes.append({'year': int(row['年度']), 'code': c})
            prev_code = c

    all_years = sorted(major_data['年度'].unique().tolist())

    return {
        'type': 'major',
        'name': name,
        'year': year,
        'school': school,
        'department': dept,
        'code': code,
        'duration': duration,
        'note': note,
        'direction': direction,
        'year_range': f"{min(all_years)}-{max(all_years)}" if all_years else '',
        'dept_evolution': dept_changes,
        'code_evolution': code_changes,
    }


def _get_attribution_detail(name, year, df, attr_data):
    """Detail for an attribution college."""
    year_data = attr_data[attr_data['年度'] == year]
    dept_names = sorted(year_data['所在院系'].dropna().unique().tolist()) if not year_data.empty else []
    majors = sorted(year_data['专业'].dropna().unique().tolist()) if not year_data.empty else []

    dept_names_by_year = attr_data.groupby('年度')['所在院系'].first().sort_index()
    evolution = []
    prev_name = None
    for y, dname in dept_names_by_year.items():
        if dname != prev_name:
            evolution.append({'year': int(y), 'name': dname})
            prev_name = dname

    return {
        'type': 'attribution',
        'name': name,
        'year': year,
        'current_names': dept_names,
        'majors': majors,
        'name_evolution': evolution,
    }


def search(keyword):
    """Search for departments and majors matching keyword."""
    df = _load()
    results = []
    seen = set()

    dept_matches = df[df['所在院系'].str.contains(keyword, na=False, case=False)]
    for dept in dept_matches['所在院系'].unique():
        if dept not in seen:
            years = sorted(dept_matches[dept_matches['所在院系'] == dept]['年度'].unique().tolist())
            results.append({
                'type': 'department', 'name': dept,
                'years': [int(y) for y in years],
            })
            seen.add(dept)

    major_matches = df[df['专业'].str.contains(keyword, na=False, case=False)]
    for major in major_matches['专业'].unique():
        if major not in seen:
            m_data = major_matches[major_matches['专业'] == major]
            years = sorted(m_data['年度'].unique().tolist())
            code = str(m_data['专业代码'].iloc[0]) if pd.notna(m_data['专业代码'].iloc[0]) else ''
            results.append({
                'type': 'major', 'name': major, 'code': code,
                'years': [int(y) for y in years],
            })
            seen.add(major)

    attr_matches = df[df['归属学院'].str.contains(keyword, na=False, case=False)]
    for attr in attr_matches['归属学院'].unique():
        if attr not in seen:
            results.append({'type': 'attribution', 'name': attr})
            seen.add(attr)

    return results


def get_assistant_data(period=None, department=None):
    """Get data for the assistant guided exploration."""
    df = _load()

    if period is None and department is None:
        return {'level': 'school', 'items': SCHOOL_HISTORY}

    if period and department is None:
        period_data = df[df['学校名称'] == period]
        if period_data.empty:
            return {'level': 'department', 'items': [], 'school': period}
        depts = sorted(period_data['归属学院'].dropna().unique().tolist())
        return {
            'level': 'department',
            'school': period,
            'items': [{'name': d} for d in depts],
        }

    if period and department:
        period_data = df[(df['学校名称'] == period) & (df['归属学院'] == department)]
        if period_data.empty:
            period_data = df[(df['学校名称'] == period) & (df['所在院系'] == department)]
        majors = []
        for major_name in sorted(period_data['专业'].dropna().unique().tolist()):
            m_row = period_data[period_data['专业'] == major_name].iloc[0]
            majors.append({
                'name': major_name,
                'code': str(m_row['专业代码']) if pd.notna(m_row['专业代码']) else '',
                'duration': str(m_row['学制']) if pd.notna(m_row['学制']) else '',
                'department': str(m_row['所在院系']) if pd.notna(m_row['所在院系']) else '',
                'note': str(m_row['说明']) if pd.notna(m_row['说明']) else '',
            })
        return {
            'level': 'major',
            'school': period,
            'department': department,
            'items': majors,
        }

    return {'level': 'unknown', 'items': []}


def get_all_colleges():
    """Return a sorted list of all attribution college names."""
    df = _load()
    colleges = sorted(df['归属学院'].dropna().unique().tolist())
    return colleges


def get_all_majors():
    """Return a sorted list of all major names."""
    df = _load()
    majors = sorted(df['专业'].dropna().unique().tolist())
    return majors


def search_college_detail(keyword):
    """Search by college, return detailed evolution info."""
    df = _load()
    matches = df[df['归属学院'].str.contains(keyword, na=False, case=False)]
    if matches.empty:
        return None

    attribution = matches['归属学院'].value_counts().index[0]
    attr_data = df[df['归属学院'] == attribution]

    name_evolution = []
    dept_by_year = attr_data.sort_values('年度').groupby('年度')['所在院系'].first()
    prev_name = None
    start_year = None
    for yr, dname in dept_by_year.items():
        if dname != prev_name:
            if prev_name is not None:
                name_evolution.append({
                    'name': prev_name,
                    'start': int(start_year),
                    'end': int(yr) - 1
                })
            prev_name = dname
            start_year = yr
    if prev_name is not None:
        all_years = sorted(attr_data['年度'].unique())
        name_evolution.append({
            'name': prev_name,
            'start': int(start_year),
            'end': int(max(all_years))
        })

    majors_info = []
    for major_name in sorted(attr_data['专业'].dropna().unique().tolist()):
        major_all = df[df['专业'] == major_name]
        major_in_college = attr_data[attr_data['专业'] == major_name]
        m_years = sorted(major_in_college['年度'].unique().tolist())
        all_m_years = sorted(major_all['年度'].unique().tolist())

        first_year = int(min(all_m_years))
        last_year = int(max(all_m_years))
        first_in_college = int(min(m_years))
        last_in_college = int(max(m_years))

        code = ''
        code_val = major_in_college['专业代码'].dropna()
        if not code_val.empty:
            code = str(code_val.iloc[-1])

        latest_year = max(all_m_years)
        latest_row = major_all[major_all['年度'] == latest_year].iloc[0]
        latest_attr = latest_row['归属学院'] if pd.notna(latest_row['归属学院']) else ''

        if latest_attr == attribution:
            status = 'active'
        else:
            if last_in_college < latest_year:
                status = 'migrated_out'
            else:
                status = 'active'

        end_years = major_in_college['结束年度'].dropna()
        removed_year = None
        if not end_years.empty:
            ey = end_years.iloc[-1]
            if pd.notna(ey):
                try:
                    removed_year = int(float(ey))
                    status = 'removed'
                except (ValueError, TypeError):
                    pass

        migrations = []
        sorted_major = major_all.sort_values('年度')
        prev_college = None
        for _, row in sorted_major.iterrows():
            cur_attr = row['归属学院'] if pd.notna(row['归属学院']) else ''
            if cur_attr != prev_college and prev_college is not None:
                migrations.append({
                    'year': int(row['年度']),
                    'from_college': prev_college,
                    'to_college': cur_attr
                })
            prev_college = cur_attr

        majors_info.append({
            'name': major_name,
            'code': code,
            'first_year': first_year,
            'last_year': last_year,
            'status': status,
            'migrations': migrations,
            'removed_year': removed_year
        })

    return {
        'type': 'college_detail',
        'attribution': attribution,
        'name_evolution': name_evolution,
        'majors': majors_info
    }


def search_major_detail(keyword):
    """Search by major name, return detailed evolution info."""
    df = _load()
    matches = df[df['专业'].str.contains(keyword, na=False, case=False)]
    if matches.empty:
        return None

    major_name = matches['专业'].value_counts().index[0]
    major_data = df[df['专业'] == major_name].sort_values('年度')

    all_years = sorted(major_data['年度'].unique().tolist())
    first_year = int(min(all_years))
    last_year = int(max(all_years))

    code = ''
    code_val = major_data['专业代码'].dropna()
    if not code_val.empty:
        code = str(code_val.iloc[-1])

    dataset_max_year = int(df['年度'].max())
    is_active = last_year >= dataset_max_year

    latest_row = major_data.iloc[-1]
    current_college = latest_row['归属学院'] if pd.notna(latest_row['归属学院']) else ''

    college_created_year = None
    if current_college:
        college_data = df[df['归属学院'] == current_college]
        if not college_data.empty:
            college_created_year = int(college_data['年度'].min())

    department_history = []
    prev_dept = None
    start_yr = None
    for _, row in major_data.iterrows():
        dept = row['所在院系'] if pd.notna(row['所在院系']) else ''
        attr = row['归属学院'] if pd.notna(row['归属学院']) else ''
        key = f"{dept}|{attr}"
        if key != prev_dept:
            if prev_dept is not None:
                p_dept, p_attr = prev_dept.split('|', 1)
                department_history.append({
                    'name': p_dept,
                    'attribution': p_attr,
                    'start': int(start_yr),
                    'end': int(row['年度']) - 1
                })
            prev_dept = key
            start_yr = row['年度']
    if prev_dept is not None:
        p_dept, p_attr = prev_dept.split('|', 1)
        department_history.append({
            'name': p_dept,
            'attribution': p_attr,
            'start': int(start_yr),
            'end': last_year
        })

    events = []
    events.append({
        'year': first_year,
        'event': 'created',
        'detail': f"专业创建，隶属{major_data.iloc[0]['所在院系'] if pd.notna(major_data.iloc[0]['所在院系']) else '未知'}"
    })

    prev_attr = None
    for _, row in major_data.iterrows():
        attr = row['归属学院'] if pd.notna(row['归属学院']) else ''
        dept = row['所在院系'] if pd.notna(row['所在院系']) else ''
        if prev_attr is not None and attr != prev_attr:
            events.append({
                'year': int(row['年度']),
                'event': 'migration',
                'detail': f"从{prev_attr}迁入{attr}（{dept}）"
            })
        prev_attr = attr

    prev_code = None
    for _, row in major_data.iterrows():
        c = str(row['专业代码']) if pd.notna(row['专业代码']) else ''
        if prev_code is not None and c != prev_code and c:
            events.append({
                'year': int(row['年度']),
                'event': 'code_change',
                'detail': f"专业代码从{prev_code}变更为{c}"
            })
        prev_code = c

    end_years = major_data['结束年度'].dropna()
    if not end_years.empty:
        ey = end_years.iloc[-1]
        if pd.notna(ey):
            try:
                removed_yr = int(float(ey))
                events.append({
                    'year': removed_yr,
                    'event': 'removed',
                    'detail': '专业停办'
                })
                is_active = False
            except (ValueError, TypeError):
                pass

    events.sort(key=lambda x: x['year'])

    return {
        'type': 'major_detail',
        'name': major_name,
        'code': code,
        'first_year': first_year,
        'last_year': last_year,
        'is_active': is_active,
        'current_college': current_college,
        'college_created_year': college_created_year,
        'department_history': department_history,
        'events': events
    }
```

---
---

# ============================================
# 文件 3: templates/index.html
# ============================================

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>成都理工大学沿革变化系统 - 3D 旗舰版</title>
    <link rel="stylesheet" href="/static/css/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <script src="https://cdn.staticfile.net/three.js/0.160.0/three.min.js"></script>
    <script src="https://cdn.staticfile.net/d3/7.8.5/d3.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three-spritetext@1.9.1/dist/three-spritetext.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/3d-force-graph@1.73.3/dist/3d-force-graph.min.js"></script>
</head>
<body>

<!-- 加载动画 -->
<div id="loading-overlay">
    <div class="loading-content">
        <div class="loading-crystals">
            <div class="crystal crystal-1"></div>
            <div class="crystal crystal-2"></div>
            <div class="crystal crystal-3"></div>
            <div class="crystal crystal-4"></div>
            <div class="crystal crystal-5"></div>
            <div class="crystal crystal-6"></div>
        </div>
        <div class="loading-text">
            Loading<span class="dot dot1">.</span><span class="dot dot2">.</span><span class="dot dot3">.</span>
        </div>
        <div class="loading-progress">
            <div class="loading-progress-bar"></div>
        </div>
    </div>
</div>

<!-- 顶部标题 -->
<div id="top-title-container">
    <div class="title-main-badge">
        <div class="badge-left-decoration"></div>
        <img src="/static/images/cdut-badge.png" alt="成都理工大学校徽" class="title-badge-logo" />
        <div class="title-text-group">
            <div class="title-text">成理沿革图谱</div>
            <div class="title-subtitle">Chengdu University of Technology</div>
        </div>
        <div class="badge-right-decoration">
            <svg viewBox="0 0 40 40" class="crystal-icon">
                <polygon points="20,2 38,15 32,38 8,38 2,15" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                <polygon points="20,8 30,16 26,32 14,32 10,16" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
                <polygon points="20,14 24,18 22,26 18,26 16,18" fill="rgba(255,255,255,0.2)"/>
            </svg>
        </div>
    </div>
</div>

<div id="app-body">
    <!-- 抽屉式侧边栏 -->
    <div id="sidebar" class="drawer-closed">
        <div id="search-drawer-handle">
            <i class="fas fa-search" style="margin-bottom: 10px;"></i>
            关键字检索
        </div>
        <div class="sidebar-content">
            <div class="sidebar-section" id="search-section">
                <div class="search-tabs">
                    <button class="search-tab active" data-tab="year">年份</button>
                    <button class="search-tab" data-tab="college">学院</button>
                    <button class="search-tab" data-tab="major">专业</button>
                </div>
                <div class="search-panel active" id="search-year">
                    <div class="search-input-wrap">
                         <input type="number" id="sidebar-year-input" placeholder="1955-2025" />
                         <button id="sidebar-year-btn">跳转</button>
                    </div>
                </div>
                <div class="search-panel" id="search-college">
                    <div class="search-input-wrap">
                         <input type="text" id="sidebar-college-input" placeholder="输入学院名称..." />
                         <button id="sidebar-college-btn">搜索</button>
                    </div>
                </div>
                <div class="search-panel" id="search-major">
                    <div class="search-input-wrap">
                         <input type="text" id="sidebar-major-input" placeholder="输入专业名称..." />
                        <button id="sidebar-major-btn">搜索</button>
                    </div>
                </div>
                <div id="sidebar-search-results"></div>
            </div>
        </div>
    </div>

    <!-- 主展示区 -->
    <div id="main-wrapper">
        <div id="main">
            <div id="3d-graph"></div>
            <div id="legend">
                <div class="legend-item"><span class="legend-dot school"></span>学校</div>
                <div class="legend-item"><span class="legend-dot department"></span>院系</div>
                <div class="legend-item"><span class="legend-dot major"></span>专业</div>
            </div>
            <div id="detail-panel" class="hidden">
                <div class="panel-header">
                    <h3 id="detail-title">详情</h3>
                    <button id="detail-close" title="关闭">&times;</button>
                </div>
                <div id="detail-content"></div>
            </div>
        </div>

        <!-- 底部时间轴 -->
        <div id="timeline-container">
            <button id="play-btn" title="播放/暂停">▶</button>
            <div id="timeline">
                <div id="timeline-track"><div id="timeline-fill"></div><div id="timeline-thumb"></div></div>
                <div id="timeline-labels"></div>
            </div>
            <div class="timeline-controls">
                <input type="number" id="year-input" value="2025" />
                <button id="goto-btn">跳转</button>
            </div>
        </div>
    </div>
</div>

<!-- 悬浮小助手 -->
<div id="floating-assistant" class="collapsed">
    <div id="assistant-window">
        <div class="assistant-header">
            <span><i class="fas fa-robot"></i> 校友小助手</span>
            <button id="close-assistant">&times;</button>
        </div>
        <div id="assistant-messages"></div>
        <div class="assistant-input-area">
            <input type="text" id="assistant-input" placeholder="输入关键词..." />
            <button id="assistant-send"><i class="fas fa-paper-plane"></i></button>
        </div>
    </div>
    <div id="assistant-trigger">
        <div class="egg-image"></div>
    </div>
</div>

<script src="/static/js/graph.js"></script>
<script src="/static/js/timeline.js"></script>
<script src="/static/js/sidebar.js"></script>
<script src="/static/js/assistant.js"></script>

</body>
</html>
```

---
---

# ============================================
# 文件 4: static/js/graph.js (3D图谱核心)
# ============================================

```javascript
/**
 * 成都理工大学沿革系统 - WebGL 3D 旗舰版
 */
const Graph = (() => {
    let graphInstance;
    let currentYear = 2025;

    const COLORS = {
        school: '#1E3A8A',
        department: '#3B82F6',
        major: '#93C5FD',
        link: 'rgba(180, 190, 210, 0.55)',
        particle: '#60A5FA',
        background: '#050810',
        glow: '#3B82F6'
    };

    const FONT_SIZES = {
        school: 16,
        department: 9,
        major: 5
    };

    function init() {
        const container = document.getElementById('3d-graph');
        if (!container) return;

        graphInstance = ForceGraph3D()(container)
            .backgroundColor(COLORS.background)
            .showNavInfo(false)
            .nodeRelSize(4)
            .linkColor(() => COLORS.link)
            .linkOpacity(0.9)
            .linkWidth(1.0)
            .linkDirectionalParticles(2)
            .linkDirectionalParticleSpeed(0.003)
            .linkDirectionalParticleWidth(1.2)
            .linkDirectionalParticleColor(() => COLORS.particle)
            .nodeThreeObject(node => {
                const group = new THREE.Group();
                const isSchool = node.type === 'school';
                const isDept = node.type === 'department';
                const nodeColor = isSchool ? COLORS.school : (isDept ? COLORS.department : COLORS.major);
                const size = isSchool ? 35 : (isDept ? 18 : 9);

                const geometry = new THREE.SphereGeometry(size, 32, 32);
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

                const glowSize = isSchool ? 1.4 : (isDept ? 1.35 : 1.3);
                const glowOpacity = isSchool ? 0.18 : (isDept ? 0.12 : 0.08);
                const glowGeometry = new THREE.SphereGeometry(size * glowSize, 32, 32);
                const glowMaterial = new THREE.MeshBasicMaterial({
                    color: COLORS.glow,
                    transparent: true,
                    opacity: glowOpacity,
                    side: THREE.BackSide
                });
                const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
                group.add(glowSphere);

                const sprite = new SpriteText(node.name);
                sprite.color = '#ffffff';
                sprite.textHeight = isSchool ? FONT_SIZES.school : (isDept ? FONT_SIZES.department : FONT_SIZES.major);
                sprite.position.set(0, size + 12, 0);
                sprite.backgroundColor = 'transparent';
                sprite.renderOrder = 999;
                sprite.material.depthTest = false;
                group.add(sprite);

                return group;
            })
            .onNodeClick(node => focusOnNode(node));

        const scene = graphInstance.scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(1, 1, 1);
        scene.add(light);

        graphInstance.controls().autoRotate = true;
        graphInstance.controls().autoRotateSpeed = 0.5;

        const closeBtn = document.getElementById('detail-close');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.preventDefault();
                document.getElementById('detail-panel').classList.add('hidden');
            };
        }

        loadYear(2025);
    }

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
                    html += `<p><span>类型:</span> ${detail.type === 'school' ? '学校' : detail.type === 'department' ? '院系' : '专业学科'}</p>`;
                    if(detail.year_range) html += `<p><span>存续:</span> ${detail.year_range}</p>`;
                    if(detail.school && detail.type !== 'school') html += `<p><span>隶属:</span> ${detail.school}</p>`;
                    if(detail.code) html += `<p><span>代码:</span> ${detail.code}</p>`;
                    if(detail.duration) html += `<p><span>学制:</span> ${detail.duration}年</p>`;

                    if(detail.departments && detail.departments.length > 0) {
                        html += `<h4>下辖院系 (${detail.departments.length})</h4><div class="tag-list">`;
                        detail.departments.forEach(d => {
                            html += `<span class="tag-item" onclick="Graph.clickTag('${d}')">${d}</span>`;
                        });
                        html += `</div>`;
                    }

                    if(detail.majors && detail.majors.length > 0) {
                        html += `<h4>开设专业 (${detail.majors.length})</h4><div class="tag-list">`;
                        detail.majors.forEach(m => {
                            html += `<span class="tag-item" onclick="Graph.clickTag('${m}')">${m}</span>`;
                        });
                        html += `</div>`;
                    }

                    const evolution = detail.history || detail.name_evolution || detail.dept_evolution;
                    if(evolution && evolution.length > 0) {
                        html += `<h4>发展沿革</h4><div class="evolution-timeline">`;
                        evolution.forEach(e => {
                            const time = e.period || e.year;
                            const name = e.name || e.department;
                            const isCurrent = name === detail.name || name === detail.department;
                            html += `<div class="evolution-item ${isCurrent ? 'current' : ''}">
                                <span class="evolution-year">${time}</span>
                                <span class="evolution-name">${name}</span>
                            </div>`;
                        });
                        html += `</div>`;
                    }

                    if(detail.note) {
                        html += `<h4>备注说明</h4><p class="detail-note">${detail.note}</p>`;
                    }
                    html += `</div>`;
                    content.innerHTML = html;
                }
            });

        const distance = 500;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graphInstance.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 1500);
    }

    function loadYear(year) {
        currentYear = year;
        if (!graphInstance) return;

        const loadStartTime = Date.now();
        const minLoadTime = 2000;

        fetch(`/api/graph?year=${year}`).then(r => r.json()).then(data => {
            const gData = {
                nodes: data.nodes.map(n => ({
                    id: n.id,
                    name: n.name,
                    type: n.type,
                    z: Math.random() * 100 - 50
                })),
                links: data.links.map(l => ({ source: l.source, target: l.target }))
            };

            graphInstance.graphData(gData);

            graphInstance.d3Force('charge').strength(-900);
            graphInstance.d3Force('radial', d3.forceRadial(node => {
                if (node.type === 'school') return 0;
                if (node.type === 'department') return 260;
                return 850;
            }, 0, 0, 0).strength(0.5));

            graphInstance.d3Force('link').distance(node => {
                return node.source.type === 'school' ? 350 : 180;
            }).strength(0.5);

            graphInstance.d3Force('center', d3.forceCenter(0, 0));

            graphInstance.cameraPosition({ z: 1200 });

            const badge = document.getElementById('current-year-badge');
            if(badge) badge.textContent = year;

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

    return {
        init: init,
        loadYear: loadYear,
        clickTag: (nodeName) => {
            if (!graphInstance) return;
            setTimeout(() => {
                const { nodes } = graphInstance.graphData();
                const target = nodes.find(n =>
                    n.name === nodeName ||
                    n.id === nodeName ||
                    (n.id && n.id.startsWith(nodeName + "("))
                );

                if (target) {
                    const distance = 400;
                    const distRatio = 1 + distance / Math.hypot(target.x, target.y, target.z);
                    graphInstance.cameraPosition(
                        { x: target.x * distRatio, y: target.y * distRatio, z: target.z * distRatio },
                        target,
                        2000
                    );

                    const qn = target.type === 'major' ? target.name : target.id;
                    fetch(`/api/detail?name=${encodeURIComponent(qn)}&year=${currentYear}`)
                        .then(r => r.json())
                        .then(detail => {
                            const panel = document.getElementById('detail-panel');
                            const content = document.getElementById('detail-content');
                            const title = document.getElementById('detail-title');

                            if (panel && content) {
                                panel.classList.remove('hidden');
                                title.textContent = detail.name;
                                let html = `<div class="detail-info">`;
                                html += `<p><span>类型:</span> ${detail.type === 'school' ? '学校' : detail.type === 'department' ? '院系' : '专业学科'}</p>`;
                                if(detail.year_range) html += `<p><span>存续:</span> ${detail.year_range}</p>`;
                                if(detail.code) html += `<p><span>代码:</span> ${detail.code}</p>`;

                                const evolution = detail.history || detail.name_evolution || detail.dept_evolution;
                                if(evolution && evolution.length > 0) {
                                    html += `<h4>发展沿革</h4><div class="evolution-timeline">`;
                                    evolution.forEach(e => {
                                        const time = e.period || e.year;
                                        const name = e.name || e.department;
                                        const isCurrent = name === detail.name || name === detail.department;
                                        html += `<div class="evolution-item ${isCurrent ? 'current' : ''}">
                                            <span class="evolution-year">${time}</span>
                                            <span class="evolution-name">${name}</span>
                                        </div>`;
                                    });
                                    html += `</div>`;
                                }

                                if(detail.note) html += `<h4>备注说明</h4><p class="detail-note">${detail.note}</p>`;
                                html += `</div>`;
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
```

---
---

# ============================================
# 文件 5: static/js/timeline.js
# ============================================

```javascript
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

        Object.entries(milestones).forEach(([yr, name]) => {
            const pct = ((yr - minYear) / (maxYear - minYear)) * 100;
            const marker = document.createElement('div');
            marker.className = 'milestone-marker';
            marker.style.left = pct + '%';
            marker.setAttribute('data-label', name.replace(/（.*）/, ''));
            marker.title = `${yr}: ${name}`;
            track.appendChild(marker);
        });

        const labelYears = [minYear, 1970, 1985, 2000, 2015, maxYear];
        labelYears.forEach(y => {
            const span = document.createElement('span');
            span.textContent = y;
            labels.appendChild(span);
        });

        track.addEventListener('click', (e) => {
            const rect = track.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const yr = Math.round(minYear + pct * (maxYear - minYear));
            setYear(findClosestYear(yr));
        });

        const thumb = document.getElementById('timeline-thumb');
        let dragging = false;

        thumb.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const rect = track.getBoundingClientRect();
            let pct = (e.clientX - rect.left) / rect.width;
            pct = Math.max(0, Math.min(1, pct));
            const yr = Math.round(minYear + pct * (maxYear - minYear));
            setYearVisual(yr);
            debouncedLoad(findClosestYear(yr));
        });
        document.addEventListener('mouseup', () => { dragging = false; });

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

        document.getElementById('play-btn').addEventListener('click', togglePlay);
        document.getElementById('goto-btn').addEventListener('click', () => {
            const yr = parseInt(document.getElementById('year-input').value);
            if (yr >= minYear && yr <= maxYear) setYear(findClosestYear(yr));
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
        const badge = document.getElementById('current-year-badge');
        if (badge) badge.textContent = year;
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
```

---
---

# ============================================
# 文件 6: static/js/sidebar.js
# ============================================

```javascript
const Sidebar = (() => {
    let collegeList = [];
    let majorList = [];
    let currentTab = 'year';

    function init() {
        setupDrawer();
        setupTabs();
        setupYearSearch();
        setupCollegeSearch();
        setupMajorSearch();
        loadAutocompleteLists();
        setupToggle();
    }

    function setupDrawer() {
        const sidebar = document.getElementById('sidebar');
        const handle = document.getElementById('search-drawer-handle');

        if (handle && sidebar) {
            handle.onclick = (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('drawer-closed');
                const icon = handle.querySelector('i');
                if (sidebar.classList.contains('drawer-closed')) {
                    icon.className = 'fas fa-search';
                } else {
                    icon.className = 'fas fa-chevron-left';
                }
            };
        }
    }

    function setupToggle() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebar-toggle');
        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('drawer-closed');
                setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 400);
            });
        }
    }

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

                document.getElementById('sidebar-search-results').innerHTML = '';
            });
        });
    }

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

    function loadAutocompleteLists() {
        fetch('/api/colleges').then(r => r.json()).then(data => { collegeList = data; });
        fetch('/api/majors').then(r => r.json()).then(data => { majorList = data; });
    }

    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

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
            </div>`;

        if (data.majors && data.majors.length > 0) {
            html += `<h5>开设专业 (${data.majors.length})</h5><div class="card-major-list">`;
            data.majors.forEach(m => {
                html += `<div class="card-major-item"><span class="card-major-name">${escapeHtml(m.name)}</span></div>`;
            });
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
            <p style="font-size:12px;color:#c0c8ff;">代码: ${data.code} | 历程: ${data.first_year}-${data.last_year}</p>
            <button class="view-in-graph-btn" onclick="Sidebar.viewInGraph('${escapeHtml(data.name)}')">在图中查看</button>
        </div>`;
        container.innerHTML = html;
    }

    function viewInGraph(name) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('drawer-closed');

        if (typeof Graph !== 'undefined' && Graph.clickTag) {
            Graph.clickTag(name);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        init();
    });

    return { init: () => {}, viewInGraph };
})();
```

---
---

# ============================================
# 文件 7: static/js/assistant.js
# ============================================

```javascript
const Assistant = (() => {
    let state = { level: 'init', period: null, department: null };

    function init() {
        const floatingContainer = document.getElementById('floating-assistant');
        const trigger = document.getElementById('assistant-trigger');
        const closeBtn = document.getElementById('close-assistant');
        const sendBtn = document.getElementById('assistant-send');
        const input = document.getElementById('assistant-input');

        if (sendBtn) {
            sendBtn.addEventListener('click', handleUserInput);
        }

        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleUserInput();
            });
        }

        if (trigger && floatingContainer) {
            trigger.addEventListener('click', (e) => {
                floatingContainer.classList.toggle('collapsed');
                if (!floatingContainer.classList.contains('collapsed') &&
                    document.getElementById('assistant-messages').children.length === 0) {
                    startConversation();
                }
            });
        }

        if (closeBtn && floatingContainer) {
            closeBtn.addEventListener('click', () => {
                floatingContainer.classList.add('collapsed');
            });
        }
    }

    function addMessage(text, type = 'bot') {
        const messages = document.getElementById('assistant-messages');
        const msg = document.createElement('div');
        msg.className = `msg ${type}`;
        msg.innerHTML = text;
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
        return msg;
    }

    function addChoices(items, onClick) {
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
        messages.scrollTop = messages.scrollHeight;

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
        addMessage(name, 'user');
        addMessage(`正在查询 <b>${name}</b> 时期的院系...`);

        fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period: name })
        })
        .then(r => r.json())
        .then(data => {
            if (data.items && data.items.length) {
                addMessage(`${name} 时期共有 <b>${data.items.length}</b> 个院系，请选择：`);
                const items = data.items.map(d => ({ label: d.name, value: d.name }));
                addChoices(items, selectDepartment);
            } else {
                addMessage('该时期暂无院系数据。');
                addChoices([{ label: '返回选择时期', value: '__back__' }], () => { startConversation(); });
            }
        });
    }

    function selectDepartment(name) {
        state.department = name;
        state.level = 'major';
        addMessage(name, 'user');
        addMessage(`正在查询 <b>${name}</b> 的专业...`);

        fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period: state.period, department: name })
        })
        .then(r => r.json())
        .then(data => {
            if (data.items && data.items.length) {
                addMessage(`<b>${name}</b> 共有 <b>${data.items.length}</b> 个专业：`);
                let html = '<div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:6px;color:#e0e0e0">';
                html += '<tr style="color:#38bdf8"><th style="text-align:left;padding:3px">专业</th><th>代码</th></tr>';
                data.items.forEach(m => {
                    html += `<tr style="border-top:1px solid rgba(255,255,255,0.1);cursor:pointer" onclick="Assistant.showMajorDetail('${escapeHtml(m.name)}')">
                        <td style="padding:5px 3px">${m.name}</td>
                        <td style="text-align:center">${m.code}</td></tr>`;
                });
                html += '</table></div>';
                addMessage(html);
                addChoices([{ label: '返回选择院系', value: '__back_dept__' }, { label: '重新开始', value: '__restart__' }],
                (v) => { if (v === '__back_dept__') selectPeriod(state.period); else startConversation(); });
            } else {
                addMessage('该院系暂无专业数据。');
                addChoices([{ label: '返回选择院系', value: '__back_dept__' }, { label: '重新开始', value: '__restart__' }],
                (v) => { if (v === '__back_dept__') selectPeriod(state.period); else startConversation(); });
            }
        });
    }

    function showMajorDetail(name) {
        const year = typeof Timeline !== 'undefined' ? Timeline.getCurrentYear() : 2025;
        fetch(`/api/detail?name=${encodeURIComponent(name)}&year=${year}`)
            .then(r => r.json())
            .then(detail => {
                if (detail.type === 'major') {
                    let html = `<b>${detail.name}</b><br>代码: ${detail.code}<br>学制: ${detail.duration}<br>院系: ${detail.department}<br>`;
                    if (detail.note) html += `说明: ${detail.note}<br>`;
                    addMessage(html);
                }
            });
    }

    function handleUserInput() {
        const input = document.getElementById('assistant-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        addMessage(text, 'user');

        fetch(`/api/search?keyword=${encodeURIComponent(text)}`)
            .then(r => r.json())
            .then(results => {
                if (results.length === 0) {
                    addMessage('未找到相关结果，请尝试其他关键词。');
                    return;
                }
                addMessage(`找到 <b>${results.length}</b> 条相关结果：`);
                const items = results.slice(0, 10).map(r => ({
                    label: `[${r.type === 'department' ? '院系' : '专业'}] ${r.name}`,
                    value: r.name
                }));
                addChoices(items, (name) => {
                    addMessage(name, 'user');
                    const year = typeof Timeline !== 'undefined' ? Timeline.getCurrentYear() : 2025;
                    fetch(`/api/detail?name=${encodeURIComponent(name)}&year=${year}`)
                        .then(r => r.json())
                        .then(detail => { addMessage(formatDetail(detail)); });
                });
            });
    }

    function formatDetail(d) {
        let html = `<b>${d.name}</b><br>`;
        if (d.school) html += `学校: ${d.school}<br>`;
        if (d.department) html += `院系: ${d.department}<br>`;
        if (d.code) html += `代码: ${d.code}<br>`;
        if (d.year_range) html += `存续: ${d.year_range}<br>`;
        return html;
    }

    return { init, showMajorDetail };
})();

document.addEventListener('DOMContentLoaded', () => {
    Assistant.init();
});
```

---
---

# 完整文件导出结束
