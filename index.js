const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const xlsx = require("xlsx");
const ExcelJS = require('exceljs');
require('dotenv').config();

// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with your own token obtained from BotFather.
const botToken = process.env.botToken;

let collectedErrors = [];
let collectedDeclarations = [];

// Create a new instance of TelegramBot.
const bot = new TelegramBot(botToken, { polling: true });

const collectErrors = (error, sheet) => {
    collectedErrors.push({ error: error, declaration: sheet });
}

const checkDuplicatedDeclaration = (declarations) => {
    let duplicated = [];
    for (let i = 0; i < declarations.length; i++) {
        for (let j = i + 1; j < declarations.length; j++) {
            if (declarations[i] == declarations[j]) {
                duplicated.push(declarations[i])
                console.log('what?');
            }
        }
    }
    return duplicated
}

const buildErrorsString = (errors) => {
    let errorString = '';
    
    for (const error of errors) {
        errorString += `${error.declaration}: ${error.error}\n`;
    }
    
    if (errorString.length >= 1000) {
        errorString = errorString.slice(0, 1000);
    }
    
    return errorString.length > 0 ? errorString : 'Ошибок не обнаружено';
}

const transformAndValidateDeclarationObject = (offsetObject, declaration, sheet) => {
    let ifError = false;
    let object = {};
    if (!offsetObject.declID) {
        collectErrors(`Номер декларации не указан`, sheet)
        ifError = true
    } else {
        if (!offsetObject.totalPrice) {
            collectErrors(`Сумма не указана`, offsetObject.declID.w)
            ifError = true
        }
        if (!offsetObject.totalWeight) {
            collectErrors(`Вес не указан`, offsetObject.declID.w)
            ifError = true
        }
        if (!offsetObject.lastName) {
            collectErrors(`Фамилия не указана`, offsetObject.declID.w)
            ifError = true
        }
        if (!offsetObject.firstName) {
            collectErrors(`Имя не указано`, offsetObject.declID.w)
            ifError = true
        }
        if (!offsetObject.passport) {
            collectErrors(`Паспорт не указан`, offsetObject.declID.w)
            ifError = true
        }
        if (!offsetObject.pnfl) {
            collectErrors(`ПНФЛ не указан`, offsetObject.declID.w)
            ifError = true
        }
        if (offsetObject.pnfl?.w.replace(/\D/g, "").trim().replaceAll(" ", "").length !== 14) {
            console.log(offsetObject.pnfl);
            collectErrors(`ПНФЛ состоит не из 14 цифр`, offsetObject.declID.w)
            ifError = true
        }
        if (!offsetObject.address) {
            collectErrors(`Адрес не указан`, offsetObject.declID.w)
            ifError = true
        }
    }

    if (!ifError) {
        object = {
            declID: offsetObject.declID.w.trim(),
            totalPrice: offsetObject.totalPrice.w.replace(/\D/g, "").trim().replaceAll(" ", "").replace(',', '.'),
            totalWeight: offsetObject.totalWeight.w.replace(/\D/g, "").trim().replaceAll(" ", "").replace(',', '.'),
            lastName: offsetObject.lastName.w.trim().replace(/ +(?= )/g, ''),
            firstName: offsetObject.firstName.w.trim().replace(/ +(?= )/g, ''),
            passport: offsetObject.passport.w.trim().replaceAll(" ", ""),
            pnfl: offsetObject.pnfl.w.replace(/\D/g, "").trim().replaceAll(" ", ""),
            address: offsetObject.address.w.trim().replace(/ +(?= )/g, ''),
            phone: !!offsetObject.phone
                ? offsetObject.phone.w.replace(/\D/g, "").replaceAll(" ", "").length < 8
                    ? "946136755"
                    : offsetObject.phone.w.replace(/\D/g, "").replaceAll(" ", "").slice(-9)
                : "946136755",
        }
    }

    return object;
}

const validateDeclarationItems = (start, end, declaration, sheet) => {
    let itemArray = [];
    for (let i = start; i <= end; i++) {
        const itemExists = declaration[`G${i}`];
        const quantityExists = declaration[`I${i}`];
        const costExists = declaration[`J${i}`];

        if (i == start && !itemExists) {
            collectErrors(`1-ая ячейка товаров пустая`, declaration['A1'].w);
            break;
        }

        if (!itemExists || itemExists.w.replace(/\s/g, '') == '0') {
            if (quantityExists) {
                collectErrors(`Количество указано, но нет названия`, declaration['A1'].w);
            }
            if (costExists) {
                collectErrors(`Цена указана, но нет названия`, declaration['A1'].w);
            }
        }

        if (!quantityExists || quantityExists?.w == 0) {
            if (itemExists) {
                collectErrors(`Название указано, но нет количества`, declaration['A1'].w);
            }
            if (costExists) {
                collectErrors(`Цена указана, но нет количества`, declaration['A1'].w);
            }
        }

        if (!costExists || +costExists?.w == 0) {
            if (itemExists) {
                collectErrors(`Название указано, но нет цены`, declaration['A1'].w);
            }
            if (quantityExists) {
                collectErrors(`Количество указано, но нет цены`, declaration['A1'].w);
            }
        }






        let itemName = declaration[`G${i}`]?.w.trim().replace(',', '.');
        let itemQuantity = Math.round(parseFloat(declaration[`I${i}`]?.w.trim().replace(',', '.').replace(/[^0-9.]/g, "")));
        let itemCost = declaration[`J${i}`]?.w.trim().replace(',', '.').replace(/[^0-9.]/g, "");

        if (!!itemName && !!itemQuantity && !!itemCost) {
            itemArray.push({
                itemName,
                itemQuantity,
                itemCost
            })
        }
    }



    return itemArray;
};

// Handle incoming documents/files.
bot.on('document', async (msg) => {
    collectedErrors = [];
    collectedDeclarations = [];

    console.log(msg);
    if (msg.chat.id == 101965789 && msg.document.mime_type == 'application/zip') {
        const chatId = msg.chat.id;
        let waitMsg = bot.sendMessage(chatId, 'Пожалуйста, подождите...', { reply_to_message_id: msg.message_id });

        let workbookEJS = new ExcelJS.Workbook();
        workbookEJS = await workbookEJS.xlsx.readFile('./newtamplate.xlsx');
        let worksheetEJS = workbookEJS.getWorksheet(1);

        let declarations = [];

        let zipFilePath;
        let extractFolderPath;

        try {
            // Downloading zip file using file_id provided by Telegram API.
            const fileData = await bot.getFile(msg.document.file_id);
            const zipFileUrl =
                `https://api.telegram.org/file/bot${botToken}/${fileData.file_path}`;

            // Download and save the zip file.
            const response = await axios({
                method: 'GET',
                url: zipFileUrl,
                responseType: 'stream',
            });

            const tempFolderPath = `${__dirname}/tmp`;

            if (!fs.existsSync(tempFolderPath)) {
                fs.mkdirSync(tempFolderPath);
            }

            zipFilePath = `${tempFolderPath}/${msg.document.file_name}`;

            response.data.pipe(fs.createWriteStream(zipFilePath));

            // Wait for the download to complete
            await new Promise((resolve, reject) => {
                response.data.on("end", resolve);
                response.data.on("error", reject);
            });

            // Unzip the downloaded file.
            const zip = new AdmZip(zipFilePath);
            const zipEntries = zip.getEntries();

            let extractedFilesCount = 0;

            extractFolderPath = `${tempFolderPath}/extracted_${msg.document.file_id}`;

            if (!fs.existsSync(extractFolderPath)) {
                fs.mkdirSync(extractFolderPath);
            }

            for (const entry of zipEntries) {
                if (!entry.isDirectory) {
                    // Extract each file from the zip archive.
                    await new Promise((resolve, reject) => {
                        entry.getDataAsync((data) => {
                            const filePath = `${extractFolderPath}/${entry.entryName}`;

                            // Save the extracted file to disk.
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
            const sheets = fs.readdirSync(extractFolderPath).filter((name) => name.slice(-3) === "xls")

            sheets.forEach((sheet) => {
                const workbook = xlsx.readFile(`${extractFolderPath}/${sheet}`);
                if (workbook.Sheets["Sheet1"] != undefined) {
                    var worksheet = [workbook.Sheets["Sheet1"]];
                } else {
                    console.log(sheet)
                }

                worksheet.forEach((declaration) => {
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
                            address: declaration["E6"],
                            phone: declaration["E10"],
                        }, declaration, sheet)
                    offset.items = validateDeclarationItems(4, 23, declaration, sheet)
                    declarations.push(offset)
                    collectedDeclarations.push({declarationName: offset.declID, fileName: sheet})
                })

            });

            for (let i = 0; i < declarations.length; i++) {
                let row = worksheetEJS.getRow(i + 8);

                // row.style.border = {
                // 	top: { style: 'thin', color: { argb: '00000000' } },
                // 	left: { style: 'thin', color: { argb: '00000000' } },
                // 	bottom: { style: 'thin', color: { argb: '00000000' } },
                // 	right: { style: 'thin', color: { argb: '00000000' } },
                // };
                let itemsArray = []
                declarations[i].items.forEach((item) => {
                    itemsArray.push(`${item.itemName}: ${item.itemQuantity}`)
                })

                row.font = { size: '15', bold: false };
                row.commit();
                row.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true, wrapText: true };
                row.commit();

                row.getCell(5).value = i + 1;
                row.getCell(6).value = declarations[i].declID;
                row.getCell(7).value = 'TezParcel';
                row.getCell(8).value = declarations[i].lastName + ' ' + declarations[i].firstName;
                row.getCell(9).value = itemsArray.join('\n');;
                row.getCell(10).value = declarations[i].totalWeight;
                row.getCell(11).value = declarations[i].totalPrice;
                row.getCell(12).value = 'USD';
                row.commit();
                if (declarations.length - 1 == i) lastIter = i;
            }

            let duplicated = checkDuplicatedDeclaration(collectedDeclarations)
            if (duplicated.length > 0) {
                bot.sendMessage(chatId, `Обнаружены дубликаты: ${duplicated.join(', ')}`);
            }


            workbookEJS.xlsx.writeFile(`${extractFolderPath}/manifest.xlsx`)
                .then(() => {
                    console.log('Excel file created successfully');
                    bot.sendDocument(chatId, fs.createReadStream(`${extractFolderPath}/manifest.xlsx`))
                        .then(() => {
                            console.log('Excel file sent successfully');
                            fs.removeSync(extractFolderPath);
                        })
                        .catch((error) => {
                            console.error('Error sending Excel file:', error);
                        });
                })
                .catch((error) => {
                    console.error('Error creating Excel file:', error);
                });


            // Send response back to user with analysis result.
            bot.deleteMessage(chatId, (await waitMsg).message_id);
            bot.sendMessage(chatId, `Successfully processed ${extractedFilesCount} files from the zip.`);

            bot.sendMessage(chatId, `${buildErrorsString(collectedErrors)}`);
        } catch (error) {
            console.error(error);
            // Send error message if any error occurs during processing or analysis.
            bot.sendMessage(chatId, 'An error occurred while processing your zip file.');
        } finally {
            // Clean up temporary files after processing is complete.
            fs.removeSync(zipFilePath);
        }
    }
});