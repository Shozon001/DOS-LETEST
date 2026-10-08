const socket = io();
const $ = (id) => document.getElementById(id);

let currentStatus = null;
let prevRequests = 0;
let prevReqTime = Date.now();

function fmtTime(sec) {
    if (sec < 60) return sec + 's';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
}

function fmtNumber(n) {
    return n.toLocaleString('en-US');
}

function log(msg, color = '#7d8590') {
    const el = document.createElement('div');
    el.style.color = color;
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    el.textContent = `[${t}] ${msg}`;
    const logBox = $('log');
    logBox.prepend(el);
    if (logBox.children.length > 150) logBox.removeChild(logBox.lastChild);
}

function render(s) {
    if (!s) return;

    // ---- Status Pill ----
    const pill = $('statusPill');
    if (s.running) {
        pill.classList.add('running');
        $('statusText').textContent = 'Active';
        $('runVal').textContent = 'Running';
        $('runVal').className = 'stat-value green';
    } else {
        pill.classList.remove('running');
        $('statusText').textContent = 'Offline';
        $('runVal').textContent = 'Stopped';
        $('runVal').className = 'stat-value red';
    }

    // ---- Hero ----
    $('targetUrl').textContent = s.url || '—';
    $('cycleVal').textContent = s.cycleDuration || 60;

    // ---- Stats ----
    $('uptimeVal').textContent = fmtTime(s.uptimeSec || 0);
    $('reqVal').textContent = fmtNumber(s.requestsSent || 0);
    $('errVal').textContent = fmtNumber(s.errors || 0);
    $('restartVal').textContent = s.restarts || 0;

    // ---- Proxy Info ----
    $('proxyCountVal').textContent = s.proxyCount || 0;

    const proxyStatus = $('proxyStatusVal');
    if (proxyStatus) {
        if (s.proxyEnabled) {
            if (s.proxyCount > 0) {
                proxyStatus.textContent = 'Active';
                proxyStatus.className = 'stat-value green';
            } else {
                proxyStatus.textContent = 'No Proxy';
                proxyStatus.className = 'stat-value red';
            }
        } else {
            proxyStatus.textContent = 'Disabled';
            proxyStatus.className = 'stat-value';
        }
    }

    // ---- RPS Calculation ----
    const now = Date.now();
    const deltaTime = (now - prevReqTime) / 1000;
    const deltaReq = (s.requestsSent || 0) - prevRequests;
    if (deltaTime > 0.5) {
        const rps = (deltaReq / deltaTime).toFixed(1);
        $('rpsVal').textContent = rps;
        prevRequests = s.requestsSent || 0;
        prevReqTime = now;
    }
}

// Live uptime ticker (every second)
setInterval(() => {
    if (currentStatus && currentStatus.running && currentStatus.startedAt) {
        const uptime = Math.floor((Date.now() - currentStatus.startedAt) / 1000);
        $('uptimeVal').textContent = fmtTime(uptime);
    }
}, 1000);

// ---- Socket Events ----
socket.on('status', (s) => {
    const prev = currentStatus;
    currentStatus = s;
    render(s);

    // First connection
    if (!prev) {
        log(`Connected. Target: ${s.url}`, '#00d4ff');
        if (s.running) log('Monitor is live.', '#10b981');
        if (s.proxyEnabled) {
            log(`Proxy mode enabled. Loaded: ${s.proxyCount} proxies`, '#7c3aed');
        } else {
            log('Proxy mode disabled.', '#7d8590');
        }
        return;
    }

    // Status change
    if (prev.running !== s.running) {
        log(
            s.running ? `Monitor started → ${s.url}` : 'Monitor stopped',
            s.running ? '#10b981' : '#ef4444'
        );
    }

    // Cycle restart
    if (s.restarts > prev.restarts) {
        log(`Auto-cycle complete. Restart #${s.restarts}`, '#f59e0b');
    }

    // Requests progress
    if (s.requestsSent > prev.requestsSent) {
        const diff = s.requestsSent - prev.requestsSent;
        if (s.requestsSent % 100 === 0 || diff >= 25) {
            log(`Requests sent: ${fmtNumber(s.requestsSent)}`, '#00d4ff');
        }
    }

    // Errors
    if (s.errors > prev.errors) {
        log(`Error detected (total: ${s.errors})`, '#ef4444');
    }

    // Proxy list update
    if (s.proxyCount !== prev.proxyCount) {
        log(`Proxy list updated: ${s.proxyCount} proxies loaded`, '#7c3aed');
    }

    // Last proxy used change
    if (s.lastProxyUsed && s.lastProxyUsed !== prev.lastProxyUsed) {
        log(`Rotating proxy → ${s.lastProxyUsed}`, '#7c3aed');
    }

    // Proxy enabled/disabled toggle
    if (s.proxyEnabled !== prev.proxyEnabled) {
        log(
            s.proxyEnabled ? 'Proxy mode enabled' : 'Proxy mode disabled',
            s.proxyEnabled ? '#10b981' : '#f59e0b'
        );
    }
});

socket.on('disconnect', () => {
    log('Disconnected from server', '#ef4444');
});

socket.on('connect', () => {
    log('Socket connected', '#10b981');
});

// Boot message
log('Initializing dashboard...', '#7c3aed');