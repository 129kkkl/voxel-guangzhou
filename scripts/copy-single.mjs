import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('dist-single/index.html');
const dst = path.resolve('体素广州-新中轴.html');
fs.copyFileSync(src, dst);
console.log(`single-file -> ${dst} (${fs.statSync(dst).size} bytes)`);
