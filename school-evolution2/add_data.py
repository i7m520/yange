# -*- coding: utf-8 -*-
"""
数据添加脚本 - 向数据库添加专业记录
使用方法: python add_data.py
"""
import database as db

# ==========================================
# 示例：添加新专业
# ==========================================

def add_new_major():
    """添加新专业示例"""
    
    # 专业信息
    major_data = {
        'name': '人工智能',           # 专业名称
        'code': '080717T',           # 专业代码
        'year': 2026,                # 年度
        'school_name': '成都理工大学（成都校区）',  # 学校名称
        'department': '计算机与网络安全学院（示范性软件学院）',  # 所在院系
        'attribution': '计算机与网络安全学院',  # 归属学院
        'duration': '4年',           # 学制
        'direction': '智能系统方向',   # 专业方向
        'note': '2026年新增专业',      # 说明
    }
    
    result = db.add_major_record(major_data)
    print(f"添加结果: {result}")


def batch_add_majors():
    """批量添加专业示例"""
    
    majors = [
        {
            'name': '人工智能',
            'code': '080717T',
            'year': 2026,
            'school_name': '成都理工大学（成都校区）',
            'department': '计算机与网络安全学院（示范性软件学院）',
            'attribution': '计算机与网络安全学院',
            'duration': '4年',
        },
        {
            'name': '数据科学与大数据技术',
            'code': '080910T',
            'year': 2026,
            'school_name': '成都理工大学（成都校区）',
            'department': '计算机与网络安全学院（示范性软件学院）',
            'attribution': '计算机与网络安全学院',
            'duration': '4年',
        },
    ]
    
    success_count = 0
    for major in majors:
        result = db.add_major_record(major)
        if result.get('success'):
            success_count += 1
            print(f"✓ 添加成功: {major['name']}")
        else:
            print(f"✗ 添加失败: {major['name']} - {result.get('message')}")
    
    print(f"\n总计: 成功 {success_count} 条")


def add_major_for_multiple_years():
    """为同一专业添加多个年度记录"""
    
    major_name = '人工智能'
    major_code = '080717T'
    years = [2026, 2027, 2028]  # 添加多个年份
    
    for year in years:
        result = db.add_major_record({
            'name': major_name,
            'code': major_code,
            'year': year,
            'school_name': '成都理工大学（成都校区）',
            'department': '计算机与网络安全学院（示范性软件学院）',
            'attribution': '计算机与网络安全学院',
            'duration': '4年',
        })
        print(f"{year}年: {'✓' if result.get('success') else '✗'} {result.get('message')}")


def update_major_info():
    """更新专业信息"""
    
    # 先查询记录ID
    record_id = 1  # 替换为实际ID
    
    result = db.update_major_record(record_id, {
        'note': '更新后的说明',
        'direction': '新方向'
    })
    print(f"更新结果: {result}")


def query_major():
    """查询专业信息"""
    
    import sqlite3
    conn = db.get_connection()
    cursor = conn.cursor()
    
    # 查询所有专业
    cursor.execute('SELECT id, name, code FROM majors ORDER BY name LIMIT 10')
    print("\n专业列表（前10个）:")
    for row in cursor.fetchall():
        print(f"  {row['id']}: {row['name']} ({row['code']})")
    
    # 查询某专业的所有记录
    cursor.execute('''
        SELECT mr.*, m.name, m.code
        FROM major_records mr
        JOIN majors m ON mr.major_id = m.id
        WHERE m.name = ?
        ORDER BY mr.year
    ''', ('软件工程',))
    
    print("\n软件工程的历史记录:")
    for row in cursor.fetchall():
        print(f"  {row['year']}: {row['department']}")
    
    conn.close()


# ==========================================
# 主程序
# ==========================================

if __name__ == '__main__':
    print("=" * 50)
    print("数据添加工具")
    print("=" * 50)
    
    print("\n请选择操作:")
    print("1. 添加单个专业")
    print("2. 批量添加专业")
    print("3. 为专业添加多年记录")
    print("4. 更新专业信息")
    print("5. 查询专业信息")
    print("0. 退出")
    
    choice = input("\n请输入选项: ").strip()
    
    if choice == '1':
        add_new_major()
    elif choice == '2':
        batch_add_majors()
    elif choice == '3':
        add_major_for_multiple_years()
    elif choice == '4':
        update_major_info()
    elif choice == '5':
        query_major()
    elif choice == '0':
        print("已退出")
    else:
        print("无效选项")
