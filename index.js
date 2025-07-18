const https = require("https");
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(port, () => console.log(`Web server listening on ${port}`));



const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs-extra");
const AdmZip = require("adm-zip");
const xlsx = require("xlsx");
const ExcelJS = require("exceljs");
// const database = require("./database.js");
require("dotenv").config();

// '-644679029',
let allowedChatIds = ["-4044680201", "-644679029", "101965789"];
let chatIdNames = {
  "-4044680201": "Тестовый",
  "-644679029": "Америка",
};

const botToken = process.env.BOT_TOKEN || process.env.botToken;

let collectedErrors = [];
let collectedDeclarations = [];

let currentChatId; // Переменная для хранения ID чата
let currentDocument; // Переменная для хранения документов
let documentMessage;

const bot = new TelegramBot(botToken, { polling: true });
console.log("Bot started");
setInterval(() => {
  console.log("сервер работает");
}, 30000);

const collectErrors = (error, sheet) => {
  collectedErrors.push({ error: error, declaration: sheet });
};

const findDuplicatedDeclaration = (declarations) => {
  const duplicates = declarations.reduce((acc, { declID, sheet }) => {
    acc[declID] ? acc[declID].push(sheet) : (acc[declID] = [sheet]);
    return acc;
  }, {});

  const duplicatesWithMultipleSheets = Object.entries(duplicates).filter(
    ([, sheets]) => sheets.length > 1
  );
  if (duplicatesWithMultipleSheets.length === 0) return;

  return duplicatesWithMultipleSheets
    .map(([declID, sheets]) => `${declID}: ${sheets.join(", ")}\n`)
    .join("");
};
function getCurrentDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
}
const buildErrorsString = (errors) => {
  let errorString = "";

  for (const error of errors) {
    errorString += `${error.declaration}: ${error.error}\n`;
  }

  if (errorString.length >= 4096) {
    errorString = errorString.substring(0, 4096);
  }

  return errorString.length > 0 ? errorString : "Ошибок не обнаружено";
};

function extractDateOfBirth(pnfl) {
  if (pnfl !== undefined) {
    const day = pnfl.substr(1, 2);
    const month = pnfl.substr(3, 2);
    const year = pnfl.substr(5, 2);

    const currentYear = new Date().getFullYear();
    const prefix =
      currentYear - (currentYear % 100) + parseInt(year, 10) > currentYear
        ? "19"
        : "20";
    const fullYear = prefix + year;

    return `${fullYear}-${month}-${day}`;
  }
}
function checkBirthdate(birthdate) {
  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

  if (!dateRegex.test(birthdate)) {
    return false;
  }

  const [year, month, day] = birthdate.split("-");
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() != parseInt(year) ||
    parsedDate.getMonth() + 1 != parseInt(month) ||
    parsedDate.getDate() != parseInt(day)
  ) {
    return false;
  }

  return true;
}

const transformAndValidateDeclarationObject = (
  offsetObject,
  declaration,
  sheet
) => {
  let ifError = false;
  let object = {};
  // console.log(offsetObject.declID.w);
  if (!offsetObject.declID) {
    collectErrors(`Номер декларации не указан`, sheet);
    ifError = true;
  } else {
    if (
      !offsetObject.totalPrice ||
      offsetObject.totalPrice.w == 0 ||
      offsetObject.totalPrice.w.trim() == ""
    ) {
      collectErrors(`Сумма не указана`, offsetObject.declID.w);
      ifError = true;
    }
    if (
      !offsetObject.totalWeight ||
      offsetObject.totalWeight.w == 0 ||
      offsetObject.totalWeight.w.trim() == ""
    ) {
      collectErrors(`Вес не указан`, offsetObject.declID.w);
      ifError = true;
    }
    if (!offsetObject.lastName) {
      collectErrors(`Фамилия не указана`, offsetObject.declID.w);
      ifError = true;
    }
    if (!offsetObject.firstName) {
      collectErrors(`Имя не ��казано`, offsetObject.declID.w);
      ifError = true;
    }
    if (!offsetObject.passport) {
      collectErrors(`Паспорт не указан`, offsetObject.declID.w);
      ifError = true;
    }
    if (!offsetObject.pnfl) {
      collectErrors(`ПНФЛ не указан`, offsetObject.declID.w);
      ifError = true;
    }
    const pnflLength = offsetObject.pnfl?.w
      .replace(/\D/g, "")
      .trim()
      .replaceAll(" ", "").length;
    if (pnflLength !== 14 && pnflLength != undefined) {
      collectErrors(`ПНФЛ состоит не из 14 цифр`, offsetObject.declID.w);
      ifError = true;
    }
    if (!checkBirthdate(extractDateOfBirth(offsetObject.pnfl?.w))) {
      collectErrors(`Неверная дата рождения`, offsetObject.declID.w);
      ifError = true;
    }
    if (!offsetObject.address) {
      collectErrors(`Адрес не указан`, offsetObject.declID.w);
      ifError = true;
    }
  }

  if (!ifError) {
    object = {
      declID: offsetObject.declID.w.trim(),
      totalPrice: +offsetObject.totalPrice.w
        .replace(/[^\d.,]/g, "")
        .trim()
        .replaceAll(" ", "")
        .replace(",", "."),
      totalWeight: +offsetObject.totalWeight.w
        .replace(/[^\d.,]/g, "")
        .trim()
        .replaceAll(" ", "")
        .replace(",", "."),
      lastName: offsetObject.lastName.w.trim().replace(/ +(?= )/g, ""),
      firstName: offsetObject.firstName.w.trim().replace(/ +(?= )/g, ""),
      passport: offsetObject.passport.w.trim().replaceAll(" ", ""),
      pnfl: offsetObject.pnfl.w.replace(/\D/g, "").trim().replaceAll(" ", ""),
      address: offsetObject.address,
      phone: !!offsetObject.phone
        ? offsetObject.phone.w.replace(/\D/g, "").replaceAll(" ", "").length < 8
          ? "946136755"
          : offsetObject.phone.w
            .replace(/\D/g, "")
            .replaceAll(" ", "")
            .slice(-9)
        : "946136755",
      senderName: offsetObject.senderName?.w,
      senderSurname: offsetObject.senderSurname?.w,
      senderAddress: offsetObject.senderAddress,
      senderPhone: offsetObject.senderPhone?.w,
    };
  }
  // if (sheet == `JFK1213814.xls`) console.log(object.declID, sheet, declaration);
  return object;
};

const validateDeclarationItems = async (start, end, declaration, sheet) => {
  let itemArray = [];
  for (let i = start; i <= end; i++) {
    const itemExists = declaration[`G${i}`];
    const quantityExists = declaration[`I${i}`];
    const costExists = declaration[`J${i}`];

    if (i == start && !itemExists) {
      collectErrors(`1-ая ячейка товаров пустая`, declaration["A1"].w);
      break;
    }

    if (!itemExists || itemExists.w.replace(/\s/g, "") == "0") {
      if (quantityExists) {
        collectErrors(
          `Количество указано, но нет названия`,
          declaration["A1"].w
        );
      }
      if (costExists) {
        collectErrors(`Цена указана, но нет названия`, declaration["A1"].w);
      }
    }

    if (!quantityExists || quantityExists?.w == 0) {
      if (itemExists && itemExists?.w.replaceAll(" ", "").length != 0) {
        collectErrors(
          `Название указано, но нет количества`,
          declaration["A1"].w
        );
      }
      if (costExists) {
        collectErrors(`Цена указана, но нет количества`, declaration["A1"].w);
      }
    }

    if (!costExists || +costExists?.w == 0) {
      if (itemExists && itemExists?.w.replaceAll(" ", "").length != 0) {
        collectErrors(`Название указано, но нет цены`, declaration["A1"].w);
      }
      if (quantityExists) {
        collectErrors(`Количество указано, но нет цены`, declaration["A1"].w);
      }
    }

    let itemName = declaration[`G${i}`]?.w.trim().replace(",", ".");
    let itemQuantity = Math.round(
      parseFloat(
        declaration[`I${i}`]?.w
          .trim()
          .replace(",", ".")
          .replace(/[^0-9.]/g, "")
      )
    );
    let itemCost = declaration[`J${i}`]?.w
      .trim()
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");

    if (!!itemName && !!itemQuantity && !!itemCost) {
      itemArray.push({
        itemName,
        itemQuantity,
        itemCost,
      });
    }
  }

  return itemArray;
};

// Обработка документов/файлов
bot.on("document", async (msg) => {
  if (msg.document && msg.document.file_name.endsWith(".zip")) {
    currentChatId = msg.chat.id; // Сохраняем ID чата
    currentDocument = msg.document; // Сохраняем документ
    documentMessage = msg;

    if (!allowedChatIds.includes(msg.chat.id.toString())) {
      // bot.sendMessage(msg.chat.id, 'Вы не можете использовать этот бот');
      return;
    }

    if (
      msg.chat.type !== "group" &&
      msg.chat.type !== "supergroup" &&
      msg.chat.id != "101965789"
    ) {
      bot.sendMessage(msg.chat.id, "Личные сообщения не поддерживаются");
      return; // Игнорировать личные сообщения
    }

    // Отправка сообщения с кнопкой
    const options = {
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
    await bot.sendMessage(
      currentChatId,
      "Документ получен. Нажмите кнопку для начала обработки.",
      options
    );
  }
});

// Обработчик команды /find
bot.onText(/\/find (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const searchQuery = match[1];

  if (!allowedChatIds.includes(msg.chat.id.toString())) {
    // bot.sendMessage(msg.chat.id, 'Вы не можете использовать этот бот');
    return;
  }

  try {
    // Отправляем запрос к нашему Python API
    const response = await axios.get(
      `http://localhost:5000/search?q=${encodeURIComponent(searchQuery)}`
    );
    const results = response.data.results;

    if (!results || results.length === 0) {
      bot.sendMessage(chatId, "По вашему запросу ничего не найдено.");
      return;
    }

    // Форматируем результаты поиска
    const formattedResults = results
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

    bot.sendMessage(chatId, formattedResults, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Search error:", error);
    bot.sendMessage(
      chatId,
      "Произошла ошибка при поиске. Пожалуйста, попробуйте позже."
    );
  }
});

// Обработка нажатия кнопки
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (query.data === "start_processing") {
    bot.deleteMessage(chatId, messageId);
    // Проверка типа документов
    if (currentDocument.mime_type === "application/zip") {
      // Начинаем обработку
      try {
        // console.clear();
        console.log("Starting analysis...");
        collectedErrors = [];
        collectedDeclarations = [];

        let waitMsg = bot.sendMessage(chatId, "Пожалуйста, подождите...", {
          reply_to_message_id: documentMessage,
        });

        let workbookEJS = new ExcelJS.Workbook();
        workbookEJS = await workbookEJS.xlsx.readFile("./newtamplate.xlsx");
        let worksheetEJS = workbookEJS.getWorksheet(1);

        let workbookEJS1 = new ExcelJS.Workbook();
        workbookEJS1 = await workbookEJS1.xlsx.readFile(
          "./newtamplate_some.xlsx"
        );
        let worksheetEJS1 = workbookEJS1.getWorksheet(1);

        let declarations = [];

        let zipFilePath;
        let extractFolderPath;

        try {
          // Downloading zip file using file_id provided by Telegram API.
          const fileData = await bot.getFile(currentDocument.file_id);
          const zipFileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.file_path}`;

          // Download and save the zip file.
          const response = await axios({
            method: "GET",
            url: zipFileUrl,
            responseType: "stream",
          });

          const tempFolderPath = `${__dirname}/tmp`;

          if (!fs.existsSync(tempFolderPath)) {
            fs.mkdirSync(tempFolderPath);
          }

          zipFilePath = `${tempFolderPath}/${currentDocument.file_name}`;

          const writer = fs.createWriteStream(zipFilePath);
          response.data.pipe(writer);

          // Wait until the file is completely written to disk
          await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
          });

          // Unzip the downloaded file.
          const zip = new AdmZip(zipFilePath);
          const zipEntries = zip.getEntries();

          let extractedFilesCount = 0;

          extractFolderPath = `${tempFolderPath}/extracted_${currentDocument.file_id}`;

          if (!fs.existsSync(extractFolderPath)) {
            fs.mkdirSync(extractFolderPath);
          }

          for (const entry of zipEntries) {
            if (!entry.isDirectory) {
              // Extract each file from the zip archive.
              await new Promise((resolve, reject) => {
                entry.getDataAsync((data) => {
                  const filePath = `${extractFolderPath}/${entry.entryName}`;
                  fs.writeFile(filePath, data, (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });
              });

              extractedFilesCount++;
            }
          }

          // Analyze and process extracted files here.
          const sheets = fs
            .readdirSync(extractFolderPath)
            .filter((name) => name.slice(-3) === "xls");

          await Promise.all(
            sheets.map(async (sheet) => {
              const workbook = xlsx.readFile(`${extractFolderPath}/${sheet}`);
              if (workbook.Sheets["Sheet1"] != undefined) {
                var worksheet = [workbook.Sheets["Sheet1"]];
              } else {
                collectErrors(`Не удалось найти лист "Sheet1"`, sheet);
                return;
              }

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

                let totlaPriceOfItems = 0;
                offset.items.forEach((item) => {
                  totlaPriceOfItems += item.itemCost;
                });
                // console.log(offset.items);

                // console.log(totlaPriceOfItems);

                const countryName = chatIdNames[chatId];
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
                // await database.addDeclarationToFlight(
                //   countryName,
                //   dataForLimits[offset.pnfl]
                // );
                // console.log(dataForLimits);
                declarations.push(offset);
                collectedDeclarations.push({
                  declID: declaration["A1"].w,
                  sheet,
                });
              }
            })
          );

          for (let i = 0; i < declarations.length; i++) {
            let row = worksheetEJS.getRow(i + 8);

            // row.style.border = {
            // 	top: { style: 'thin', color: { argb: '00000000' } },
            // 	left: { style: 'thin', color: { argb: '00000000' } },
            // 	bottom: { style: 'thin', color: { argb: '00000000' } },
            // 	right: { style: 'thin', color: { argb: '00000000' } },
            // };
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

          let duplicates = findDuplicatedDeclaration(collectedDeclarations);
          if (!!duplicates) {
            bot.sendMessage(chatId, `Обнаружены дубликаты:\n${duplicates}`);
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

          // Добавьте эту функцию в начало файла

          let fileName;
          const currentDate = getCurrentDate();

          if (chatIdNames[chatId]) {
            fileName = `${chatIdNames[chatId]} ${currentDate}.xlsx`;
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

          workbookEJS.xlsx
            .writeFile(`${extractFolderPath}/${fileName}`)
            .then(() => {
              console.log("Excel file created successfully");
              bot
                .sendDocument(
                  chatId,
                  fs.createReadStream(`${extractFolderPath}/${fileName}`),
                  {
                    caption: `${firstPackage} - ${lastPackage}\nОбщий вес: ${totalWeight.toFixed(
                      2
                    )} кг\nКоличество посылок: ${totalItems}`,
                  }
                )
                .then(() => {
                  console.log("Excel file sent successfully");
                })
                .catch((error) => {
                  console.error("Error sending Excel file:", error);
                });
            })
            .catch((error) => {
              console.error("Error creating Excel file:", error);
            });

          workbookEJS1.xlsx
            .writeFile(`${extractFolderPath}/1${fileName}`)
            .then(() => {
              console.log("Excel file created successfully");
              bot
                .sendDocument(
                  "-4044680201",
                  fs.createReadStream(`${extractFolderPath}/1${fileName}`)
                )
                .then(() => {
                  console.log("Excel file sent successfully");
                  fs.removeSync(extractFolderPath);
                })
                .catch((error) => {
                  console.error("Error sending Excel file:", error);
                });
            })
            .catch((error) => {
              console.error("Error creating Excel file:", error);
            });

          // Send response back to user with analysis result.
          bot.deleteMessage(chatId, (await waitMsg).message_id);

          bot.sendMessage(chatId, `${buildErrorsString(collectedErrors)}`);
        } catch (error) {
          console.error(error);
          // Send error message if any error occurs during processing or analysis.
          bot.sendMessage(
            chatId,
            "An error occurred while processing your zip file."
          );
        } finally {
          // Clean up temporary files after processing is complete.
          fs.removeSync(zipFilePath);
        }
      } catch (error) {
        console.error(error);
        // Send error message if any error occurs during processing or analysis.
        bot.sendMessage(
          chatId,
          "An error occurred while processing your zip file."
        );
      }
    } else {
      bot.sendMessage(
        chatId,
        "Пожалуйста, отправьте ZIP-архив с декларациями."
      );
    }
  }

  if (query.data === "cancel_processing") {
    bot.deleteMessage(chatId, messageId);
  }

  if (query.data === "check_weight") {
    bot.deleteMessage(chatId, messageId);

    try {
      const fileData = await bot.getFile(currentDocument.file_id);
      const zipFileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.file_path}`;

      const response = await axios({
        method: "GET",
        url: zipFileUrl,
        responseType: "stream",
      });

      const tempFolderPath = `${__dirname}/tmp`;

      if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
      }

      const zipFilePath = `${tempFolderPath}/${fileData.file_id}.zip`;
      const writeStream = fs.createWriteStream(zipFilePath);

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        response.data.pipe(writeStream);
      });

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
        `Общий вес всех посылок: ${totalWeight.toFixed(2)} кг`
      );

      // Очистка временных файлов
      fs.unlinkSync(zipFilePath);
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "Произошла ошибка при обработке ZIP файла.");
    }
  }

  if (query.data === "check_errors") {
    bot.deleteMessage(chatId, messageId);

    try {
      await logToFile("Начало обработки запроса check_errors");
      const fileData = await bot.getFile(currentDocument.file_id);
      await logToFile(`Получен файл: ${fileData.file_path}`);

      const zipFileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.file_path}`;
      await logToFile(`URL архива: ${zipFileUrl}`);

      await logToFile("Скачивание архива...");
      const response = await axios({
        method: "GET",
        url: zipFileUrl,
        responseType: "stream",
      });
      await logToFile("Архив успешно скачан");

      const tempFolderPath = `${__dirname}/tmp`;
      await logToFile(`Создание временной папки: ${tempFolderPath}`);

      if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
        await logToFile("Временная папка создана");
      }

      const zipFilePath = `${tempFolderPath}/${fileData.file_id}.zip`;
      await logToFile(`Путь к архиву: ${zipFilePath}`);
      const writeStream = fs.createWriteStream(zipFilePath);

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        response.data.pipe(writeStream);
      });
      await logToFile("Архив сохранен на диск");

      const zip = new AdmZip(zipFilePath);
      const zipEntries = zip.getEntries();
      await logToFile(`Найдено файлов в архиве: ${zipEntries.length}`);

      let sessionId;

      try {
        await logToFile("Чтение JSESSIONID из файла...");
        const jsessionid = fs.readFileSync("jsession.txt", "utf8");
        sessionId = `JSESSIONID=${jsessionid}`;
        await logToFile("JSESSIONID успешно прочитан");
      } catch (error) {
        await logToFile(
          `Ошибка при чтении JSESSIONID: ${error.message}`,
          "error"
        );
        throw new Error(
          "Не удалось прочитать JSESSIONID. Возможно, нужно перелогиниться."
        );
      }

      // Подготавливаем файлы для пакетной обработки
      const excelFiles = zipEntries
        .filter((entry) => entry.entryName.match(/\.(xls|xlsx)$/i))
        .map((entry) => ({
          name: entry.entryName,
          content: zip.readFile(entry),
        }));

      await logToFile(`Найдено Excel файлов: ${excelFiles.length}`);

      // Обрабатываем файлы асинхронно
      const batchResults = await processBatchFiles(
        excelFiles,
        sessionId,
        chatId
      );
      await logToFile(
        `Обработка всех файлов завершена. Всего результатов: ${batchResults.length}`
      );

      fs.unlinkSync(zipFilePath);
      await logToFile("Временные файлы удалены");
    } catch (error) {
      console.error(error);
      await logToFile(`Критическая ошибка: ${error.message}`, "error");
      bot.sendMessage(
        chatId,
        `Произошла ошибка при обработке ZIP файла: ${error.message}`
      );
    }
  }
});

// Функция для пакетной обработки файлов
async function processBatchFiles(files, sessionId, chatId, batchSize = 10) {
  let processedFiles = 0;
  const totalFiles = files.length;
  const allResults = [];

  // Создаем начальное сообщение с прогрессом
  const progressMessage = `Прогресс обработки:\n✅ Обработано: 0/${totalFiles} (0%)\n⏳ В процессе: ${totalFiles} файлов`;
  const msgResponse = await bot.sendMessage(chatId, progressMessage);
  const messageId = msgResponse.message_id;

  // Функция для создания throttled версии функции
  function throttle(func, limit) {
    let inThrottle;
    let lastResult;
    return function (...args) {
      if (!inThrottle) {
        lastResult = func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
      return lastResult;
    };
  }

  // Создаем throttled версию функции обновления прогресса (обновление не чаще чем раз в 2 секунды)
  const throttledUpdate = throttle(async (currentProcessed) => {
    const percentage = Math.round((currentProcessed / totalFiles) * 100);
    const remaining = totalFiles - currentProcessed;
    const message = `Прогресс обработки:\n✅ Обработано: ${currentProcessed}/${totalFiles} (${percentage}%)\n⏳ Осталось: ${remaining} файлов`;
    await safeUpdateMessage(message, messageId);
  }, 2000);

  // Обновленная функция для обновления прогресса
  const updateProgress = async (currentProcessed) => {
    await throttledUpdate(currentProcessed);
  };

  // Обрабатываем файлы пачками
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await logToFile(
      `Обработка пачки ${Math.floor(i / batchSize) + 1}, файлов в пачке: ${batch.length
      }`
    );

    const batchPromises = batch.map(async (file) => {
      let currentPnfl = null;
      let currentPassport = null;

      try {
        const content = file.content;
        const workbook = xlsx.read(content, { type: "buffer" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        currentPassport = worksheet["E11"] ? worksheet["E11"].v : null;
        currentPnfl = worksheet["E12"] ? worksheet["E12"].w : null;

        await logToFile(`Обработка файла: ${file.name}, ПНФЛ: ${currentPnfl}`);

        if (!currentPnfl) {
          await logToFile(
            `Пропуск файла ${file.name}: не найден ПНФЛ`,
            "warning"
          );
          processedFiles++;
          await updateProgress(processedFiles);
          return {
            fileName: file.name,
            status: "error",
            message: `❌ ПНФЛ не указан в файле\n📄 Файл: ${file.name}`,
          };
        }

        // Пробуем первый запрос (datedocv4)
        const passportData = await fetchPassportDataV4(currentPnfl, sessionId);
        await logToFile(
          `Результат datedocv4 для файла ${file.name}: ${passportData?.result}`
        );

        // Если первый запрос успешен
        if (passportData && passportData.result === 1) {
          processedFiles++;
          await updateProgress(processedFiles);
          return {
            fileName: file.name,
            status: "success",
          };
        }

        // Если первый запрос неуспешен, пробуем второй (datedocv2)
        await logToFile(`Пробуем datedocv2 для файла ${file.name}`);
        const birthDate = extractDateOfBirth(currentPnfl);
        const documentNum = currentPassport || "";
        const additionalData = await fetchPassportDataV2(
          birthDate,
          documentNum,
          sessionId
        );
        await logToFile(
          `Результат datedocv2 для файла ${file.name}: ${additionalData?.result}`
        );

        // Если второй запрос успешен
        if (additionalData && additionalData.result === 1) {
          processedFiles++;
          await updateProgress(processedFiles);
          return {
            fileName: file.name,
            status: "success",
          };
        }

        // Если оба запроса неуспешны
        processedFiles++;
        await updateProgress(processedFiles);
        return {
          fileName: file.name,
          status: "error",
          message: `📄 Файл: ${file.name}\n⚠️ Ошибки:\n- ${passportData?.queryld || "Неизвестная ошибка"
            }\n- ${additionalData?.queryld || "Неизвестная ошибка"}`,
        };
      } catch (error) {
        await logToFile(
          `Ошибка при обработке файла ${file.name}: ${error.message}`,
          "error"
        );
        processedFiles++;
        await updateProgress(processedFiles);
        return {
          fileName: file.name,
          status: "error",
          message: `📄 Файл: ${file.name}\n${currentPnfl}\n⚠️ Ошибка: ${error.message}`,
        };
      }
    });

    // Ждем завершения текущей пачки
    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    await logToFile(`Пачка ${Math.floor(i / batchSize) + 1} обработана`);
  }

  // Обновляем сообщение о завершении и отправляем результаты
  try {
    // Фильтруем только ошибки
    const errorResults = allResults.filter(
      (result) => result.status === "error"
    );

    if (errorResults.length > 0) {
      let message = "❌ Найдены ошибки при проверке:\n\n";

      // Добавляем только ошибки
      for (const result of errorResults) {
        message += `${result.message}\n\n`;
      }

      await safeUpdateMessage(message, messageId);
    } else {
      // Если ошибок нет, отправляем краткое сообщение об успехе
      await safeUpdateMessage(
        `✅ Все файлы успешно проверены\n📑 Всего обработано: ${allResults.length} файлов`,
        messageId
      );
    }
  } catch (error) {
    await logToFile(
      `Ошибка при обновлении финального сообщения: ${error.message}`,
      "error"
    );
    // Пробуем отправить новое сообщение в случае ошибки
    try {
      await bot.sendMessage(
        chatId,
        "❌ Произошла ошибка при обновлении сообщения. Пожалуйста, проверьте логи."
      );
    } catch (sendError) {
      await logToFile(
        `Не удалось отправить сообщение об ошибке: ${sendError.message}`,
        "error"
      );
    }
  }

  return allResults;
}

// Функция для безопасного обновления сообщения
const safeUpdateMessage = async (text, messageId) => {
  try {
    await bot.editMessageText(text, {
      chat_id: currentChatId,
      message_id: messageId,
    });
  } catch (error) {
    // Если не удалось обновить сообщение, отправляем новое
    await bot.sendMessage(currentChatId, text);
    await logToFile(
      "Не удалось обновить сообщение, отправлено новое",
      "warning"
    );
  }
};

// Функция для логирования
async function logToFile(message, type = "info") {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;

  // Выводим в консоль
  console.log(logEntry);

  // Записываем в файл
  try {
    await fs.promises.appendFile("bot_log.txt", logEntry);
  } catch (error) {
    console.error("Ошибка при записи в лог файл:", error);
  }
}

// Функция для выполнения запроса datedocv4
async function fetchPassportDataV4(pnfl, sessionId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    await logToFile(`[datedocv4] Отправка запроса для ПНФЛ: ${pnfl}`);
    await logToFile(
      `[datedocv4] Используемая сессия: ${sessionId.substring(0, 20)}...`
    );

    const response = await axios({
      method: "POST",
      url: "https://cargo.customs.uz/personDate/datedocv4",
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

// Функция для выполнения запроса datedocv2
async function fetchPassportDataV2(birthDate, documentNum, sessionId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    await logToFile(
      `[datedocv2] Отправка запроса: birthDate=${birthDate}, documentNum=${documentNum}`
    );
    await logToFile(
      `[datedocv2] Используемая сессия: ${sessionId.substring(0, 20)}...`
    );

    const response = await axios({
      method: "POST",
      url: "https://cargo.customs.uz/personDate/datedocv2",
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
