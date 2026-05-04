// Lightweight E2EE helper built on Web Crypto API.
(function attachE2EE(global) {
    const STORE_KEYPAIR = 'e2ee-device-keypair-v1';
    const STORE_KEYID = 'e2ee-device-keyid-v1';
    const STORE_CHAT_KEYS = 'e2ee-chat-keys-v1';

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    const chatKeyCache = new Map();
    const E2EE_DEBUG = true;

    function debugLog(event, details = null) {
        if (!E2EE_DEBUG) return;
        const ts = new Date().toISOString();
        if (details == null) {
            console.log(`[E2EE][${ts}] ${event}`);
            return;
        }
        console.log(`[E2EE][${ts}] ${event}`, details);
    }

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
            debugLog('device_keypair.load_existing', { keyId: existingKeyId });
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
        debugLog('device_keypair.generated', { keyId });
        localStorage.setItem(STORE_KEYPAIR, JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk }));
        localStorage.setItem(STORE_KEYID, keyId);
        return { keyId, privateKey: pair.privateKey, publicKey: pair.publicKey, publicJwk };
    }

    async function uploadMyPublicKey(authToken) {
        const pair = await getOrCreateDeviceKeyPair();
        debugLog('public_key.upload.start', { keyId: pair.keyId });
        await fetch('/users/me/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ key_id: pair.keyId, algorithm: 'RSA-OAEP', public_key: JSON.stringify(pair.publicJwk) }),
        });
        debugLog('public_key.upload.done', { keyId: pair.keyId });
        return pair;
    }

    function saveChatKey(chatId, keyVersion, key) {
        const str = localStorage.getItem(STORE_CHAT_KEYS);
        const parsed = str ? JSON.parse(str) : {};
        parsed[chatId] = parsed[chatId] || {};
        parsed[chatId][String(keyVersion)] = key;
        localStorage.setItem(STORE_CHAT_KEYS, JSON.stringify(parsed));
    }

    function loadChatKey(chatId) {
        let chatMap = null;
        if (chatKeyCache.has(chatId)) {
            chatMap = chatKeyCache.get(chatId);
        } else {
            const str = localStorage.getItem(STORE_CHAT_KEYS);
            if (!str) return null;
            const parsed = JSON.parse(str);
            if (!parsed[chatId]) return null;
            chatMap = parsed[chatId];
            chatKeyCache.set(chatId, chatMap);
        }
        const versions = Object.keys(chatMap).map(v => Number(v)).filter(v => Number.isFinite(v));
        if (versions.length === 0) return null;
        const latest = Math.max(...versions);
        return { keyVersion: latest, key: chatMap[String(latest)] };
    }



    function parseKeyVersion(encryptionVersion) {
        if (!encryptionVersion || typeof encryptionVersion !== 'string') return null;
        const parts = encryptionVersion.split(':');
        if (parts.length < 2) return null;
        const n = Number(parts[1]);
        return Number.isFinite(n) && n > 0 ? n : null;
    }

    function loadChatKeyByVersion(chatId, keyVersion) {
        const str = localStorage.getItem(STORE_CHAT_KEYS);
        if (!str) return null;
        const parsed = JSON.parse(str);
        const chatMap = parsed[chatId];
        if (!chatMap || !chatMap[String(keyVersion)]) return null;
        return { keyVersion, key: chatMap[String(keyVersion)] };
    }
    function removeChatKey(chatId) {
        chatKeyCache.delete(chatId);
        const str = localStorage.getItem(STORE_CHAT_KEYS);
        if (!str) return;
        const parsed = JSON.parse(str);
        if (parsed[chatId]) {
            delete parsed[chatId];
            localStorage.setItem(STORE_CHAT_KEYS, JSON.stringify(parsed));
        }
    }

    async function importAesKey(base64Key) {
        return crypto.subtle.importKey('raw', fromBase64(base64Key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }

    async function exportAesKey(key) {
        const raw = await crypto.subtle.exportKey('raw', key);
        return toBase64(new Uint8Array(raw));
    }

    async function bootstrapChatKeyForMembers(chatId, members, currentUserId, authToken) {
        debugLog('chat_key.bootstrap.start', { chatId, currentUserId, membersCount: members?.length || 0 });
        const pair = await getOrCreateDeviceKeyPair();

        let keyVersion = 1;
        try {
            const metaResp = await fetch(`/chats/${chatId}/keys/meta`, { headers: { Authorization: `Bearer ${authToken}` } });
            if (metaResp.ok) {
                const meta = await metaResp.json();
                if (meta?.latest_version) {
                    keyVersion = meta.latest_version + 1;
                }
            }
        } catch (_) {}

        const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        const exportedKey = await exportAesKey(aesKey);

        let selfKeyStored = false;
        for (const member of members) {
            const uid = member.user_id || member.id;
            const keysResp = await fetch(`/users/${uid}/keys`, { headers: { Authorization: `Bearer ${authToken}` } });
            if (!keysResp.ok) continue;
            const keys = await keysResp.json();
            debugLog('chat_key.bootstrap.member_keys', { chatId, targetUserId: uid, keysCount: Array.isArray(keys) ? keys.length : null, myKeyId: pair.keyId });
            if (!Array.isArray(keys) || keys.length === 0) continue;

            for (const active of keys) {
                if (!active || !active.public_key || !active.key_id) continue;
                const memberPub = await crypto.subtle.importKey('jwk', JSON.parse(active.public_key), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
                const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, memberPub, fromBase64(exportedKey));
                const storeResp = await fetch(`/chats/${chatId}/keys/${uid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({
                        key_id: active.key_id,
                        encrypted_chat_key: toBase64(new Uint8Array(encrypted)),
                        key_version: keyVersion,
                        // Store account-level recovery copy for every member
                        backup_key_plaintext: exportedKey,
                    }),
                });
                debugLog('chat_key.bootstrap.store_result', { chatId, targetUserId: uid, targetKeyId: active.key_id, status: storeResp.status, ok: storeResp.ok });
                if (storeResp.ok && uid === currentUserId && active.key_id === pair.keyId) selfKeyStored = true;
            }
        }

        if (!selfKeyStored) {
            throw new Error('Failed to provision encrypted key for current device');
        }
        saveChatKey(chatId, keyVersion, exportedKey);
        const cached = { keyVersion, key: exportedKey };
        chatKeyCache.set(chatId, cached);
        debugLog('chat_key.bootstrap.done', { chatId, keyVersion, selfKeyStored, myKeyId: pair.keyId });
        return cached;
    }

    async function ensureChatKey(chatId, members, currentUserId, authToken) {
        const existing = loadChatKey(chatId);
        if (existing) return existing;

        const pair = await getOrCreateDeviceKeyPair();
        debugLog('chat_key.ensure.start', { chatId, currentUserId, myKeyId: pair.keyId });
        const mine = await fetch(`/chats/${chatId}/keys/me?key_id=${encodeURIComponent(pair.keyId)}`, { headers: { Authorization: `Bearer ${authToken}` } });
        debugLog('chat_key.ensure.fetch_my_key', { chatId, myKeyId: pair.keyId, status: mine.status, ok: mine.ok });
        if (mine.ok) {
            try {
                const myKey = await mine.json();
                debugLog('chat_key.ensure.my_key_payload', { chatId, returnedKeyId: myKey?.key_id, keyVersion: myKey?.key_version });
                const decryptedRaw = await crypto.subtle.decrypt(
                    { name: 'RSA-OAEP' },
                    pair.privateKey,
                    fromBase64(myKey.encrypted_chat_key),
                );
                const keyBase64 = toBase64(new Uint8Array(decryptedRaw));
                const cached = { keyVersion: myKey.key_version, key: keyBase64 };
                saveChatKey(chatId, myKey.key_version, keyBase64);
                chatKeyCache.set(chatId, cached);
                debugLog('chat_key.ensure.decrypt_success', { chatId, keyVersion: myKey.key_version, returnedKeyId: myKey?.key_id, myKeyId: pair.keyId });
                return cached;
            } catch (error) {
                debugLog('chat_key.ensure.decrypt_failed', { chatId, myKeyId: pair.keyId, error: String(error?.message || error) });
                const recoverResp = await fetch(`/chats/${chatId}/keys/me/recover`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                });
                debugLog('chat_key.ensure.recover_attempt', { chatId, status: recoverResp.status, ok: recoverResp.ok });
                if (recoverResp.ok) {
                    const recovered = await recoverResp.json();
                    const recoveredBase64 = recovered.chat_key_plaintext;
                    const keyVersion = recovered.key_version || 1;
                    saveChatKey(chatId, keyVersion, recoveredBase64);
                    chatKeyCache.set(chatId, { keyVersion, key: recoveredBase64 });
                    try {
                        await shareChatKeyToUser(chatId, currentUserId, authToken, recoveredBase64, keyVersion, true);
                    } catch (_) {}
                    debugLog('chat_key.ensure.recover_success', { chatId, keyVersion, myKeyId: pair.keyId });
                    return { keyVersion, key: recoveredBase64 };
                }
                const wrapped = new Error('CHAT_KEY_MISMATCH');
                wrapped.cause = error;
                throw wrapped;
            }
        }

        if (mine.status === 404) {
            let hasAnyKeys = false;
            try {
                const metaResp = await fetch(`/chats/${chatId}/keys/meta`, { headers: { Authorization: `Bearer ${authToken}` } });
                if (metaResp.ok) {
                    const meta = await metaResp.json();
                    hasAnyKeys = Boolean(meta?.has_any_keys);
                }
            } catch (_) {}

            if (hasAnyKeys) {
                debugLog('chat_key.ensure.no_device_key_but_chat_has_keys_trying_recover', { chatId, myKeyId: pair.keyId });
                try {
                    const recoverResp = await fetch(`/chats/${chatId}/keys/me/recover`, {
                        headers: { Authorization: `Bearer ${authToken}` },
                    });
if (recoverResp.ok) {
                        const recovered = await recoverResp.json();
                        const recoveredBase64 = recovered.chat_key_plaintext;
                        const keyVersion = recovered.key_version || 1;
                        saveChatKey(chatId, keyVersion, recoveredBase64);
                        chatKeyCache.set(chatId, { keyVersion, key: recoveredBase64 });
                        try {
                            await shareChatKeyToUser(chatId, currentUserId, authToken, recoveredBase64, keyVersion, true);
                        } catch (_) {}
                        debugLog('chat_key.ensure.recover_success', { chatId, keyVersion, myKeyId: pair.keyId });
                        return { keyVersion, key: recoveredBase64 };
                    }
                } catch (e) {
                    debugLog('chat_key.ensure.recover_failed_fallback_bootstrap', { chatId, myKeyId: pair.keyId, error: String(e) });
                }
                const wrapped = new Error('CHAT_KEY_MISMATCH');
                throw wrapped;
            }

            debugLog('chat_key.ensure.no_key_for_device_bootstrap', { chatId, myKeyId: pair.keyId });
            return bootstrapChatKeyForMembers(chatId, members, currentUserId, authToken);
        }
        debugLog('chat_key.ensure.failed', { chatId, myKeyId: pair.keyId, status: mine.status });
        throw new Error(`Failed to load chat key: ${mine.status}`);
    }

    async function rotateDeviceKey(authToken, chatId = null) {
        localStorage.removeItem(STORE_KEYPAIR);
        localStorage.removeItem(STORE_KEYID);
        if (chatId != null) {
            removeChatKey(chatId);
        }
        await uploadMyPublicKey(authToken);
    }

    async function shareChatKeyToUser(chatId, targetUserId, authToken, overrideKey = null, overrideVersion = null, includeBackup = true) {
        const chatKey = overrideKey ? { key: overrideKey, keyVersion: overrideVersion || 1 } : loadChatKey(chatId);
        if (!chatKey) throw new Error('Missing local chat key');
        const keysResp = await fetch(`/users/${targetUserId}/keys`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (!keysResp.ok) throw new Error('Failed to load target public key');
        const keys = await keysResp.json();
        debugLog('chat_key.share.start', { chatId, targetUserId, keysCount: Array.isArray(keys) ? keys.length : null, includeBackup });
        if (!Array.isArray(keys) || keys.length === 0) throw new Error('Target has no public keys');

        let hasSuccess = false;
        for (const active of keys) {
            if (!active || !active.public_key || !active.key_id) continue;
            const memberPub = await crypto.subtle.importKey('jwk', JSON.parse(active.public_key), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
            const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, memberPub, fromBase64(chatKey.key));
            const resp = await fetch(`/chats/${chatId}/keys/${targetUserId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({
                    key_id: active.key_id,
                    encrypted_chat_key: toBase64(new Uint8Array(encrypted)),
                    key_version: chatKey.keyVersion || 1,
                    backup_key_plaintext: includeBackup ? chatKey.key : undefined,
                }),
            });
            debugLog('chat_key.share.store_result', { chatId, targetUserId, targetKeyId: active.key_id, status: resp.status, ok: resp.ok });
            if (resp.ok) hasSuccess = true;
        }
        if (!hasSuccess) {
            throw new Error('Failed to share chat key to any target device key');
        }
        debugLog('chat_key.share.done', { chatId, targetUserId, hasSuccess });
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
        const payloadVersion = parseKeyVersion(payload?.encryption_version);
        let chatKey = payloadVersion ? loadChatKeyByVersion(chatId, payloadVersion) : null;
        if (!chatKey) chatKey = loadChatKey(chatId);
        if (!chatKey) return null;
        debugLog('message.decrypt.start', {
            chatId,
            keyVersion: chatKey.keyVersion,
            senderKeyId: payload?.sender_key_id || null,
            encryptionVersion: payload?.encryption_version || null,
            hasAad: Boolean(payload?.aad),
        });
        const key = await importAesKey(chatKey.key);
        const decAlgo = { name: 'AES-GCM', iv: fromBase64(payload.nonce) };
        if (payload.aad) {
            decAlgo.additionalData = fromBase64(payload.aad);
        }
        const decrypted = await crypto.subtle.decrypt(decAlgo, key, fromBase64(payload.ciphertext));
        debugLog('message.decrypt.success', { chatId, keyVersion: chatKey.keyVersion });
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
        rotateDeviceKey,
        shareChatKeyToUser,
        encryptText,
        decryptPayload,
        encryptFile,
        decryptFile,
        loadChatKey,
        loadChatKeyByVersion,
    };
})(window);
