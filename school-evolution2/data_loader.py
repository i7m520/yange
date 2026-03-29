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
    # Strip code suffix if present: "专业名(代码)" -> "专业名"
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

    # Current year info
    school = year_data['学校名称'].iloc[0] if not year_data.empty and pd.notna(year_data['学校名称'].iloc[0]) else ''
    attribution = year_data['归属学院'].iloc[0] if not year_data.empty and pd.notna(year_data['归属学院'].iloc[0]) else ''
    majors = sorted(year_data['专业'].dropna().unique().tolist()) if not year_data.empty else []

    # Department name evolution via 归属学院
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

    # Track department changes across years
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

    # Track code changes
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

    # Name evolution
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

    # Search in department names
    dept_matches = df[df['所在院系'].str.contains(keyword, na=False, case=False)]
    for dept in dept_matches['所在院系'].unique():
        if dept not in seen:
            years = sorted(dept_matches[dept_matches['所在院系'] == dept]['年度'].unique().tolist())
            results.append({
                'type': 'department', 'name': dept,
                'years': [int(y) for y in years],
            })
            seen.add(dept)

    # Search in major names
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

    # Search in attribution colleges
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
        # Return school periods
        return {
            'level': 'school',
            'items': SCHOOL_HISTORY,
        }

    if period and department is None:
        # Return departments for a school period
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
        # Return majors for a department in a school period
        period_data = df[(df['学校名称'] == period) & (df['归属学院'] == department)]
        if period_data.empty:
            # Try matching 所在院系
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
    """Return a sorted list of all attribution college names (归属学院)."""
    df = _load()
    colleges = sorted(df['归属学院'].dropna().unique().tolist())
    return colleges


def get_all_majors():
    """Return a sorted list of all major names (专业)."""
    df = _load()
    majors = sorted(df['专业'].dropna().unique().tolist())
    return majors


def search_college_detail(keyword):
    """Search by college (归属学院), return detailed evolution info."""
    df = _load()

    # Find matching attribution colleges
    matches = df[df['归属学院'].str.contains(keyword, na=False, case=False)]
    if matches.empty:
        return None

    # Use the first matching attribution college
    attribution = matches['归属学院'].value_counts().index[0]
    attr_data = df[df['归属学院'] == attribution]

    # Name evolution: track how department name (所在院系) changed over time
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

    # Build majors list with migration and status info
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

        # Get code
        code = ''
        code_val = major_in_college['专业代码'].dropna()
        if not code_val.empty:
            code = str(code_val.iloc[-1])

        # Determine status
        # Check if this major is still in this college in the latest year
        latest_year = max(all_m_years)
        latest_row = major_all[major_all['年度'] == latest_year].iloc[0]
        latest_attr = latest_row['归属学院'] if pd.notna(latest_row['归属学院']) else ''

        if latest_attr == attribution:
            status = 'active'
        else:
            # Check if major was removed entirely or migrated out
            if last_in_college < latest_year:
                status = 'migrated_out'
            else:
                status = 'active'

        # Check end year (结束年度)
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

        # Build migrations: track college changes for this major
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
    """Search by major name (专业), return detailed evolution info."""
    df = _load()

    matches = df[df['专业'].str.contains(keyword, na=False, case=False)]
    if matches.empty:
        return None

    # Use the first matching major
    major_name = matches['专业'].value_counts().index[0]
    major_data = df[df['专业'] == major_name].sort_values('年度')

    all_years = sorted(major_data['年度'].unique().tolist())
    first_year = int(min(all_years))
    last_year = int(max(all_years))

    # Get code from latest record
    code = ''
    code_val = major_data['专业代码'].dropna()
    if not code_val.empty:
        code = str(code_val.iloc[-1])

    # Check if active (exists in latest available year in dataset)
    dataset_max_year = int(df['年度'].max())
    is_active = last_year >= dataset_max_year

    # Current college info
    latest_row = major_data.iloc[-1]
    current_college = latest_row['归属学院'] if pd.notna(latest_row['归属学院']) else ''

    # Find when current college was created
    college_created_year = None
    if current_college:
        college_data = df[df['归属学院'] == current_college]
        if not college_data.empty:
            college_created_year = int(college_data['年度'].min())

    # Department history: track which department (所在院系) and attribution (归属学院) over time
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

    # Build events list
    events = []
    events.append({
        'year': first_year,
        'event': 'created',
        'detail': f"专业创建，隶属{major_data.iloc[0]['所在院系'] if pd.notna(major_data.iloc[0]['所在院系']) else '未知'}"
    })

    # Track migrations
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

    # Track code changes
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

    # Check if removed
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

    # Sort events by year
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
