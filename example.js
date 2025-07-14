const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Путь к папке с XML файлами
const folderPath = './db';

// Функция для капитализации строк
const capitalise = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

// Функция для обработки одного XML файла
const processXmlFile = (filePath, peopleDeclarations, allDeclarations) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);

      xml2js.parseString(data, (err, result) => {
        if (err) reject(err);

        const declarations = result.main_data.Declaration;

        declarations.forEach(declaration => {
          const pnfl = declaration.pnfl[0];
          const totalCost = parseFloat(declaration.total_cost[0]);
          const weight = parseFloat(declaration.brutto[0].replace('$', '').trim());
          const identNum = declaration.ident_num[0];
          const passport = declaration.pass_ser[0] + declaration.pass_num[0];

          const declarationInfo = {
            id: identNum,
            date: declaration.ident_data[0],
            cost: totalCost,
            weight: weight,
            person: {
              first_name: capitalise(declaration.first_name[0]).trim(),
              last_name: capitalise(declaration.last_name[0]).trim(),
            },
            passport: passport,
          };

          // Проверяем на дубликат
          if (!allDeclarations[identNum]) {
            allDeclarations[identNum] = 0;
          }
          allDeclarations[identNum]++;

          if (!peopleDeclarations[pnfl]) {
            peopleDeclarations[pnfl] = {
              totalCost: 0,
              declarations: []
            };
          }

          peopleDeclarations[pnfl].declarations.push(declarationInfo);
        });

        resolve();
      });
    });
  });
};

// Функция для обработки всех XML файлов в папке
const processAllXmlFiles = async (folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    let peopleDeclarations = {};
    let allDeclarations = {};

    for (const file of files) {
      if (path.extname(file) === '.xml') {
        const filePath = path.join(folderPath, file);
        await processXmlFile(filePath, peopleDeclarations, allDeclarations);
      }
    }

    // Фильтруем и записываем результаты в текстовый файл
    let outputLines = [];

    // Выявляем и записываем дубликаты
    const duplicates = Object.keys(allDeclarations).filter(id => allDeclarations[id] > 1);
    if (duplicates.length > 0) {
      outputLines.push('Дубликаты деклараций:');
      duplicates.forEach(id => {
        outputLines.push(`- ${id} повторяется ${allDeclarations[id]} раз`);
      });
      outputLines.push(''); // Пустая строка для разделения
    }

    Object.keys(peopleDeclarations).forEach(pnfl => {
      const personData = peopleDeclarations[pnfl];
      const uniqueDeclarations = personData.declarations.filter(declaration => allDeclarations[declaration.id] === 1);

      // Сортируем уникальные декларации по дате (новые сначала)
      uniqueDeclarations.sort((a, b) => new Date(b.date) - new Date(a.date));

      const totalCost = uniqueDeclarations.reduce((acc, declaration) => acc + declaration.cost, 0);
      if (totalCost > 1000) {
        outputLines.push(`${pnfl}: ${totalCost.toFixed(1)}$`);
        uniqueDeclarations.forEach(declaration => {
          outputLines.push(`- ${declaration.id} | ${declaration.passport} | ${declaration.person.first_name} ${declaration.person.last_name} | ${declaration.date} | ${declaration.cost.toFixed(1)}$ | ${declaration.weight.toFixed(1)}kg`);
        });
      }
    });

    fs.writeFileSync('output.txt', outputLines.join('\n'));
    console.log('Результаты записаны в output.txt');
  } catch (err) {
    console.error('Ошибка при обработке файлов:', err);
  }
};

processAllXmlFiles(folderPath);
