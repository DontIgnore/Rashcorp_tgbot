const { searchPerson, formatSearchResults } = require('../services/searchService');
const config = require('../config/config');

async function handleSearch(bot, msg, match) {
    const chatId = msg.chat.id;
    const searchQuery = match[1];

    if (!config.allowedChatIds.includes(chatId.toString())) {
        return;
    }

    try {
        const results = await searchPerson(searchQuery);
        const formattedResults = formatSearchResults(results);
        
        await bot.sendMessage(chatId, formattedResults, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Search error:', error);
        await bot.sendMessage(
            chatId,
            'Произошла ошибка при поиске. Пожалуйста, попробуйте позже.'
        );
    }
}

module.exports = {
    handleSearch
};
