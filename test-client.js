const http = require('http');
const fs = require('fs');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users',
    method: 'GET',
    headers: {}
};

const log = (msg) => {
    fs.appendFileSync('result.txt', msg + '\n');
};

const req = http.request(options, (res) => {
    log(`STATUS: ${res.statusCode}`);
    log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        log('No more data in response.');
    });
});

req.on('error', (e) => {
    log(`problem with request: ${e.message}`);
});

req.end();
