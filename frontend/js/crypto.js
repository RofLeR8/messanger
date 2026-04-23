// Lightweight E2EE helper built on Web Crypto API.
(function attachE2EE(global) {
    const STORE_KEYPAIR = 'e2ee-device-keypair-v1';
    const STORE_KEYID = 'e2ee-device-keyid-v1';
    const STORE_CHAT_KEYS = 'e2ee-chat-keys-v1';

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    const chatKeyCache = new Map();

    function toBase64(bytes) {
        let binary = '';
        const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
        return btoa(binary);
    }

    function fromBase64(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function randomId(prefix = 'key') {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    async function getOrCreateDeviceKeyPair() {
        const existing = localStorage.getItem(STORE_KEYPAIR);
        const existingKeyId = localStorage.getItem(STORE_KEYID);
        if (existing && existingKeyId) {
            const parsed = JSON.parse(existing);
            const privateKey = await crypto.subtle.importKey('jwk', parsed.privateKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
            const publicKey = await crypto.subtle.importKey('jwk', parsed.publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
            return { keyId: existingKeyId, privateKey, publicKey, publicJwk: parsed.publicKey };
        }

        const pair = await crypto.subtle.generateKey(
            { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
            true,
            ['encrypt', 'decrypt']
        );
        const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
        const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
        const keyId = randomId('device');
        localStorage.setItem(STORE_KEYPAIR, JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk }));
        localStorage.setItem(STORE_KEYID, keyId);
        return { keyId, privateKey: pair.privateKey, publicKey: pair.publicKey, publicJwk };
    }

    async function uploadMyPublicKey(authToken) {
        const pair = await getOrCreateDeviceKeyPair();
        await fetch('/users/me/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ key_id: pair.keyId, algorithm: 'RSA-OAEP', public_key: JSON.stringify(pair.publicJwk) }),
        });
        return pair;
    }

    function saveChatKey(chatId, keyVersion, key) {
        const str = localStorage.getItem(STORE_CHAT_KEYS);
        const parsed = str ? JSON.parse(str) : {};
        parsed[chatId] = { keyVersion, key };
        localStorage.setItem(STORE_CHAT_KEYS, JSON.stringify(parsed));
    }

    function loadChatKey(chatId) {
        if (chatKeyCache.has(chatId)) return chatKeyCache.get(chatId);
        const str = localStorage.getItem(STORE_CHAT_KEYS);
        if (!str) return null;
        const parsed = JSON.parse(str);
        if (!parsed[chatId]) return null;
        chatKeyCache.set(chatId, parsed[chatId]);
        return parsed[chatId];
    }

    async function importAesKey(base64Key) {
        return crypto.subtle.importKey('raw', fromBase64(base64Key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }

    async function exportAesKey(key) {
        const raw = await crypto.subtle.exportKey('raw', key);
        return toBase64(new Uint8Array(raw));
    }

    async function ensureChatKey(chatId, members, currentUserId, authToken) {
        const existing = loadChatKey(chatId);
        if (existing) return existing;

        const mine = await fetch(`/chats/${chatId}/keys/me`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (mine.ok) {
            try {
                const myKey = await mine.json();
                const pair = await getOrCreateDeviceKeyPair();
                const decryptedRaw = await crypto.subtle.decrypt(
                    { name: 'RSA-OAEP' },
                    pair.privateKey,
                    fromBase64(myKey.encrypted_chat_key),
                );
                const keyBase64 = toBase64(new Uint8Array(decryptedRaw));
                const cached = { keyVersion: myKey.key_version, key: keyBase64 };
                saveChatKey(chatId, myKey.key_version, keyBase64);
                chatKeyCache.set(chatId, cached);
                return cached;
            } catch (error) {
                // Stale/invalid wrapped key for this device: continue to re-provision below.
                console.warn('E2EE: failed to decrypt my chat key, trying reprovision', error);
            }
        }

        const pair = await getOrCreateDeviceKeyPair();
        const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        const exportedKey = await exportAesKey(aesKey);
        const keyVersion = 1;

        let selfKeyStored = false;
        let peerKeyStored = false;
        for (const member of members) {
            const uid = member.user_id || member.id;
            const keysResp = await fetch(`/users/${uid}/keys`, { headers: { Authorization: `Bearer ${authToken}` } });
            if (!keysResp.ok) continue;
            const keys = await keysResp.json();
            const active = keys[0];
            if (!active) continue;
            const memberPub = await crypto.subtle.importKey('jwk', JSON.parse(active.public_key), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
            const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, memberPub, fromBase64(exportedKey));
            const storeResp = await fetch(`/chats/${chatId}/keys/${uid}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({
                    key_id: pair.keyId,
                    encrypted_chat_key: toBase64(new Uint8Array(encrypted)),
                    key_version: keyVersion,
                }),
            });
            if (storeResp.ok && uid === currentUserId) {
                selfKeyStored = true;
            }
            if (storeResp.ok && uid !== currentUserId) {
                peerKeyStored = true;
            }
        }

        if (!selfKeyStored || !peerKeyStored) {
            throw new Error('Failed to provision encrypted key for current device');
        }
        saveChatKey(chatId, keyVersion, exportedKey);
        const cached = { keyVersion, key: exportedKey };
        chatKeyCache.set(chatId, cached);
        return cached;
    }

    async function encryptText(chatId, content, extraAad = null) {
        const chatKey = loadChatKey(chatId);
        if (!chatKey) throw new Error('Missing chat key');
        const key = await importAesKey(chatKey.key);
        const nonce = crypto.getRandomValues(new Uint8Array(12));
        const aadBytes = extraAad ? textEncoder.encode(JSON.stringify(extraAad)) : null;
        const algo = { name: 'AES-GCM', iv: nonce };
        if (aadBytes && aadBytes.byteLength > 0) {
            algo.additionalData = aadBytes;
        }
        const encrypted = await crypto.subtle.encrypt(algo, key, textEncoder.encode(content));
        return {
            ciphertext: toBase64(new Uint8Array(encrypted)),
            nonce: toBase64(nonce),
            aad: aadBytes && aadBytes.byteLength > 0 ? toBase64(aadBytes) : null,
            encryption_version: `v1:${chatKey.keyVersion}`,
            sender_key_id: localStorage.getItem(STORE_KEYID),
        };
    }

    async function decryptPayload(chatId, payload) {
        if (!payload) return null;
        const chatKey = loadChatKey(chatId);
        if (!chatKey) return null;
        const key = await importAesKey(chatKey.key);
        const decAlgo = { name: 'AES-GCM', iv: fromBase64(payload.nonce) };
        if (payload.aad) {
            decAlgo.additionalData = fromBase64(payload.aad);
        }
        const decrypted = await crypto.subtle.decrypt(decAlgo, key, fromBase64(payload.ciphertext));
        return textDecoder.decode(decrypted);
    }

    async function encryptFile(chatId, file) {
        const chatKey = loadChatKey(chatId);
        if (!chatKey) throw new Error('Missing chat key');
        const key = await importAesKey(chatKey.key);
        const nonce = crypto.getRandomValues(new Uint8Array(12));
        const plainBytes = new Uint8Array(await file.arrayBuffer());
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plainBytes);
        return {
            blob: new Blob([encrypted], { type: 'application/octet-stream' }),
            nonce: toBase64(nonce),
            originalName: file.name,
            originalType: file.type || 'application/octet-stream',
        };
    }

    async function decryptFile(chatId, encryptedArrayBuffer, nonceBase64) {
        const chatKey = loadChatKey(chatId);
        if (!chatKey) throw new Error('Missing chat key');
        const key = await importAesKey(chatKey.key);
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64(nonceBase64) },
            key,
            encryptedArrayBuffer,
        );
        return plain;
    }

    global.E2EE = {
        getOrCreateDeviceKeyPair,
        uploadMyPublicKey,
        ensureChatKey,
        encryptText,
        decryptPayload,
        encryptFile,
        decryptFile,
        loadChatKey,
    };
})(window);
