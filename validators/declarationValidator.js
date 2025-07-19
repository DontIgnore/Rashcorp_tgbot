const config = require('../config');
const { 
  extractDateOfBirth, 
  checkBirthdate, 
  cleanString, 
  extractNumber,
  validatePnfl 
} = require('../utils');

/**
 * Сбор ошибок валидации
 */
const collectErrors = (error, sheet) => {
  // Используем глобальную переменную из основного файла
  if (global.collectedErrors) {
    global.collectedErrors.push({ error: error, declaration: sheet });
  }
};

/**
 * Трансформация и валидация объекта декларации
 */
const transformAndValidateDeclarationObject = (
  offsetObject,
  declaration,
  sheet
) => {
  let ifError = false;
  let object = {};

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
      collectErrors(`Имя не указано`, offsetObject.declID.w);
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
    if (pnflLength !== config.validation.pnflLength && pnflLength != undefined) {
      collectErrors(`ПНФЛ состоит не из ${config.validation.pnflLength} цифр`, offsetObject.declID.w);
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
      totalPrice: extractNumber(offsetObject.totalPrice.w),
      totalWeight: extractNumber(offsetObject.totalWeight.w),
      lastName: cleanString(offsetObject.lastName.w),
      firstName: cleanString(offsetObject.firstName.w),
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

  return object;
};

/**
 * Валидация элементов декларации
 */
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

/**
 * Инициализация глобальных переменных для сбора ошибок
 */
function initializeErrorCollection() {
  if (!global.collectedErrors) {
    global.collectedErrors = [];
  }
  if (!global.collectedDeclarations) {
    global.collectedDeclarations = [];
  }
}

/**
 * Очистка собранных ошибок
 */
function clearCollectedErrors() {
  if (global.collectedErrors) {
    global.collectedErrors = [];
  }
  if (global.collectedDeclarations) {
    global.collectedDeclarations = [];
  }
}

/**
 * Получение собранных ошибок
 */
function getCollectedErrors() {
  return global.collectedErrors || [];
}

/**
 * Получение собранных деклараций
 */
function getCollectedDeclarations() {
  return global.collectedDeclarations || [];
}

module.exports = {
  transformAndValidateDeclarationObject,
  validateDeclarationItems,
  initializeErrorCollection,
  clearCollectedErrors,
  getCollectedErrors,
  getCollectedDeclarations
}; 