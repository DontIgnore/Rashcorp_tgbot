import json
from whoosh.index import create_in, open_dir
from whoosh.fields import *
from whoosh.qparser import QueryParser, OrGroup
from difflib import SequenceMatcher
import os

class SearchEngine:
    def __init__(self, json_file_path):
        self.json_file_path = json_file_path
        self.index_dir = "search_index"
        self.data = self._load_data()  # Загружаем данные в память для нечёткого поиска
        
        # Определяем схему индекса
        self.schema = Schema(
            passport=ID(stored=True),
            pnfl=ID(stored=True),
            name=TEXT(stored=True),
            name_lat=TEXT(stored=True),
            name_cyr=TEXT(stored=True),
            sex=ID(stored=True),
            content=TEXT
        )
        
        # Создаем или открываем индекс
        if not os.path.exists(self.index_dir):
            os.mkdir(self.index_dir)
            self.create_index()
        else:
            self.ix = open_dir(self.index_dir)
    
    def _load_data(self):
        with open(self.json_file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def create_index(self):
        self.ix = create_in(self.index_dir, self.schema)
        writer = self.ix.writer()
        
        for item in self.data:
            # Создаем общий контент для поиска
            content = f"{item.get('passport', '')} {item.get('pnfl', '')} {item.get('name', '')} {item.get('name_lat', '')} {item.get('name_cyr', '')}"
            
            writer.add_document(
                passport=item.get('passport', ''),
                pnfl=item.get('pnfl', ''),
                name=item.get('name', ''),
                name_lat=item.get('name_lat', ''),
                name_cyr=item.get('name_cyr', ''),
                sex=item.get('sex', ''),
                content=content
            )
        writer.commit()

    def similarity_ratio(self, a, b):
        """Вычисляет схожесть двух строк"""
        return SequenceMatcher(None, a.lower(), b.lower()).ratio()
    
    def fuzzy_search(self, query):
        """Выполняет нечёткий поиск по всем полям"""
        results = []
        
        # Проверяем каждую запись в данных
        for item in self.data:
            max_score = 0
            # Проверяем совпадение со всеми полями
            fields_to_check = [
                item.get('passport', ''),
                item.get('pnfl', ''),
                item.get('name', ''),
                item.get('name_lat', ''),
                item.get('name_cyr', '')
            ]
            
            # Находим лучшее совпадение среди всех полей
            for field in fields_to_check:
                if not field:
                    continue
                
                # Для паспорта и ПИНФЛ используем более строгое сравнение
                if len(query) >= 5 and (len(field) == len(query) or abs(len(field) - len(query)) <= 2):
                    score = self.similarity_ratio(query, field)
                else:
                    # Для имен проверяем каждое слово отдельно
                    query_words = query.split()
                    field_words = field.split()
                    word_scores = []
                    
                    for q_word in query_words:
                        best_word_score = max(
                            (self.similarity_ratio(q_word, f_word) for f_word in field_words),
                            default=0
                        )
                        word_scores.append(best_word_score)
                    
                    score = sum(word_scores) / len(word_scores) if word_scores else 0
                
                max_score = max(max_score, score)
            
            # Если score достаточно высокий, добавляем результат
            if max_score >= 0.75:  # Порог схожести 75%
                results.append((item, max_score))
        
        # Сортируем результаты по score и берём топ 5
        results.sort(key=lambda x: x[1], reverse=True)
        return [item for item, score in results[:5]]
    
    def search(self, query_text):
        """Комбинированный поиск: сначала точный, затем нечёткий"""
        # Сначала пробуем точный поиск через Whoosh
        with self.ix.searcher() as searcher:
            parser = QueryParser("content", self.ix.schema, group=OrGroup)
            query = parser.parse(query_text)
            results = searcher.search(query, limit=5)
            
            if len(results) > 0:
                return [
                    {
                        'passport': r['passport'],
                        'pnfl': r['pnfl'],
                        'name': r['name'],
                        'name_lat': r['name_lat'],
                        'name_cyr': r['name_cyr'],
                        'sex': r['sex']
                    }
                    for r in results
                ]
        
        # Если точный поиск не дал результатов, используем нечёткий поиск
        fuzzy_results = self.fuzzy_search(query_text)
        if fuzzy_results:
            return fuzzy_results
            
        return None
