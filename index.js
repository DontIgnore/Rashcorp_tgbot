const https = require("https");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

// Импорт конфигурации
const config = require('./config');

// Импорт модулей
const { handleCheckPnfl, handleTextMessage, handleFind, handleXmlDocument } = require('./handlers/commandHandlers');
const { handleStartProcessing, handleCheckWeight, handleCheckErrors, handleCancel } = require('./handlers/callbackHandlers');

// Инициализация Express сервера
const app = express();
const port = config.server.port;
app.get("/", (_, res) => res.send(config.messages.welcome));
app.listen(port, () => console.log(`${config.messages.serverStarted} ${port}`));

// Инициализация бота
const bot = new TelegramBot(config.bot.token, { polling: true });
console.log(config.messages.botStarted);

// Глобальные переменные для хранения состояния
global.currentChatId = null;
global.currentDocument = null;
global.documentMessage = null;
global.userSessions = new Map();
global.userStates = new Map();
global.collectedErrors = [];
global.collectedDeclarations = [];

bot.onText(/\/find (.+)/, async (msg, match) => {
  await handleFind(bot, msg, match);
});

// Обработчик текстовых сообщений
bot.on('message', async (msg) => {
  if (msg.document || msg.text?.startsWith('/')) return;
  await handleTextMessage(bot, msg);
});

// Обработчик документов
bot.on("document", async (msg) => {
  // Проверка авторизации
  if (!config.bot.allowedChatIds.includes(msg.chat.id.toString())) {
    return;
  }

  // Проверка типа чата
  if (
    msg.chat.type !== "group" &&
    msg.chat.type !== "supergroup" &&
    msg.chat.id != "101965789"
  ) {
    bot.sendMessage(msg.chat.id, config.messages.fileProcessing.personalNotSupported);
    return;
  }

  // Обработка XML файлов
  if (msg.document && msg.document.file_name.endsWith(".xml")) {
    await handleXmlDocument(bot, msg);
    return;
  }

  // Обработка ZIP файлов
  if (msg.document && msg.document.file_name.endsWith(".zip")) {
    global.currentChatId = msg.chat.id;
    global.currentDocument = msg.document;
    global.documentMessage = msg;

    // Отправка сообщения с кнопками
    let options;
    if (msg.chat.id == "-4044680201") {
      options = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Начать обработку", callback_data: "start_processing" },
              { text: "Проверить вес", callback_data: "check_weight" },
              { text: "Отмена", callback_data: "cancel_processing" },
            ],
            [{ text: "Проверить ошибки", callback_data: "check_errors" }],
          ],
        },
      };
    } else {
      options = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Начать обработку", callback_data: "start_processing" },
              { text: "Проверить вес", callback_data: "check_weight" },
              { text: "Отмена", callback_data: "cancel_processing" },
            ]
          ],
        },
      };
    }
    await bot.sendMessage(
      global.currentChatId,
      config.messages.fileProcessing.documentReceived,
      options
    );
  }
});

// Обработчик callback запросов
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  switch (query.data) {
    case "start_processing":
      await handleStartProcessing(bot, query);
      break;
    case "check_weight":
      await handleCheckWeight(bot, query);
      break;
    case "check_errors":
      await handleCheckErrors(bot, query);
      break;
    case "cancel_processing":
      await handleCancel(bot, query);
      break;
    default:
      console.log(`Неизвестный callback: ${query.data}`);
  }
});

// Обработка ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

module.exports = { bot, app }; 