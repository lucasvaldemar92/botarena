const fs = require('fs');
const path = require('path');

const REPORT_FILE = path.join(__dirname, '..', 'qa-evidence', 'report_latest.html');
const content = fs.readFileSync(REPORT_FILE, 'utf8');

// Simple parser for details
const regex = /<span class="cat-name">(.*?)<\/span>\s*<span class="cat-score">(.*?)<\/span>[\s\S]*?<ul>([\s\S]*?)<\/ul>/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const score = match[2];
    const list = match[3].replace(/<[^>]*>/g, '').trim();
    if (score !== '100/100') {
        console.log(`\nCategory: ${name} (${score})`);
        console.log(list.split('\n').map(l => ' - ' + l.trim()).join('\n'));
    }
}
