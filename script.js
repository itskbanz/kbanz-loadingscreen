/* ============================================================
   THE LANDIA - Loading Screen Logic
   ============================================================ */

const APP_CONFIG = window.LoadingScreenConfig || {};
const CONFIG = APP_CONFIG.player || {};
const tracks = Array.isArray(APP_CONFIG.tracks) ? APP_CONFIG.tracks : [];

function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '').trim();
    const full = clean.length === 3
        ? clean.split('').map((value) => value + value).join('')
        : clean;

    if (!/^[0-9a-fA-F]{6}$/.test(full)) return { r: 4, g: 0, b: 255 };

    return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16)
    };
}

function applyLoadingScreenConfig() {
    const root = document.documentElement;
    const baseColor = APP_CONFIG.baseColor || '#0400ff';
    const rgb = hexToRgb(baseColor);

    root.style.setProperty('--blue', baseColor);
    root.style.setProperty('--blue-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

    document.querySelectorAll('.watermark, .brand-logo').forEach((image) => {
        image.src = APP_CONFIG.logoUrl || '';
        image.alt = '';
    });
}

/* ---------- Elements ---------- */
const video        = document.getElementById('bgVideo');
const playlistEl   = document.getElementById('playlist');

const muteIndicator= document.getElementById('muteIndicator');
const muteLabel    = document.getElementById('muteLabel');
const iconSound    = document.getElementById('iconSound');
const iconMuted    = document.getElementById('iconMuted');
const spaceKey     = document.getElementById('spaceKey');

const playerToggle = document.getElementById('playerToggle');
const player       = document.getElementById('player');
const playerClose  = document.getElementById('playerClose');

const playerTitle  = document.getElementById('playerTitle');
const playerArtist = document.getElementById('playerArtist');
const eqEl         = document.getElementById('eq');
const playerVis    = document.getElementById('playerVis');

const prevBtn      = document.getElementById('prevBtn');
const nextBtn      = document.getElementById('nextBtn');
const playBtn      = document.getElementById('playBtn');
const muteBtn      = document.getElementById('muteBtn');
const iconPlay     = document.getElementById('iconPlay');
const iconPause    = document.getElementById('iconPause');
const pIconSound   = document.getElementById('pIconSound');
const pIconMuted   = document.getElementById('pIconMuted');
const volume       = document.getElementById('volume');

const progressBar  = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const curTime      = document.getElementById('curTime');
const durTime      = document.getElementById('durTime');

const npToast      = document.getElementById('npToast');
const toastTitle   = document.getElementById('toastTitle');
const toastArtist  = document.getElementById('toastArtist');

const loadbarFill  = document.getElementById('loadbarFill');
const staffPanel   = document.getElementById('staffPanel');
const staffHeading = document.getElementById('staffHeading');
const staffList    = document.getElementById('staffList');

/* ---------- State ---------- */
let current = CONFIG.shuffleOnLoad && tracks.length ? Math.floor(Math.random() * tracks.length) : 0;
let isMuted = CONFIG.startMuted === true;
let trackLoadToken = 0;
let playRetryTimer = null;
let loadRetryTimer = null;
let pendingAutoplay = true;
let lastSwitchAt = 0;
let queuedTrack = null;

function preloadNextTrack() {
    // Keep FiveM CEF light while the server is loading. We intentionally avoid
    // downloading another full 1080p MP4 in the background.
}

function buildStaff() {
    const cfg = APP_CONFIG.staff || {};
    if (!staffPanel || !staffList) return;

    if (cfg.enabled === false) {
        staffPanel.classList.add('hidden');
        return;
    }

    staffPanel.classList.remove('hidden');
    staffHeading.textContent = cfg.title || 'STAFF TEAM';
    staffList.innerHTML = '';

    const fallback = cfg.defaultImage || '';
    const members = Array.isArray(cfg.members) ? cfg.members : [];

    members.filter(member => member && member.enabled !== false).forEach(member => {
        const row = document.createElement('div');
        row.className = 'staff-member';

        const avatar = document.createElement('img');
        avatar.className = 'staff-avatar';
        avatar.alt = '';
        avatar.decoding = 'async';
        avatar.src = member.image || fallback;
        avatar.onerror = () => {
            if (fallback && avatar.src !== fallback) avatar.src = fallback;
        };

        const copy = document.createElement('div');
        copy.className = 'staff-copy';
        const name = document.createElement('div');
        name.className = 'staff-name';
        name.textContent = member.name || 'Staff';
        const role = document.createElement('div');
        role.className = 'staff-role';
        role.textContent = member.role || 'Staff';
        copy.append(name, role);

        if (member.logo) {
            const logo = document.createElement('img');
            logo.className = 'staff-member-logo';
            logo.alt = '';
            logo.decoding = 'async';
            logo.src = member.logo;
            logo.onerror = () => logo.remove();
            copy.appendChild(logo);
        }

        row.append(avatar, copy);
        staffList.appendChild(row);
    });

    if (!staffList.children.length) staffPanel.classList.add('hidden');
}

/* ============================================================
   PLAYER
   ============================================================ */
function buildPlaylist() {
    playlistEl.innerHTML = '';
    tracks.forEach((t, i) => {
        const row = document.createElement('div');
        row.className = 'track';
        row.dataset.index = i;
        row.innerHTML = `
            <span class="track-num">${String(i + 1).padStart(2, '0')}</span>
            <div class="track-info">
                <div class="track-title">${t.title}</div>
                <div class="track-artist">${t.artist}</div>
            </div>
            <div class="track-playing"><span></span><span></span><span></span></div>`;
        row.addEventListener('click', () => loadTrack(i, true));
        playlistEl.appendChild(row);
    });
}

function highlightActive() {
    [...playlistEl.children].forEach((row, i) => {
        row.classList.toggle('active', i === current);
    });
    const active = playlistEl.children[current];
    if (active) active.scrollIntoView({ block: 'nearest' });
}

function loadTrack(index, autoplay = true, force = false) {
    if (!tracks.length) return;

    const now = performance.now();
    if (!force && now - lastSwitchAt < 180) {
        queuedTrack = { index, autoplay };
        clearTimeout(loadRetryTimer);
        loadRetryTimer = setTimeout(() => {
            const queued = queuedTrack;
            queuedTrack = null;
            if (queued) loadTrack(queued.index, queued.autoplay, true);
        }, 190);
        return;
    }
    lastSwitchAt = now;

    current = (index + tracks.length) % tracks.length;
    const t = tracks[current];
    const token = ++trackLoadToken;
    pendingAutoplay = autoplay;

    clearTimeout(playRetryTimer);
    clearTimeout(loadRetryTimer);

    playerTitle.textContent = t.title || 'Unknown Track';
    playerArtist.textContent = t.artist || '';
    playerTitle.title = t.title || '';
    playerArtist.title = t.artist || '';
    highlightActive();
    showToast(t);

    progressFill.style.width = '0%';
    curTime.textContent = '0:00';
    durTime.textContent = '0:00';

    video.classList.remove('ready');
    video.pause();
    video.muted = isMuted;
    video.volume = Math.max(0, Math.min(1, Number(volume.value || 70) / 100));

    // Reset the media element once, then assign the new source. Calling load()
    // multiple times during a switch can make FiveM CEF cancel the new request.
    video.removeAttribute('src');
    video.load();
    video.src = t.src;
    video.dataset.loadToken = String(token);
    video.load();

    // Playback starts from canplay/loadeddata. This avoids asking CEF to play a
    // remote MP4 while it is still tearing down the previous request.
    if (autoplay) {
        playRetryTimer = setTimeout(() => {
            if (token === trackLoadToken && video.paused) attemptPlay(token, 0);
        }, 900);
    }
}

function attemptPlay(token = trackLoadToken, retry = 0) {
    clearTimeout(playRetryTimer);
    if (token !== trackLoadToken || !video.src || !pendingAutoplay) return;

    const promise = video.play();
    if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
            if (token !== trackLoadToken || document.hidden || retry >= 4) return;
            playRetryTimer = setTimeout(() => attemptPlay(token, retry + 1), 350 + retry * 250);
        });
    }
}

function nextTrack() { loadTrack(current + 1, true); }
function prevTrack() { loadTrack(current - 1, true); }

function togglePlay() {
    if (video.paused) { pendingAutoplay = true; attemptPlay(trackLoadToken, 0); }
    else { pendingAutoplay = false; video.pause(); }
}

function setMuted(state) {
    isMuted = state;
    video.muted = state;

    // top-right indicator
    muteIndicator.classList.toggle('muted', state);
    muteLabel.textContent = state ? 'Unmute' : 'Mute';
    iconSound.style.display = state ? 'none' : 'block';
    iconMuted.style.display = state ? 'block' : 'none';

    // player mute button
    muteBtn.classList.toggle('active', state);
    pIconSound.style.display = state ? 'none' : 'block';
    pIconMuted.style.display = state ? 'block' : 'none';
}

function toggleMute() {
    setMuted(!isMuted);
    spaceKey.classList.add('flash');
    setTimeout(() => spaceKey.classList.remove('flash'), 130);
}

/* ---------- Play / pause UI sync ---------- */
video.addEventListener('play', () => {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    eqEl.classList.remove('paused');
    playerVis.classList.remove('paused');
    video.classList.add('ready');
});
video.addEventListener('pause', () => {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    eqEl.classList.add('paused');
    playerVis.classList.add('paused');
});
video.addEventListener('ended', () => {
    if (CONFIG.autoAdvance !== false) nextTrack();
});
video.addEventListener('loadeddata', () => {
    video.classList.add('ready');
    if (pendingAutoplay) attemptPlay(trackLoadToken, 0);
});
video.addEventListener('canplay', () => {
    video.classList.add('ready');
    if (pendingAutoplay && video.paused) attemptPlay(trackLoadToken, 0);
});
video.addEventListener('error', () => {
    // Never auto-skip on a temporary CEF/CDN error. Auto-skipping could make a
    // valid second song appear broken by immediately jumping away from it.
    video.classList.remove('ready');
    clearTimeout(playRetryTimer);
});
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.paused && pendingAutoplay) attemptPlay(trackLoadToken, 0);
});

/* ---------- Progress ---------- */
video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    progressFill.style.width = pct + '%';
    curTime.textContent = fmtTime(video.currentTime);
    durTime.textContent = fmtTime(video.duration);
});
video.addEventListener('loadedmetadata', () => {
    durTime.textContent = fmtTime(video.duration);
});
progressBar.addEventListener('click', (e) => {
    if (!video.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * video.duration;
});


let isSeeking=false;
function seekFromEvent(e){
 if(!video.duration)return;
 const r=progressBar.getBoundingClientRect();
 const x=Math.max(0,Math.min(r.width,e.clientX-r.left));
 video.currentTime=(x/r.width)*video.duration;
}
progressBar.addEventListener('mousedown',e=>{isSeeking=true;seekFromEvent(e);});
window.addEventListener('mousemove',e=>{if(isSeeking)seekFromEvent(e);});
window.addEventListener('mouseup',()=>isSeeking=false);

function fmtTime(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

/* ---------- Now playing toast ---------- */
let toastTimer = null;
function showToast(t) {
    if (player.classList.contains('show')) return; // panel already shows the info
    toastTitle.textContent = t.title;
    toastArtist.textContent = t.artist;
    npToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => npToast.classList.remove('show'), 3200);
}

/* ============================================================
   MEDIA PLAYER SHOW / HIDE  (hidden by default)
   ============================================================ */
function openPlayer() {
    player.classList.add('show');
    playerToggle.classList.add('hidden');
    npToast.classList.remove('show'); // panel already shows the info
}
function closePlayer() {
    player.classList.remove('show');
    playerToggle.classList.remove('hidden');
}
playerToggle.addEventListener('click', openPlayer);
playerClose.addEventListener('click', closePlayer);

/* ---------- Control buttons ---------- */
prevBtn.addEventListener('click', prevTrack);
nextBtn.addEventListener('click', nextTrack);
playBtn.addEventListener('click', togglePlay);
muteBtn.addEventListener('click', toggleMute);
volume.addEventListener('input', () => {
    video.volume = parseInt(volume.value, 10) / 100;
    if (parseInt(volume.value, 10) > 0 && isMuted) setMuted(false);
});

/* ============================================================
   KEYBOARD
   ←  previous track   |   →  next track   |   Space  mute
   ============================================================ */
document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'ArrowLeft':
            e.preventDefault();
            prevTrack();
            break;
        case 'ArrowRight':
            e.preventDefault();
            nextTrack();
            break;
        case 'Space':
            e.preventDefault();
            toggleMute();
            break;
        case 'KeyM':
            e.preventDefault();
            player.classList.contains('show') ? closePlayer() : openPlayer();
            break;
    }
});

/* ---------- Unlock audio on first interaction (browser preview only) ---------- */
function unlockOnce() {
    pendingAutoplay = true;
    attemptPlay(trackLoadToken, 0);
    window.removeEventListener('click', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
}
window.addEventListener('click', unlockOnce);
window.addEventListener('keydown', unlockOnce);

/* ============================================================
   FIVEM LOADING PROGRESS
   The center % reflects the TOTAL loading progress reported by
   FiveM (loadProgress.loadFraction), NOT individual init / script
   events. It only ever moves forward and eases smoothly to the
   true total so it never jumps around or resets per phase.
   ============================================================ */
let realProgressSeen = false;
let targetPercent = 0;   // the true overall total, 0 - 100
let shownPercent = 0;    // smoothed value actually on screen

function setTarget(p) {
    p = Math.max(0, Math.min(100, p));
    if (p > targetPercent) targetPercent = p;   // monotonic: total only climbs
}

function animatePercent() {
    const diff = targetPercent - shownPercent;
    shownPercent += Math.abs(diff) > 0.1 ? diff * 0.09 : diff;
    if (loadbarFill) loadbarFill.style.width = shownPercent + '%';
    requestAnimationFrame(animatePercent);
}

window.addEventListener('message', function (e) {
    const data = e.data || {};

    // Single source of truth: the overall load fraction (0.0 - 1.0).
    if (data.eventName === 'loadProgress' && typeof data.loadFraction === 'number') {
        const pct = Math.max(0, Math.min(100, data.loadFraction * 100));
        if (!realProgressSeen) {
            realProgressSeen = true;
            targetPercent = pct;   // snap to the real total, ignore any preview creep
        } else {
            setTarget(pct);
        }
    }
});

/* Browser-preview only: if NO FiveM events arrive within the grace period,
   gently creep the bar so the preview isn't frozen. The instant a real
   loadProgress event arrives, this stops and the true total takes over. */
function fallbackProgress() {
    if (realProgressSeen) return;
    if (targetPercent < 95) setTarget(targetPercent + 0.5);
    setTimeout(fallbackProgress, 130);
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
    document.body.classList.add('booting');
    applyLoadingScreenConfig();
    playerVis.innerHTML = '<span></span>'.repeat(28);
    buildPlaylist();
    buildStaff();
    const defaultVolume = Number.isFinite(CONFIG.defaultVolume) ? CONFIG.defaultVolume : 0.70;
    volume.value = Math.round(defaultVolume * 100);
    video.volume = defaultVolume;
    setMuted(CONFIG.startMuted === true);
    loadTrack(current, true);

    requestAnimationFrame(animatePercent);   // smooth bar fill loop
    setTimeout(fallbackProgress, 1500);       // preview creep only if no real events
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('booting')));
}
init();
