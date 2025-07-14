import json
from datetime import datetime

def remove_duplicates(input_file, output_file):
    # Загружаем данные
    print("Загрузка данных...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Загружено {len(data)} записей")
    
    # Создаем словарь для хранения уникальных записей по ПИНФЛ
    unique_records = {}
    duplicates_count = 0
    
    print("Поиск дубликатов...")
    for record in data:
        pnfl = record.get('pnfl')
        if not pnfl:  # Пропускаем записи без ПИНФЛ
            continue
            
        if pnfl in unique_records:
            duplicates_count += 1
        else:
            unique_records[pnfl] = record
    
    # Преобразуем словарь обратно в список
    unique_data = list(unique_records.values())
    
    # Сохраняем результат
    print("Сохранение результатов...")
    
    # Создаем резервную копию оригинального файла
    backup_file = input_file.replace('.json', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Сохраняем очищенные данные
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(unique_data, f, ensure_ascii=False, indent=2)
    
    print(f"\nРезультаты:")
    print(f"Исходное количество записей: {len(data)}")
    print(f"Количество дубликатов: {duplicates_count}")
    print(f"Количество уникальных записей: {len(unique_data)}")
    print(f"Создана резервная копия: {backup_file}")
    print(f"Очищенные данные сохранены в: {output_file}")

if __name__ == "__main__":
    input_file = "full_data.json"
    output_file = "full_data_unique.json"
    remove_duplicates(input_file, output_file)
