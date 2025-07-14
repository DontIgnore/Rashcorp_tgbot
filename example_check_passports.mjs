import fetch from 'node-fetch';
import fs from 'fs/promises';
import xml2js from 'xml2js';
import https from 'https';
import playwright from 'playwright';
import robot from 'robotjs';

let sessionId = "";

// Функция для логирования
async function logMessage(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
  
  // Выводим в консоль
  console.log(logEntry);
  
  // Записываем в файл
  try {
    await fs.appendFile('log.txt', logEntry);
  } catch (error) {
    console.error('Ошибка при записи в лог файл:', error);
  }
}

function enterPassword(password) {
  // Подождите, пока окно E-IMZO появится
  setTimeout(() => {
    // Переместите курсор в нужное место (вам нужно будет определить координаты)
    const screenSize = robot.getScreenSize();
    robot.moveMouse(screenSize.width / 2, screenSize.height / 2 - 10);

    // Кликните, чтобы активировать поле ввода
    robot.mouseClick();

    // Введите пароль
    robot.typeString(password);

    // Нажмите Enter для подтверждения
    robot.keyTap("enter");
  }, 1000); // Подождите 5 секунд перед выполнением (настройте по необходимости)
}

// Функция для запуска браузера чтобы получить JSESSIONID из cookies
async function getJsessionid(maxRetries = 3) {
  let browser;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await logMessage(`Попытка ${attempt} получения JSESSIONID`);
      browser = await playwright.chromium.launch( {
        headless: false
      });
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await logMessage('Браузер запущен успешно');
      
      // Устанавливаем таймаут для навигации
      page.setDefaultNavigationTimeout(30000);
      page.setDefaultTimeout(30000);

      await logMessage('Переход на страницу авторизации...');
      await page.goto('https://cargo.customs.uz/user/auth/auth-signin');
      
      await logMessage('Ожидание элемента #kirishToken...');
      await page.waitForSelector('#kirishToken', { state: 'visible' });
      await page.click('#kirishToken');
      
      await logMessage('Ожидание загрузки DOM...');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      await logMessage('Нажатие на кнопку входа...');
      const signButton = await page.waitForSelector('#signButton', { state: 'visible' });
      await signButton.click();
      
      await page.waitForTimeout(1000);
      await logMessage('Ввод пароля...');
      await enterPassword('95366262');

      await logMessage('Ожидание главной страницы...');
      await page.waitForSelector('#MainContent > div.main-welcome-page', {
        timeout: 30000
      });

      const cookies = await context.cookies();
      const jsessionid = cookies.find(cookie => cookie.name === 'JSESSIONID')?.value;
      
      if (!jsessionid) {
        throw new Error('JSESSIONID не найден в cookies');
      }

      sessionId = `JSESSIONID=${jsessionid}`;
      await logMessage(`JSESSIONID успешно получен: ${jsessionid.substring(0, 5)}...`);
      return;
    } catch (error) {
      await logMessage(`Ошибка при получении JSESSIONID: ${error.message}`, 'error');
      
      if (attempt === maxRetries) {
        throw new Error(`Не удалось получить JSESSIONID после ${maxRetries} попыток: ${error.message}`);
      }
      
      await logMessage(`Ожидание ${attempt * 2} секунд перед следующей попыткой...`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    } finally {
      if (browser) {
        await browser.close();
        await logMessage('Браузер закрыт');
      }
    }
  }
}

// Создаем агент с отключенной проверкой сертификата
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Функция для чтения и парсинга XML файла
async function readXmlFile(filePath) {
  const data = await fs.readFile(filePath, 'utf-8');
  return new Promise((resolve, reject) => {
    xml2js.parseString(data, { explicitArray: false }, (err, result) => {
      if (err) reject(err);
      else resolve(result.main_data.Declaration);
    });
  });
}

// Функция для выполнения запроса с повторными попытками
async function fetchWithRetry(pnfl, maxRetries = 3, timeout = 30000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await logMessage(`Запрос данных для ПНФЛ ${pnfl} (попытка ${attempt}/${maxRetries})`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch("https://cargo.customs.uz/personDate/datedocv4", {
        method: "POST",
        headers: {
          "accept": "*/*",
          "accept-language": "ru-RU,ru;q=0.9",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest",
          "Cookie": sessionId
        },
        body: `document=${pnfl}`,
        credentials: "include",
        agent: agent,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      await logMessage(`Получен ответ с кодом: ${response.status}`);

      if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      const data = JSON.parse(text);
      await logMessage(`Данные успешно получены для ПНФЛ ${pnfl}`);
      return data;
    } catch (error) {
      await logMessage(`Ошибка при запросе ПНФЛ ${pnfl}: ${error.message}`, 'error');
      if (attempt === maxRetries) {
        throw error;
      }
      await logMessage(`Ожидание ${attempt} секунд перед следующей попыткой...`);
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

// Функция для создания 4-х значногогода из двух последний цифр
function buildYear(pnfl) {
  if (/\d{2}\.\d{2}\.\d{4}/.test(pnfl)) {
    return pnfl;
  }

  if (pnfl.length !== 14) {
    console.log(declID, "Ошибка ПНФЛ");
    return "00000000";
  }

  const day = pnfl.substr(1, 2);
  const month = pnfl.substr(3, 2);
  const year = pnfl.substr(5, 2);

  const currentYear = new Date().getFullYear();
  const prefix = currentYear - (currentYear % 100) + parseInt(year, 10) > currentYear ? "19" : "20";
  const fullYear = prefix + year;

  return `${fullYear}-${month}-${day}`;
}

// Функция для обработки и формирования строки с нужными данными
async function processDeclaration(decl) {
  const pnfl = decl.pnfl;
  const original_pass_ser = decl.pass_ser;
  const original_pass_num = decl.pass_num;
  let birth_date;

  if (pnfl.length === 14) {
    birth_date = buildYear(pnfl); 
  }
  
  await logMessage(`Начало обработки ПНФЛ: ${pnfl}`);

  try {
    let data = await fetchWithRetry(pnfl);
    await logMessage(`Результат первого запроса для ПНФЛ ${pnfl}:`, 'info');
    await logMessage(JSON.stringify(data, null, 2), 'info');
    
    if (data.result === 4) {
      await logMessage(`Ошибка: данные для ПНФЛ ${pnfl} неверные, выполняется дополнительный запрос.`);
      let birthDateFormatted = "";
      if (pnfl.length === 14) {
        birthDateFormatted = buildYear(pnfl);
      } else {
        birthDateFormatted = decl.birth_date;
      }
      const documentNum = decl.pass_ser + decl.pass_num;
      await logMessage(`Отправляемые данные: birthDate=${birthDateFormatted}&document=${documentNum}&langId=2`);
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 30000);
      const response2 = await fetch("https://cargo.customs.uz/personDate/datedocv2", {
        method: "POST",
        headers: {
          "accept": "*/*",
          "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "priority": "u=1, i",
          "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
          "Cookie": sessionId
        },
        body: `birthDate=${birthDateFormatted}&document=${documentNum}&langId=2`,
        credentials: "include",
        agent: agent,
        signal: controller2.signal
      });
      clearTimeout(timeoutId2);
      const text2 = await response2.text();
      const alternativeData = JSON.parse(text2);
      await logMessage(`Альтернативный запрос выполнен для ПНФЛ ${pnfl} со статусом: ${response2.status}`);
      await logMessage(`Результат второго запроса для ПНФЛ ${pnfl}:`, 'info');
      await logMessage(JSON.stringify(alternativeData, null, 2), 'info');
      data = alternativeData;
    }
    if (data.current_document === null) {
      await logMessage(`Предупреждение: Данные для ПНФЛ ${pnfl} отсутствуют или некорректны`, 'warn');
      var pass_ser = decl.pass_ser;
      var pass_num = decl.pass_num;
    } else {
      await logMessage(`Успешно получены данные для ПНФЛ ${pnfl}`);
      var [pass_ser, pass_num] = data.current_document.split(/(\d+)/);
      var extracted_pnfl = data.pinpps;
    }
    const result = {
      ident_num: decl.ident_num,
      pass_ser: pass_ser.trim(),
      pass_num: pass_num.trim(),
      pnfl: extracted_pnfl,
      result: `${decl.ident_num}|${data.surnamelat} ${data.namelat} ${data.patronymlat}|${data.birth_date}|${data.current_document}`,
    };
    await logMessage(`Обработка ПНФЛ ${pnfl} завершена успешно`);
    return result;
  } catch (error) {
    await logMessage(`Ошибка при обработке ${pnfl}: ${error.message}`, 'error');
    return { error: `${decl.ident_num}|Ошибка обработки: ${error.message}` };
  }
}

// Функция для обработки и формирования строки с нужными данными в асинхронном режиме
async function processBatch(declarations, batchSize) {
  const results = [];
  for (let i = 0; i < declarations.length; i += batchSize) {
    const batch = declarations.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processDeclaration));
    results.push(...batchResults);
    await logMessage(`Обработано ${i + batch.length} из ${declarations.length}`);
  }
  return results;
}

async function updateXmlFile(updatedDeclarations) {
  const xmlFilePath = './sheets/cn22-cn23.xml';
  const xmlContent = await fs.readFile(xmlFilePath, 'utf-8');

  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlContent);

  // Обновляем все декларации за один проход
  for (const { ident_num, pass_ser, pass_num, pnfl } of updatedDeclarations) {
    const declaration = result.main_data.Declaration.find(d => d.ident_num[0] === ident_num);
    if (declaration) {
      declaration.pass_ser[0] = pass_ser;
      declaration.pass_num[0] = pass_num;
      declaration.pnfl[0] = pnfl;
    } else {
      await logMessage(`Декларация с ident_num ${ident_num} не найдена в XML файле`, 'warn');
    }
  }

  // Преобразуем обратно в XML
  const builder = new xml2js.Builder();
  const updatedXml = builder.buildObject(result);

  // Записываем обновленный XML обратно в файл
  await fs.writeFile(xmlFilePath, updatedXml);
}

// Основная функция
async function main() {
  try {
    await logMessage('Начало выполнения программы');
    await getJsessionid();
    
    await logMessage('Чтение XML файла...');
    const declarations = await readXmlFile('./sheets/cn22-cn23.xml');
    await logMessage(`Загружено ${declarations.length} деклараций`);
    
    const batchSize = 5;
    console.time('Время выполнения');
    await logMessage(`Начало обработки деклараций пачками по ${batchSize} штук`);
    
    const results = await processBatch(declarations, batchSize);
    console.timeEnd('Время выполнения');
    
    const successfulResults = results.filter(r => !r.error);
    const errorResults = results.filter(r => r.error);
    
    await logMessage(`Обработка завершена. Успешно: ${successfulResults.length}, Ошибок: ${errorResults.length}`);

    // Обновляем XML-файл один раз
    await logMessage('Обновление XML файла...');
    await updateXmlFile(successfulResults);

    // Записываем результаты в файл
    const outputResults = [...successfulResults.map(r => r.result), ...errorResults.map(r => r.error)];
    await logMessage('Сохранение результатов в файл...');
    await fs.writeFile('results.txt', outputResults.join('\n'));

    await logMessage('Программа успешно завершена');
  } catch (error) {
    await logMessage(`Критическая ошибка: ${error.message}`, 'error');
    console.error('Произошла ошибка:', error);
  }
}

main();