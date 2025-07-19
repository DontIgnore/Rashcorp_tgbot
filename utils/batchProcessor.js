const config = require('../config');
const { throttle, splitLongMessage } = require('../utils');
const { logToFile } = require('./logger');
const { fetchPassportDataV4, fetchPassportDataV2 } = require('../api/customs');
const { extractDateOfBirth } = require('../utils');
const xlsx = require("xlsx");

/**
 * Безопасное обновление сообщения
 */
const safeUpdateMessage = async (bot, text, messageId, chatId) => {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (error) {
    // Если не удалось обновить сообщение, отправляем новое
    await bot.sendMessage(chatId, text);
    await logToFile(
      "Не удалось обновить сообщение, отправлено новое",
      "warning"
    );
  }
};

/**
 * Пакетная обработка файлов
 */
async function processBatchFiles(files, sessionId, chatId, bot, batchSize = config.processing.batchSize) {
  let processedFiles = 0;
  const totalFiles = files.length;
  const allResults = [];

  // Создаем начальное сообщение с прогрессом
  const progressMessage = `${config.messages.progress.processing}\n${config.messages.progress.processed} 0/${totalFiles} (0%)\n${config.messages.progress.inProcess} ${totalFiles} файлов`;
  const msgResponse = await bot.sendMessage(chatId, progressMessage);
  const messageId = msgResponse.message_id;

  // Создаем throttled версию функции обновления прогресса
  const throttledUpdate = throttle(async (currentProcessed) => {
    const percentage = Math.round((currentProcessed / totalFiles) * 100);
    const remaining = totalFiles - currentProcessed;
    const message = `${config.messages.progress.processing}\n${config.messages.progress.processed} ${currentProcessed}/${totalFiles} (${percentage}%)\n${config.messages.progress.remaining} ${remaining} файлов`;
    await safeUpdateMessage(bot, message, messageId, chatId);
  }, config.processing.progressUpdateInterval);

  // Обновленная функция для обновления прогресса
  const updateProgress = async (currentProcessed) => {
    await throttledUpdate(currentProcessed);
  };

  // Обрабатываем файлы пачками
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await logToFile(
      `Обработка пачки ${Math.floor(i / batchSize) + 1}, файлов в пачке: ${batch.length}`
    );

    const batchPromises = batch.map(async (file) => {
      let currentPnfl = null;
      let currentPassport = null;

      try {
        const content = file.content;
        const workbook = xlsx.read(content, { type: "buffer" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        currentPassport = worksheet["E11"] ? worksheet["E11"].v : null;
        currentPnfl = worksheet["E12"] ? worksheet["E12"].w : null;

        await logToFile(`Обработка файла: ${file.name}, ПНФЛ: ${currentPnfl}`);

        if (!currentPnfl) {
          await logToFile(
            `Пропуск файла ${file.name}: не найден ПНФЛ`,
            "warning"
          );
          processedFiles++;
          await updateProgress(processedFiles);
          return {
            fileName: file.name,
            status: "error",
            message: `❌ ПНФЛ не указан в файле\n📄 Файл: ${file.name}`,
          };
        }

        // Пробуем первый запрос (datedocv4)
        const passportData = await fetchPassportDataV4(currentPnfl, sessionId);
        await logToFile(
          `Результат datedocv4 для файла ${file.name}: ${passportData?.result}`
        );

        // Если первый запрос успешен
        if (passportData && passportData.result === 1) {
          processedFiles++;
          await updateProgress(processedFiles);
          return {
            fileName: file.name,
            status: "success",
          };
        }

        // Если первый запрос неуспешен, пробуем второй (datedocv2)
        await logToFile(`Пробуем datedocv2 для файла ${file.name}`);
        const birthDate = extractDateOfBirth(currentPnfl);
        const documentNum = currentPassport || "";
        const additionalData = await fetchPassportDataV2(
          birthDate,
          documentNum,
          sessionId
        );
        await logToFile(
          `Результат datedocv2 для файла ${file.name}: ${additionalData?.result}`
        );

        // Если второй запрос успешен
        if (additionalData && additionalData.result === 1) {
          processedFiles++;
          await updateProgress(processedFiles);
          return {
            fileName: file.name,
            status: "success",
          };
        }

        // Если оба запроса неуспешны
        processedFiles++;
        await updateProgress(processedFiles);
        return {
          fileName: file.name,
          status: "error",
          message: `📄 Файл: ${file.name}\n⚠️ Ошибки:\n- ${passportData?.queryld || "Неизвестная ошибка"}\n- ${additionalData?.queryld || "Неизвестная ошибка"}`,
        };
      } catch (error) {
        await logToFile(
          `Ошибка при обработке файла ${file.name}: ${error.message}`,
          "error"
        );
        processedFiles++;
        await updateProgress(processedFiles);
        return {
          fileName: file.name,
          status: "error",
          message: `📄 Файл: ${file.name}\n${currentPnfl}\n⚠️ Ошибка: ${error.message}`,
        };
      }
    });

    // Ждем завершения текущей пачки
    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    await logToFile(`Пачка ${Math.floor(i / batchSize) + 1} обработана`);
  }

  // Обновляем сообщение о завершении и отправляем результаты
  try {
    // Фильтруем только ошибки
    const errorResults = allResults.filter(
      (result) => result.status === "error"
    );

    if (errorResults.length > 0) {
      let message = "❌ Найдены ошибки при проверке:\n\n";

      // Добавляем только ошибки
      for (const result of errorResults) {
        message += `${result.message}\n\n`;
      }

      await safeUpdateMessage(bot, message, messageId, chatId);
    } else {
      // Если ошибок нет, отправляем краткое сообщение об успехе
      await safeUpdateMessage(
        bot,
        `${config.messages.progress.allFilesSuccess}\n${config.messages.progress.totalProcessed} ${allResults.length} файлов`,
        messageId,
        chatId
      );
    }
  } catch (error) {
    await logToFile(
      `Ошибка при обновлении финального сообщения: ${error.message}`,
      "error"
    );
    // Пробуем отправить новое сообщение в случае ошибки
    try {
      await bot.sendMessage(
        chatId,
        config.messages.errors.messageUpdate
      );
    } catch (sendError) {
      await logToFile(
        `Не удалось отправить сообщение об ошибке: ${sendError.message}`,
        "error"
      );
    }
  }

  return allResults;
}

module.exports = {
  processBatchFiles,
  safeUpdateMessage
}; 