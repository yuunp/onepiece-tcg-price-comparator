const fs = require('fs');

async function main() {
    const API_KEY = 'd9ae58b0d53de2809c283d035321f3c9';
    const url = encodeURIComponent('https://www.ligaonepiece.com.br/?view=cards%2Fsearch&card=luffy&tipo=1');
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${API_KEY}&url=${url}&render=true&country_code=br&premium=true`;

    try {
        const res = await fetch(scraperApiUrl);
        const html = await res.text();

        fs.writeFileSync('liga_res.html', html);
        console.log('Saved to liga_res.html, length: ' + html.length);

        // Look for pagination
        const exibirMatches = html.match(/exibir[\w-]+[^>]*/gi) || [];
        console.log('exibir matches:', exibirMatches.slice(0, 5));

        // Look for page URLs
        const pageMatches = html.match(/href="[^"]*page=[^"]*"/gi) || html.match(/href="[^"]*p=[^"]*"/gi) || [];
        console.log('page URL matches:', pageMatches.slice(0, 5));

        // And page JS functions
        const funcMatches = html.match(/onClick="[^"]*pagin[^"]*"/gi) || html.match(/onclick="[^"]*load[^"]*"/gi) || [];
        console.log('onClick pagination:', funcMatches.slice(0, 5));

    } catch (e) {
        console.error(e);
    }
}
main();
