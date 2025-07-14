require('dotenv').config();

const config = {
    botToken: process.env.botToken,
    allowedChatIds: ["-4044680201", "-644679029", "101965789"],
    chatIdNames: {
        "-4044680201": "Тестовый",
        "-644679029": "Америка",
    },
    searchApiUrl: 'http://localhost:5000/search',
    templateFiles: {
        main: './newtamplate.xlsx',
        secondary: './newtamplate_some.xlsx'
    }
};

module.exports = config;
