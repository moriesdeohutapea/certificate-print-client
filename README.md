# Certificate Print Client

Electron app untuk menerima data sertifikat dari WebSocket, menampilkan preview, dan melakukan silent print.

## Install

```bash
npm install
```

## Run

Local:

```bash
npm run start:local
```

Production:

```bash
npm run start:prod
```

Shortcut command:

```bash
npm run start:win
npm run start:prod:win
```

OS wrapper script command:

```bash
npm run run:local:win
npm run run:prod:win
```

Wrapper script behavior:

- Cek `node` dan `npm` otomatis
- Jika `node` belum ada:
  - Windows: coba install via `winget install OpenJS.NodeJS.LTS`
- Jika `node_modules` belum ada: otomatis jalankan `npm install`
- Jika install/start gagal: script akan self-heal (verify npm cache, reinstall dependency, lalu retry start sekali)
- Lalu menjalankan app sesuai mode local/prod

## Build

Package app:

```bash
npm run package:win
```

Make distributable:

```bash
npm run make:win
```

Production build:

```bash
npm run make:prod:win
```

## Environment

Local env:

- [.env.local](/Users/morieshutapea/Documents/ReactProject/certificate-print-client/.env.local)

Production env:

- [.env.prod](/Users/morieshutapea/Documents/ReactProject/certificate-print-client/.env.prod)

WebSocket host diambil dari env aktif, bukan dari settings UI.

## Notes

- Default socket status saat app dibuka adalah `OFF`
- Untuk mulai listen WebSocket, klik tombol `Turn socket on`
- Build Windows paling aman dilakukan di mesin Windows
