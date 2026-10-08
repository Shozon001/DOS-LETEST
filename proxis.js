const fs = require('fs');
const path = require('path');

const PROXY_FILE = path.join(__dirname, 'proxy.txt');

let proxies = [];
let lastLoad = 0;

/**
 * Validate IPv4 address
 */
function isValidIP(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => {
        const n = Number(p);
        return Number.isInteger(n) && n >= 0 && n <= 255 && /^\d+$/.test(p);
    });
}

/**
 * Validate port
 */
function isValidPort(port) {
    const n = Number(port);
    return Number.isInteger(n) && n > 0 && n <= 65535;
}

/**
 * Parse one line into proxy object or null
 * Supported formats:
 *   ip:port
 *   ip:port:user:pass
 *   protocol://ip:port
 *   protocol://user:pass@ip:port
 */
function parseLine(line) {
    if (!line) return null;

    // Strip whitespace, HTML entities, tags
    line = line.trim();
    if (!line || line.startsWith('#')) return null;
    if (line.includes('<') || line.includes('&')) return null;

    // With protocol
    if (line.includes('://')) {
        const m = line.match(/^(socks4|socks5|http|https):\/\/(?:([^:@\s]+):([^@\s]+)@)?([\d.]+):(\d+)$/i);
        if (!m) return null;
        const [, proto, user, pass, host, port] = m;
        if (!isValidIP(host) || !isValidPort(port)) return null;
        return { url: line, raw: line, host, port, protocol: proto };
    }

    const parts = line.split(':');

    // ip:port:user:pass
    if (parts.length === 4) {
        const [host, port, user, pass] = parts;
        if (!isValidIP(host) || !isValidPort(port)) return null;
        return {
            url: `http://${user}:${pass}@${host}:${port}`,
            raw: line, host, port, protocol: 'http', user, pass
        };
    }

    // ip:port
    if (parts.length === 2) {
        const [host, port] = parts;
        if (!isValidIP(host) || !isValidPort(port)) return null;
        return {
            url: `http://${host}:${port}`,
            raw: line, host, port, protocol: 'http'
        };
    }

    return null;
}

function loadProxies() {
    try {
        if (!fs.existsSync(PROXY_FILE)) {
            console.log('[!] proxy.txt not found. Running without proxies.');
            proxies = [];
            return;
        }

        const content = fs.readFileSync(PROXY_FILE, 'utf8');
        const lines = content.split(/\r?\n/);

        const seen = new Set();
        const parsed = [];

        let valid = 0;
        let skipped = 0;

        for (const line of lines) {
            const p = parseLine(line);
            if (p) {
                if (seen.has(p.url)) {
                    skipped++;
                    continue;
                }
                seen.add(p.url);
                parsed.push(p);
                valid++;
            } else {
                skipped++;
            }
        }

        proxies = parsed;
        lastLoad = Date.now();

        console.log(`[+] proxy.txt loaded`);
        console.log(`    ✔ Valid unique proxies  : ${valid}`);
        console.log(`    ✘ Skipped invalid lines: ${skipped}`);

        // Protocol summary
        const summary = {};
        for (const p of proxies) summary[p.protocol] = (summary[p.protocol] || 0) + 1;
        console.log(`    Protocol breakdown:`);
        for (const [k, v] of Object.entries(summary)) {
            console.log(`      - ${k}: ${v}`);
        }

    } catch (err) {
        console.log('[!] Error loading proxies:', err.message);
        proxies = [];
    }
}

function getRandomProxy() {
    if (proxies.length === 0) return null;
    return proxies[Math.floor(Math.random() * proxies.length)];
}

function getProxyCount() {
    return proxies.length;
}

function getProxies() {
    return proxies;
}

function watchProxies() {
    setInterval(() => {
        try {
            const stat = fs.statSync(PROXY_FILE);
            if (stat.mtimeMs > lastLoad) {
                console.log('[+] proxy.txt changed. Reloading...');
                loadProxies();
            }
        } catch (e) {}
    }, 60000);
}

// Initial load
loadProxies();
watchProxies();

module.exports = {
    getRandomProxy,
    getProxyCount,
    getProxies,
    loadProxies
};
