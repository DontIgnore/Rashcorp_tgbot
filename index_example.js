// fs = require('fs');
// var parser = require('xml2json');
// var XLSX = require('xlsx');
// var Excel = require('exceljs');
// var workbook = new Excel.Workbook();

// let json;

// let arr = [];

// fs.readFile('./cn22-cn23.xml', function (err, data) {
// 	json = JSON.parse(parser.toJson(data));

// 	let decl_id;
// 	let name;
// 	let cost;
// 	let brutto;
// 	let address;
// 	let co_inn;

// 	let items;

// 	let pnfl;

// 	let item_name;
// 	let item_quantity;
// 	let item_netto;
// 	let item_cost;

// 	let country;
// 	let country_name;
// 	let company;
// 	let company_template;

// 	let allItems;

// 	for (let i = 0; i < json.main_data.Declaration.length; i++) {
// 		const element = json.main_data.Declaration[i];

// 		country = element.sending_country;

// 		decl_id = element.ident_num;
// 		name = element.last_name + ' ' + element.first_name;
// 		cost = +element.total_cost;
// 		brutto = +element.brutto;
// 		address = element.address;
// 		co_inn = element.company_inn;

// 		items = element.ConsignmentItem;

// 		pnfl = element.pnfl;

// 		console.log(decl_id);

// 		strItem = [];
// 		allItems = [];

// 		iLength = items.length ? items.length : 1;

// 		for (let ii = 0; ii < iLength; ii++) {
// 			let element;
// 			if (iLength > 1) {
// 				element = items[ii];
// 			} else {
// 				element = items;
// 			}

// 			item_name = element.name;
// 			item_quantity = element.quantity;

// 			strItem.push(item_name + ': ' + item_quantity);
// 			// allItems = item_name + ": " + item_quantity;
// 		}
// 		switch (co_inn) {
// 			case "305564687":
// 				company = 'DPC EXPRES';
// 				break;
// 			case "303360698":
// 				company = 'TEZ PARCEL';
// 				break;
// 			default:
// 				break;
// 		}
// 		allItems = strItem.join('\n');
// 		arr.push({
// 			iteral: i + 1,
// 			id: decl_id,
// 			sender: company,
// 			name: name + '\n ' + address + '\n' + pnfl,
// 			brutto: brutto,
// 			cost: cost,
// 			items: allItems,
// 		});

// 		allItems = i + 1;
// 	}

// 	switch (co_inn) {
// 		case "305564687":
// 			company_template = './newtamplate_TK.xlsx';
// 			break;
// 		case "303360698":
// 			company_template = './newtamplate.xlsx';
// 			break;
// 		default:
// 			break;
// 	}

// 	workbook.xlsx.readFile(company_template).then(function () {
// 		var worksheet = workbook.getWorksheet(1);
// 		var lastIter;
// 		for (let i = 0; i < arr.length; i++) {
// 			var row = worksheet.getRow(i + 8);

// 			row.getCell(5).style.border = {
// 				top: { style: 'thin', color: { argb: '00000000' } },
// 				left: { style: 'thin', color: { argb: '00000000' } },
// 				bottom: { style: 'thin', color: { argb: '00000000' } },
// 				right: { style: 'thin', color: { argb: '00000000' } },
// 			};
// 			row.getCell(6).style.border = {
// 				top: { style: 'thin', color: { argb: '00000000' } },
// 				left: { style: 'thin', color: { argb: '00000000' } },
// 				bottom: { style: 'thin', color: { argb: '00000000' } },
// 				right: { style: 'thin', color: { argb: '00000000' } },
// 			};
// 			row.getCell(7).style.border = {
// 				top: { style: 'thin', color: { argb: '00000000' } },
// 				left: { style: 'thin', color: { argb: '00000000' } },
// 				bottom: { style: 'thin', color: { argb: '00000000' } },
// 				right: { style: 'thin', color: { argb: '00000000' } },
// 			};
// 			row.getCell(8).style.border = {
// 				top: { style: 'thin', color: { argb: '00000000' } },
// 				left: { style: 'thin', color: { argb: '00000000' } },
// 				bottom: { style: 'thin', color: { argb: '00000000' } },
// 				right: { style: 'thin', color: { argb: '00000000' } },
// 			};
// 			row.getCell(9).style.border = {
// 				top: { style: 'thin', color: { argb: '00000000' } },
// 				left: { style: 'thin', color: { argb: '00000000' } },
// 				bottom: { style: 'thin', color: { argb: '00000000' } },
// 				right: { style: 'thin', color: { argb: '00000000' } },
// 			};
// 			row.getCell(10).style.border = {
// 				top: { style: 'thin', color: { argb: '00000000' } },
// 				left: { style: 'thin', color: { argb: '00000000' } },
// 				bottom: { style: 'thin', color: { argb: '00000000' } },
// 				right: { style: 'thin', color: { argb: '00000000' } },
// 			};
// 			row.getCell(11).style.border = {
// 				top: { style: 'thin', color: { argb: '00000000' } },
// 				left: { style: 'thin', color: { argb: '00000000' } },
// 				bottom: { style: 'thin', color: { argb: '00000000' } },
// 				right: { style: 'thin', color: { argb: '00000000' } },
// 			};
// 			row.getCell(12).style.border = {
// 				top: { style: 'thin', color: { argb: '00000000' } },
// 				left: { style: 'thin', color: { argb: '00000000' } },
// 				bottom: { style: 'thin', color: { argb: '00000000' } },
// 				right: { style: 'thin', color: { argb: '00000000' } },
// 			};

// 			// if(arr[i].items.length == 0) {
// 			// console.log(arr[i])
// 			// }

// 			row.getCell(5).value = arr[i].iteral;
// 			row.getCell(6).value = arr[i].id;
// 			row.getCell(7).value = arr[i].sender;
// 			row.getCell(8).value = arr[i].name;
// 			row.getCell(9).value = arr[i].items;
// 			row.getCell(10).value = arr[i].brutto;
// 			row.getCell(11).value = arr[i].cost;
// 			row.getCell(12).value = 'USD';

// 			row.commit();
// 			lastIter = i;
// 		}

// 		var row = worksheet.getRow(lastIter + 9);

// 		var secondRow = worksheet.getRow(lastIter + 13);

// 		row.height = 45;

// 		row.getCell(9).font = { size: '18', bold: true };
// 		row.getCell(9).alignment = { vertical: 'center', horizontal: 'right' };
// 		row.getCell(9).value = 'Жами:';
// 		row.getCell(10).value = { formula: 'SUM(J8:J' + (lastIter + 8) + ')' };
// 		row.getCell(11).value = { formula: 'SUM(K8:K' + (lastIter + 8) + ')' };
// 		row.getCell(12).value = 'USD';
// 		row.commit();

// 		let date_ob = new Date();
// 		let date = ('0' + date_ob.getDate()).slice(-2);
// 		let month = ('0' + (date_ob.getMonth() + 1)).slice(-2);
// 		let year = date_ob.getFullYear();

// 		let fullDate = date + '.' + month + '.' + year;

// 		switch (country) {
// 			case '752':
// 				country_name = 'Швед';
// 				break;
// 			case '826':
// 				country_name = 'Лондон';
// 				break;
// 			case '276':
// 				country_name = 'Германия';
// 				break;
// 			case '840':
// 				country_name = 'Америка';
// 				break;
// 			case '792':
// 				country_name = 'Турция TP';
// 				break;

// 			default:
// 				break;
// 		}

// 		if(country == "792" && co_inn == "305564687") country_name = "Турция DPC"

// 		return workbook.xlsx.writeFile(country_name + ' ' + fullDate + ' ' + allItems + 'шт.xlsx');
// 	});
// });
const exportFunction = async (config) => {

	fs = require('fs').promises;
	var xml2js = require('xml2js');
	var Excel = require('exceljs');
	var workbook = new Excel.Workbook();
	var workbook1 = new Excel.Workbook();
	const parser = new xml2js.Parser({ explicitArray: false });
	let json;
	let fileName;
	let arr = [];

	let data = await fs.readFile('./cn22-cn23.xml');

	parser.parseString(data, function (err, result) {
		json = result;
	});

	let fulldate;
	let decl_id;
	let name;
	let cost;
	let brutto;
	let address;
	let co_inn;

	let items;

	let pnfl;

	let item_name;
	let item_quantity;
	let item_netto;
	let item_cost;

	let country;
	let country_name;
	let company;
	let company_template;

	let allItems;

	for (let i = 0; i < json.main_data.Declaration.length; i++) {
		const element = json.main_data.Declaration[i];

		country = element.sending_country;

		fulldate = element.ident_data;
		decl_id = element.ident_num;
		name = element.last_name + ' ' + element.first_name;
		cost = +element.total_cost;
		brutto = +element.brutto;
		address = element.address;
		passport = element.pass_ser + element.pass_num;
		phone = element.phone;
		co_inn = element.company_inn;

		items = element.ConsignmentItem;

		pnfl = element.pnfl;

		strItem = [];
		allItems = [];
		console.log(decl_id);
		iLength = items.length ? items.length : 1;

		for (let ii = 0; ii < iLength; ii++) {
			let element;
			if (iLength > 1) {
				element = items[ii];
			} else {
				element = items;
			}
			item_name = element.name;
			item_quantity = element.quantity;
			strItem.push(item_name + ': ' + item_quantity);
			// allItems = item_name + ": " + item_quantity;
		}
		switch (co_inn) {
			case '305564687':
				company = 'DPC EXPRES';
				break;
			case '303360698':
				company = 'TEZ PARCEL';
				break;
			default:
				break;
		}
		allItems = strItem.join('\n');
		arr.push({
			iteral: i + 1,
			id: decl_id,
			fulldate: fulldate,
			sender: company,
			passport: passport,
			fullname: name,
			address: address,
			name: name + '\n ' + address + '\n' + pnfl,
			pnfl: pnfl,
			brutto: brutto,
			cost: cost,
			phone: phone,
			items: allItems,
		});

		allItems = i + 1;
	}

	switch (co_inn) {
		case '305564687':
			company_template = './newtamplate_TK.xlsx';
			break;
		case '303360698':
			company_template = './newtamplate.xlsx';
			break;
		default:
			break;
	}


	workbook1 = await workbook1.xlsx.readFile('./newtamplate_some.xlsx');
	const worksheet1 = workbook1.getWorksheet(1);

	workbook = await workbook.xlsx.readFile(company_template);
	const worksheet = workbook.getWorksheet(1);

	let lastIter;
	for (let i = 0; i < arr.length; i++) {
		let row = worksheet.getRow(i + 8);

		// row.style.border = {
		// 	top: { style: 'thin', color: { argb: '00000000' } },
		// 	left: { style: 'thin', color: { argb: '00000000' } },
		// 	bottom: { style: 'thin', color: { argb: '00000000' } },
		// 	right: { style: 'thin', color: { argb: '00000000' } },
		// };

		row.font = { size: '15', bold: false };
		row.commit();
		row.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true, wrapText: true };
		row.commit();

		row.getCell(5).value = arr[i].iteral;
		row.getCell(6).value = arr[i].id;
		row.getCell(7).value = arr[i].sender;
		row.getCell(8).value = arr[i].name;
		row.getCell(9).value = arr[i].items;
		row.getCell(10).value = arr[i].brutto;
		row.getCell(11).value = arr[i].cost;
		row.getCell(12).value = 'USD';
		row.commit();

		let row1 = worksheet1.getRow(i + 4);
		row1.font = { size: '11', bold: false };
		row1.commit();
		row1.alignment = { vertical: 'middle', horizontal: 'center', shrinkToFit: true, wrapText: true };
		row1.commit();

		row1.getCell(1).value = arr[i].fulldate;
		row1.getCell(2).value = arr[i].fullname;
		row1.getCell(3).value = arr[i].phone;
		row1.getCell(4).value = arr[i].address;
		row1.getCell(5).value = arr[i].passport;
		row1.getCell(6).value = arr[i].pnfl;
		row1.getCell(8).value = arr[i].fullname;
		row1.getCell(9).value = arr[i].phone;
		row1.getCell(10).value = arr[i].address;
		row1.getCell(11).value = arr[i].passport;
		row1.getCell(12).value = arr[i].pnfl;

		if (arr.length - 1 == i) lastIter = i;
	}

	const row = worksheet.getRow(lastIter + 9);

	row.getCell(9).font = { size: '18', bold: true };
	row.commit();
	row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
	row.commit();
	row.getCell(9).value = 'Жами:';
	row.getCell(10).value = { formula: 'SUM(J8:J' + (lastIter + 8) + ')' };
	row.getCell(11).value = { formula: 'SUM(K8:K' + (lastIter + 8) + ')' };
	row.getCell(12).value = 'USD';
	row.commit();

	worksheet.mergeCells(`I${lastIter + 16}:L${lastIter + 16}`);
	worksheet.mergeCells(`I${lastIter + 13}:L${lastIter + 13}`);


	worksheet.getCell(`I${lastIter + 13}`).font = { size: '16', bold: true };
	worksheet.getCell(`I${lastIter + 13}`).alignment = { vertical: 'middle', horizontal: 'left' };
	worksheet.getCell(`I${lastIter + 16}`).font = { size: '16', bold: true };
	worksheet.getCell(`I${lastIter + 16}`).alignment = { vertical: 'middle', horizontal: 'left' };

	worksheet.getCell(`I${lastIter + 13}`).value = 'Қабул қилувчи ташкилот номи, имзоси ва муҳри:';
	worksheet.getCell(`I${lastIter + 16}`).value = 'Жўнатувчи ташкилот номи, имзоси ва муҳри:';
	// secondRow.commit();

	let date_ob = new Date();
	let date = ('0' + date_ob.getDate()).slice(-2);
	let month = ('0' + (date_ob.getMonth() + 1)).slice(-2);
	let year = date_ob.getFullYear();

	let fullDate = date + '.' + month + '.' + year;

	switch (country) {
		case '752':
			country_name = 'Швед';
			break;
		case '826':
			country_name = 'Лондон';
			break;
		case '276':
			country_name = 'Германия';
			break;
		case '840':
			country_name = 'Америка';
			break;
		case '792':
			country_name = 'Турция TP';
			break;

		default:
			break;
	}

	if (country == '792' && co_inn == '305564687') country_name = 'Турция DPC';
	fileName = `${country_name} ${fullDate} ${allItems}шт.xlsx`;
	workbook.xlsx.writeFile(fileName);
	workbook1.xlsx.writeFile("./rc/RC" + fileName);

	return fileName;
};

exportFunction()
