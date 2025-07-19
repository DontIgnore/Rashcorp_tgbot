const fs = require("fs-extra");

/**
 * Логирование сообщений в файл и консоль
 */
async function logToFile(message, type = "info") {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;

  // Выводим в консоль
  console.log(logEntry);

  // Записываем в файл
  try {
    await fs.promises.appendFile("bot_log.txt", logEntry);
  } catch (error) {
    console.error("Ошибка при записи в лог файл:", error);
  }
}

module.exports = {
  logToFile
}; 