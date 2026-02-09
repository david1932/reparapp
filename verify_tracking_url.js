const https = require('https');

const url = 'https://david1932.github.io/reparapp/tracking.html';

https.get(url, (res) => {
    console.log('Status Code:', res.statusCode);
    if (res.statusCode === 200) {
        console.log('URL is accessible!');
    } else {
        console.log('URL returned status:', res.statusCode);
    }
}).on('error', (e) => {
    console.error('Error checking URL:', e);
});
