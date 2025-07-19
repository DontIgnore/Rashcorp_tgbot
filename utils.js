const config = require('./config');

/**
 * Получение текущей даты в формате DD.MM.YYYY
 */
function getCurrentDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Извлечение даты рождения из PNFL
 */
function extractDateOfBirth(pnfl) {
  if (pnfl !== undefined) {
    const day = pnfl.substr(1, 2);
    const month = pnfl.substr(3, 2);
    const year = pnfl.substr(5, 2);

    const currentYear = new Date().getFullYear();
    const prefix =
      currentYear - (currentYear % 100) + parseInt(year, 10) > currentYear
        ? "19"
        : "20";
    const fullYear = prefix + year;

    return `${fullYear}-${month}-${day}`;
  }
}

/**
 * Проверка корректности даты рождения
 */
function checkBirthdate(birthdate) {
  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

  if (!dateRegex.test(birthdate)) {
    return false;
  }

  const [year, month, day] = birthdate.split("-");
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() != parseInt(year) ||
    parsedDate.getMonth() + 1 != parseInt(month) ||
    parsedDate.getDate() != parseInt(day)
  ) {
    return false;
  }

  return true;
}

/**
 * Построение строки ошибок
 */
const buildErrorsString = (errors) => {
  let errorString = "";

  for (const error of errors) {
    errorString += `${error.declaration}: ${error.error}\n`;
  }

  if (errorString.length >= config.validation.maxProgressMessageLength) {
    errorString = errorString.substring(0, config.validation.maxProgressMessageLength);
  }

  return errorString.length > 0 ? errorString : "Ошибок не обнаружено";
};

/**
 * Поиск дублированных деклараций
 */
const findDuplicatedDeclaration = (declarations) => {
  const duplicates = declarations.reduce((acc, { declID, sheet }) => {
    acc[declID] ? acc[declID].push(sheet) : (acc[declID] = [sheet]);
    return acc;
  }, {});

  const duplicatesWithMultipleSheets = Object.entries(duplicates).filter(
    ([, sheets]) => sheets.length > 1
  );
  if (duplicatesWithMultipleSheets.length === 0) return;

  return duplicatesWithMultipleSheets
    .map(([declID, sheets]) => `${declID}: ${sheets.join(", ")}\n`)
    .join("");
};

/**
 * Разбиение длинного сообщения на части
 */
function splitLongMessage(message, maxLength = config.validation.maxMessageLength) {
  if (message.length <= maxLength) {
    return [message];
  }
  
  return message.match(new RegExp(`[\\s\\S]{1,${maxLength}}`, 'g')) || [message];
}

/**
 * Создание throttled функции
 */
function throttle(func, limit) {
  let inThrottle;
  let lastResult;
  return function (...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
    return lastResult;
  };
}

/**
 * Форматирование результатов поиска
 */
function formatSearchResults(results) {
  return results
    .map((person) => {
      return (
        `👤 *${person.name_cyr}*\n` +
        `📝 Паспорт: \`${person.passport}\`\n` +
        `🔢 ПИНФЛ: \`${person.pnfl}\`\n` +
        `👥 ФИО (лат.): ${person.name_lat}\n` +
        `⚧ Пол: ${person.sex === "M" ? "Мужской" : "Женский"}\n`
      );
    })
    .join("\n");
}

/**
 * Валидация токенов
 */
function validateToken(token) {
  return token && token.trim().length > config.validation.minTokenLength;
}

/**
 * Валидация PNFL
 */
function validatePnfl(pnfl) {
  if (!pnfl) return false;
  const cleanPnfl = pnfl.replace(/\D/g, "").trim().replaceAll(" ", "");
  return cleanPnfl.length === config.validation.pnflLength;
}

/**
 * Очистка и форматирование строки
 */
function cleanString(str) {
  if (!str) return "";
  return str.trim().replace(/ +(?= )/g, "");
}

/**
 * Извлечение числового значения из строки
 */
function extractNumber(str) {
  if (!str) return 0;
  return +str
    .replace(/[^\d.,]/g, "")
    .trim()
    .replaceAll(" ", "")
    .replace(",", ".");
}

/**
 * Создание прогресс-бара
 */
function createProgressBar(percentage, width = 20) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  const filledBar = '█'.repeat(filled);
  const emptyBar = '░'.repeat(empty);
  
  return `${filledBar}${emptyBar}`;
}

/**
 * Форматирование времени
 */
function formatTime(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}с`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}м ${remainingSeconds}с`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${hours}ч ${minutes}м ${remainingSeconds}с`;
  }
}

/**
 * Расчет оставшегося времени
 */
function calculateRemainingTime(startTime, processed, total, averageTimePerItem) {
  const elapsed = (Date.now() - startTime) / 1000;
  const remaining = total - processed;
  
  if (processed === 0) {
    return averageTimePerItem * total;
  }
  
  const averageTimePerProcessed = elapsed / processed;
  return averageTimePerProcessed * remaining;
}

/**
 * Создание сообщения о прогрессе
 */
function createProgressMessage(processed, total, startTime, averageTimePerItem = 2) {
  const percentage = Math.round((processed / total) * 100);
  const progressBar = createProgressBar(percentage);
  const remaining = total - processed;
  
  // Расчет оставшегося времени
  const remainingTime = calculateRemainingTime(startTime, processed, total, averageTimePerItem);
  const formattedTime = formatTime(remainingTime);
  
  // Расчет прошедшего времени
  const elapsed = (Date.now() - startTime) / 1000;
  const formattedElapsed = formatTime(elapsed);
  
  return `🔍 Проверка PNFL в процессе...

📊 Прогресс: ${processed}/${total} (${percentage}%)
${progressBar}

⏱️ Прошло времени: ${formattedElapsed}
⏳ Осталось времени: ~${formattedTime}
📦 Осталось PNFL: ${remaining}`;
}

module.exports = {
  getCurrentDate,
  extractDateOfBirth,
  checkBirthdate,
  buildErrorsString,
  findDuplicatedDeclaration,
  splitLongMessage,
  throttle,
  formatSearchResults,
  validateToken,
  validatePnfl,
  cleanString,
  extractNumber,
  createProgressBar,
  formatTime,
  calculateRemainingTime,
  createProgressMessage
}; 