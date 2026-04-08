---


# 🚀 @crysnovax/baileys

![Logo](https://files.catbox.moe/c5s9g0.jpg)

A lightweight fork of Baileys with a few fixes and small adjustments.

### ⚙️ Changes

#### 🛠️ Internal Adjustments
- 🖼️ Fixed an issue where media could not be sent to newsletters due to an upstream issue.
- 📁 Reintroduced [`makeInMemoryStore`](#%EF%B8%8F-implementing-a-data-store) with a minimal ESM adaptation and small adjustments for Baileys v7.
- 📦 Switched FFmpeg execution from `exec` to `spawn` for safer process handling.
- 🗃️ Added `@napi-rs/image` as a supported image processing backend in `getImageProcessingLibrary()`, offering a balance between performance and compatibility.

#### 📨 Message Handling & Compatibility
- 👉🏻 Added support for sending [interactive message](#-sending-interactive-messages) types (button, list, interactive, template, carousel).
- 📩 Added support for [album messages](#%EF%B8%8F-album-image--video), [group status messages](#4%EF%B8%8F⃣-group-status), [status mention messages](#%EF%B8%8F-status-mention), [sticker pack messages](#-sticker-pack), and several [payment-related messages](#-sending-payment-messages) (request payment, payment invite, order, invoice).
- 📰 Simplified sending messages with ad thumbnails via [`externalAdReply`](#3%EF%B8%8F⃣-external-ad-reply) without requiring manual `contextInfo`.

#### 🧩 Additional Message Options
- 👁️ Added optional boolean flags for message handling:  
   - [`ai`](#1%EF%B8%8F⃣-ai-label) - AI label on message
   - [`mentionAll`](#-mention) - Mentions all group participants without requiring their JIDs in `mentions` or `mentionedJid`
   - [`ephemeral`](#2%EF%B8%8F⃣-ephemeral), [`groupStatus`](#4%EF%B8%8F⃣-group-status), [`viewOnceV2`](#8%EF%B8%8F⃣-view-once-v2), [`viewOnceV2Extension`](#9%EF%B8%8F⃣-view-once-v2-extension), [`interactiveAsTemplate`](#3%EF%B8%8F⃣-interactive) - Message wrappers
   - [`secureMetaServiceLabel`](#6%EF%B8%8F⃣-secure-meta-service-label) - Secure meta service label on message
   - [`raw`](#5%EF%B8%8F⃣-raw) - Build your message manually **(DO NOT USE FOR EXPLOITATION)**

> [!NOTE]
📄 This project is maintained with limited scope and is not intended to replace upstream Baileys.

### 📥 Installation

- 📄 Via `package.json`

```json
# NPM
"dependencies": {
   "@crysnovax/baileys": "latest"
}

# GitHub
"dependencies": {
   "@crysnovax/baileys": "github:crysnovax/crysnovax"
}
```

· ⌨️ Via terminal

```bash
# NPM
npm i @crysnovax/baileys@latest

# GitHub
npm i github:crysnovax/crysnovax
```

🧩 Import (ESM & CJS)

```javascript
// --- ESM
import { makeWASocket } from '@crysnovax/baileys'

// --- CJS (tested and working on Node.js 24 ✅)
const { makeWASocket } = require('@crysnovax/baileys')
```

🔧 Usage

🌐 Connect to WhatsApp (Quick Step)

```javascript
import { makeWASocket, delay, DisconnectReason, useMultiFileAuthState } from '@crysnovax/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'

// --- Connect with pairing code
const myPhoneNumber = '6288888888888'

const logger = pino({ level: 'silent' })

const connectToWhatsApp = async () => {
   const { state, saveCreds } = await useMultiFileAuthState('session')
    
   const sock = makeWASocket({
      logger,
      auth: state
   })

   sock.ev.on('creds.update', saveCreds)

   sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update
      // ... rest of connection logic
   })
   
   // ... rest of your code
}
```

📚 Documentation

For full API documentation, please refer to the original Baileys repository.

📄 License

MIT

```

---

### 📌 Summary of Changes Made
| Original | New |
|----------|-----|
| `@itsliaaa/baileys` | `@crysnovax/baileys` |
| `github:itsliaaa/baileys` | `github:crysnovax/crysnovax` |
| `itsliaaa/baileys#readme` (homepage in package.json) | `crysnovax/crysnovax#readme` |
