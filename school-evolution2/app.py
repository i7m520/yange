# -*- coding: utf-8 -*-
from flask import Flask, render_template, request, jsonify
import database as db

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/graph')
def api_graph():
    year = request.args.get('year', 2025, type=int)
    return jsonify(db.get_graph_data(year))


@app.route('/api/detail')
def api_detail():
    name = request.args.get('name', '')
    year = request.args.get('year', 2025, type=int)
    if not name:
        return jsonify({'error': '缺少name参数'}), 400
    return jsonify(db.get_node_detail(name, year))


@app.route('/api/years')
def api_years():
    return jsonify(db.get_year_range())


@app.route('/api/search')
def api_search():
    keyword = request.args.get('keyword', '')
    if not keyword:
        return jsonify([])
    return jsonify(db.search(keyword))


@app.route('/api/assistant', methods=['POST'])
def api_assistant():
    data = request.get_json(silent=True) or {}
    period = data.get('period')
    department = data.get('department')
    return jsonify(db.get_assistant_data(period, department))


@app.route('/api/schools')
def api_schools():
    return jsonify(db.get_school_history())


@app.route('/api/colleges')
def api_colleges():
    return jsonify(db.get_all_colleges())


@app.route('/api/majors')
def api_majors():
    return jsonify(db.get_all_majors())


# ========== 数据管理API ==========

@app.route('/api/admin/record', methods=['POST'])
def add_record():
    """添加专业记录"""
    data = request.get_json(silent=True) or {}
    required = ['name', 'year', 'school_name', 'department']
    
    for field in required:
        if field not in data:
            return jsonify({'success': False, 'message': f'缺少必填字段: {field}'}), 400
    
    result = db.add_major_record(data)
    return jsonify(result)


@app.route('/api/admin/record/<int:record_id>', methods=['PUT'])
def update_record(record_id):
    """更新专业记录"""
    data = request.get_json(silent=True) or {}
    result = db.update_major_record(record_id, data)
    return jsonify(result)


@app.route('/api/admin/record/<int:record_id>', methods=['DELETE'])
def delete_record(record_id):
    """删除专业记录"""
    result = db.delete_major_record(record_id)
    return jsonify(result)


@app.route('/api/admin/batch', methods=['POST'])
def batch_import():
    """批量导入数据"""
    data = request.get_json(silent=True) or {}
    records = data.get('records', [])
    
    if not records:
        return jsonify({'success': False, 'message': '没有数据需要导入'}), 400
    
    success_count = 0
    fail_count = 0
    
    for record in records:
        result = db.add_major_record(record)
        if result.get('success'):
            success_count += 1
        else:
            fail_count += 1
    
    return jsonify({
        'success': True,
        'message': f'成功导入 {success_count} 条，失败 {fail_count} 条',
        'success_count': success_count,
        'fail_count': fail_count
    })


if __name__ == '__main__':
    # 初始化数据库
    print("正在初始化数据库...")
    db.init_db()
    print("数据库初始化完成！")
    app.run(debug=False, host='0.0.0.0', port=5000)
