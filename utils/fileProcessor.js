const xlsx = require("xlsx");
const fs = require("fs-extra");
const AdmZip = require("adm-zip");
const axios = require("axios");
const config = require('../config');
const { logToFile } = require('./logger');

/**
 * Парсинг XML и извлечение PNFL
 */
function parseXMLForPNFL(xmlContent) {
  const xml2js = require('xml2js');
  const parser = new xml2js.Parser();
  
  return new Promise((resolve, reject) => {
    parser.parseString(xmlContent, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      
      const declarations = [];
      
      if (result.main_data && result.main_data.Declaration) {
        const decls = Array.isArray(result.main_data.Declaration) 
          ? result.main_data.Declaration 
          : [result.main_data.Declaration];
          
        for (const decl of decls) {
          if (decl.pnfl && decl.pnfl[0] && decl.ident_num && decl.ident_num[0]) {
            declarations.push({
              pnfl: decl.pnfl[0],
              ident_num: decl.ident_num[0]
            });
          }
        }
      }
      
      resolve(declarations);
    });
  });
}

/**
 * Скачивание файла из Telegram
 */
async function downloadTelegramFile(fileId, botToken) {
  // Получаем информацию о файле через Telegram API
  const fileDataResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = fileDataResponse.data.result;
  
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.file_path}`;
  
  const response = await axios({
    method: 'GET',
    url: fileUrl,
    responseType: 'text'
  });
  
  return response.data;
}

/**
 * Скачивание ZIP файла из Telegram
 */
async function downloadZipFile(fileId, botToken, fileName) {
  // Получаем информацию о файле через Telegram API
  const fileDataResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = fileDataResponse.data.result;
  const zipFileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.file_path}`;

  const response = await axios({
    method: "GET",
    url: zipFileUrl,
    responseType: "stream",
  });

  const tempFolderPath = config.files.tempDir;

  if (!fs.existsSync(tempFolderPath)) {
    fs.mkdirSync(tempFolderPath);
  }

  const zipFilePath = `${tempFolderPath}/${fileName}`;
  const writer = fs.createWriteStream(zipFilePath);
  response.data.pipe(writer);

  // Ждем завершения записи файла
  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return zipFilePath;
}

/**
 * Распаковка ZIP файла
 */
async function extractZipFile(zipFilePath, fileId) {
  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();

  const extractFolderPath = `${config.files.tempDir}/extracted_${fileId}`;

  if (!fs.existsSync(extractFolderPath)) {
    fs.mkdirSync(extractFolderPath);
  }

  let extractedFilesCount = 0;

  for (const entry of zipEntries) {
    if (!entry.isDirectory) {
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

  return { extractFolderPath, extractedFilesCount };
}

/**
 * Получение Excel файлов из папки
 */
function getExcelFiles(folderPath) {
  return fs
    .readdirSync(folderPath)
    .filter((name) => name.slice(-3) === "xls");
}

/**
 * Чтение Excel файла
 */
function readExcelFile(filePath) {
  const workbook = xlsx.readFile(filePath);
  if (workbook.Sheets["Sheet1"] != undefined) {
    return [workbook.Sheets["Sheet1"]];
  } else {
    throw new Error(`Не удалось найти лист "Sheet1" в файле ${filePath}`);
  }
}

/**
 * Извлечение PNFL из Excel файлов в ZIP
 */
function extractPnflFromZip(zipEntries) {
  const excelFiles = zipEntries
    .filter((entry) => entry.entryName.match(/\.(xls|xlsx)$/i))
    .map((entry) => ({
      name: entry.entryName,
      content: entry.getData(),
    }));

  const allPNFLs = [];
  
  for (const file of excelFiles) {
    try {
      const workbook = xlsx.read(file.content, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // PNFL находится в ячейке E12
      const pnflCell = worksheet['E12'];
      // ident_num находится в ячейке A1 (предполагаем)
      const identCell = worksheet['A1'];
      
      if (pnflCell && pnflCell.v) {
        const pnflValue = pnflCell.v.toString().trim();
        // Проверяем, что это похоже на PNFL (14 цифр)
        if (/^\d{14}$/.test(pnflValue)) {
          const identNum = identCell && identCell.v ? identCell.v.toString().trim() : file.name;
          
          allPNFLs.push({
            pnfl: pnflValue,
            ident_num: identNum,
            fileName: file.name
          });
        }
      }
    } catch (error) {
      logToFile(`Ошибка обработки файла ${file.name}: ${error.message}`, "error");
    }
  }

  return allPNFLs;
}

/**
 * Очистка временных файлов
 */
async function cleanupTempFiles(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await fs.remove(filePath);
    }
  } catch (error) {
    logToFile(`Ошибка при очистке файла ${filePath}: ${error.message}`, "error");
  }
}

module.exports = {
  parseXMLForPNFL,
  downloadTelegramFile,
  downloadZipFile,
  extractZipFile,
  getExcelFiles,
  readExcelFile,
  extractPnflFromZip,
  cleanupTempFiles
}; 