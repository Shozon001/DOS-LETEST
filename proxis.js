const fs = require('fs');
const path = require('path');

const PROXY_FILE = path.join(__dirname, 'proxy.txt');

let proxies = [];
let lastLoad = 0;

function parseLine(line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return null;

    // Format: protocol://user:pass@host:port
    if (line.includes('://')) {
        return { url: line, raw: line };
    }

    // Format: host:port:user:pass
    const parts = line.split(':');
    if (parts.length === 4) {
        const [host, port, user, pass] = parts;
        return {
            url: `http://${user}:${pass}@${host}:${port}`,
            raw: line
        };
    }

    // Format: host:port
    if (parts.length === 2) {
        return {
            url: `http://${parts[0]}:${parts[1]}`,
            raw: line
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
        const parsed = lines.map(parseLine).filter(Boolean);

        // Remove duplicates
        const seen = new Set();
        proxies = parsed.filter(p => {
            if (seen.has(p.url)) return false;
            seen.add(p.url);
            return true;
        });

        lastLoad = Date.now();
        console.log(`[+] Loaded ${proxies.length} proxies from proxy.txt`);
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

// Auto reload every 60 seconds if file changes
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