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
