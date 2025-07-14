const axios = require('axios');
const config = require('../config/config');

async function searchPerson(query) {
    try {
        const response = await axios.get(
            `${config.searchApiUrl}?q=${encodeURIComponent(query)}`
        );
        return response.data.results;
    } catch (error) {
        console.error("Search error:", error);
        throw error;
    }
}

function formatSearchResults(results) {
    if (!results || results.length === 0) {
        return "По вашему запросу ничего не найдено.";
    }

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

module.exports = {
    searchPerson,
    formatSearchResults
};
