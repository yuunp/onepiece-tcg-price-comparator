const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('liga_res.html', 'utf8');
const $ = cheerio.load(html);

const btn = $('.exibir-mais');
console.log('Button:');
console.log(btn.parent().html());

const btn2 = $('#btn-mais-resultados');
console.log('Button2:');
console.log(btn2.parent().html());

// Let's also look for mcards
const scriptMatches = html.match(/mcards\.[a-zA-Z0-9_]+/g);
if (scriptMatches) {
    console.log('mcards matches:', [...new Set(scriptMatches)]);
}
