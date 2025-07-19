const config = require('../config');
const { validateToken, formatSearchResults, splitLongMessage, createProgressMessage } = require('../utils');
const { checkPNFL } = require('../api/customs');
const { parseXMLForPNFL, downloadTelegramFile, downloadZipFile, extractPnflFromZip, cleanupTempFiles } = require('../utils/fileProcessor');
const axios = require('axios');
const AdmZip = require('adm-zip');

/**
 * Обработчик команды /check_pnfl
 */
async function handleCheckPnfl(bot, msg) {
  const chatId = msg.chat.id;
  
  // Сбрасываем состояние пользователя
  if (!global.userStates) global.userStates = new Map();
  global.userStates.set(chatId, { step: 'waiting_csrf', action: 'check_pnfl' });
  
  await bot.sendMessage(chatId, config.messages.checkPnfl.instructions);
}

/**
 * Обработчик текстовых сообщений для пошагового ввода
 */
async function handleTextMessage(bot, msg) {
  if (msg.document || msg.text?.startsWith('/')) return; // Пропускаем документы и команды
  
  const chatId = msg.chat.id;
  const userState = global.userStates?.get(chatId);
  
  if (!userState) return; // Пользователь не в процессе настройки
  
  if (userState.step === 'waiting_csrf') {
    // Ожидаем x-csrf-token
    const csrfToken = msg.text.trim();
    
    if (validateToken(csrfToken)) {
      userState.csrfToken = csrfToken;
      userState.step = 'waiting_session';
      global.userStates.set(chatId, userState);
      
      await bot.sendMessage(chatId, config.messages.checkPnfl.csrfReceived);
    } else {
      await bot.sendMessage(chatId, config.messages.checkPnfl.invalidCsrf);
    }
    
  } else if (userState.step === 'waiting_session') {
    // Ожидаем SESSION
    const session = msg.text.trim();
    
    if (validateToken(session)) {
      // Сохраняем полные данные сессии
      if (!global.userSessions) global.userSessions = new Map();
      
      const sessionData = {
        csrfToken: userState.csrfToken,
        session: session
      };
      
      global.userSessions.set(chatId, sessionData);
      global.userStates.delete(chatId); // Очищаем состояние
      
      await bot.sendMessage(chatId, config.messages.checkPnfl.sessionReceived);
      
      // Если это было вызвано кнопкой "Проверить ошибки", сразу начинаем проверку
      if (userState.action === 'check_errors') {
        await startPnflCheck(bot, chatId, sessionData);
      }
      // Если это была команда /check_pnfl, просто сохраняем сессию для будущего использования
    } else {
      await bot.sendMessage(chatId, config.messages.checkPnfl.invalidSession);
    }
  }
}

/**
 * Обработчик команды /find
 */
async function handleFind(bot, msg, match) {
  const chatId = msg.chat.id;
  const searchQuery = match[1];

  if (!config.bot.allowedChatIds.includes(msg.chat.id.toString())) {
    return;
  }

  try {
    // Отправляем запрос к нашему Python API
    const response = await axios.get(
      `${config.api.search.baseUrl}/search?q=${encodeURIComponent(searchQuery)}`
    );
    const results = response.data.results;

    if (!results || results.length === 0) {
      bot.sendMessage(chatId, config.messages.errors.noResults);
      return;
    }

    // Форматируем результаты поиска
    const formattedResults = formatSearchResults(results);
    bot.sendMessage(chatId, formattedResults, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Search error:", error);
    bot.sendMessage(chatId, config.messages.errors.search);
  }
}

/**
 * Обработчик XML документов для проверки PNFL
 */
async function handleXmlDocument(bot, msg) {
  const chatId = msg.chat.id;
  
  // Проверяем, есть ли сессионные данные для пользователя
  if (!global.userSessions?.has(chatId)) {
    await bot.sendMessage(chatId, config.messages.checkPnfl.noSession);
    return;
  }
  
  try {
    // Скачиваем XML файл
    const xmlContent = await downloadTelegramFile(msg.document.file_id, config.bot.token);
    
    // Парсим XML и извлекаем PNFL
    const declarations = await parseXMLForPNFL(xmlContent);
    
    if (declarations.length === 0) {
      await bot.sendMessage(chatId, config.messages.fileProcessing.noXmlDeclarations);
      return;
    }
    
    await bot.sendMessage(chatId, 
      `${config.messages.fileProcessing.foundDeclarations.replace('{count}', declarations.length)}`
    );
    
    const sessionData = global.userSessions.get(chatId);
    const errors = [];
    const startTime = Date.now();
    let processedCount = 0;
    
    // Создаем начальное сообщение о прогрессе
    const progressMessage = await bot.sendMessage(chatId, createProgressMessage(0, declarations.length, startTime));
    let progressMessageId = progressMessage.message_id;
    
    // Проверяем PNFL пачками
    for (let i = 0; i < declarations.length; i += config.processing.batchSize) {
      const batch = declarations.slice(i, i + config.processing.batchSize);
      
      const promises = batch.map(({ pnfl, ident_num }) => {
        return checkPNFL(pnfl, sessionData).then(result => {
          processedCount++;
          
          if (result.result !== 1) {
            errors.push({
              ident_num,
              pnfl,
              error: result.error || 'Неуспешная проверка'
            });
          }
          return result;
        });
      });
      
      await Promise.all(promises);
      
      // Обновляем сообщение о прогрессе
      try {
        const updatedProgressMessage = createProgressMessage(processedCount, declarations.length, startTime);
        await bot.editMessageText(updatedProgressMessage, {
          chat_id: chatId,
          message_id: progressMessageId
        });
      } catch (editError) {
        // Если не удалось обновить сообщение, отправляем новое
        console.log('Не удалось обновить сообщение о прогрессе, отправляем новое');
        const newProgressMessage = await bot.sendMessage(chatId, createProgressMessage(processedCount, declarations.length, startTime));
        // Обновляем ID сообщения для следующих обновлений
        progressMessageId = newProgressMessage.message_id;
      }
      
      // Небольшая задержка между пачками
      await new Promise(resolve => setTimeout(resolve, config.processing.delayBetweenBatches));
    }
    
    // Отправляем результат
    if (errors.length === 0) {
      await bot.sendMessage(chatId, config.messages.fileProcessing.allSuccess);
    } else {
      let errorMessage = `${config.messages.fileProcessing.errorsFound.replace('{count}', errors.length)}:\n\n`;
      
      for (const error of errors) {
        errorMessage += `🔸 ${error.ident_num}\n`;
        errorMessage += `   PNFL: ${error.pnfl}\n`;
        errorMessage += `   Ошибка: ${error.error}\n\n`;
      }
      
      // Разбиваем длинные сообщения
      const messageChunks = splitLongMessage(errorMessage);
      for (const chunk of messageChunks) {
        await bot.sendMessage(chatId, chunk);
      }
    }
    
  } catch (error) {
    console.error('Ошибка обработки XML:', error);
    await bot.sendMessage(chatId, 
      `${config.messages.errors.xmlProcessing} ${error.message}`
    );
  }
}

/**
 * Функция для запуска проверки PNFL из загруженного архива
 */
async function startPnflCheck(bot, chatId, sessionData) {
  try {
    await bot.sendMessage(chatId, config.messages.fileProcessing.processingZip);
    
    const zipFilePath = await downloadZipFile(global.currentDocument.file_id, config.bot.token, `${global.currentDocument.file_id}.zip`);

    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    // Извлекаем PNFL из Excel файлов
    const allPNFLs = extractPnflFromZip(zipEntries);

    if (allPNFLs.length === 0) {
      await bot.sendMessage(chatId, config.messages.fileProcessing.noExcelPnfl);
      await cleanupTempFiles(zipFilePath);
      return;
    }

    await bot.sendMessage(chatId, `${config.messages.fileProcessing.foundPnfl.replace('{count}', allPNFLs.length)}`);

    const errors = [];
    const startTime = Date.now();
    let processedCount = 0;
    
    // Создаем начальное сообщение о прогрессе
    const progressMessage = await bot.sendMessage(chatId, createProgressMessage(0, allPNFLs.length, startTime));
    let progressMessageId = progressMessage.message_id;

    // Проверяем PNFL пачками
    for (let i = 0; i < allPNFLs.length; i += config.processing.batchSize) {
      const batch = allPNFLs.slice(i, i + config.processing.batchSize);
      
      const promises = batch.map(({ pnfl, ident_num, fileName }) => {
        return checkPNFL(pnfl, sessionData).then(result => {
          processedCount++;
          
          if (result.result !== 1) {
            errors.push({
              ident_num,
              fileName,
              pnfl,
              error: result.error || 'Неуспешная проверка'
            });
          }
          return result;
        });
      });
      
      await Promise.all(promises);
      
      // Обновляем сообщение о прогрессе
      try {
        const updatedProgressMessage = createProgressMessage(processedCount, allPNFLs.length, startTime);
        await bot.editMessageText(updatedProgressMessage, {
          chat_id: chatId,
          message_id: progressMessageId
        });
      } catch (editError) {
        // Если не удалось обновить сообщение, отправляем новое
        console.log('Не удалось обновить сообщение о прогрессе, отправляем новое');
        const newProgressMessage = await bot.sendMessage(chatId, createProgressMessage(processedCount, allPNFLs.length, startTime));
        // Обновляем ID сообщения для следующих обновлений
        progressMessageId = newProgressMessage.message_id;
      }
      
      // Небольшая задержка между пачками
      await new Promise(resolve => setTimeout(resolve, config.processing.delayBetweenBatches));
    }

    // Отправляем результат
    if (errors.length === 0) {
      await bot.sendMessage(chatId, config.messages.fileProcessing.allSuccess);
    } else {
      let errorMessage = `${config.messages.fileProcessing.errorsFound.replace('{count}', errors.length)}:\n\n`;
      
      for (const error of errors) {
        errorMessage += `🔸 ${error.ident_num}\n`;
      }
      
      // Разбиваем длинные сообщения
      const messageChunks = splitLongMessage(errorMessage);
      for (const chunk of messageChunks) {
        await bot.sendMessage(chatId, chunk);
      }
    }

    await cleanupTempFiles(zipFilePath);
  } catch (error) {
    console.error(error);
    bot.sendMessage(
      chatId,
      `${config.messages.errors.pnflCheck} ${error.message}`
    );
  }
}

module.exports = {
  handleCheckPnfl,
  handleTextMessage,
  handleFind,
  handleXmlDocument,
  startPnflCheck
}; 