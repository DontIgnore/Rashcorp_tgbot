const config = require('../config');
const { getCurrentDate, buildErrorsString, findDuplicatedDeclaration, splitLongMessage } = require('../utils');
const { logToFile } = require('../utils/logger');
const { 
  downloadZipFile, 
  extractZipFile, 
  getExcelFiles, 
  readExcelFile,
  extractPnflFromZip,
  cleanupTempFiles 
} = require('../utils/fileProcessor');
const { 
  transformAndValidateDeclarationObject, 
  validateDeclarationItems,
  initializeErrorCollection,
  clearCollectedErrors,
  getCollectedErrors,
  getCollectedDeclarations
} = require('../validators/declarationValidator');
const { checkPNFL } = require('../api/customs');
const ExcelJS = require("exceljs");
const xlsx = require("xlsx");
const AdmZip = require("adm-zip");

/**
 * Обработчик кнопки "Начать обработку"
 */
async function handleStartProcessing(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  bot.deleteMessage(chatId, messageId);
  
  // Проверка типа документов
  if (global.currentDocument?.mime_type === "application/zip") {
    // Начинаем обработку
    try {
      console.log(config.messages.fileProcessing.startingAnalysis);
      
      // Инициализируем сбор ошибок
      initializeErrorCollection();
      clearCollectedErrors();

      let waitMsg = bot.sendMessage(chatId, config.messages.fileProcessing.pleaseWait, {
        reply_to_message_id: global.documentMessage,
      });

      let workbookEJS = new ExcelJS.Workbook();
      workbookEJS = await workbookEJS.xlsx.readFile(config.files.templates.main);
      let worksheetEJS = workbookEJS.getWorksheet(1);

      let workbookEJS1 = new ExcelJS.Workbook();
      workbookEJS1 = await workbookEJS1.xlsx.readFile(config.files.templates.some);
      let worksheetEJS1 = workbookEJS1.getWorksheet(1);

      let declarations = [];

      let zipFilePath;
      let extractFolderPath;

      try {
        // Скачиваем ZIP файл
        zipFilePath = await downloadZipFile(global.currentDocument.file_id, config.bot.token, global.currentDocument.file_name);

        // Распаковываем ZIP файл
        const extractResult = await extractZipFile(zipFilePath, global.currentDocument.file_id);
        extractFolderPath = extractResult.extractFolderPath;

        // Получаем Excel файлы
        const sheets = getExcelFiles(extractFolderPath);

        await Promise.all(
          sheets.map(async (sheet) => {
            try {
              const worksheet = readExcelFile(`${extractFolderPath}/${sheet}`);

              for (const declaration of worksheet) {
                let offset = transformAndValidateDeclarationObject(
                  {
                    declID: declaration["A1"],
                    region: declaration["E8"],
                    district: declaration["E7"],
                    totalPrice: declaration["N10"],
                    totalWeight: declaration["N11"],
                    lastName: declaration["E4"],
                    firstName: declaration["E5"],
                    passport: declaration["E11"],
                    pnfl: declaration["E12"],
                    address:
                      declaration["E6"]?.w +
                      " " +
                      declaration["E7"]?.w +
                      " " +
                      declaration["E8"]?.w,
                    phone: declaration["E10"],
                    senderName: declaration["B4"],
                    senderSurname: declaration["B5"],
                    senderAddress:
                      declaration["B6"]?.w +
                      " " +
                      declaration["B7"]?.w +
                      " " +
                      declaration["B8"]?.w + 
                      "\n" +
                      declaration["B9"]?.w,
                    senderPhone: declaration["B10"]?.w,
                  },
                  declaration,
                  sheet
                );

                offset.items = await validateDeclarationItems(
                  4,
                  23,
                  declaration,
                  sheet
                );

                const countryName = config.bot.chatIdNames[chatId];
                const dataForLimits = {
                  [offset.pnfl]: {
                    declID: offset.declID,
                    totalPrice: offset.totalPrice,
                    totalWeight: offset.totalWeight,
                    lastName: offset.lastName,
                    firstName: offset.firstName,
                    passport: offset.passport,
                    pnfl: offset.pnfl,
                    senderName: offset.senderName,
                    senderSurname: offset.senderSurname,
                    senderAddress: offset.senderAddress,
                    senderPhone: offset.senderPhone,
                  },
                };

                declarations.push(offset);
                global.collectedDeclarations.push({
                  declID: declaration["A1"].w,
                  sheet,
                });
              }
            } catch (error) {
              // Обрабатываем ошибки для отдельных файлов
              console.error(`Ошибка обработки файла ${sheet}:`, error);
            }
          })
        );

        // Заполняем Excel файлы
        await fillExcelFiles(declarations, worksheetEJS, worksheetEJS1, chatId);

        // Проверяем дубликаты
        const duplicates = findDuplicatedDeclaration(getCollectedDeclarations());
        if (duplicates) {
          bot.sendMessage(chatId, `Обнаружены дубликаты:\n${duplicates}`);
        }

        // Отправляем результаты
        await sendResults(bot, chatId, declarations, extractFolderPath, workbookEJS, workbookEJS1);

        // Отправляем ошибки
        bot.deleteMessage(chatId, (await waitMsg).message_id);
        bot.sendMessage(chatId, buildErrorsString(getCollectedErrors()));

      } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, config.messages.errors.zipProcessing);
      } finally {
        // Очищаем временные файлы
        await cleanupTempFiles(zipFilePath);
        await cleanupTempFiles(extractFolderPath);
      }
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, config.messages.errors.zipProcessing);
    }
  } else {
    bot.sendMessage(chatId, config.messages.fileProcessing.zipOnly);
  }
}

/**
 * Обработчик кнопки "Проверить вес"
 */
async function handleCheckWeight(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  bot.deleteMessage(chatId, messageId);

  try {
    const zipFilePath = await downloadZipFile(global.currentDocument.file_id, config.bot.token, `${global.currentDocument.file_id}.zip`);

    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    let totalWeight = 0;

    for (const entry of zipEntries) {
      if (entry.entryName.match(/\.(xls|xlsx)$/i)) {
        const content = zip.readFile(entry);
        const workbook = xlsx.read(content, { type: "buffer" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Получаем значение из ячейки N11
        const weightCell = worksheet["N11"];
        if (weightCell) {
          const weight = parseFloat(
            weightCell.v
              .toString()
              .replace(/[^\d.,]/g, "")
              .replace(",", ".")
          );
          if (!isNaN(weight)) {
            totalWeight += weight;
          }
        }
      }
    }

    await bot.sendMessage(
      chatId,
      `${config.messages.weight.totalWeight} ${totalWeight.toFixed(2)} кг`
    );

    // Очистка временных файлов
    await cleanupTempFiles(zipFilePath);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, config.messages.weight.weightCheck);
  }
}

/**
 * Обработчик кнопки "Проверить ошибки"
 */
async function handleCheckErrors(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  bot.deleteMessage(chatId, messageId);

  // Проверяем, есть ли загруженный архив
  if (!global.currentDocument) {
    await bot.sendMessage(chatId, "❌ Сначала отправьте ZIP архив с Excel файлами для проверки.");
    return;
  }

  // Всегда запрашиваем токен и сессию при нажатии кнопки
  if (!global.userStates) global.userStates = new Map();
  global.userStates.set(chatId, { step: 'waiting_csrf', action: 'check_errors' });
  
  await bot.sendMessage(chatId, config.messages.checkPnfl.instructions);
  
  // Отправляем скрипт для консоли
  const fs = require('fs-extra');
  const scriptContent = await fs.readFile(config.files.consoleScript, 'utf8');
  await bot.sendMessage(chatId, `\`\`\`javascript\n${scriptContent}\n\`\`\``, { parse_mode: 'Markdown' });
}

/**
 * Обработчик кнопки "Отмена"
 */
async function handleCancel(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  bot.deleteMessage(chatId, messageId);
}

/**
 * Заполнение Excel файлов данными
 */
async function fillExcelFiles(declarations, worksheetEJS, worksheetEJS1, chatId) {
  let lastIter = 0; // Объявляем lastIter вне цикла, как в оригинальном коде
  
  for (let i = 0; i < declarations.length; i++) {
    let row = worksheetEJS.getRow(i + 8);

    let itemsArray = [];
    declarations[i].items.forEach((item) => {
      itemsArray.push(`${item.itemName}: ${item.itemQuantity}`);
    });

    row.font = { size: "15", bold: false };
    row.commit();
    row.alignment = {
      vertical: "middle",
      horizontal: "center",
      shrinkToFit: true,
      wrapText: true,
    };
    row.commit();

    row.getCell(5).value = i + 1;
    row.getCell(6).value = declarations[i].declID;
    row.getCell(7).value =
      declarations[i].senderName +
      " " +
      declarations[i].senderSurname +
      "\n" +
      declarations[i].senderAddress;
    row.getCell(8).value =
      declarations[i].lastName +
      " " +
      declarations[i].firstName +
      "\n" +
      declarations[i].address +
      "\n" +
      declarations[i].pnfl;
    row.getCell(9).value = itemsArray.join("\n");
    row.getCell(10).value = declarations[i].totalWeight;
    row.getCell(11).value = declarations[i].totalPrice;
    row.getCell(12).value = "USD";
    row.commit();

    let row1 = worksheetEJS1.getRow(i + 4);
    row1.font = { size: "11", bold: false };
    row1.commit();
    row1.alignment = {
      vertical: "middle",
      horizontal: "center",
      shrinkToFit: true,
      wrapText: true,
    };
    row1.commit();

    row1.getCell(1).value = getCurrentDate();
    row1.getCell(2).value =
      declarations[i].lastName + " " + declarations[i].firstName;
    row1.getCell(3).value = declarations[i].phone;
    row1.getCell(4).value = declarations[i].address;
    row1.getCell(5).value = declarations[i].passport;
    row1.getCell(6).value = declarations[i].pnfl;
    row1.getCell(8).value =
      declarations[i].lastName + " " + declarations[i].firstName;
    row1.getCell(9).value = declarations[i].phone;
    row1.getCell(10).value = declarations[i].address;
    row1.getCell(11).value = declarations[i].passport;
    row1.getCell(12).value = declarations[i].pnfl;

    if (declarations.length - 1 == i) lastIter = i;
  }

  const row = worksheetEJS.getRow(lastIter + 9);

  row.getCell(9).font = { size: "18", bold: true };
  row.commit();
  row.getCell(9).alignment = {
    vertical: "middle",
    horizontal: "right",
  };
  row.commit();
  row.getCell(9).value = "Жами:";
  row.getCell(10).value = {
    formula: "SUM(J8:J" + (lastIter + 8) + ")",
  };
  row.getCell(11).value = {
    formula: "SUM(K8:K" + (lastIter + 8) + ")",
  };
  row.getCell(12).value = "USD";
  row.commit();

  worksheetEJS.mergeCells(`I${lastIter + 16}:L${lastIter + 16}`);
  worksheetEJS.mergeCells(`I${lastIter + 13}:L${lastIter + 13}`);

  worksheetEJS.getCell(`I${lastIter + 13}`).font = {
    size: "16",
    bold: true,
  };
  worksheetEJS.getCell(`I${lastIter + 13}`).alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  worksheetEJS.getCell(`I${lastIter + 16}`).font = {
    size: "16",
    bold: true,
  };
  worksheetEJS.getCell(`I${lastIter + 16}`).alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  worksheetEJS.getCell(`I${lastIter + 13}`).value =
    "Қабул қилувчи ташкилот номи, имзоси ва муҳри:";
  worksheetEJS.getCell(`I${lastIter + 16}`).value =
    "Жўнатувчи ташкилот номи, имзоси ва муҳри:";
}

/**
 * Отправка результатов обработки
 */
async function sendResults(bot, chatId, declarations, extractFolderPath, workbookEJS, workbookEJS1) {
  let fileName;
  const currentDate = getCurrentDate();

  if (config.bot.chatIdNames[chatId]) {
    fileName = `${config.bot.chatIdNames[chatId]} ${currentDate}.xlsx`;
  } else {
    fileName = `manifest_${currentDate}.xlsx`;
  }

  // Calculate total weight from all declarations
  const totalWeight = declarations.reduce(
    (sum, decl) => sum + parseFloat(decl.totalWeight || 0),
    0
  );

  // Get first and last package names
  const firstPackage = declarations[0]?.declID;
  const lastPackage = declarations[declarations.length - 1]?.declID;

  // Calculate total items count
  const totalItems = declarations.length;

  await workbookEJS.xlsx.writeFile(`${extractFolderPath}/${fileName}`);
  console.log("Excel file created successfully");
  
  const fs = require("fs-extra");
  try {
    await bot.sendDocument(
      chatId,
      fs.createReadStream(`${extractFolderPath}/${fileName}`),
      {
        caption: `${firstPackage} - ${lastPackage}\nОбщий вес: ${totalWeight.toFixed(
          2
        )} кг\nКоличество посылок: ${totalItems}`,
      }
    );
    console.log("Main Excel file sent successfully");
  } catch (error) {
    console.error("Error sending main Excel file:", error.message);
    // Отправляем текстовое сообщение с результатами, если не удалось отправить файл
    await bot.sendMessage(chatId, 
      `Обработка завершена!\n` +
      `Файлы: ${firstPackage} - ${lastPackage}\n` +
      `Общий вес: ${totalWeight.toFixed(2)} кг\n` +
      `Количество посылок: ${totalItems}\n\n` +
      `Ошибка отправки файла: ${error.message}`
    );
  }

  try {
    await workbookEJS1.xlsx.writeFile(`${extractFolderPath}/1${fileName}`);
    console.log("Secondary Excel file created successfully");
  } catch (error) {
    console.error("Error creating secondary Excel file:", error.message);
  }
  
  // Попытка отправить во второй чат (опционально)
  if (config.bot.secondaryChatId) {
    try {
      await bot.sendDocument(
        config.bot.secondaryChatId,
        fs.createReadStream(`${extractFolderPath}/1${fileName}`)
      );
      console.log("Excel file sent to secondary chat successfully");
    } catch (error) {
      console.log("Could not send to secondary chat:", error.message);
      // Продолжаем выполнение, даже если не удалось отправить во второй чат
    }
  }
  
  console.log("Excel file sent successfully");
  await cleanupTempFiles(extractFolderPath);
}

module.exports = {
  handleStartProcessing,
  handleCheckWeight,
  handleCheckErrors,
  handleCancel
}; 