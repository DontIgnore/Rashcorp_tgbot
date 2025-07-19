fetch("https://cargo.customs.uz/personDate/datedocv4", {
  "headers": {
    "accept": "*/*",
    "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-csrf-token": "SpSE_XyXa_NRdgMLCJYkkemAReHBrvMOCz1JDMwKs50v7dFpK629zR2jXcR8Q2c_PbsQqN22aID2n8AjaV59Pqk6g6wd3LIN",
    "x-requested-with": "XMLHttpRequest"
  },
  "referrer": "https://cargo.customs.uz/",
  "body": "document=30512604310052",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});



#### пример успешного ответа
{"result":1,"comments":null,"transaction_id":null,"engname":null,"birthcountry":null,"pinpps":"30512604310052","document":null,"birthcountryid":0,"livestatus":1,"birth_date":"1960-12-05","nationality":null,"nationalityid":0,"citizenship":"УЗБЕКИСТАН","citizenshipid":182,"sex":1,"dateEnd":null,"surnamelat":"MAMASADIKOV","surnamecyr":"МАМАСАДЫКОВ","current_document":"AE2663239","patronymlat":"MAMASALIYEVICH","patronymcyr":"МАМАСАЛИЕВИЧ","namelat":"SHUKRULLA","namecyr":"ШУКРУЛЛА","birthplace":null,"birthplaceid":null,"engsurname":null,"current_pinpp":"30512604310052","queryld":null,"address":null,"photo":null,"redDocument":"FB1147624"}