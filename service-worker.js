// ========================================================
// PIZARRA OESTE - service-worker.js
// Cachea los archivos de la app para que funcione sin conexión
// una vez instalada. El nombre del caché está atado a la versión
// de la app: cuando se sube una versión nueva (y se cambia
// CACHE_NAME acá abajo), el caché viejo se descarta solo y se
// vuelve a descargar todo de cero.
// ========================================================

const CACHE_NAME = 'pizarra-oeste-v136';

const ARCHIVOS_A_CACHEAR = [
    './',
    './index.html',
    './estilos.css',
    './estado.js',
    './audio.js',
    './jugadores.js',
    './cancha.js',
    './interaccion.js',
    './ui.js',
    './logo.svg',
    './logocancha.svg',
    './bplogorojo.svg',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-192.png',
    './icon-maskable-512.png'
];

// --- INSTALACIÓN: precarga todo el "esqueleto" de la app ---
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // Usamos Promise.allSettled en vez de cache.addAll: si UN
                // solo archivo de la lista no se pudiera cachear (ej. un
                // nombre que no coincide exactamente), cache.addAll hace
                // fallar TODA la instalación y el service worker nunca
                // queda activo -y sin uno activo, el navegador no ofrece
                // instalar la app-. Así, cacheamos lo que se pueda y
                // avisamos en la consola lo que no.
                return Promise.allSettled(
                    ARCHIVOS_A_CACHEAR.map((url) =>
                        cache.add(url).catch((err) => {
                            console.warn('[Service Worker] No se pudo cachear:', url, err);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// --- ACTIVACIÓN: borra cachés de versiones viejas ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((nombres) =>
            Promise.all(
                nombres
                    .filter((nombre) => nombre !== CACHE_NAME)
                    .map((nombre) => caches.delete(nombre))
            )
        ).then(() => self.clients.claim())
    );
});

// --- PEDIDOS: primero caché (rápido y funciona sin conexión),
// si no está, va a la red y guarda una copia para la próxima vez ---
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((respuestaCacheada) => {
            if (respuestaCacheada) return respuestaCacheada;

            return fetch(event.request).then((respuestaRed) => {
                const copia = respuestaRed.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
                return respuestaRed;
            }).catch(() => {
                // Sin conexión y sin nada en caché: si pidieron navegar a
                // una página, devolvemos el index como último recurso.
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
