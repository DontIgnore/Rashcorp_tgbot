require("dotenv").config();

module.exports = {
  // Настройки сервера
  server: {
    port: process.env.PORT || 3000
  },

  // Настройки бота
  bot: {
    token: process.env.BOT_TOKEN || process.env.botToken,
    allowedChatIds: ["-4044680201", "-644679029", "101965789"],
    chatIdNames: {
      "-4044680201": "Тестовый",
      "-644679029": "Америка",
    },
    secondaryChatId: "-4044680201" // ID чата для отправки дополнительных файлов
  },

  // API настройки
  api: {
    customs: {
      baseUrl: "https://cargo.customs.uz",
      endpoints: {
        datedocv4: "/personDate/datedocv4",
        datedocv2: "/personDate/datedocv2"
      },
      timeout: 30000
    },
    search: {
      baseUrl: "http://localhost:5000"
    }
  },

  // Настройки файлов
  files: {
    templates: {
      main: "./newtamplate.xlsx",
      some: "./newtamplate_some.xlsx"
    },
    tempDir: "./tmp",
    consoleScript: "./console-script.js"
  },

  // Настройки обработки
  processing: {
    batchSize: 10,
    progressUpdateInterval: 2000,
    delayBetweenBatches: 1000
  },

  // Сообщения бота
  messages: {
    welcome: "Bot is running",
    serverStarted: "Web server listening on",
    botStarted: "Bot started",
    
    // Команды
    checkPnfl: {
      instructions: `📋 Для проверки PNFL выполните следующие шаги:

1. Откройте https://cargo.customs.uz в браузере
2. Войдите в систему через E-IMZO
3. Откройте консоль браузера (F12 → Console)
4. Вставьте и выполните скрипт (отправлю следующим сообщением)
5. Выполните любой запрос на сайте
6. Скопируйте x-csrf-token из консоли и отправьте мне`,
      
      csrfReceived: `✅ x-csrf-token получен!

Теперь скопируйте SESSION из браузера:
1. Откройте DevTools (F12)
2. Перейдите в Application → Cookies
3. Найдите cookie с именем 'SESSION'
4. Скопируйте его значение и отправьте мне`,
      
      sessionReceived: `✅ Данные сессии получены!

Начинаю проверку PNFL из загруженного архива...`,
      
      invalidCsrf: "❌ Неверный формат x-csrf-token. Попробуйте еще раз.",
      invalidSession: "❌ Неверный формат SESSION. Попробуйте еще раз.",
      noSession: "❌ Сначала выполните команду /check_pnfl и предоставьте данные сессии."
    },

    // Обработка файлов
    fileProcessing: {
      documentReceived: "Документ получен. Нажмите кнопку для начала обработки.",
      pleaseWait: "Пожалуйста, подождите...",
      startingAnalysis: "Starting analysis...",
      noXmlDeclarations: "❌ В XML файле не найдено деклараций с PNFL.",
      noExcelPnfl: "❌ В Excel файлах не найдено PNFL для проверки.",
      processingZip: "🔍 Начинаю проверку PNFL из загруженного архива...",
      foundExcelFiles: "📊 Найдено Excel файлов:",
      foundDeclarations: "📋 Найдено деклараций. Начинаю проверку PNFL...",
      foundPnfl: "📋 Найдено PNFL для проверки. Начинаю проверку...",
      checkingBatch: "🔍 Проверяю",
      allSuccess: "✅ Все PNFL прошли проверку успешно!",
      errorsFound: "❌ Найдено ошибок:",
      zipOnly: "Пожалуйста, отправьте ZIP-архив с декларациями.",
      personalNotSupported: "Личные сообщения не поддерживаются",
      notAuthorized: "Вы не можете использовать этот бот"
    },

    // Ошибки
    errors: {
      xmlProcessing: "❌ Ошибка обработки XML файла:",
      zipProcessing: "An error occurred while processing your zip file.",
      pnflCheck: "Произошла ошибка при проверке PNFL:",
      search: "Произошла ошибка при поиске. Пожалуйста, попробуйте позже.",
      noResults: "По вашему запросу ничего не найдено.",
      messageUpdate: "❌ Произошла ошибка при обновлении сообщения. Пожалуйста, проверьте логи."
    },

    // Прогресс
    progress: {
      processing: "Прогресс обработки:",
      processed: "✅ Обработано:",
      remaining: "⏳ Осталось:",
      inProcess: "⏳ В процессе:",
      batchComplete: "пачек обработано",
      allFilesSuccess: "✅ Все файлы успешно проверены",
      totalProcessed: "📑 Всего обработано:"
    },

    // Вес
    weight: {
      totalWeight: "Общий вес всех посылок:",
      weightCheck: "Произошла ошибка при обработке ZIP файла."
    }
  },

  // Валидация
  validation: {
    minTokenLength: 10,
    pnflLength: 14,
    maxMessageLength: 4000,
    maxProgressMessageLength: 4096
  }
}; 