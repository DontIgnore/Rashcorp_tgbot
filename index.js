const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const xlsx = require("xlsx");
const ExcelJS = require('exceljs');
// const AWS = require("aws-sdk");
// const s3 = new AWS.S3()
require('dotenv').config();

const botToken = process.env.botToken;

let collectedErrors = [];
let collectedDeclarations = [];

// Create a new instance of TelegramBot.
const bot = new TelegramBot(botToken, { polling: true });
console.log(bot);

const collectErrors = (error, sheet) => {
    collectedErrors.push({ error: error, declaration: sheet });
}

const checkDuplicatedDeclaration = async (declarations) => {
    let duplicated = [];
    let duplicatedObj = {};
    let errorString = "";
    for (let i = 0; i < declarations.length; i++) {
        console.log(declarations[i]);
    }
    return errorString;
}

const buildErrorsString = (errors) => {
    let errorString = '';

    for (const error of errors) {
        errorString += `${error.declaration}: ${error.error}\n`;
    }

    if (errorString.length >= 1000) {
        errorString = errorString;
    }

    return errorString.length > 0 ? errorString : 'Ошибок не обнаружено';
}

function extractDateOfBirth(pnfl, declID) {
    if (pnfl !== undefined) {
        const day = pnfl.substr(1, 2);
        const month = pnfl.substr(3, 2);
        const year = pnfl.substr(5, 2);

        const currentYear = new Date().getFullYear();
        const prefix = currentYear - (currentYear % 100) + parseInt(year, 10) > currentYear ? "19" : "20";
        const fullYear = prefix + year;

        return `${day}.${month}.${fullYear}`;
    }
}
function checkBirthdate(birthdate) {
    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;

    if (!dateRegex.test(birthdate)) {
        return false;
    }

    const [day, month, year] = birthdate.split(".");
    const parsedDate = new Date(`${year}-${month}-${day}`);

    if (
        parsedDate.getDate() != parseInt(day) ||
        parsedDate.getMonth() + 1 != parseInt(month) ||
        parsedDate.getFullYear() != parseInt(year)
    ) {
        return false;
    }

    return true;
}

const transformAndValidateDeclarationObject = (offsetObject, declaration, sheet) => {
    let ifError = false;
    let object = {};
    // console.log(offsetObject.declID.w);
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
        const pnflLength = offsetObject.pnfl?.w.replace(/\D/g, "").trim().replaceAll(" ", "").length;
        if (pnflLength !== 14 && pnflLength != undefined) {
            collectErrors(`ПНФЛ состоит не из 14 цифр`, offsetObject.declID.w)
            ifError = true
        }
        if (!checkBirthdate(extractDateOfBirth(offsetObject.pnfl?.w))) {
            collectErrors(`Неверная дата рождения`, offsetObject.declID.w)
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
            totalPrice: +offsetObject.totalPrice.w.replace(/[^\d.,]/g, "").trim().replaceAll(" ", "").replace(',', '.'),
            totalWeight: +offsetObject.totalWeight.w.replace(/[^\d.,]/g, "").trim().replaceAll(" ", "").replace(',', '.'),
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
    // if (sheet == `JFK1213814.xls`) console.log(object.declID, sheet, declaration);
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
            if (itemExists && itemExists?.w.replaceAll(' ', '').length != 0) {
                collectErrors(`Название указано, но нет количества`, declaration['A1'].w);
            }
            if (costExists) {
                collectErrors(`Цена указана, но нет количества`, declaration['A1'].w);
            }
        }

        if (!costExists || +costExists?.w == 0) {
            if (itemExists && itemExists?.w.replaceAll(' ', '').length != 0) {
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
    console.clear();
    console.log('Starting analysis...');
    collectedErrors = [];
    collectedDeclarations = [];

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
                    collectErrors(`Не удалось найти лист "Sheet1"`, sheet);
                    return
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
                    collectedDeclarations.push({ declarationName: offset.declID, fileName: sheet })
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
            let duplicated = await checkDuplicatedDeclaration(collectedDeclarations);
            // console.log(duplicated);
            // if (duplicated.length > 0) {
            // bot.sendMessage(chatId, `Обнаружены дубликаты:\n${duplicated}`);
            // }

            const row = worksheetEJS.getRow(lastIter + 9);

            row.getCell(9).font = { size: '18', bold: true };
            row.commit();
            row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
            row.commit();
            row.getCell(9).value = 'Жами:';
            row.getCell(10).value = { formula: 'SUM(J8:J' + (lastIter + 8) + ')' };
            row.getCell(11).value = { formula: 'SUM(K8:K' + (lastIter + 8) + ')' };
            row.getCell(12).value = 'USD';
            row.commit();

            worksheetEJS.mergeCells(`I${lastIter + 16}:L${lastIter + 16}`);
            worksheetEJS.mergeCells(`I${lastIter + 13}:L${lastIter + 13}`);


            worksheetEJS.getCell(`I${lastIter + 13}`).font = { size: '16', bold: true };
            worksheetEJS.getCell(`I${lastIter + 13}`).alignment = { vertical: 'middle', horizontal: 'left' };
            worksheetEJS.getCell(`I${lastIter + 16}`).font = { size: '16', bold: true };
            worksheetEJS.getCell(`I${lastIter + 16}`).alignment = { vertical: 'middle', horizontal: 'left' };

            worksheetEJS.getCell(`I${lastIter + 13}`).value = 'Қабул қилувчи ташкилот номи, имзоси ва муҳри:';
            worksheetEJS.getCell(`I${lastIter + 16}`).value = 'Жўнатувчи ташкилот номи, имзоси ва муҳри:';


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