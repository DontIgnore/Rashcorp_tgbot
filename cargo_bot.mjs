// cargo_bot.mjs
// Скрипт для автоматизации работы с сайтом cargo.customs.uz с использованием Playwright (JS).
// При запуске бот открывает браузер с persistent context (сохраняет сессию), заходит на сайт,
// совершает клик по указанному селектору для эмуляции активности, и, если сессия истекает,
// автоматически выполняет перелогин. Также сохраняется cookie JSESSIONID для использования в работе бота.

import { chromium } from 'playwright';
import fs from 'fs';
import robot from 'robotjs';

// Параметры
const BASE_URL = 'https://cargo.customs.uz';
const USER_DATA_DIR = 'user_data'; // Папка для хранения данных сессии
const ACTIVITY_SELECTOR = '#mainDiv > nav > div > div > ul > li.nav-item.pcoded-hasmenu.lili.mb-4 > a';
const SESSION_EXPIRED_TEXT = 'Тизимга хуш келибсиз!';
const JSSESSION_FILE = 'jsession.txt';

// Обновленная функция для логина, аналогичная example_check_passports.mjs
async function login(page) {
  console.log('Выполняется логин...');
  await page.goto('https://cargo.customs.uz/user/auth/auth-signin', { waitUntil: 'networkidle' });
  console.log('Ожидание элемента #kirishToken...');
  await page.waitForSelector('#kirishToken', { state: 'visible' });
  await page.click('#kirishToken');
  console.log('Ожидание загрузки DOM...');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  console.log('Нажатие на кнопку входа...');
  const signButton = await page.waitForSelector('#signButton', { state: 'visible' });
  await signButton.click();
  await page.waitForTimeout(1000);
  console.log('Ввод пароля...');
  await enterPassword('95366262');
  console.log('Ожидание главной страницы...');
  await page.waitForSelector('#MainContent > div.main-welcome-page', { timeout: 30000 });
  await saveJsession(page.context());
}

// Новая функция enterPassword
function enterPassword(password) {
  setTimeout(() => {
    const screenSize = robot.getScreenSize();
    robot.moveMouse(screenSize.width / 2, screenSize.height / 2 - 10);
    robot.mouseClick();
    robot.typeString(password);
    robot.keyTap('enter');
  }, 1000);
}

// Функция для сохранения cookie JSESSIONID
async function saveJsession(context) {
  const cookies = await context.cookies();
  const jsessionCookie = cookies.find(cookie => cookie.name === 'JSESSIONID');
  if (jsessionCookie) {
    fs.writeFileSync(JSSESSION_FILE, jsessionCookie.value, 'utf8');
    console.log('JSESSIONID сохранен:', jsessionCookie.value);
  } else {
    console.log('JSESSIONID не найден в куках.');
  }
}

// Функция для получения сохраненного JSESSIONID
function getSavedJsession() {
  if (fs.existsSync(JSSESSION_FILE)) {
    return fs.readFileSync(JSSESSION_FILE, 'utf8');
  }
  return null;
}

// Функция для проверки активности сессии
async function isSessionActive(page) {
  // Проверяем наличие текста, свидетельствующего о том, что сессия просрочена
  const content = await page.content();
  if (content.includes(SESSION_EXPIRED_TEXT)) {
    console.log('Обнаружено сообщение о завершении сессии.');
    return false;
  }
  // Проверяем наличие элемента, по которому нужно кликать
  const element = await page.$(ACTIVITY_SELECTOR);
  if (!element) {
    console.log('Не найден селектор активности, сессия может быть завершена.');
    return false;
  }
  return true;
}

// Функция для поддержания активности сессии
async function maintainSession(page, context) {
  let savedJsession = getSavedJsession();
  while (true) {
    try {
      // Ждем 60 секунд между действиями
      await page.waitForTimeout(60000);

      // Эмулируем активность: кликаем по заданному селектору
      console.log('Выполняется клик для активности...');
      await page.click(ACTIVITY_SELECTOR, { timeout: 30000 });
      await page.waitForTimeout(2000); // небольшая задержка

      // Обновляем страницу
      await page.reload({ waitUntil: 'networkidle' });

      // Проверяем активность сессии
      const active = await isSessionActive(page);
      if (!active) {
        console.log('Сессия неактивна. Перелогиниваемся...');
        await login(page);
        // Обновляем сохраненный JSESSIONID
        savedJsession = getSavedJsession();
      } else {
        // Проверяем, не изменился ли JSESSIONID
        const cookies = await context.cookies();
        const currentJsessionCookie = cookies.find(cookie => cookie.name === 'JSESSIONID');
        if (currentJsessionCookie && currentJsessionCookie.value !== savedJsession) {
          console.log('JSESSIONID изменился. Перелогиниваемся для актуализации сессии...');
          await login(page);
          savedJsession = getSavedJsession();
        } else {
          console.log('Сессия активна, изменений нет.');
        }
      }
    } catch (err) {
      console.error('Ошибка в поддержании сессии:', err);
      console.log('Пробуем перелогиниться...');
      await login(page);
      savedJsession = getSavedJsession();
    }
  }
}

// Основная функция
(async () => {
  // Запускаем браузер с persistent context для хранения данных сессии
  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true, // не показываем браузер
    // Дополнительные опции, если необходимо
  });

  const pages = browser.pages();
  const page = pages.length ? pages[0] : await browser.newPage();

  // Переходим на страницу и выполняем логин, если необходимо
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    // Если нет нужного элемента или присутствует сообщение о выходе, выполняем логин
    if (!(await isSessionActive(page))) {
      await login(page);
    } else {
      console.log('Сессия уже активна, пропускаем логин.');
    }
  } catch (err) {
    console.error('Ошибка при загрузке страницы:', err);
    await login(page);
  }

  // Начинаем поддерживать активность сессии
  console.log('Запуск цикла поддержания активности сессии...');
  await maintainSession(page, browser);

  // Никогда не дойдем сюда, так как maintainSession является бесконечным циклом.
})();
