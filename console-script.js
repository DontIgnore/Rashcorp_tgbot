// Скрипт для консоли браузера - получение только x-csrf-token
(function() {
    console.log("🤖 Скрипт для извлечения x-csrf-token запущен...");
    
    let csrfToken = null;
    
    // Перехватываем fetch запросы
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const result = originalFetch.apply(this, args);
        
        // Проверяем заголовки запроса
        if (args[1] && args[1].headers) {
            const headers = args[1].headers;
            if (headers['x-csrf-token']) {
                csrfToken = headers['x-csrf-token'];
                console.log("✅ x-csrf-token найден:", csrfToken);
                console.log("\n🎯 СКОПИРУЙТЕ ЭТОТ ТОКЕН В БОТА:");
                console.log(csrfToken);
            }
        }
        
        return result;
    };
    
    // Перехватываем XMLHttpRequest
    const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        if (header.toLowerCase() === 'x-csrf-token') {
            csrfToken = value;
            console.log("✅ x-csrf-token найден:", csrfToken);
            console.log("\n🎯 СКОПИРУЙТЕ ЭТОТ ТОКЕН В БОТА:");
            console.log(csrfToken);
        }
        return originalXHRSetRequestHeader.call(this, header, value);
    };
    
    // Функция для получения текущего токена
    function getToken() {
        if (csrfToken) {
            console.log("\n🎯 ТЕКУЩИЙ x-csrf-token:");
            console.log(csrfToken);
        } else {
            console.log("\n⚠️  x-csrf-token не найден. Выполните любой запрос на сайте.");
        }
    }
    
    // Добавляем функцию в глобальную область
    window.getToken = getToken;
    
    console.log("\n💡 Инструкции:");
    console.log("1. Выполните любой запрос на сайте (отправьте форму, нажмите кнопку)");
    console.log("2. Скопируйте x-csrf-token из консоли");
    console.log("3. Для повторного получения токена введите: getToken()");
    console.log("\n📋 Также вам нужно скопировать SESSION из Application → Cookies");
})();
