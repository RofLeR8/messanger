// Device Management Functions for Multi-device Support

// API Configuration - must match app.js
const API_BASE_URL = typeof window.API_BASE_URL !== 'undefined' ? window.API_BASE_URL : '';

// DOM Elements for device management (lazy initialization)
let _devicesElements = null;

function getDevicesElements() {
    if (_devicesElements) return _devicesElements;
    
    _devicesElements = {
        devicesList: document.getElementById('devices-list'),
        addDeviceBtn: document.getElementById('add-device-btn'),
        qrModal: document.getElementById('qr-modal'),
        closeQrBtn: document.getElementById('close-qr-btn'),
        qrCodeContainer: document.getElementById('qr-code-container'),
        pairingTokenText: document.getElementById('pairing-token-text'),
        expiresCountdown: document.getElementById('expires-countdown'),
        refreshQrBtn: document.getElementById('refresh-qr-btn'),
        scanQrModal: document.getElementById('scan-qr-modal'),
        closeScanQrBtn: document.getElementById('close-scan-qr-btn'),
        pairingTokenForm: document.getElementById('pairing-token-form'),
        pairingTokenInput: document.getElementById('pairing-token-input'),
        pairingSuccess: document.getElementById('pairing-success'),
        pairingError: document.getElementById('pairing-error'),
    };
    
    return _devicesElements;
}

// Generate a unique device ID for this browser/device
function generateDeviceId() {
    const stored = localStorage.getItem('deviceId');
    if (stored) return stored;
    
    const newId = 'device_' + crypto.randomUUID();
    localStorage.setItem('deviceId', newId);
    return newId;
}

// Get device name from browser info
function getDeviceName() {
    const userAgent = navigator.userAgent;
    if (/mobile/i.test(userAgent)) {
        return 'Mobile Browser';
    } else if (/tablet/i.test(userAgent)) {
        return 'Tablet Browser';
    } else {
        return 'Desktop Browser';
    }
}

// Get device type
function getDeviceType() {
    const userAgent = navigator.userAgent;
    if (/mobile/i.test(userAgent)) {
        return 'mobile';
    } else if (/tablet/i.test(userAgent)) {
        return 'tablet';
    } else {
        return 'web';
    }
}

// API: Get all devices for current user
async function getMyDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me/devices/`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error('Failed to load devices');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading devices:', error);
        return [];
    }
}

// API: Register new device (PENDING status)
async function registerNewDevice(devicePublicKey, algorithm = 'RSA-OAEP') {
    const deviceId = generateDeviceId();
    const deviceName = getDeviceName();
    const deviceType = getDeviceType();
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/me/devices/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
                device_id: deviceId,
                device_name: deviceName,
                device_type: deviceType,
                device_public_key: devicePublicKey,
                algorithm: algorithm,
            }),
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to register device');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error registering device:', error);
        throw error;
    }
}

// API: Initiate pairing (get QR code token)
async function initiateDevicePairing(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me/devices/pairing/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ device_id: deviceId }),
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to initiate pairing');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error initiating pairing:', error);
        throw error;
    }
}

// API: Confirm pairing with token (for new device)
async function confirmDevicePairing(pairingToken, devicePublicKey, algorithm = 'RSA-OAEP') {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me/devices/pairing/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
                pairing_token: pairingToken,
                device_public_key: devicePublicKey,
                algorithm: algorithm,
            }),
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to confirm pairing');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error confirming pairing:', error);
        throw error;
    }
}

// API: Revoke device
async function revokeDevice(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me/devices/${deviceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to revoke device');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error revoking device:', error);
        throw error;
    }
}

// API: Refresh device last_seen
async function refreshDevice(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me/devices/${deviceId}/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to refresh device');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error refreshing device:', error);
        throw error;
    }
}

// Render devices list in settings
async function renderDevicesList() {
    const { devicesList } = getDevicesElements();
    if (!devicesList) {
        console.warn('devicesList element not found');
        return;
    }
    
    devicesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Loading...</p>';
    
    try {
        const devices = await getMyDevices();
        const currentDeviceId = generateDeviceId();
        
        if (devices.length === 0) {
            devicesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No devices yet</p>';
            return;
        }
        
        devicesList.innerHTML = '';
        
        devices.forEach(device => {
            const isCurrentDevice = device.device_id === currentDeviceId;
            const isActive = device.status === 'active';
            const isPending = device.status === 'pending';
            const isRevoked = device.status === 'revoked';
            
            const deviceEl = document.createElement('div');
            deviceEl.className = 'device-item';
            deviceEl.style.cssText = `
                padding: 1rem;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                margin-bottom: 0.5rem;
                background: var(--bg-secondary);
            `;
            
            const statusColor = isActive ? '#4caf50' : isPending ? '#ff9800' : '#f44336';
            const statusText = isActive ? 'Active' : isPending ? 'Pending' : 'Revoked';
            
            const lastSeen = device.last_seen_at 
                ? new Date(device.last_seen_at).toLocaleString()
                : 'Never';
            
            deviceEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                        <strong>${escapeHtml(device.device_name || 'Unknown Device')}</strong>
                        ${isCurrentDevice ? '<span style="font-size: 0.75rem; background: var(--primary-color); color: white; padding: 0.2rem 0.5rem; border-radius: 4px;">This Device</span>' : ''}
                    </div>
                    <span style="color: ${statusColor}; font-size: 0.85rem; font-weight: 500;">${statusText}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    <div>Type: ${escapeHtml(device.device_type || 'Unknown')}</div>
                    <div>Last seen: ${lastSeen}</div>
                    <div>Added: ${new Date(device.created_at).toLocaleDateString()}</div>
                </div>
                ${isActive && !isCurrentDevice ? `
                    <button class="btn btn-danger btn-sm" onclick="handleRevokeDevice('${device.device_id}')" 
                            style="margin-top: 0.5rem; font-size: 0.85rem;">
                        Revoke Device
                    </button>
                ` : ''}
            `;
            
            devicesList.appendChild(deviceEl);
        });
    } catch (error) {
        console.error('Error rendering devices:', error);
        devicesList.innerHTML = `<p style="text-align: center; color: #f44336;">Error loading devices: ${error.message}</p>`;
    }
}

// Show QR code modal for adding new device
let qrRefreshInterval = null;
let currentPairingExpiresAt = null;

async function showAddDeviceModal() {
    const elements = getDevicesElements();
    const { qrModal, pairingError, pairingSuccess, pairingTokenText } = elements;
    
    if (!qrModal) {
        console.error('QR modal element not found');
        return;
    }
    
    hideElement(pairingError);
    hideElement(pairingSuccess);
    
    try {
        // Generate device keys for the new device
        const keyPair = await window.cryptoKeyHelper?.generateDeviceKeys?.() || await generateDeviceKeyPair();
        
        // Register the device
        const device = await registerNewDevice(keyPair.publicKey);
        
        // Initiate pairing to get QR token
        const pairingData = await initiateDevicePairing(device.device_id);
        
        // Display QR code
        displayQRCode(pairingData.pairing_token, elements);
        pairingTokenText.textContent = pairingData.pairing_token;
        
        // Set up countdown timer
        currentPairingExpiresAt = new Date(pairingData.expires_at);
        updateCountdown(elements);
        qrRefreshInterval = setInterval(() => updateCountdown(elements), 1000);
        
        showElement(qrModal);
    } catch (error) {
        console.error('Error showing add device modal:', error);
        showModalError(pairingError, error.message);
    }
}

// Generate RSA key pair for device
async function generateDeviceKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
    );
    
    // Export public key
    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = arrayBufferToBase64(publicKey);
    
    // Store private key in localStorage (in production, use more secure storage)
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyBase64 = arrayBufferToBase64(privateKey);
    localStorage.setItem('devicePrivateKey', privateKeyBase64);
    
    return {
        publicKey: publicKeyBase64,
        privateKey: privateKeyBase64,
    };
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Display QR code using a simple library or canvas
function displayQRCode(token, elements = null) {
    const { qrCodeContainer } = elements || getDevicesElements();
    if (!qrCodeContainer) {
        console.warn('qrCodeContainer element not found');
        return;
    }
    
    // Use a QR code library or create a simple representation
    // For now, we'll use a placeholder - in production, use qrcode.js or similar
    qrCodeContainer.innerHTML = `
        <div style="width: 200px; height: 200px; background: white; margin: 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(token)}" 
                 alt="QR Code" style="width: 100%; height: 100%;">
        </div>
    `;
}

// Update countdown timer
function updateCountdown(elements = null) {
    const { expiresCountdown } = elements || getDevicesElements();
    if (!currentPairingExpiresAt || !expiresCountdown) return;
    
    const now = new Date();
    const diff = currentPairingExpiresAt - now;
    
    if (diff <= 0) {
        expiresCountdown.textContent = 'EXPIRED';
        clearInterval(qrRefreshInterval);
        return;
    }
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    expiresCountdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Handle device revocation
window.handleRevokeDevice = async function(deviceId) {
    if (!confirm('Are you sure you want to revoke this device? It will no longer be able to access your encrypted messages.')) {
        return;
    }
    
    try {
        await revokeDevice(deviceId);
        await renderDevicesList();
        alert('Device revoked successfully');
    } catch (error) {
        alert(`Error revoking device: ${error.message}`);
    }
};

// Close QR modal
function closeQrModalHandler() {
    const { qrModal } = getDevicesElements();
    hideElement(qrModal);
    if (qrRefreshInterval) {
        clearInterval(qrRefreshInterval);
        qrRefreshInterval = null;
    }
}

// Refresh QR code
async function refreshQRCode() {
    const elements = getDevicesElements();
    const { pairingError } = elements;
    hideElement(pairingError);
    
    try {
        const deviceId = generateDeviceId();
        const pairingData = await initiateDevicePairing(deviceId);
        
        displayQRCode(pairingData.pairing_token, elements);
        elements.pairingTokenText.textContent = pairingData.pairing_token;
        
        currentPairingExpiresAt = new Date(pairingData.expires_at);
        updateCountdown(elements);
    } catch (error) {
        showModalError(pairingError, error.message);
    }
}

// Handle pairing token form submission (for new device linking)
async function handlePairingTokenSubmit(e) {
    e.preventDefault();
    const elements = getDevicesElements();
    const { pairingError, pairingSuccess, pairingTokenInput, pairingTokenForm, scanQrModal } = elements;
    
    hideElement(pairingError);
    hideElement(pairingSuccess);
    
    const token = pairingTokenInput.value.trim();
    if (!token) {
        showModalError(pairingError, 'Please enter a pairing token');
        return;
    }
    
    try {
        // Generate keys for this new device
        const keyPair = await generateDeviceKeyPair();
        
        // Confirm pairing
        await confirmDevicePairing(token, keyPair.publicKey);
        
        showElement(pairingSuccess);
        setTimeout(() => {
            hideElement(scanQrModal);
            pairingTokenForm.reset();
            hideElement(pairingSuccess);
        }, 2000);
    } catch (error) {
        showModalError(pairingError, error.message);
    }
}

// Initialize device management on app load
async function initializeDeviceManagement() {
    const deviceId = generateDeviceId();
    
    // Refresh device last_seen
    try {
        await refreshDevice(deviceId);
    } catch (error) {
        console.error('Error refreshing device:', error);
    }
    
    // Set up periodic refresh (every 5 minutes)
    setInterval(() => {
        refreshDevice(deviceId).catch(console.error);
    }, 5 * 60 * 1000);
}

// Setup event listeners for device management
function setupDeviceEventListeners() {
    // Check if elements exist before adding listeners
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener('click', showAddDeviceModal);
    } else {
        console.warn('addDeviceBtn not found in DOM');
    }
    
    if (closeQrBtn) {
        closeQrBtn.addEventListener('click', closeQrModalHandler);
    } else {
        console.warn('closeQrBtn not found in DOM');
    }
    
    if (refreshQrBtn) {
        refreshQrBtn.addEventListener('click', refreshQRCode);
    } else {
        console.warn('refreshQrBtn not found in DOM');
    }
    
    if (closeScanQrBtn) {
        closeScanQrBtn.addEventListener('click', () => hideElement(scanQrModal));
    } else {
        console.warn('closeScanQrBtn not found in DOM');
    }
    
    if (pairingTokenForm) {
        pairingTokenForm.addEventListener('submit', handlePairingTokenSubmit);
    } else {
        console.warn('pairingTokenForm not found in DOM');
    }
}
