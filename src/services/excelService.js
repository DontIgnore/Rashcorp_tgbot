const ExcelJS = require('exceljs');
const { collectErrors } = require('../utils/validationUtils');

async function transformAndValidateDeclarationObject(offsetObject, declaration, sheet, errorsArray) {
    let ifError = false;
    let object = {};

    // Получаем значение, независимо от того, где оно находится (w или v)
    const getValue = (obj) => {
        if (!obj) return '';
        return obj.w || obj.v || '';
    };

    if (!offsetObject.declID || !getValue(offsetObject.declID)) {
        collectErrors(`Номер декларации не указан`, sheet, errorsArray);
        ifError = true;
    } else {
        if (!offsetObject.totalPrice || !getValue(offsetObject.totalPrice) || getValue(offsetObject.totalPrice) == 0) {
            collectErrors(`Сумма не указана`, getValue(offsetObject.declID), errorsArray);
            ifError = true;
        }
        if (!offsetObject.totalWeight || !getValue(offsetObject.totalWeight) || getValue(offsetObject.totalWeight) == 0) {
            collectErrors(`Вес не указан`, getValue(offsetObject.declID), errorsArray);
            ifError = true;
        }
        if (!offsetObject.lastName || !getValue(offsetObject.lastName)) {
            collectErrors(`Фамилия не указана`, getValue(offsetObject.declID), errorsArray);
            ifError = true;
        }
        if (!offsetObject.firstName || !getValue(offsetObject.firstName)) {
            collectErrors(`Имя не указано`, getValue(offsetObject.declID), errorsArray);
            ifError = true;
        }
        if (!offsetObject.passport || !getValue(offsetObject.passport)) {
            collectErrors(`Паспорт не указан`, getValue(offsetObject.declID), errorsArray);
            ifError = true;
        }
        if (!offsetObject.pnfl || !getValue(offsetObject.pnfl)) {
            collectErrors(`ПНФЛ не указан`, getValue(offsetObject.declID), errorsArray);
            ifError = true;
        }
        const pnfl = getValue(offsetObject.pnfl).replace(/\D/g, "").trim();
        if (pnfl.length !== 14) {
            collectErrors(`ПНФЛ состоит не из 14 цифр`, getValue(offsetObject.declID), errorsArray);
            ifError = true;
        }
        if (!offsetObject.address || !getValue(offsetObject.address)) {
            collectErrors(`Адрес не указан`, getValue(offsetObject.declID), errorsArray);
            ifError = true;
        }
    }

    if (!ifError) {
        object = {
            declID: getValue(offsetObject.declID).toString().trim(),
            totalPrice: parseFloat(getValue(offsetObject.totalPrice)),
            totalWeight: parseFloat(getValue(offsetObject.totalWeight)),
            lastName: getValue(offsetObject.lastName).toString().trim(),
            firstName: getValue(offsetObject.firstName).toString().trim(),
            passport: getValue(offsetObject.passport).toString().trim(),
            pnfl: getValue(offsetObject.pnfl).toString().replace(/\D/g, "").trim(),
            address: getValue(offsetObject.address).toString().trim(),
            phone: getValue(offsetObject.phone) 
                ? getValue(offsetObject.phone).toString().replace(/\D/g, "").length < 8
                    ? "946136755"
                    : getValue(offsetObject.phone).toString().replace(/\D/g, "").slice(-9)
                : "946136755"
        };
    }
    return object;
}

async function validateDeclarationItems(start, end, declaration, sheet, errorsArray) {
    let itemArray = [];
    for (let i = start; i <= end; i++) {
        const itemExists = declaration[`G${i}`];
        const quantityExists = declaration[`I${i}`];
        const costExists = declaration[`J${i}`];

        // Получаем значение, независимо от того, где оно находится (w или v)
        const getValue = (cell) => {
            if (!cell) return '';
            return cell.w || cell.v || '';
        };

        if (i == start && (!itemExists || !getValue(itemExists))) {
            collectErrors(`1-ая ячейка товаров пустая`, getValue(declaration["A1"]) || sheet, errorsArray);
            break;
        }

        if (!itemExists || !getValue(itemExists) || getValue(itemExists).toString().replace(/\s/g, "") === "0") {
            if (quantityExists && getValue(quantityExists)) {
                collectErrors(
                    `Количество указано, но нет названия`,
                    getValue(declaration["A1"]) || sheet,
                    errorsArray
                );
            }
            if (costExists && getValue(costExists)) {
                collectErrors(
                    `Цена указана, но нет названия`,
                    getValue(declaration["A1"]) || sheet,
                    errorsArray
                );
            }
            continue;
        }

        if (!quantityExists || !getValue(quantityExists) || getValue(quantityExists) === "0") {
            if (itemExists && getValue(itemExists) && getValue(itemExists).toString().replaceAll(" ", "").length !== 0) {
                collectErrors(
                    `Название указано, но нет количества`,
                    getValue(declaration["A1"]) || sheet,
                    errorsArray
                );
            }
            if (costExists && getValue(costExists)) {
                collectErrors(
                    `Цена указана, но нет количества`,
                    getValue(declaration["A1"]) || sheet,
                    errorsArray
                );
            }
            continue;
        }

        if (!costExists || !getValue(costExists) || parseFloat(getValue(costExists)) === 0) {
            if (itemExists && getValue(itemExists) && getValue(itemExists).toString().replaceAll(" ", "").length !== 0) {
                collectErrors(
                    `Название указано, но нет цены`,
                    getValue(declaration["A1"]) || sheet,
                    errorsArray
                );
            }
            if (quantityExists && getValue(quantityExists)) {
                collectErrors(
                    `Количество указано, но нет цены`,
                    getValue(declaration["A1"]) || sheet,
                    errorsArray
                );
            }
            continue;
        }

        const itemName = getValue(itemExists).toString().trim();
        const itemQuantity = Math.round(
            parseFloat(
                getValue(quantityExists)
                    .toString()
                    .trim()
                    .replace(",", ".")
                    .replace(/[^0-9.]/g, "")
            )
        );
        const itemCost = parseFloat(
            getValue(costExists)
                .toString()
                .trim()
                .replace(",", ".")
                .replace(/[^0-9.]/g, "")
        );

        if (itemName && itemQuantity && itemCost) {
            itemArray.push({
                itemName,
                itemQuantity,
                itemCost
            });
        }
    }

    return itemArray;
}

async function loadTemplates() {
    const config = require('../config/config');
    
    const workbookEJS = new ExcelJS.Workbook();
    const mainTemplate = await workbookEJS.xlsx.readFile(config.templateFiles.main);
    
    const workbookEJS1 = new ExcelJS.Workbook();
    const secondaryTemplate = await workbookEJS1.xlsx.readFile(config.templateFiles.secondary);
    
    return {
        main: mainTemplate.getWorksheet(1),
        secondary: secondaryTemplate.getWorksheet(1)
    };
}

module.exports = {
    transformAndValidateDeclarationObject,
    validateDeclarationItems,
    loadTemplates
};
