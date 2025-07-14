function getCurrentDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${day}.${month}.${year}`;
}

function extractDateOfBirth(pnfl) {
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

    if (parsedDate.getDate() != parseInt(day) ||
        parsedDate.getMonth() + 1 != parseInt(month) ||
        parsedDate.getFullYear() != parseInt(year)) {
        return false;
    }

    return true;
}

module.exports = {
    getCurrentDate,
    extractDateOfBirth,
    checkBirthdate
};
