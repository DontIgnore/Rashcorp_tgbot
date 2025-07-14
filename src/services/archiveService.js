const AdmZip = require('adm-zip');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const xlsx = require('xlsx');
const { collectErrors } = require('../utils/validationUtils');
const { transformAndValidateDeclarationObject, validateDeclarationItems } = require('./excelService');

// Опциональное подключение базы данных
let database;
try {
    database = require('../../database.js');
} catch (error) {
    console.log('Database module not found, skipping database operations');
    database = {
        addDeclarationToFlight: async () => {} // Пустая функция-заглушка
    };
}

async function downloadAndExtractZip(fileId, botToken) {
    try {
        // Get file info from Telegram
        const response = await axios.get(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
        );
        const filePath = response.data.result.file_path;
        const zipFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

        // Create temporary directories
        const tempFolderPath = path.join(__dirname, '../../tmp');
        await fs.ensureDir(tempFolderPath);

        const zipFilePath = path.join(tempFolderPath, `${fileId}.zip`);
        const extractFolderPath = path.join(tempFolderPath, `extracted_${fileId}`);
        await fs.ensureDir(extractFolderPath);

        // Download zip file
        const downloadResponse = await axios({
            method: 'GET',
            url: zipFileUrl,
            responseType: 'stream'
        });

        // Save zip file
        await new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(zipFilePath);
            downloadResponse.data.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // Extract zip file
        const zip = new AdmZip(zipFilePath);
        const zipEntries = zip.getEntries();

        // Extract each file
        for (const entry of zipEntries) {
            if (!entry.isDirectory) {
                await new Promise((resolve, reject) => {
                    entry.getDataAsync((data) => {
                        const filePath = path.join(extractFolderPath, entry.entryName);
                        fs.writeFile(filePath, data, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });
            }
        }

        return {
            zipFilePath,
            extractFolderPath
        };
    } catch (error) {
        console.error('Error in downloadAndExtractZip:', error);
        throw error;
    }
}

async function processExcelFiles(extractFolderPath, chatId, chatIdNames, collectedErrors = [], collectedDeclarations = []) {
    const declarations = [];
    
    // Get all Excel files
    const sheets = fs.readdirSync(extractFolderPath)
        .filter(name => name.endsWith('.xls') || name.endsWith('.xlsx'));

    console.log('Processing sheets:', sheets);

    await Promise.all(sheets.map(async (sheet) => {
        try {
            console.log('Processing sheet:', sheet);
            const workbook = xlsx.readFile(path.join(extractFolderPath, sheet));
            
            if (!workbook.Sheets['Sheet1']) {
                console.log('Sheet1 not found in workbook:', Object.keys(workbook.Sheets));
                collectErrors('Не удалось найти лист "Sheet1"', sheet, collectedErrors);
                return;
            }

            const worksheet = workbook.Sheets['Sheet1'];
            
            // Отладочная информация
            console.log('Worksheet data for', sheet, ':', {
                A1: worksheet['A1']?.v,
                E4: worksheet['E4']?.v,
                E5: worksheet['E5']?.v,
                E6: worksheet['E6']?.v,
                E7: worksheet['E7']?.v,
                E8: worksheet['E8']?.v,
                E10: worksheet['E10']?.v,
                E11: worksheet['E11']?.v,
                E12: worksheet['E12']?.v,
                N10: worksheet['N10']?.v,
                N11: worksheet['N11']?.v
            });

            const offset = transformAndValidateDeclarationObject({
                declID: { w: worksheet['A1']?.v?.toString() || '' },
                region: { w: worksheet['E8']?.v?.toString() || '' },
                district: { w: worksheet['E7']?.v?.toString() || '' },
                totalPrice: { w: worksheet['N10']?.v?.toString() || '0' },
                totalWeight: { w: worksheet['N11']?.v?.toString() || '0' },
                lastName: { w: worksheet['E4']?.v?.toString() || '' },
                firstName: { w: worksheet['E5']?.v?.toString() || '' },
                passport: { w: worksheet['E11']?.v?.toString() || '' },
                pnfl: { w: worksheet['E12']?.v?.toString() || '' },
                address: { w: worksheet['E6']?.v?.toString() || '' },
                phone: { w: worksheet['E10']?.v?.toString() || '' }
            }, worksheet, sheet, collectedErrors);

            if (offset) {
                console.log('Processed declaration:', offset);
                offset.items = await validateDeclarationItems(4, 23, worksheet, sheet, collectedErrors);
                // console.log('Declaration items:', offset.items);

                // Calculate total price of items
                let totalPriceOfItems = offset.items.reduce((sum, item) => sum + parseFloat(item.itemCost), 0);
                // console.log('Total price:', totalPriceOfItems);

                // Add to database if needed
                const countryName = chatIdNames[chatId];
                if (countryName && database.addDeclarationToFlight) {
                    const dataForLimits = {
                        declID: offset.declID,
                        totalPrice: offset.totalPrice,
                        totalWeight: offset.totalWeight,
                        lastName: offset.lastName,
                        firstName: offset.firstName,
                        passport: offset.passport,
                        pnfl: offset.pnfl
                    };
                    await database.addDeclarationToFlight(countryName, dataForLimits);
                }

                declarations.push(offset);
                collectedDeclarations.push({
                    declID: worksheet['A1']?.v?.toString() || sheet,
                    sheet
                });
            }
        } catch (error) {
            console.error('Error processing sheet:', sheet, error);
            collectErrors(`Ошибка обработки файла: ${error.message}`, sheet, collectedErrors);
        }
    }));

    console.log('Total declarations processed:', declarations.length);
    return declarations;
}

async function cleanup(paths) {
    try {
        for (const path of Object.values(paths)) {
            if (await fs.pathExists(path)) {
                await fs.remove(path);
            }
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

module.exports = {
    downloadAndExtractZip,
    processExcelFiles,
    cleanup
};
