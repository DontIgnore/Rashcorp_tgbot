const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/config');
const { handleDocument, processDocument } = require('./handlers/documentHandler');
const { handleSearch } = require('./handlers/searchHandler');

// Глобальные переменные для хранения состояния
let currentChatId;
let currentDocument;
let documentMessage;
let collectedErrors = [];
let collectedDeclarations = [];

// Инициализация бота
const bot = new TelegramBot(config.botToken, { polling: true });
console.log('Bot started');

// Обработка документов
bot.on('document', async (msg) => {
    const result = await handleDocument(bot, msg);
    if (result) {
        currentChatId = result.currentChatId;
        currentDocument = result.currentDocument;
        documentMessage = result.documentMessage;
    }
});

// Обработка команды поиска
bot.onText(/\/find (.+)/, async (msg, match) => {
    await handleSearch(bot, msg, match);
});

// Обработка нажатий кнопок
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (query.data === 'start_processing') {
        bot.deleteMessage(chatId, messageId);
        
        if (currentDocument?.mime_type === 'application/zip') {
            const result = await processDocument(bot, chatId, currentDocument, documentMessage);
            
            if (!result.success) {
                await bot.sendMessage(chatId, result.message);
            }
        } else {
            await bot.sendMessage(chatId, 'Пожалуйста, отправьте ZIP-архив с декларациями.');
        }
    }

    if (query.data === 'cancel_processing') {
        bot.deleteMessage(chatId, messageId);
    }

    if (query.data === 'check_weight') {
        // Здесь должна быть логика проверки веса
        // Добавьте её в соответствии с вашими требованиями
    }
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});
