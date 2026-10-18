self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Este arquivo permite que o celular entenda que o site é um app instalável
});
