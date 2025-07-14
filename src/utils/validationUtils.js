function collectErrors(error, sheet, errorsArray) {
    errorsArray.push({ error: error, declaration: sheet });
}

function findDuplicatedDeclaration(declarations) {
    const duplicates = declarations.reduce((acc, { declID, sheet }) => {
        acc[declID] ? acc[declID].push(sheet) : (acc[declID] = [sheet]);
        return acc;
    }, {});

    const duplicatesWithMultipleSheets = Object.entries(duplicates)
        .filter(([, sheets]) => sheets.length > 1);
    
    if (duplicatesWithMultipleSheets.length === 0) return;

    return duplicatesWithMultipleSheets
        .map(([declID, sheets]) => `${declID}: ${sheets.join(", ")}\n`)
        .join("");
}

function buildErrorsString(errors) {
    let errorString = "";

    for (const error of errors) {
        errorString += `${error.declaration}: ${error.error}\n`;
    }

    if (errorString.length >= 4096) {
        errorString = errorString.substring(0, 4096);
    }

    return errorString.length > 0 ? errorString : "Ошибок не обнаружено";
}

module.exports = {
    collectErrors,
    findDuplicatedDeclaration,
    buildErrorsString
};
