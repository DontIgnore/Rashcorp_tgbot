const https = require("https");
const axios = require("axios");
const config = require('../config');
const { logToFile } = require('../utils/logger');

/**
 * Проверка PNFL через API datedocv4
 */
async function checkPNFL(pnfl, sessionData) {
  try {
    const response = await axios({
      method: 'POST',
      url: `${config.api.customs.baseUrl}${config.api.customs.endpoints.datedocv4}`,
      headers: {
        'accept': '*/*',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-csrf-token': sessionData.csrfToken,
        'x-requested-with': 'XMLHttpRequest',
        'cookie': `SESSION=${sessionData.session}`,
        'referer': config.api.customs.baseUrl
      },
      data: `document=${pnfl}`,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    
    console.log(`Проверка PNFL ${pnfl}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Ошибка проверки PNFL ${pnfl}:`, error.message);
    return { result: 0, error: error.message };
  }
}

/**
 * Выполнение запроса datedocv4
 */
async function fetchPassportDataV4(pnfl, sessionId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.api.customs.timeout);

  try {
    await logToFile(`[datedocv4] Отправка запроса для ПНФЛ: ${pnfl}`);
    await logToFile(
      `[datedocv4] Используемая сессия: ${sessionId.substring(0, 20)}...`
    );

    const response = await axios({
      method: "POST",
      url: `${config.api.customs.baseUrl}${config.api.customs.endpoints.datedocv4}`,
      headers: {
        accept: "*/*",
        "accept-language": "ru-RU,ru;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        Cookie: sessionId,
      },
      data: `document=${pnfl}`,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    clearTimeout(timeoutId);
    await logToFile(`[datedocv4] Получен ответ с кодом: ${response.status}`);
    await logToFile(
      `[datedocv4] Тело ответа: ${JSON.stringify(response.data)}`
    );
    return response.data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.response) {
      await logToFile(
        `[datedocv4] Ошибка с кодом ${error.response.status}: ${JSON.stringify(
          error.response.data
        )}`,
        "error"
      );
    } else {
      await logToFile(`[datedocv4] Ошибка запроса: ${error.message}`, "error");
    }
    throw error;
  }
}

/**
 * Выполнение запроса datedocv2
 */
async function fetchPassportDataV2(birthDate, documentNum, sessionId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.api.customs.timeout);

  try {
    await logToFile(
      `[datedocv2] Отправка запроса: birthDate=${birthDate}, documentNum=${documentNum}`
    );
    await logToFile(
      `[datedocv2] Используемая сессия: ${sessionId.substring(0, 20)}...`
    );

    const response = await axios({
      method: "POST",
      url: `${config.api.customs.baseUrl}${config.api.customs.endpoints.datedocv2}`,
      headers: {
        accept: "*/*",
        "accept-language": "ru-RU,ru;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        Cookie: sessionId,
      },
      data: `birthDate=${birthDate}&document=${documentNum}&langId=2`,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    clearTimeout(timeoutId);
    await logToFile(`[datedocv2] Получен ответ с кодом: ${response.status}`);
    await logToFile(
      `[datedocv2] Тело ответа: ${JSON.stringify(response.data)}`
    );
    return response.data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.response) {
      await logToFile(
        `[datedocv2] Ошибка с кодом ${error.response.status}: ${JSON.stringify(
          error.response.data
        )}`,
        "error"
      );
    } else {
      await logToFile(`[datedocv2] Ошибка запроса: ${error.message}`, "error");
    }
    throw error;
  }
}

module.exports = {
  checkPNFL,
  fetchPassportDataV4,
  fetchPassportDataV2
}; 