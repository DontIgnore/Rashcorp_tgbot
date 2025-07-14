from flask import Flask, request, jsonify
from search_module import SearchEngine
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Инициализируем поисковой движок
search_engine = SearchEngine('full_data_unique.json')

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    results = search_engine.search(query)
    return jsonify({'results': results if results else []})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
