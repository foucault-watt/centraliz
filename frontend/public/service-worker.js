const CACHE_NAME = 'centraliz-v1';

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  console.log('Service Worker: Fetching');
});
