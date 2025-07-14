const { downloadAndExtractZip, processExcelFiles, cleanup } = require('../services/archiveService');
const { loadTemplates } = require('../services/excelService');
const { buildErrorsString, findDuplicatedDeclaration } = require('../utils/validationUtils');
const { getCurrentDate } = require('../utils/dateUtils');
const config = require('../config/config');
const fs = require('fs-extra');

async function handleDocument(bot, msg) {
    if (!msg.document || !msg.document.file_name.endsWith('.zip')) {
        return;
    }

    if (!config.allowedChatIds.includes(msg.chat.id.toString())) {
        return;
    }

    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup' && msg.chat.id != '101965789') {
        await bot.sendMessage(msg.chat.id, 'Личные сообщения не поддерживаются');
        return;
    }

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Начать обработку', callback_data: 'start_processing' },
                    { text: 'Проверить вес', callback_data: 'check_weight' },
                    { text: 'Отмена', callback_data: 'cancel_processing' }
                ]
            ]
        }
    };

    await bot.sendMessage(
        msg.chat.id,
        'Документ получен. Нажмите кнопку для начала обработки.',
        options
    );

    return {
        currentChatId: msg.chat.id,
        currentDocument: msg.document,
        documentMessage: msg
    };
}

async function processDocument(bot, chatId, document, documentMessage) {
    try {
        console.log('Starting analysis...');
        let collectedErrors = [];
        let collectedDeclarations = [];

        const waitMsg = await bot.sendMessage(chatId, 'Пожалуйста, подождите...', {
            reply_to_message_id: documentMessage.message_id
        });

        // Загрузка шаблонов
        const templates = await loadTemplates();
        let lastIter = 0;

        // Загрузка и обработка ZIP файла
        const paths = await downloadAndExtractZip(document.file_id, config.botToken);
        const declarations = await processExcelFiles(
            paths.extractFolderPath, 
            chatId,
            config.chatIdNames,
            collectedErrors,
            collectedDeclarations
        );

        if (!declarations || declarations.length === 0) {
            throw new Error('Не удалось обработать декларации');
        }

        // Обработка деклараций и создание Excel файлов
        for (let i = 0; i < declarations.length; i++) {
            let row = templates.main.getRow(i + 8);
            let itemsArray = declarations[i].items.map(item => `${item.itemName}: ${item.itemQuantity}`);

            // Настройка стиля основной таблицы
            row.font = { size: '15', bold: false };
            row.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true, wrapText: true };

            // Заполнение основной таблицы
            row.getCell(5).value = i + 1;
            row.getCell(6).value = declarations[i].declID || '';
            row.getCell(7).value = 'TezParcel';
            row.getCell(8).value = `${declarations[i].lastName || ''} ${declarations[i].firstName || ''}\n${declarations[i].address || ''}\n${declarations[i].pnfl || ''}`;
            row.getCell(9).value = itemsArray.join('\n');
            row.getCell(10).value = declarations[i].totalWeight || 0;
            row.getCell(11).value = declarations[i].totalPrice || 0;
            row.getCell(12).value = 'USD';
            row.commit();

            // Заполнение второй таблицы
            let row1 = templates.secondary.getRow(i + 4);
            row1.font = { size: '11', bold: false };
            row1.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true, wrapText: true };

            row1.getCell(1).value = getCurrentDate();
            row1.getCell(2).value = `${declarations[i].lastName || ''} ${declarations[i].firstName || ''}`;
            row1.getCell(3).value = declarations[i].phone || '';
            row1.getCell(4).value = declarations[i].address || '';
            row1.getCell(5).value = declarations[i].passport || '';
            row1.getCell(6).value = declarations[i].pnfl || '';
            row1.getCell(8).value = `${declarations[i].lastName || ''} ${declarations[i].firstName || ''}`;
            row1.getCell(9).value = declarations[i].phone || '';
            row1.getCell(10).value = declarations[i].address || '';
            row1.getCell(11).value = declarations[i].passport || '';
            row1.getCell(12).value = declarations[i].pnfl || '';
            row1.commit();

            if (i === declarations.length - 1) lastIter = i;
        }

        // Проверка дубликатов
        let duplicates = findDuplicatedDeclaration(collectedDeclarations);
        if (duplicates) {
            await bot.sendMessage(chatId, `Обнаружены дубликаты:\n${duplicates}`);
        }

        // Добавление итоговой строки
        const totalRow = templates.main.getRow(lastIter + 9);
        totalRow.getCell(9).font = { size: '18', bold: true };
        totalRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
        totalRow.getCell(9).value = 'Жами:';
        totalRow.getCell(10).value = { formula: `SUM(J8:J${lastIter + 8})` };
        totalRow.getCell(11).value = { formula: `SUM(K8:K${lastIter + 8})` };
        totalRow.getCell(12).value = 'USD';
        totalRow.commit();

        // Добавление подписей
        templates.main.mergeCells(`I${lastIter + 16}:L${lastIter + 16}`);
        templates.main.mergeCells(`I${lastIter + 13}:L${lastIter + 13}`);
        
        const signatureStyle = { size: '16', bold: true };
        const signatureAlignment = { vertical: 'middle', horizontal: 'left' };

        templates.main.getCell(`I${lastIter + 13}`).font = signatureStyle;
        templates.main.getCell(`I${lastIter + 13}`).alignment = signatureAlignment;
        templates.main.getCell(`I${lastIter + 13}`).value = 'Қабул қилувчи ташкилот номи, имзоси ва муҳри:';

        templates.main.getCell(`I${lastIter + 16}`).font = signatureStyle;
        templates.main.getCell(`I${lastIter + 16}`).alignment = signatureAlignment;
        templates.main.getCell(`I${lastIter + 16}`).value = 'Жўнатувчи ташкилот номи, имзоси ва муҳри:';

        // Сохранение и отправка файлов
        const currentDate = getCurrentDate();
        const fileName = config.chatIdNames[chatId] 
            ? `${config.chatIdNames[chatId]} ${currentDate}.xlsx`
            : `manifest_${currentDate}.xlsx`;

        const totalWeight = declarations.reduce((sum, decl) => sum + (parseFloat(decl.totalWeight) || 0), 0);
        const firstPackage = declarations[0]?.declID || 'undefined';
        const lastPackage = declarations[declarations.length - 1]?.declID || 'undefined';

        // Сохранение и отправка основного файла
        await templates.main.workbook.xlsx.writeFile(`${paths.extractFolderPath}/${fileName}`);
        await bot.sendDocument(
            chatId,
            fs.createReadStream(`${paths.extractFolderPath}/${fileName}`),
            {
                caption: `${firstPackage} - ${lastPackage}\nОбщий вес: ${totalWeight.toFixed(2)} кг\nКоличество посылок: ${declarations.length}`
            }
        );

        // Сохранение и отправка второго файла
        await templates.secondary.workbook.xlsx.writeFile(`${paths.extractFolderPath}/1${fileName}`);
        await bot.sendDocument(
            '-4044680201',
            fs.createReadStream(`${paths.extractFolderPath}/1${fileName}`)
        );

        // Очистка
        await cleanup(paths);
        await bot.deleteMessage(chatId, waitMsg.message_id);
        
        // Отправка отчета об ошибках
        const errorString = buildErrorsString(collectedErrors);
        if (errorString !== 'Ошибок не обнаружено') {
            await bot.sendMessage(chatId, errorString);
        }

        return { success: true };
    } catch (error) {
        console.error('Error in processDocument:', error);
        return { 
            success: false, 
            message: 'Произошла ошибка при обработке файла. Пожалуйста, попробуйте еще раз или обратитесь к администратору.'
        };
    }
}

module.exports = {
    handleDocument,
    processDocument
};
