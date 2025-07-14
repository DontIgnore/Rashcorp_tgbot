const fs = require('fs-extra');
const path = require('path');

const tmpDir = path.join(__dirname, 'tmp');
fs.ensureDirSync(tmpDir);
console.log('Temporary directory created:', tmpDir);
