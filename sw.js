// Service worker: the app shell is cached at install so Tutti opens offline; samples are cached the
// first time they play, so instruments you have used keep working without a network. The cache is
// named after the app version, and old caches are dropped on activation.
const VERSION = '4.1.0';
const SHELL = 'tutti-shell-' + VERSION, SAMPLES = 'tutti-samples-v1';
const SHELL_FILES = [
  './', 'index.html', 'help.html', 'styles.css', 'manifest.webmanifest', 'assets/icon-192.png', 'assets/icon-512.png',
  'src/main.js', 'src/version.js',
  'src/core/constants.js', 'src/core/sounds.js', 'src/core/song.js', 'src/core/render.js', 'src/core/scheduler.js', 'src/core/synth.js',
  'src/core/midi.js', 'src/core/midifile.js', 'src/core/examples.js', 'src/core/edit.js', 'src/core/scales.js', 'src/core/sampler.js',
  'src/ui/state.js', 'src/ui/layout.js', 'src/ui/sync.js', 'src/ui/edit.js', 'src/ui/selection.js', 'src/ui/transport.js', 'src/ui/keyboard.js',
  'src/ui/pointer.js', 'src/ui/draw.js', 'src/ui/gamepad.js', 'src/ui/pad.js', 'src/ui/midi-in.js', 'src/ui/toolbar.js', 'src/ui/storage.js',
  'src/ui/session.js', 'src/ui/instruments.js', 'src/ui/pocket.js', 'src/ui/map.js', 'src/ui/songview.js', 'src/ui/monitor.js', 'src/ui/mixer.js', 'src/ui/panels.js',
  'banks/index.json',
  'src/core/banks.js',
];
self.addEventListener('install', e => {
  // Cache each file on its own: one missing file (a CDN still propagating, say) must not block install.
  e.waitUntil(caches.open(SHELL).then(c => Promise.allSettled(SHELL_FILES.map(f => c.add(f)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tutti-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // The deployed site keeps pull request previews (pr/<number>/) and the builds listing inside this scope.
  // They are left to the network: never stored in the shell cache, and a preview's own samples never cache-first.
  if (/^(pr|builds)\//.test(url.pathname.slice(new URL(self.registration.scope).pathname.length))) return;
  if (url.pathname.includes('/samples/') || url.pathname.includes('/banks/')) {
    // cache first; samples never change for a given file name
    e.respondWith(caches.open(SAMPLES).then(async c => { const hit = await c.match(e.request); if (hit) return hit; const res = await fetch(e.request); if (res.ok) c.put(e.request, res.clone()); return res; }));
    return;
  }
  // shell: network first so deploys show up, cache when offline
  // (the copy is taken before the response is handed back: its body cannot be cloned once it is being read)
  e.respondWith(fetch(e.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); } return res; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))));
});
