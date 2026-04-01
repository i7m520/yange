# -*- coding: utf-8 -*-
"""
数据迁移脚本 - 将Excel数据导入SQLite数据库
"""
import pandas as pd
import os
import database as db

# 数据文件路径
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', '本科专业发展-导出数据.xlsx')

# 学校历史数据
SCHOOL_HISTORY = [
    {'name': '北京地质学院', 'start': 1955, 'end': 1955},
    {'name': '重庆大学', 'start': 1955, 'end': 1955},
    {'name': '成都地质勘探学院', 'start': 1956, 'end': 1958},
    {'name': '成都地质学院', 'start': 1959, 'end': 1992},
    {'name': '成都理工学院', 'start': 1993, 'end': 2001},
    {'name': '成都理工大学（成都校区）', 'start': 2002, 'end': 2025},
]

# 学校里程碑
SCHOOL_MILESTONES = {
    1956: '成都地质勘探学院',
    1959: '成都地质学院',
    1993: '成都理工学院',
    2002: '成都理工大学（成都校区）',
}


def migrate():
    """执行数据迁移"""
    print("=" * 50)
    print("开始数据迁移...")
    print("=" * 50)
    
    # 1. 初始化数据库
    print("\n[1/4] 初始化数据库...")
    db.init_db()
    
    # 2. 插入学校历史和里程碑
    print("\n[2/4] 导入学校历史数据...")
    db.insert_school_history(SCHOOL_HISTORY)
    db.insert_school_milestones(SCHOOL_MILESTONES)
    print(f"  - 学校历史: {len(SCHOOL_HISTORY)} 条")
    print(f"  - 学校里程碑: {len(SCHOOL_MILESTONES)} 条")
    
    # 3. 读取Excel数据
    print("\n[3/4] 读取Excel数据...")
    df = pd.read_excel(DATA_FILE, header=2)
    
    # 设置列名
    cols = [
        '确定', '专业', '专业代码', '年度', '学制', '学校名称',
        '所在院系', '院系简称', '院系代码', '归属学院', '专业方向',
        '说明', '证明材料', '归属部门', '结束年度',
        '创建时间', '更新时间', '创建成员', '记录ID'
    ]
    df.columns = cols
    
    # 处理年度
    df['年度'] = pd.to_numeric(df['年度'], errors='coerce')
    df = df.dropna(subset=['年度'])
    df['年度'] = df['年度'].astype(int)
    
    print(f"  - 总记录数: {len(df)} 条")
    print(f"  - 年份范围: {df['年度'].min()} - {df['年度'].max()}")
    
    # 4. 导入专业数据
    print("\n[4/4] 导入专业数据...")
    
    major_count = 0
    record_count = 0
    dept_cache = {}
    
    for idx, row in df.iterrows():
        try:
            # 跳过空数据
            if pd.isna(row['专业']) or pd.isna(row['年度']):
                continue
            
            major_name = str(row['专业']).strip()
            major_code = str(row['专业代码']).strip() if pd.notna(row['专业代码']) else ''
            year = int(row['年度'])
            school_name = str(row['学校名称']).strip() if pd.notna(row['学校名称']) else '成都理工大学（成都校区）'
            department = str(row['所在院系']).strip() if pd.notna(row['所在院系']) else ''
            dept_code = str(row['院系代码']).strip() if pd.notna(row['院系代码']) else ''
            dept_short = str(row['院系简称']).strip() if pd.notna(row['院系简称']) else ''
            attribution = str(row['归属学院']).strip() if pd.notna(row['归属学院']) else ''
            duration = str(row['学制']).strip() if pd.notna(row['学制']) else ''
            direction = str(row['专业方向']).strip() if pd.notna(row['专业方向']) else ''
            note = str(row['说明']).strip() if pd.notna(row['说明']) else ''
            proof = str(row['证明材料']).strip() if pd.notna(row['证明材料']) else ''
            # 提取年份（处理日期格式）
            if pd.notna(row['结束年度']):
                try:
                    end_val = row['结束年度']
                    if isinstance(end_val, str):
                        # 从日期字符串提取年份
                        end_year = int(end_val.split('/')[0])
                    elif isinstance(end_val, pd.Timestamp):
                        end_year = end_val.year
                    else:
                        end_year = int(end_val)
                except:
                    end_year = None
            else:
                end_year = None
            
            # 插入专业
            major_id = db.insert_major(major_name, major_code)
            if major_id:
                major_count += 1
            
            # 插入年度记录
            db.insert_major_record(
                major_id=major_id,
                year=year,
                school_name=school_name,
                department=department,
                department_code=dept_code,
                attribution=attribution,
                duration=duration,
                direction=direction,
                note=note,
                end_year=end_year,
                proof_material=proof
            )
            record_count += 1
            
            # 进度显示
            if record_count % 100 == 0:
                print(f"  - 已处理 {record_count} 条记录...")
                
        except Exception as e:
            print(f"  - 警告: 第 {idx + 3} 行处理失败: {e}")
            continue
    
    print(f"\n迁移完成!")
    print(f"  - 专业数: {major_count}")
    print(f"  - 年度记录数: {record_count}")
    
    # 验证数据
    print("\n验证数据...")
    years = db.get_all_years()
    print(f"  - 年份数: {len(years)}")
    print(f"  - 年份范围: {min(years)} - {max(years)}")
    
    colleges = db.get_all_colleges()
    print(f"  - 归属学院数: {len(colleges)}")
    
    majors = db.get_all_majors()
    print(f"  - 专业数: {len(majors)}")
    
    print("\n" + "=" * 50)
    print("数据迁移成功完成!")
    print(f"数据库文件: {db.DB_PATH}")
    print("=" * 50)


if __name__ == '__main__':
    migrate()
