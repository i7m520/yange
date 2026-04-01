# -*- coding: utf-8 -*-
"""
数据库模块 - SQLite数据库管理
用于存储成都理工大学沿革数据
"""
import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'evolution.db')


def get_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 返回字典格式
    return conn


def init_db():
    """初始化数据库表结构"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. 学校历史表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS school_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_year INTEGER NOT NULL,
            end_year INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 2. 学校里程碑表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS school_milestones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL UNIQUE,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 3. 院系表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            short_name TEXT,
            code TEXT,
            attribution TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, attribution)
        )
    ''')
    
    # 4. 专业表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS majors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, code)
        )
    ''')
    
    # 5. 专业年度记录表（核心数据）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS major_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            major_id INTEGER NOT NULL,
            year INTEGER NOT NULL,
            school_name TEXT NOT NULL,
            department TEXT NOT NULL,
            department_code TEXT,
            attribution TEXT,
            duration TEXT,
            direction TEXT,
            note TEXT,
            end_year INTEGER,
            proof_material TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (major_id) REFERENCES majors(id),
            UNIQUE(major_id, year)
        )
    ''')
    
    # 创建索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_major_records_year ON major_records(year)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_major_records_school ON major_records(school_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_major_records_dept ON major_records(department)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_major_records_attr ON major_records(attribution)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_majors_name ON majors(name)')
    
    conn.commit()
    conn.close()
    print("数据库初始化完成！")


def insert_school_history(data):
    """插入学校历史数据"""
    conn = get_connection()
    cursor = conn.cursor()
    for item in data:
        cursor.execute('''
            INSERT OR REPLACE INTO school_history (name, start_year, end_year)
            VALUES (?, ?, ?)
        ''', (item['name'], item['start'], item['end']))
    conn.commit()
    conn.close()


def insert_school_milestones(data):
    """插入学校里程碑数据"""
    conn = get_connection()
    cursor = conn.cursor()
    for year, name in data.items():
        cursor.execute('''
            INSERT OR REPLACE INTO school_milestones (year, name)
            VALUES (?, ?)
        ''', (year, name))
    conn.commit()
    conn.close()


def insert_department(name, short_name=None, code=None, attribution=None):
    """插入院系数据，返回ID"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR IGNORE INTO departments (name, short_name, code, attribution)
            VALUES (?, ?, ?, ?)
        ''', (name, short_name, code, attribution))
        
        # 获取ID
        cursor.execute('SELECT id FROM departments WHERE name = ? AND attribution = ?', (name, attribution or ''))
        result = cursor.fetchone()
        conn.commit()
        return result['id'] if result else None
    finally:
        conn.close()


def insert_major(name, code=None):
    """插入专业数据，返回ID"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR IGNORE INTO majors (name, code)
            VALUES (?, ?)
        ''', (name, code))
        
        # 获取ID
        cursor.execute('SELECT id FROM majors WHERE name = ? AND code = ?', (name, code or ''))
        result = cursor.fetchone()
        conn.commit()
        return result['id'] if result else None
    finally:
        conn.close()


def insert_major_record(major_id, year, school_name, department, department_code=None,
                        attribution=None, duration=None, direction=None, note=None,
                        end_year=None, proof_material=None):
    """插入专业年度记录"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO major_records 
            (major_id, year, school_name, department, department_code, attribution, 
             duration, direction, note, end_year, proof_material, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (major_id, year, school_name, department, department_code, attribution,
              duration, direction, note, end_year, proof_material, datetime.now()))
        conn.commit()
    finally:
        conn.close()


def get_major_by_name(name):
    """根据专业名获取专业ID"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM majors WHERE name = ?', (name,))
    result = cursor.fetchone()
    conn.close()
    return result['id'] if result else None


# ========== 查询函数 ==========

def get_all_years():
    """获取所有年份"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT year FROM major_records ORDER BY year')
    years = [row['year'] for row in cursor.fetchall()]
    conn.close()
    return years


def get_year_range():
    """获取年份范围"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT MIN(year) as min_year, MAX(year) as max_year FROM major_records')
    result = cursor.fetchone()
    
    # 获取里程碑
    cursor.execute('SELECT year, name FROM school_milestones ORDER BY year')
    milestones = {row['year']: row['name'] for row in cursor.fetchall()}
    
    conn.close()
    return {
        'min_year': result['min_year'],
        'max_year': result['max_year'],
        'available_years': get_all_years(),
        'school_milestones': milestones
    }


def get_school_history():
    """获取学校历史"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT name, start_year, end_year FROM school_history ORDER BY start_year')
    result = [{'name': row['name'], 'start': row['start_year'], 'end': row['end_year']} 
              for row in cursor.fetchall()]
    conn.close()
    return result


def get_graph_data(year):
    """获取图谱数据"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 获取该年度所有记录
    cursor.execute('''
        SELECT mr.*, m.name as major_name, m.code as major_code
        FROM major_records mr
        JOIN majors m ON mr.major_id = m.id
        WHERE mr.year = ?
    ''', (year,))
    records = cursor.fetchall()
    
    if not records:
        # 返回空数据
        return {'nodes': [], 'links': [], 'school_name': ''}
    
    nodes = []
    links = []
    node_ids = set()
    
    # 获取主要学校名
    school_names = list(set(row['school_name'] for row in records))
    primary_school = school_names[0] if school_names else ''
    
    # 添加学校节点
    for sn in school_names:
        if sn and sn not in node_ids:
            nodes.append({'id': sn, 'type': 'school', 'name': sn})
            node_ids.add(sn)
    
    # 添加院系和专业节点
    for row in records:
        school = row['school_name']
        dept = row['department']
        major_name = row['major_name']
        major_code = row['major_code']
        attribution = row['attribution']
        direction = row['direction']
        
        # 添加院系节点
        if dept and dept not in node_ids:
            nodes.append({
                'id': dept,
                'type': 'department',
                'name': dept,
                'attribution': attribution or ''
            })
            node_ids.add(dept)
            if school:
                links.append({'source': school, 'target': dept})
        
        # 添加专业节点
        if major_name and dept:
            major_id = f"{major_name}({major_code})" if major_code else major_name
            if major_id not in node_ids:
                nodes.append({
                    'id': major_id,
                    'type': 'major',
                    'name': major_name,
                    'code': str(major_code) if major_code else '',
                    'direction': str(direction) if direction else ''
                })
                node_ids.add(major_id)
                links.append({'source': dept, 'target': major_id})
    
    conn.close()
    return {
        'nodes': nodes,
        'links': links,
        'school_name': primary_school
    }


def get_node_detail(name, year):
    """获取节点详情"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 首先检查是否是学校节点
    cursor.execute('''
        SELECT * FROM school_history
        WHERE name = ?
    ''', (name,))
    school_record = cursor.fetchone()
    
    if school_record:
        # 获取该年份的所有院系（通过 attribution 或 department）
        cursor.execute('''
            SELECT DISTINCT attribution FROM major_records
            WHERE school_name = ? AND year = ?
            ORDER BY attribution
        ''', (name, year))
        departments = [row['attribution'] for row in cursor.fetchall() if row['attribution']]
        
        # 获取里程碑
        cursor.execute('''
            SELECT year, name FROM school_milestones
            WHERE year <= ? 
            ORDER BY year DESC LIMIT 5
        ''', (year,))
        milestones = cursor.fetchall()
        
        conn.close()
        return {
            'type': 'school',
            'name': name,
            'year': year,
            'year_range': f"{school_record['start_year']}-{school_record['end_year']}",
            'departments': departments,
            'departments_count': len(departments),
            'history': [{'year': m['year'], 'name': m['name']} for m in milestones]
        }
    
    # 处理带代码的专业名称（如 "计算机科学与技术(080901)"）
    pure_name = name.split('(')[0] if '(' in name else name
    
    # 尝试作为专业查找
    cursor.execute('''
        SELECT mr.*, m.name as major_name, m.code as major_code
        FROM major_records mr
        JOIN majors m ON mr.major_id = m.id
        WHERE m.name = ? AND mr.year = ?
    ''', (pure_name, year))
    major_record = cursor.fetchone()
    
    if major_record:
        # 获取专业历史
        cursor.execute('''
            SELECT mr.*, m.code as major_code
            FROM major_records mr
            JOIN majors m ON mr.major_id = m.id
            WHERE m.name = ?
            ORDER BY mr.year
        ''', (pure_name,))
        history = cursor.fetchall()
        
        # 构建详情
        all_years = [h['year'] for h in history]
        dept_changes = []
        code_changes = []
        prev_dept = None
        prev_code = None
        
        for h in history:
            if h['department'] != prev_dept:
                dept_changes.append({
                    'year': h['year'],
                    'department': h['department'],
                    'school': h['school_name']
                })
                prev_dept = h['department']
            
            code = str(h['major_code']) if h['major_code'] else ''
            if code != prev_code:
                code_changes.append({'year': h['year'], 'code': code})
                prev_code = code
        
        conn.close()
        return {
            'type': 'major',
            'name': pure_name,
            'year': year,
            'school': major_record['school_name'],
            'department': major_record['department'],
            'code': str(major_record['major_code']) if major_record['major_code'] else '',
            'duration': major_record['duration'] or '',
            'note': major_record['note'] or '',
            'direction': major_record['direction'] or '',
            'year_range': f"{min(all_years)}-{max(all_years)}" if all_years else '',
            'dept_evolution': dept_changes,
            'code_evolution': code_changes
        }
    
    # 尝试作为归属学院查找（先精确匹配，再模糊匹配）
    cursor.execute('''
        SELECT * FROM major_records
        WHERE attribution = ? AND year = ?
        LIMIT 1
    ''', (name, year))
    attr_record = cursor.fetchone()
    
    # 如果精确匹配没找到，尝试模糊匹配
    if not attr_record:
        cursor.execute('''
            SELECT * FROM major_records
            WHERE attribution LIKE ? AND year = ?
            LIMIT 1
        ''', (f'%{name}%', year))
        attr_record = cursor.fetchone()
    
    if attr_record:
        attribution_name = attr_record['attribution']
        # 获取归属学院下的专业
        cursor.execute('''
            SELECT DISTINCT m.name, m.code
            FROM major_records mr
            JOIN majors m ON mr.major_id = m.id
            WHERE mr.attribution = ? AND mr.year = ?
        ''', (attribution_name, year))
        majors = cursor.fetchall()
        
        # 获取归属学院历史年份
        cursor.execute('''
            SELECT DISTINCT year FROM major_records
            WHERE attribution = ?
            ORDER BY year
        ''', (attribution_name,))
        years = [row['year'] for row in cursor.fetchall()]
        
        conn.close()
        return {
            'type': 'attribution',
            'name': attribution_name,
            'year': year,
            'school': attr_record['school_name'],
            'majors': [m['name'] for m in majors],
            'majors_count': len(majors),
            'year_range': f"{min(years)}-{max(years)}" if years else ''
        }
    
    # 尝试作为院系查找
    cursor.execute('''
        SELECT * FROM major_records
        WHERE department = ? AND year = ?
    ''', (name, year))
    dept_record = cursor.fetchone()
    
    if dept_record:
        # 获取院系下的专业
        cursor.execute('''
            SELECT DISTINCT m.name, m.code
            FROM major_records mr
            JOIN majors m ON mr.major_id = m.id
            WHERE mr.department = ? AND mr.year = ?
        ''', (name, year))
        majors = cursor.fetchall()
        
        # 获取院系历史年份
        cursor.execute('''
            SELECT DISTINCT year FROM major_records
            WHERE department = ?
            ORDER BY year
        ''', (name,))
        years = [row['year'] for row in cursor.fetchall()]
        
        conn.close()
        return {
            'type': 'department',
            'name': name,
            'year': year,
            'school': dept_record['school_name'],
            'attribution': dept_record['attribution'] or '',
            'majors': [m['name'] for m in majors],
            'majors_count': len(majors),
            'year_range': f"{min(years)}-{max(years)}" if years else ''
        }
    
    conn.close()
    return {'type': 'unknown', 'name': name, 'message': '未找到相关信息'}


def search(keyword):
    """搜索"""
    conn = get_connection()
    cursor = conn.cursor()
    results = []
    seen = set()
    
    # 搜索归属学院（attribution）
    cursor.execute('''
        SELECT DISTINCT attribution
        FROM major_records
        WHERE attribution LIKE ?
        ORDER BY attribution
    ''', (f'%{keyword}%',))
    
    for row in cursor.fetchall():
        if row['attribution'] and row['attribution'] not in seen:
            cursor.execute('''
                SELECT DISTINCT year FROM major_records
                WHERE attribution = ?
                ORDER BY year
            ''', (row['attribution'],))
            years = [r['year'] for r in cursor.fetchall()]
            results.append({
                'type': 'attribution',
                'name': row['attribution'],
                'years': years
            })
            seen.add(row['attribution'])
    
    # 搜索院系
    cursor.execute('''
        SELECT DISTINCT department, attribution
        FROM major_records
        WHERE department LIKE ?
        ORDER BY department
    ''', (f'%{keyword}%',))
    
    for row in cursor.fetchall():
        if row['department'] not in seen:
            cursor.execute('''
                SELECT DISTINCT year FROM major_records
                WHERE department = ?
                ORDER BY year
            ''', (row['department'],))
            years = [r['year'] for r in cursor.fetchall()]
            results.append({
                'type': 'department',
                'name': row['department'],
                'years': years
            })
            seen.add(row['department'])
    
    # 搜索专业
    cursor.execute('''
        SELECT DISTINCT m.name, m.code
        FROM majors m
        WHERE m.name LIKE ?
        ORDER BY m.name
    ''', (f'%{keyword}%',))
    
    for row in cursor.fetchall():
        if row['name'] not in seen:
            cursor.execute('''
                SELECT DISTINCT year FROM major_records mr
                JOIN majors m ON mr.major_id = m.id
                WHERE m.name = ?
                ORDER BY year
            ''', (row['name'],))
            years = [r['year'] for r in cursor.fetchall()]
            results.append({
                'type': 'major',
                'name': row['name'],
                'code': row['code'] or '',
                'years': years
            })
            seen.add(row['name'])
    
    conn.close()
    return results


def get_assistant_data(period=None, department=None):
    """获取小助手数据"""
    conn = get_connection()
    cursor = conn.cursor()
    
    if period is None and department is None:
        # 返回学校时期
        history = get_school_history()
        return {'level': 'school', 'items': history}
    
    if period and department is None:
        # 返回院系列表
        cursor.execute('''
            SELECT DISTINCT attribution
            FROM major_records
            WHERE school_name = ?
            ORDER BY attribution
        ''', (period,))
        depts = [row['attribution'] for row in cursor.fetchall() if row['attribution']]
        
        conn.close()
        return {
            'level': 'department',
            'school': period,
            'items': [{'name': d} for d in depts]
        }
    
    if period and department:
        # 返回专业列表（去重）
        cursor.execute('''
            SELECT m.name, m.code, mr.duration, mr.department, mr.note
            FROM major_records mr
            JOIN majors m ON mr.major_id = m.id
            WHERE mr.school_name = ? AND mr.attribution = ?
            GROUP BY m.name
            ORDER BY m.name
        ''', (period, department))
        
        majors = [{
            'name': row['name'],
            'code': str(row['code']) if row['code'] else '',
            'duration': str(row['duration']) if row['duration'] else '',
            'department': str(row['department']) if row['department'] else '',
            'note': str(row['note']) if row['note'] else ''
        } for row in cursor.fetchall()]
        
        conn.close()
        return {
            'level': 'major',
            'school': period,
            'department': department,
            'items': majors
        }
    
    conn.close()
    return {'level': 'unknown', 'items': []}


def get_all_colleges():
    """获取所有归属学院"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT DISTINCT attribution FROM major_records
        WHERE attribution IS NOT NULL AND attribution != ''
        ORDER BY attribution
    ''')
    colleges = [row['attribution'] for row in cursor.fetchall()]
    conn.close()
    return colleges


def get_all_majors():
    """获取所有专业"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM majors ORDER BY name')
    majors = [row['name'] for row in cursor.fetchall()]
    conn.close()
    return majors


def search_college_detail(keyword):
    """搜索学院详情（归属学院）"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 搜索归属学院
    cursor.execute('''
        SELECT DISTINCT attribution FROM major_records
        WHERE attribution LIKE ?
        ORDER BY attribution
    ''', (f'%{keyword}%',))
    
    results = cursor.fetchall()
    if not results:
        conn.close()
        return None
    
    # 取第一个匹配的归属学院
    attribution = results[0]['attribution']
    
    # 获取归属学院下的所有专业（去重 - 按专业名分组）
    cursor.execute('''
        SELECT m.name, MAX(m.code) as code, MAX(mr.duration) as duration
        FROM major_records mr
        JOIN majors m ON mr.major_id = m.id
        WHERE mr.attribution = ?
        GROUP BY m.name
        ORDER BY m.name
    ''', (attribution,))
    majors = cursor.fetchall()
    
    # 获取年份范围
    cursor.execute('''
        SELECT MIN(year) as first_year, MAX(year) as last_year
        FROM major_records WHERE attribution = ?
    ''', (attribution,))
    year_range = cursor.fetchone()
    
    # 获取院系名称演变历史
    cursor.execute('''
        SELECT DISTINCT year, department
        FROM major_records
        WHERE attribution = ?
        ORDER BY year
    ''', (attribution,))
    dept_history = cursor.fetchall()
    
    # 构建名称演变
    name_evolution = []
    prev_dept = None
    start_year = None
    for h in dept_history:
        if h['department'] != prev_dept:
            if prev_dept is not None:
                name_evolution.append({
                    'name': prev_dept,
                    'start': start_year,
                    'end': h['year'] - 1
                })
            prev_dept = h['department']
            start_year = h['year']
    
    if prev_dept is not None and dept_history:
        last_year = dept_history[-1]['year']
        name_evolution.append({
            'name': prev_dept,
            'start': start_year,
            'end': last_year
        })
    
    conn.close()
    return {
        'attribution': attribution,
        'majors': [{'name': m['name'], 'code': str(m['code']) if m['code'] else '', 'duration': str(m['duration']) if m['duration'] else ''} for m in majors],
        'first_year': year_range['first_year'],
        'last_year': year_range['last_year'],
        'name_evolution': name_evolution
    }


def search_major_detail(keyword):
    """搜索专业详情"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 搜索专业
    cursor.execute('''
        SELECT id, name, code FROM majors
        WHERE name LIKE ?
        ORDER BY name
    ''', (f'%{keyword}%',))
    
    results = cursor.fetchall()
    if not results:
        conn.close()
        return None
    
    # 取第一个匹配的专业
    major = results[0]
    major_name = major['name']
    
    # 获取专业所有年份记录
    cursor.execute('''
        SELECT mr.*, m.code as major_code
        FROM major_records mr
        JOIN majors m ON mr.major_id = m.id
        WHERE m.name = ?
        ORDER BY mr.year
    ''', (major_name,))
    records = cursor.fetchall()
    
    if not records:
        conn.close()
        return None
    
    all_years = [r['year'] for r in records]
    first_year = min(all_years)
    last_year = max(all_years)
    
    # 获取最新记录
    latest = records[-1]
    
    # 构建院系演变历史
    dept_evolution = []
    prev_dept = None
    for r in records:
        if r['department'] != prev_dept:
            dept_evolution.append({
                'year': r['year'],
                'department': r['department'],
                'school': r['school_name']
            })
            prev_dept = r['department']
    
    conn.close()
    return {
        'name': major_name,
        'code': str(latest['major_code']) if latest['major_code'] else '',
        'first_year': first_year,
        'last_year': last_year,
        'duration': str(latest['duration']) if latest['duration'] else '',
        'school': latest['school_name'],
        'department': latest['department'],
        'attribution': latest['attribution'] or '',
        'dept_evolution': dept_evolution
    }


# ========== 数据管理API ==========

def add_major_record(data):
    """添加专业记录"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 插入或获取专业ID
        cursor.execute('''
            INSERT OR IGNORE INTO majors (name, code)
            VALUES (?, ?)
        ''', (data['name'], data.get('code', '')))
        
        cursor.execute('SELECT id FROM majors WHERE name = ?', (data['name'],))
        major_id = cursor.fetchone()['id']
        
        # 插入年度记录
        cursor.execute('''
            INSERT OR REPLACE INTO major_records
            (major_id, year, school_name, department, department_code, attribution,
             duration, direction, note, end_year, proof_material, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            major_id,
            data['year'],
            data['school_name'],
            data['department'],
            data.get('department_code', ''),
            data.get('attribution', ''),
            data.get('duration', ''),
            data.get('direction', ''),
            data.get('note', ''),
            data.get('end_year'),
            data.get('proof_material', ''),
            datetime.now()
        ))
        
        conn.commit()
        return {'success': True, 'message': '添加成功', 'major_id': major_id}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': str(e)}
    finally:
        conn.close()


def update_major_record(record_id, data):
    """更新专业记录"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        update_fields = []
        values = []
        
        for field in ['school_name', 'department', 'department_code', 'attribution',
                      'duration', 'direction', 'note', 'end_year', 'proof_material']:
            if field in data:
                update_fields.append(f'{field} = ?')
                values.append(data[field])
        
        if update_fields:
            update_fields.append('updated_at = ?')
            values.append(datetime.now())
            values.append(record_id)
            
            cursor.execute(f'''
                UPDATE major_records SET {', '.join(update_fields)}
                WHERE id = ?
            ''', values)
            conn.commit()
        
        return {'success': True, 'message': '更新成功'}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': str(e)}
    finally:
        conn.close()


def delete_major_record(record_id):
    """删除专业记录"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('DELETE FROM major_records WHERE id = ?', (record_id,))
        conn.commit()
        return {'success': True, 'message': '删除成功'}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': str(e)}
    finally:
        conn.close()


if __name__ == '__main__':
    # 初始化数据库
    init_db()
    print("数据库文件已创建:", DB_PATH)
