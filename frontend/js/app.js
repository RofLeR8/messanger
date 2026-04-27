// API Configuration - use relative URLs since frontend is served by backend
const API_BASE_URL = '';

// State
let authToken = null;
let currentChatId = null;
let currentUserId = null;
let websocket = null;
let notificationWs = null;
let usersCache = {}; // Cache for user info: { userId: { name, email, username, avatar_url, is_online, last_seen } }
let friendsCache = []; // Cache for current user's friends
let pendingRequestsCache = []; // Cache for pending friend requests
let typingTimeout = null;
let isTyping = false;
let currentChatIsGroup = false; // Track if current chat is a group
let currentActiveTab = 'chats'; // 'chats' or 'friends'
let currentFriendsTab = 'all'; // 'all', 'requests', 'search'
let e2eeEnabled = true;
const UI_SCALE_STORAGE_KEY = 'ui-scale-percent';
const DEFAULT_UI_SCALE_PERCENT = 100;
const e2eeRecoveryRequestedChats = new Set();

// Reply state
let replyingToMessage = null; // { id, sender_id, content, sender_name }

// File upload state
let selectedFile = null;

// Editing state
let editingMessageId = null;

// Search state
let searchResults = [];
let currentSearchIndex = -1;
let searchNavTimeout = null;
let searchTimeout = null;
let selectedUserInfoId = null;

// Context menu state
let contextMenuTarget = null;
let contextMessageId = null;
let contextChatId = null;

// Group members cache
let currentChatMembers = []; // Cached members of current chat

// DOM Elements
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const mainTabs = document.getElementById('main-tabs');
const appContainer = document.querySelector('.app-container');
const tabChats = document.getElementById('tab-chats');
const tabFriends = document.getElementById('tab-friends');
const tabSettings = document.getElementById('tab-settings');
const friendsPage = document.getElementById('friends-page');
const settingsPage = document.getElementById('settings-page');
const friendsTabs = document.getElementById('friends-tabs');
const friendsTabAll = document.getElementById('friends-tab-all');
const friendsTabRequests = document.getElementById('friends-tab-requests');
const friendsTabSearch = document.getElementById('friends-tab-search');
const friendsList = document.getElementById('friends-list');
const pendingRequestsList = document.getElementById('pending-requests-list');
const searchUserInput = document.getElementById('search-user-input');
const searchUserBtn = document.getElementById('search-user-btn');
const searchUserResults = document.getElementById('search-user-results');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const showRegisterFromLinkBtn = document.getElementById('show-register-from-link');
const showLoginFromLinkBtn = document.getElementById('show-login-from-link');
const showLinkFromLoginBtn = document.getElementById('show-link-from-login');
const openScanQrBtn = document.getElementById('open-scan-qr-btn');
const linkDeviceForm = document.getElementById('link-device-form');
const linkTokenInput = document.getElementById('link-token-input');
const linkDeviceError = document.getElementById('link-device-error');
const linkDeviceSuccess = document.getElementById('link-device-success');
const logoutBtn = document.getElementById('logout-btn');
const chatsList = document.getElementById('chats-list');
const createDirectChatBtn = document.getElementById('create-direct-chat-btn');
const createGroupChatBtn = document.getElementById('create-group-chat-btn');
const chatTitle = document.getElementById('chat-title');
const chatHeaderAvatar = document.getElementById('chat-header-avatar');
const chatHeaderStatus = document.getElementById('chat-header-status');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const backToChatsBtn = document.getElementById('back-to-chats-btn');
const togglePinnedBtn = document.getElementById('toggle-pinned-btn');
const toggleSearchBtn = document.getElementById('toggle-search-btn');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const closeSearchBtn = document.getElementById('close-search-btn');
const searchPrevBtn = document.getElementById('search-prev-btn');
const searchNextBtn = document.getElementById('search-next-btn');
const pinnedPanel = document.getElementById('pinned-panel');
const pinnedMessagesList = document.getElementById('pinned-messages-list');
const closePinnedBtn = document.getElementById('close-pinned-btn');
const contextMenu = document.getElementById('context-menu');
const replyPreview = document.getElementById('reply-preview');
const replyPreviewText = replyPreview?.querySelector('.reply-preview-text strong');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const filePreviewName = filePreview?.querySelector('.file-preview-name');
const cancelFileBtn = document.getElementById('cancel-file-btn');
const attachFileBtn = document.getElementById('attach-file-btn');

// Devices management - elements are now managed in devices.js via getDevicesElements()
// These references are kept for backward compatibility but may be null if elements don't exist yet
let devicesList = null;
let addDeviceBtn = null;
let qrModal = null;
let closeQrBtn = null;
let qrCodeContainer = null;
let pairingTokenText = null;
let expiresCountdown = null;
let refreshQrBtn = null;
let scanQrModal = null;
let closeScanQrBtn = null;
let pairingTokenForm = null;
let pairingTokenInput = null;
let pairingSuccess = null;
let pairingError = null;

// Initialize device elements when DOM is ready
function initDeviceElements() {
    devicesList = document.getElementById('devices-list');
    addDeviceBtn = document.getElementById('add-device-btn');
    qrModal = document.getElementById('qr-modal');
    closeQrBtn = document.getElementById('close-qr-btn');
    qrCodeContainer = document.getElementById('qr-code-container');
    pairingTokenText = document.getElementById('pairing-token-text');
    expiresCountdown = document.getElementById('expires-countdown');
    refreshQrBtn = document.getElementById('refresh-qr-btn');
    scanQrModal = document.getElementById('scan-qr-modal');
    closeScanQrBtn = document.getElementById('close-scan-qr-btn');
    pairingTokenForm = document.getElementById('pairing-token-form');
    pairingTokenInput = document.getElementById('pairing-token-input');
    pairingSuccess = document.getElementById('pairing-success');
    pairingError = document.getElementById('pairing-error');
}

// Pages
const chatsPage = document.getElementById('chats-page');
const chatPage = document.getElementById('chat-page');
const uiScaleSelect = document.getElementById('ui-scale-select');

// Modals
const directChatModal = document.getElementById('direct-chat-modal');
const directChatForm = document.getElementById('direct-chat-form');
const directChatFriendsSelect = document.getElementById('direct-chat-friends-select');
const directChatNoFriends = document.getElementById('direct-chat-no-friends');
const directChatError = document.getElementById('direct-chat-error');
const closeDirectModalBtn = document.getElementById('close-direct-modal-btn');

const profileModal = document.getElementById('profile-modal');
const profileBtn = document.getElementById('profile-btn');
const closeProfileBtn = document.getElementById('close-profile-btn');
const profileForm = document.getElementById('profile-form');
const profileEmail = document.getElementById('profile-email');
const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');
const profilePhone = document.getElementById('profile-phone');
const profileBio = document.getElementById('profile-bio');
const profileAvatarDisplay = document.getElementById('profile-avatar-display');
const avatarUploadInput = document.getElementById('avatar-upload-input');
const profileSuccess = document.getElementById('profile-success');
const profileError = document.getElementById('profile-error');
const userInfoModal = document.getElementById('user-info-modal');
const closeUserInfoBtn = document.getElementById('close-user-info-btn');
const userInfoAvatar = document.getElementById('user-info-avatar');
const userInfoName = document.getElementById('user-info-name');
const userInfoUsername = document.getElementById('user-info-username');
const userInfoEmail = document.getElementById('user-info-email');
const userInfoPhone = document.getElementById('user-info-phone');
const userInfoBio = document.getElementById('user-info-bio');
const userInfoStatus = document.getElementById('user-info-status');
const userInfoChatBtn = document.getElementById('user-info-chat-btn');
const userInfoFriendBtn = document.getElementById('user-info-friend-btn');

const groupChatModal = document.getElementById('group-chat-modal');
const groupChatForm = document.getElementById('group-chat-form');
const groupChatNameInput = document.getElementById('group-chat-name');
const groupMembersSelect = document.getElementById('group-members-select');
const closeGroupModalBtn = document.getElementById('close-group-modal-btn');

// Group members panel
const groupMembersPanel = document.getElementById('group-members-panel');
const groupMembersList = document.getElementById('group-members-list');
const closeMembersPanelBtn = document.getElementById('close-members-panel-btn');
const addMemberEmailInput = document.getElementById('add-member-email');
const addMemberBtn = document.getElementById('add-member-btn');
const leaveGroupBtn = document.getElementById('leave-group-btn');
const addMemberSection = document.getElementById('group-add-member-section');
const leaveGroupSection = document.getElementById('leave-group-section');

// Utility Functions
function showElement(element) { element.classList.remove('hidden'); }
function hideElement(element) { element.classList.add('hidden'); }

function showError(message) {
    authError.textContent = message;
    showElement(authError);
    setTimeout(() => hideElement(authError), 5000);
}

function showModalError(input, message) {
    input.textContent = message;
    showElement(input);
    setTimeout(() => hideElement(input), 5000);
}

function formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getEncryptedPayloadFromMessage(message) {
    if (message.encrypted_payload) return message.encrypted_payload;
    if (message.ciphertext && message.nonce) {
        return {
            ciphertext: message.ciphertext,
            nonce: message.nonce,
            aad: message.aad || null,
            encryption_version: message.encryption_version || 'v1',
            sender_key_id: message.sender_key_id || null,
        };
    }
    return null;
}

function parseEncryptedAad(payload) {
    if (!payload?.aad) return null;
    try {
        return JSON.parse(atob(payload.aad));
    } catch (_) {
        return null;
    }
}

async function prepareChatKeyIfNeeded(chatId) {
    if (!e2eeEnabled || !window.E2EE || !authToken || !currentUserId) return;
    try {
        const members = await getChatMembers(chatId);
        await window.E2EE.ensureChatKey(chatId, members, currentUserId, authToken);
        return true;
    } catch (error) {
        const msg = String(error?.message || '');
        if (!e2eeRecoveryRequestedChats.has(chatId) && (
            msg.includes('CHAT_KEY_MISMATCH') ||
            msg.includes('OperationError') ||
            msg.includes('Failed to provision encrypted key')
        )) {
            e2eeRecoveryRequestedChats.add(chatId);
            fetch(`${API_BASE_URL}/chats/${chatId}/keys/recovery-request`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
            }).catch(() => {});
        }
        console.warn('E2EE key setup skipped:', error);
        return false;
    }
}

function renderMessagesLoadError(chatId) {
    messagesContainer.innerHTML = `
        <div class="messages-error-state">
            <div class="messages-error-title">Не удалось загрузить сообщения</div>
            <div class="messages-error-text">Проблема с ключами шифрования. Нажмите "Повторить".</div>
            <button id="retry-load-messages-btn" class="btn btn-primary">Повторить</button>
        </div>
    `;
    const retryBtn = document.getElementById('retry-load-messages-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => retryLoadMessagesWithRecovery(chatId));
    }
}

async function retryLoadMessagesWithRecovery(chatId) {
    const retryBtn = document.getElementById('retry-load-messages-btn');
    if (retryBtn) {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Восстановление...';
    }
    try {
        if (window.E2EE && authToken) {
            await window.E2EE.rotateDeviceKey(authToken, chatId);
        }
        e2eeRecoveryRequestedChats.delete(chatId);
        const ready = await prepareChatKeyIfNeeded(chatId);
        if (!ready) {
            throw new Error('Recovery still pending');
        }
        await loadMessages(chatId);
        connectWebSocket(chatId);
    } catch (error) {
        console.warn('Retry messages load failed:', error);
        renderMessagesLoadError(chatId);
    }
}

async function decryptMessageContentIfNeeded(message) {
    const payload = getEncryptedPayloadFromMessage(message);
    if (!payload || !window.E2EE) return message.content || '';
    const chatId = message.chat_id || currentChatId;
    const chatKey = window.E2EE.loadChatKey(chatId);
    if (!chatKey) {
        return message.file_url ? '' : '[Encrypted message]';
    }
    try {
        const decrypted = await window.E2EE.decryptPayload(chatId, payload);
        if (decrypted == null) {
            return message.content || '';
        }
        // File-only messages: ciphertext decrypts to empty string — not an error
        if (decrypted === '' && message.file_url) {
            return '';
        }
        return decrypted;
    } catch (error) {
        return message.file_url ? '' : '[Encrypted message]';
    }
}

function formatChatListPreviewLine(chat) {
    let inner = chat._preview_inner;
    if (inner == null || inner === '') {
        inner = chat.last_message_content || '';
    }
    if (inner === '[Encrypted message]') inner = '';
    if (chat.last_message_file_url) {
        const isImage = chat._preview_file_is_image ?? (chat.last_message_file_type === 'image');
        const name = chat._preview_file_label || chat.last_message_file_name || (isImage ? 'Image' : 'File');
        const prefix = isImage ? '📷' : '📎';
        return inner ? `${prefix} ${name}: ${inner}` : `${prefix} ${name}`;
    }
    return inner;
}

async function decorateChatListPreviews(chats) {
    for (const chat of chats) {
        chat._preview_inner = null;
        chat._preview_file_label = undefined;
        chat._preview_file_is_image = undefined;

        const aadEarly = chat.last_message_encrypted_payload
            ? parseEncryptedAad(chat.last_message_encrypted_payload)
            : null;
        if (aadEarly?.original_name) chat._preview_file_label = aadEarly.original_name;
        if (aadEarly?.original_type?.toLowerCase().startsWith('image/')) chat._preview_file_is_image = true;

        if (!chat.last_message_encrypted_payload || !e2eeEnabled || !window.E2EE) {
            const raw = chat.last_message_content || '';
            chat._preview_inner = raw === '[Encrypted message]' ? '' : raw;
            continue;
        }
        await prepareChatKeyIfNeeded(chat.id);
        if (!window.E2EE.loadChatKey(chat.id)) {
            chat._preview_inner = '';
            continue;
        }
        try {
            const msg = {
                chat_id: chat.id,
                encrypted_payload: chat.last_message_encrypted_payload,
                content: chat.last_message_content,
                file_url: chat.last_message_file_url,
            };
            let inner = await decryptMessageContentIfNeeded(msg);
            if (inner === '[Encrypted message]') inner = '';
            if ((!inner || !String(inner).trim()) && chat.last_message_file_url) {
                const aad = parseEncryptedAad(chat.last_message_encrypted_payload);
                if (aad?.file_nonce) inner = '';
            }
            chat._preview_inner = inner || '';
        } catch (_) {
            chat._preview_inner = '';
        }
    }
}

async function downloadAndDecryptAttachment(fileUrl, fileNonce, originalName, originalType) {
    if (!window.E2EE || !fileNonce) {
        window.open(fileUrl, '_blank');
        return;
    }
    try {
        const response = await fetch(fileUrl, { headers: { Authorization: `Bearer ${authToken}` } });
        const encryptedBuffer = await response.arrayBuffer();
        const plainBuffer = await window.E2EE.decryptFile(currentChatId, encryptedBuffer, fileNonce);
        const blob = new Blob([plainBuffer], { type: originalType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName || 'decrypted-file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Failed to decrypt attachment');
    }
}

async function hydrateEncryptedImagePreviews(messageDiv, message) {
    const wrap = messageDiv.querySelector('.message-attachment-encrypted-image');
    if (!wrap || !window.E2EE?.decryptFile || !message?.file_url) return;
    const nonce = wrap.dataset.fileNonce;
    const url = wrap.dataset.fileUrl;
    if (!nonce || !url) return;
    const chatId = message.chat_id || currentChatId;
    try {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${authToken}` } });
        const encryptedBuffer = await response.arrayBuffer();
        const plain = await window.E2EE.decryptFile(chatId, encryptedBuffer, nonce);
        const mime = wrap.dataset.fileType || 'image/jpeg';
        const blob = new Blob([plain], { type: mime });
        const src = URL.createObjectURL(blob);
        wrap.innerHTML = '';
        const img = document.createElement('img');
        img.src = src;
        img.alt = wrap.dataset.fileName || 'Image';
        img.className = 'message-attachment-img';
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(src, '_blank');
        });
        wrap.appendChild(img);
    } catch (_) {
        wrap.innerHTML = '<div class="encrypted-media-fallback">Image</div>';
    }
}

let currentChatOffset = 0; // Track pagination offset for message history

// Infinite scroll: load older messages when scrolling to top
let isLoadingMore = false;
const MESSAGES_PAGE_SIZE = 50;

function initInfiniteScroll() {
    currentChatOffset = MESSAGES_PAGE_SIZE; // Already loaded first page
    messagesContainer.removeEventListener('scroll', handleScroll);
    messagesContainer.addEventListener('scroll', handleScroll);
}

function handleScroll() {
    if (isLoadingMore) return;
    if (messagesContainer.scrollTop < 50) { // Near top
        loadMoreMessages();
    }
}

async function loadMoreMessages() {
    if (!currentChatId || isLoadingMore) return false;
    isLoadingMore = true;

    try {
        // Save current scroll height before adding messages
        const oldScrollHeight = messagesContainer.scrollHeight;

        const response = await fetch(`${API_BASE_URL}/chats/${currentChatId}/messages?limit=${MESSAGES_PAGE_SIZE}&offset=${currentChatOffset}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error('Failed to load messages');

        const messages = await response.json();
        if (messages.length === 0) {
            // No more messages
            return false;
        }

        currentChatOffset += messages.length;

        // Prepend older messages (they come in reverse order, so reverse back)
        const fragment = document.createDocumentFragment();
        const reversedMessages = [...messages].reverse();
        for (const msg of reversedMessages) {
            msg.display_content = await decryptMessageContentIfNeeded(msg);
            const isSent = msg.sender_id === currentUserId;
            const el = createMessageElement(msg, isSent);
            fragment.appendChild(el);
            void hydrateEncryptedImagePreviews(el, msg);
        }

        // Insert at the beginning
        if (messagesContainer.firstChild) {
            messagesContainer.insertBefore(fragment, messagesContainer.firstChild);
        } else {
            messagesContainer.appendChild(fragment);
        }

        // Restore scroll position
        const newScrollHeight = messagesContainer.scrollHeight;
        messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;
        return true;

    } catch (error) {
        console.error('Error loading more messages:', error);
        return false;
    } finally {
        isLoadingMore = false;
    }
}

function resetInfiniteScroll() {
    currentChatOffset = MESSAGES_PAGE_SIZE;
    isLoadingMore = false;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function scrollToMessage(messageId) {
    const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageEl) {
        // Avoid viewport scroll on mobile: scroll only inside messages container.
        const targetTop = messageEl.offsetTop - (messagesContainer.clientHeight / 2) + (messageEl.offsetHeight / 2);
        messagesContainer.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth',
        });
        messageEl.style.transition = 'background 0.3s ease';
        messageEl.style.background = 'rgba(0, 217, 255, 0.3)';
        setTimeout(() => { messageEl.style.background = ''; }, 2000);
        return true;
    }
    return false;
}

async function ensureMessageLoadedAndScroll(messageId) {
    if (scrollToMessage(messageId)) return true;
    // Load older history chunks until message appears or history ends.
    for (let i = 0; i < 40; i++) {
        const loadedAny = await loadMoreMessages();
        if (!loadedAny) break;
        if (scrollToMessage(messageId)) return true;
    }
    return false;
}

function getUserDisplayName(userId) {
    const user = usersCache[userId];
    if (user) return user.name || user.email?.split('@')[0] || `User ${userId}`;
    return `User ${userId}`;
}

function getUserInitials(userId) {
    const name = getUserDisplayName(userId);
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function getUserAvatarHtml(userId, size = '42') {
    const user = usersCache[userId] || {};
    const initials = getUserInitials(userId);
    const clickableClass = userId ? ' user-clickable' : '';
    const clickableAttrs = userId ? `data-user-id="${userId}" role="button" tabindex="0"` : '';
    if (user.avatar_url) {
        return `<div class="chat-item-avatar${clickableClass}" ${clickableAttrs}><img src="${escapeHtml(user.avatar_url)}" alt="Avatar">
            <span class="avatar-status-dot ${user.is_online ? 'online' : ''}"></span></div>`;
    }
    return `<div class="chat-item-avatar${clickableClass}" ${clickableAttrs}>${initials}
        <span class="avatar-status-dot ${user.is_online ? 'online' : ''}"></span></div>`;
}

function getFriendAvatarHtml(user, sizeClass = 'friend-avatar', userId = null) {
    const targetUserId = userId || user.user_id || user.id || null;
    const clickableClass = targetUserId ? ' user-clickable' : '';
    const clickableAttrs = targetUserId ? `data-user-id="${targetUserId}" role="button" tabindex="0"` : '';
    if (user.avatar_url) {
        return `<div class="${sizeClass}${clickableClass}" ${clickableAttrs}><img src="${escapeHtml(user.avatar_url)}" alt="Avatar"></div>`;
    }
    const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    return `<div class="${sizeClass}${clickableClass}" ${clickableAttrs}>${initials}</div>`;
}

async function getUserInfoById(userId) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (!response.ok) throw new Error('Failed to load user info');
    return await response.json();
}

function renderUserInfoModal(user) {
    const userName = user.name || user.email?.split('@')[0] || 'Unknown user';
    if (user.avatar_url) {
        userInfoAvatar.innerHTML = `<img src="${escapeHtml(user.avatar_url)}" alt="Avatar">`;
    } else {
        const initials = userName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        userInfoAvatar.innerHTML = initials;
    }
    userInfoName.textContent = userName;
    userInfoUsername.textContent = user.username ? `@${user.username}` : '—';
    userInfoEmail.textContent = user.email || '—';
    userInfoPhone.textContent = user.phone || '—';
    userInfoBio.textContent = user.bio || '—';
    userInfoStatus.textContent = user.is_online ? 'Online' : (user.last_seen ? `Last seen ${formatLastSeen(user.last_seen)}` : 'Offline');
}

async function openUserInfoModal(userId) {
    if (!userId || !authToken) return;
    selectedUserInfoId = userId;
    try {
        const userInfo = await getUserInfoById(userId);
        usersCache[userId] = { ...(usersCache[userId] || {}), ...userInfo };
        renderUserInfoModal(usersCache[userId]);
        updateUserInfoActions(userId);
        showElement(userInfoModal);
    } catch (error) {
        const fallbackUser = usersCache[userId];
        if (!fallbackUser) {
            alert('Failed to load user info');
            return;
        }
        renderUserInfoModal(fallbackUser);
        updateUserInfoActions(userId);
        showElement(userInfoModal);
    }
}

function closeUserInfoModal() {
    hideElement(userInfoModal);
    selectedUserInfoId = null;
}

function updateUserInfoActions(userId) {
    if (!userInfoChatBtn || !userInfoFriendBtn) return;
    const isSelf = userId === currentUserId;
    const isFriend = friendsCache.some(f => f.user_id === userId);
    const sentPending = pendingRequestsCache.some(r => r.addressee_id === userId);
    const hasIncoming = pendingRequestsCache.some(r => r.requester_id === userId);

    userInfoChatBtn.disabled = isSelf;
    userInfoChatBtn.textContent = isSelf ? 'This is you' : 'Start chat';

    if (isSelf) {
        userInfoFriendBtn.disabled = true;
        userInfoFriendBtn.textContent = 'This is you';
    } else if (isFriend) {
        userInfoFriendBtn.disabled = true;
        userInfoFriendBtn.textContent = 'Friends';
    } else if (sentPending) {
        userInfoFriendBtn.disabled = true;
        userInfoFriendBtn.textContent = 'Request sent';
    } else if (hasIncoming) {
        userInfoFriendBtn.disabled = true;
        userInfoFriendBtn.textContent = 'Incoming request';
    } else {
        userInfoFriendBtn.disabled = false;
        userInfoFriendBtn.textContent = 'Add friend';
    }
}

// ==================== Page Navigation ====================
function navigateToChats() {
    switchToTab('chats');
    currentChatId = null;
    currentChatIsGroup = false;
    currentChatMembers = [];

    // Disconnect chat WebSocket
    if (websocket) { websocket.close(); websocket = null; }
    hideElement(groupMembersPanel);

    // Reset chat detail page
    chatPage.classList.remove('active');
    chatPage.classList.add('inactive');
    chatsPage.classList.add('active');
    chatsPage.classList.remove('inactive');
}

async function refreshChats() {
    try {
        const chats = await getChats();
        await decorateChatListPreviews(chats);
        updateChatsList(chats, false); // false = no animation
    } catch (error) {
        console.error('Error refreshing chats:', error);
    }
}

function updateChatsList(chats, animate = true) {
    const currentChatItems = document.querySelectorAll('.chat-item');
    const currentOrder = Array.from(currentChatItems).map(item => parseInt(item.dataset.chatId));
    const newOrder = chats.map(chat => chat.id);
    const orderChanged = JSON.stringify(currentOrder) !== JSON.stringify(newOrder);

    if (orderChanged || currentChatItems.length !== chats.length) {
        renderChats(chats, animate);
    } else {
        chats.forEach(chat => {
            const chatItem = document.querySelector(`.chat-item[data-chat-id="${chat.id}"]`);
            if (!chatItem) return;
            const unreadCount = chat.unread_count || 0;
            let unreadBadge = chatItem.querySelector('.unread-badge');

            if (unreadCount > 0) {
                if (!unreadBadge) {
                    const footer = chatItem.querySelector('.chat-item-footer');
                    if (footer) {
                        const lastMsgEl = footer.querySelector('.chat-item-last-message');
                        if (lastMsgEl) {
                            const badge = document.createElement('span');
                            badge.className = 'unread-badge';
                            badge.textContent = unreadCount;
                            lastMsgEl.after(badge);
                        }
                    }
                } else if (parseInt(unreadBadge.textContent) !== unreadCount) {
                    unreadBadge.textContent = unreadCount;
                }
            } else if (unreadBadge) {
                unreadBadge.remove();
            }

            const lastMessageTime = chat.last_message_at ? formatTime(chat.last_message_at) : '';
            const lastMessageEl = chatItem.querySelector('.chat-item-last-message');
            const timeEl = chatItem.querySelector('.chat-item-time');

            const messagePreview = formatChatListPreviewLine(chat);
            if (lastMessageEl) lastMessageEl.textContent = messagePreview;
            if (timeEl && lastMessageTime) timeEl.textContent = lastMessageTime;
        });
    }
}

async function navigateToChat(chatId, chatName, isGroup) {
    currentChatId = chatId;
    currentChatIsGroup = isGroup;
    chatTitle.textContent = chatName;
    chatNamesCache[chatId] = chatName; // Cache the name
    currentChatMembers = [];

    // Update header status
    if (isGroup) {
        chatHeaderStatus.innerHTML = '';
        chatHeaderStatus.classList.remove('online');
        if (chatHeaderAvatar) {
            chatHeaderAvatar.classList.add('hidden');
            chatHeaderAvatar.removeAttribute('data-user-id');
            chatHeaderAvatar.classList.remove('user-clickable');
        }
        chatTitle.classList.remove('user-clickable');
        chatTitle.removeAttribute('data-user-id');
    } else {
        // For direct chats, show loading then update with actual status
        chatHeaderStatus.innerHTML = '<span class="offline-dot"></span> Loading...';
        if (chatHeaderAvatar) {
            chatHeaderAvatar.classList.add('hidden');
            chatHeaderAvatar.classList.add('user-clickable');
        }
        // Load the other user's status from chat members
        getChatMembers(chatId).then(members => {
            const otherMember = members.find(m => m.user_id !== currentUserId);
            if (otherMember) {
                if (chatHeaderAvatar) chatHeaderAvatar.dataset.userId = String(otherMember.user_id);
                chatTitle.classList.add('user-clickable');
                chatTitle.dataset.userId = String(otherMember.user_id);
                // Cache the user info with avatar
                usersCache[otherMember.user_id] = {
                    name: otherMember.user_name || otherMember.user_email?.split('@')[0],
                    email: otherMember.user_email || '',
                    username: otherMember.user_username || null,
                    avatar_url: otherMember.user_avatar_url || null,
                    is_online: false,
                    last_seen: null
                };
                // Update status
                updateUserOnlineStatus(otherMember.user_id);
            }
        }).catch(() => {
            chatHeaderStatus.innerHTML = '';
            if (chatHeaderAvatar) chatHeaderAvatar.classList.add('hidden');
            chatTitle.classList.remove('user-clickable');
            chatTitle.removeAttribute('data-user-id');
        });
    }

    // Update active state
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.chatId) === chatId) item.classList.add('active');
    });

    clearChatUnreadCount(chatId);

    chatsPage.classList.remove('active');
    chatsPage.classList.add('inactive');
    chatPage.classList.add('active');
    chatPage.classList.remove('inactive');

    hideElement(groupMembersPanel);
    const targetChatId = chatId;
    const keyReady = await prepareChatKeyIfNeeded(chatId);
    if (currentChatId !== targetChatId) return;
    if (!keyReady && e2eeEnabled) {
        renderMessagesLoadError(chatId);
        return;
    }
    await loadMessages(chatId);
    if (currentChatId !== targetChatId) return;
    connectWebSocket(chatId);
    stopNotificationCheck();
}

function stopNotificationCheck() {}

function normalizeUiScalePercent(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_UI_SCALE_PERCENT;
    return Math.min(120, Math.max(85, parsed));
}

function applyUiScalePercent(value, persist = true) {
    const scalePercent = normalizeUiScalePercent(value);
    const scaleMultiplier = scalePercent / 100;
    document.documentElement.style.setProperty('--ui-scale', String(scaleMultiplier));
    if (uiScaleSelect) {
        uiScaleSelect.value = String(scalePercent);
    }
    if (appContainer && window.visualViewport) {
        appContainer.style.height = `${window.visualViewport.height / scaleMultiplier}px`;
    }
    if (persist) {
        localStorage.setItem(UI_SCALE_STORAGE_KEY, String(scalePercent));
    }
}

function initUiScaleSettings() {
    const saved = localStorage.getItem(UI_SCALE_STORAGE_KEY);
    applyUiScalePercent(saved ?? DEFAULT_UI_SCALE_PERCENT, false);
    if (uiScaleSelect) {
        uiScaleSelect.addEventListener('change', (e) => {
            applyUiScalePercent(e.target.value);
        });
    }
}

// ==================== Tab Switching ====================
function switchToTab(tab) {
    // If user switches tabs while viewing a specific chat, close chat detail view first.
    if (chatPage.classList.contains('active')) {
        currentChatId = null;
        currentChatIsGroup = false;
        currentChatMembers = [];
        if (websocket) { websocket.close(); websocket = null; }
        hideElement(groupMembersPanel);
        chatPage.classList.remove('active');
        chatPage.classList.add('inactive');
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    }

    currentActiveTab = tab;
    tabChats.classList.toggle('active', tab === 'chats');
    tabFriends.classList.toggle('active', tab === 'friends');
    if (tabSettings) tabSettings.classList.toggle('active', tab === 'settings');
    chatsPage.classList.toggle('active', tab === 'chats');
    friendsPage.classList.toggle('active', tab === 'friends');
    if (settingsPage) settingsPage.classList.toggle('active', tab === 'settings');
    chatsPage.classList.toggle('inactive', tab !== 'chats');
    friendsPage.classList.toggle('inactive', tab !== 'friends');
    if (settingsPage) settingsPage.classList.toggle('inactive', tab !== 'settings');

    if (tab === 'friends') {
        loadFriendsPage();
    } else if (tab === 'settings') {
        // Render devices list when opening settings
        if (typeof renderDevicesList === 'function') {
            renderDevicesList();
        }
    }
}

function switchFriendsTab(subTab) {
    currentFriendsTab = subTab;
    friendsTabAll.classList.toggle('active', subTab === 'all');
    friendsTabRequests.classList.toggle('active', subTab === 'requests');
    friendsTabSearch.classList.toggle('active', subTab === 'search');

    document.getElementById('friends-panel-all').classList.toggle('active', subTab === 'all');
    document.getElementById('friends-panel-requests').classList.toggle('active', subTab === 'requests');
    document.getElementById('friends-panel-search').classList.toggle('active', subTab === 'search');

    if (subTab === 'all') loadFriendsList();
    else if (subTab === 'requests') loadPendingRequests();
}

async function loadFriendsPage() {
    await Promise.all([loadFriendsList(), loadPendingRequests()]);
}

async function loadFriendsList() {
    const friends = await getMyFriends();
    friendsCache = friends;
    renderFriendsList(friends);
}

function renderFriendsList(friends) {
    friendsList.innerHTML = '';
    if (friends.length === 0) {
        friendsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p>No friends yet.<br>Use the "Add Friend" tab to find people!</p>
            </div>
        `;
        return;
    }

    friends.forEach((friend, index) => {
        // Cache the user
        usersCache[friend.user_id] = {
            name: friend.name,
            email: '',
            username: friend.username,
            avatar_url: friend.avatar_url,
            is_online: friend.is_online,
            last_seen: friend.last_seen
        };

        const item = document.createElement('div');
        item.className = 'friend-item';
        item.style.animationDelay = `${index * 0.05}s`;

        item.innerHTML = `
            ${getFriendAvatarHtml(friend)}
            <div class="friend-info">
                <div class="friend-name user-clickable" data-user-id="${friend.user_id}" role="button" tabindex="0">
                    ${friend.is_online ? '<span class="status-dot online"></span>' : ''}
                    ${escapeHtml(friend.name)}
                </div>
                ${friend.username ? `<div class="friend-username user-clickable" data-user-id="${friend.user_id}" role="button" tabindex="0">@${escapeHtml(friend.username)}</div>` : ''}
            </div>
            <div class="friend-actions">
                <button class="btn-chat" data-friend-id="${friend.user_id}" title="Start chat">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Chat
                </button>
                <button class="btn-remove-friend" data-friend-id="${friend.user_id}" title="Remove friend">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;

        friendsList.appendChild(item);
    });

    // Chat button handlers
    friendsList.querySelectorAll('.btn-chat').forEach(btn => {
        btn.addEventListener('click', async () => {
            const friendId = parseInt(btn.dataset.friendId);
            try {
                const chat = await createDirectChat(friendId);
                await loadChats();
                // Find the other user info
                const otherInfo = usersCache[friendId] || { name: 'Chat' };
                navigateToChat(chat.id, otherInfo.name, false);
            } catch (error) { alert('Failed to create chat: ' + error.message); }
        });
    });

    // Remove friend handlers
    friendsList.querySelectorAll('.btn-remove-friend').forEach(btn => {
        btn.addEventListener('click', async () => {
            const friendId = parseInt(btn.dataset.friendId);
            if (!confirm('Remove this friend?')) return;
            try {
                await removeFriend(friendId);
                await loadFriendsList();
            } catch (error) { alert('Failed to remove friend: ' + error.message); }
        });
    });
}

async function loadPendingRequests() {
    const requests = await getPendingFriendRequests();
    pendingRequestsCache = requests;
    renderPendingRequests(requests);
}

function renderPendingRequests(requests) {
    pendingRequestsList.innerHTML = '';
    if (requests.length === 0) {
        pendingRequestsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📬</div>
                <p>No pending friend requests.</p>
            </div>
        `;
        return;
    }

    requests.forEach((req, index) => {
        const item = document.createElement('div');
        item.className = 'pending-request-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const requester = {
            name: req.requester_name,
            username: req.requester_username,
            avatar_url: req.requester_avatar
        };

        item.innerHTML = `
            ${getFriendAvatarHtml(requester, 'friend-avatar', req.requester_id)}
            <div class="pending-request-info">
                <div class="pending-request-name user-clickable" data-user-id="${req.requester_id}" role="button" tabindex="0">${escapeHtml(req.requester_name)}</div>
                ${req.requester_username ? `<div class="pending-request-username user-clickable" data-user-id="${req.requester_id}" role="button" tabindex="0">@${escapeHtml(req.requester_username)}</div>` : ''}
            </div>
            <div class="pending-request-actions">
                <button class="btn-accept" data-requester-id="${req.requester_id}">Accept</button>
                <button class="btn-decline" data-requester-id="${req.requester_id}">Decline</button>
            </div>
        `;

        pendingRequestsList.appendChild(item);
    });

    // Accept handlers
    pendingRequestsList.querySelectorAll('.btn-accept').forEach(btn => {
        btn.addEventListener('click', async () => {
            const requesterId = parseInt(btn.dataset.requesterId);
            try {
                await acceptFriendRequest(requesterId);
                await Promise.all([loadFriendsList(), loadPendingRequests()]);
            } catch (error) { alert('Failed to accept: ' + error.message); }
        });
    });

    // Decline handlers
    pendingRequestsList.querySelectorAll('.btn-decline').forEach(btn => {
        btn.addEventListener('click', async () => {
            const requesterId = parseInt(btn.dataset.requesterId);
            try {
                await declineFriendRequest(requesterId);
                await loadPendingRequests();
            } catch (error) { alert('Failed to decline: ' + error.message); }
        });
    });
}

async function searchUserAndRender() {
    const username = searchUserInput.value.trim();
    if (!username || username.length < 2) {
        searchUserResults.innerHTML = '';
        return;
    }

    const user = await searchUserByUsername(username);
    searchUserResults.innerHTML = '';

    if (!user) {
        searchUserResults.innerHTML = `
            <div class="empty-state">
                <p>User not found.</p>
            </div>
        `;
        return;
    }

    // Cache the user
    usersCache[user.id] = {
        name: user.name,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        is_online: user.is_online,
        last_seen: user.last_seen
    };

    // Check if already friends or request sent
    const isFriend = friendsCache.some(f => f.user_id === user.id);
    const requestSent = pendingRequestsCache.some(r => r.addressee_id === user.id);

    const item = document.createElement('div');
    item.className = 'search-user-item';

    item.innerHTML = `
        ${getFriendAvatarHtml(user)}
        <div class="search-user-info">
            <div class="search-user-name user-clickable" data-user-id="${user.id}" role="button" tabindex="0">${escapeHtml(user.name)}</div>
            <div class="search-user-handle user-clickable" data-user-id="${user.id}" role="button" tabindex="0">${user.username ? '@' + escapeHtml(user.username) : escapeHtml(user.email)}</div>
        </div>
        ${!isFriend && !requestSent ? `<button class="btn-add-friend" data-user-id="${user.id}">Add Friend</button>` :
          requestSent ? '<button class="btn-add-friend" disabled>Pending</button>' :
          '<button class="btn-add-friend" disabled>Friends</button>'}
    `;

    searchUserResults.appendChild(item);

    // Add friend handler
    const addBtn = item.querySelector('.btn-add-friend');
    if (addBtn && !addBtn.disabled) {
        addBtn.addEventListener('click', async () => {
            const userId = parseInt(addBtn.dataset.userId);
            try {
                await sendFriendRequest(userId);
                addBtn.textContent = 'Sent';
                addBtn.disabled = true;
                await loadPendingRequests();
            } catch (error) { alert(error.message); }
        });
    }
}

// ==================== Auth Functions ====================
async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Login failed');
    authToken = data.access_token;
    localStorage.setItem('authToken', authToken);
    return true;
}

async function register(email, name, username, password, passwordCheck) {
    // Generate device key pair for registration
    const keyPair = await generateDeviceKeyPair();
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const deviceName = navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Device';
    const deviceType = navigator.userAgent.includes('Mobile') ? 'mobile' : 'web';
    
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            email, 
            name, 
            username: username || null, 
            password, 
            password_check: passwordCheck,
            device_id: deviceId,
            device_name: deviceName,
            device_type: deviceType,
            device_public_key: keyPair.publicKey,
            algorithm: 'RSA-OAEP'
        }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Registration failed');
    return true;
}

async function logout() {
    try {
        await fetch(`${API_BASE_URL}/auth/logout/`, { method: 'POST', credentials: 'include' });
    } catch (error) { console.error('Logout error:', error); }
    finally {
        authToken = null;
        localStorage.removeItem('authToken');
        if (websocket) { websocket.close(); websocket = null; }
        if (notificationWs) { notificationWs.close(); notificationWs = null; }
        // Reset caches
        usersCache = {};
        friendsCache = [];
        pendingRequestsCache = [];
        currentActiveTab = 'chats';
        currentFriendsTab = 'all';
    }
}

// ==================== Device Pairing Functions ====================
async function generateDeviceKeyPair() {
    // Generate RSA key pair for the device
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
    const exportedPublicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)));
    
    return {
        publicKey: publicKeyBase64,
        keyPair: keyPair
    };
}

async function confirmDevicePairing(pairingToken, devicePublicKey) {
    const response = await fetch(`${API_BASE_URL}/users/me/devices/pairing/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pairing_token: pairingToken,
            device_public_key: devicePublicKey,
            algorithm: 'RSA-OAEP'
        }),
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to confirm device pairing');
    }
    
    return data;
}

async function initDevicePairing(deviceId) {
    const response = await fetch(`${API_BASE_URL}/users/me/devices/pairing/init`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ device_id: deviceId }),
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to initiate device pairing');
    }
    
    return data;
}

async function registerDevice(deviceData) {
    const response = await fetch(`${API_BASE_URL}/users/me/devices/register`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(deviceData),
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to register device');
    }
    
    return data;
}

async function handleUnauthorizedSession() {
    await logout();
    showAuthSection();
}

// ==================== API Functions ====================
async function getChats() {
    const response = await fetch(`${API_BASE_URL}/chats/?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (response.status === 401 || response.status === 403) throw new Error('Unauthorized');
    if (!response.ok) throw new Error('Failed to load chats');
    return await response.json();
}

async function getUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) return [];
        return await response.json();
    } catch (error) { console.error('Error loading users:', error); return []; }
}

async function getCurrentUserInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) { console.error('Error loading current user:', error); return null; }
}

// ==================== Friends API Functions ====================
async function getMyFriends() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me/friends`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) return [];
        return await response.json();
    } catch (error) { console.error('Error loading friends:', error); return []; }
}

async function getPendingFriendRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me/friends/requests/pending`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) return [];
        return await response.json();
    } catch (error) { console.error('Error loading friend requests:', error); return []; }
}

async function sendFriendRequest(addresseeId) {
    const response = await fetch(`${API_BASE_URL}/users/me/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ addressee_id: addresseeId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to send friend request');
    return data;
}

async function acceptFriendRequest(requesterId) {
    const response = await fetch(`${API_BASE_URL}/users/me/friends/request/${requesterId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to accept friend request');
    return data;
}

async function declineFriendRequest(requesterId) {
    const response = await fetch(`${API_BASE_URL}/users/me/friends/request/${requesterId}/decline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to decline friend request');
    return data;
}

async function removeFriend(friendId) {
    const response = await fetch(`${API_BASE_URL}/users/me/friends/${friendId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to remove friend');
    return data;
}

async function searchUserByUsername(username) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/search/${encodeURIComponent(username)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) { console.error('Error searching user:', error); return null; }
}

async function getAllUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) return [];
        return await response.json();
    } catch (error) { console.error('Error loading users:', error); return []; }
}

async function createDirectChat(friendId) {
    if (friendId === currentUserId) throw new Error('Cannot create chat with yourself');

    // Check existing direct chat with this friend
    const chats = await getChats();
    for (const chat of chats) {
        if (!chat.is_group) {
            try {
                const members = await getChatMembers(chat.id);
                const memberIds = members.map(m => m.user_id);
                if (memberIds.includes(friendId) && memberIds.includes(currentUserId)) {
                    return chat;
                }
            } catch (e) { /* ignore */ }
        }
    }

    const response = await fetch(`${API_BASE_URL}/chats/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ user_id: friendId }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create chat');
    }
    return await response.json();
}

async function createGroupChat(name, memberIds) {
    const response = await fetch(`${API_BASE_URL}/chats/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name, member_ids: memberIds }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create group chat');
    }
    return await response.json();
}

async function getChatMembers(chatId) {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/members`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (!response.ok) throw new Error('Failed to load members');
    return await response.json();
}

async function addChatMember(chatId, userId) {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add member');
    }
    return await response.json();
}

async function removeChatMember(chatId, userId) {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to remove member');
    }
    return await response.json();
}

async function getMessages(chatId, limit = 50, offset = 0) {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages?limit=${limit}&offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (!response.ok) throw new Error('Failed to load messages');
    return await response.json();
}

async function sendMessage(chatId, content) {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return await response.json();
}

async function sendMessageWithReply(chatId, messagePayload) {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(messagePayload),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return await response.json();
}

async function markMessagesAsRead(chatId) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'read_receipt', chat_id: chatId }));
    }
    try {
        await fetch(`${API_BASE_URL}/chats/${chatId}/messages/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
    } catch (error) { console.error('Error marking messages as read:', error); }
}

// ==================== WebSocket Functions ====================
function connectWebSocket(chatId) {
    if (websocket) websocket.close();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/chats/ws/${chatId}?token=${authToken}`;
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log('Chat WebSocket connected');
        markMessagesAsRead(chatId);
    };

    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWsMessage(data);
    };

    websocket.onerror = (error) => { console.error('Chat WebSocket error:', error); };
    websocket.onclose = async (event) => {
        console.log('Chat WebSocket disconnected');
        if (event.code === 4001 && authToken) {
            await handleUnauthorizedSession();
        }
    };
}

function handleWsMessage(data) {
    switch (data.type) {
        case 'connected':
            console.log('Connected to chat', data.chat_id);
            break;

        case 'ping':
            // Respond to server ping to keep connection alive
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({ type: 'pong' }));
            }
            break;

        case 'new_message':
            if (data.sender_id !== currentUserId) {
                if (currentChatId === data.chat_id) markMessagesAsRead(data.chat_id);
            }
            addMessageToUI(data, data.sender_id === currentUserId);
            void updateChatLastMessage(data.chat_id, data);
            break;

        case 'typing':
            showTypingIndicator(data.user_id, data.is_typing);
            break;

        case 'read_receipt':
            if (data.user_id && data.user_id !== currentUserId) updateAllMessagesAsRead(data.user_id);
            break;

        case 'message_deleted':
            removeMessageFromUI(data.message_id);
            break;

        case 'message_edited':
            const msgEl = document.querySelector(`.message[data-message-id="${data.message_id}"]`);
            if (msgEl) {
                const contentEl = msgEl.querySelector('.message-content');
                if (contentEl) {
                    if (data.encrypted_payload && window.E2EE) {
                        window.E2EE.decryptPayload(currentChatId, data.encrypted_payload)
                            .then(decrypted => { contentEl.textContent = decrypted || ''; })
                            .catch(() => { contentEl.textContent = ''; });
                    } else {
                        contentEl.textContent = data.content || '';
                    }
                }
                let editedEl = msgEl.querySelector('.message-edited');
                if (!editedEl) {
                    const metaEl = msgEl.querySelector('.message-meta');
                    editedEl = document.createElement('span');
                    editedEl.className = 'message-edited';
                    editedEl.textContent = '(edited)';
                    if (metaEl) metaEl.insertBefore(editedEl, metaEl.lastElementChild);
                }
            }
            break;

        case 'message_pinned':
        case 'message_unpinned':
            if (!pinnedPanel.classList.contains('hidden')) loadPinnedMessages(currentChatId);
            break;

        // Group chat events
        case 'member_added':
            handleMemberAdded(data);
            break;

        case 'member_left':
        case 'member_removed':
            handleMemberLeft(data);
            break;

        case 'chat_updated':
            if (data.name && currentChatId === data.chat_id) {
                chatTitle.textContent = data.name;
            }
            break;
    }
}

function handleMemberAdded(data) {
    // Refresh members list if panel is open
    if (currentChatId === data.chat_id && !groupMembersPanel.classList.contains('hidden')) {
        loadChatMembersPanel(data.chat_id);
    }
    // Update members count in chat list
    updateChatMembersCount(data.chat_id);
    // Cache the new member
    if (data.user_id && data.user_name) {
        usersCache[data.user_id] = { name: data.user_name, email: '', is_online: false };
    }
}

function handleMemberLeft(data) {
    if (currentChatId === data.chat_id && !groupMembersPanel.classList.contains('hidden')) {
        loadChatMembersPanel(data.chat_id);
    }
    updateChatMembersCount(data.chat_id);
}

function updateChatMembersCount(chatId) {
    getChatMembers(chatId).then(members => {
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (chatItem) {
            const infoEl = chatItem.querySelector('.chat-item-members-info');
            if (infoEl) infoEl.textContent = `${members.length} members`;
        }
    }).catch(() => {});
}

function connectNotificationWebSocket() {
    if (notificationWs) notificationWs.close();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications?token=${authToken}`;
    notificationWs = new WebSocket(wsUrl);

    notificationWs.onopen = () => { console.log('Notification WebSocket connected'); };

    notificationWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'read_receipt':
                if (data.chat_id) clearChatUnreadCount(data.chat_id);
                break;

            case 'new_message':
                if (data.chat_id) {
                    if (currentChatId === null) {
                        refreshChats();
                    } else if (data.chat_id !== currentChatId) {
                        updateChatUnreadCount(data.chat_id, 1);
                        void updateChatLastMessage(data.chat_id, data);
                    }
                }
                break;

            case 'user_status':
                updateUserOnlineStatusInCache(data.user_id, data.is_online);
                break;

            case 'added_to_group':
                refreshChats();
                break;

            case 'removed_from_group':
                refreshChats();
                if (currentChatId === data.chat_id) {
                    navigateToChats();
                }
                break;

            case 'key_recovery_requested':
                if (data.chat_id) refreshChats();
                if (window.E2EE && authToken && data.chat_id && data.requested_by && data.requested_by !== currentUserId) {
                    window.E2EE.shareChatKeyToUser(data.chat_id, data.requested_by, authToken).catch(() => {});
                }
                break;
        }
    };

    notificationWs.onerror = (error) => { console.error('Notification WebSocket error:', error); };
    notificationWs.onclose = async (event) => {
        console.log('Notification WebSocket disconnected');
        if (event.code === 4001 && authToken) {
            await handleUnauthorizedSession();
            return;
        }
        setTimeout(() => { if (authToken) connectNotificationWebSocket(); }, 3000);
    };
}

// Typing indicator
function sendTypingStatus(isTyping) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    websocket.send(JSON.stringify({ type: 'typing', chat_id: currentChatId, is_typing: isTyping }));
}

function handleTypingInput() {
    if (!isTyping) { isTyping = true; sendTypingStatus(true); }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { isTyping = false; sendTypingStatus(false); }, 1000);
}

let typingIndicatorEl = null;
function showTypingIndicator(userId, isTyping) {
    if (!typingIndicatorEl) {
        typingIndicatorEl = document.createElement('div');
        typingIndicatorEl.className = 'typing-indicator';
        typingIndicatorEl.innerHTML = '<span class="typing-text">typing</span>';
        // Insert at the bottom of messagesContainer
        messagesContainer.appendChild(typingIndicatorEl);
        typingIndicatorEl.style.order = '999'; // Ensure it's at the bottom (flexbox)
    }
    if (isTyping) {
        const userName = getUserDisplayName(userId);
        typingIndicatorEl.querySelector('.typing-text').textContent = `${userName} is typing...`;
        typingIndicatorEl.style.display = 'block';
        scrollToBottom();
    } else {
        typingIndicatorEl.style.display = 'none';
    }
}

// Chat names cache: { chatId: name }
let chatNamesCache = {};
// Direct chat other user: { chatId: otherUserId }
let chatOtherUserId = {};

// ==================== UI Rendering ====================
function renderChats(chats, animate = true) {
    chatsList.innerHTML = '';
    if (chats.length === 0) {
        chatsList.innerHTML = `
            <div class="empty-state">
                <p style="color: var(--text-secondary); text-align: center; padding: 40px 20px;">
                    No chats yet.<br>Create a Direct or Group chat above.
                </p>
            </div>
        `;
        return;
    }

    chats.forEach((chat, index) => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.id;
        if (animate) {
            chatItem.style.animationDelay = `${index * 0.05}s`;
        } else {
            chatItem.style.animation = 'none';
        }

        // Determine display name and avatar
        let chatName, subtitle, avatarHtml;
        let nameHtml = '';
        if (chat.is_group) {
            chatName = chat.name || 'Group Chat';
            chatNamesCache[chat.id] = chatName;
            subtitle = `${chat.members_count || 0} members`;
            avatarHtml = `<div class="chat-item-avatar">👥</div>`;
            nameHtml = `<div class="chat-item-name">${escapeHtml(chatName)}</div>`;
        } else {
            chatName = chatNamesCache[chat.id];
            if (!chatName) {
                chatName = getChatDisplayName(chat);
                chatNamesCache[chat.id] = chatName;
            }
            subtitle = '';
            const otherId = chatOtherUserId[chat.id];
            avatarHtml = getUserAvatarHtml(otherId);
            nameHtml = `<div class="chat-item-name user-clickable" data-user-id="${otherId}" role="button" tabindex="0">${escapeHtml(chatName)}</div>`;
        }

        const lastMessageTime = chat.last_message_at ? formatTime(chat.last_message_at) : '';
        const unreadCount = chat.unread_count || 0;

        const lastMessagePreview = formatChatListPreviewLine(chat);

        chatItem.innerHTML = `
            <div class="chat-item-content">
                <div class="chat-item-header">
                    <div class="chat-item-content-with-avatar">
                        ${avatarHtml}
                        <div>
                            ${nameHtml}
                            ${subtitle ? `<div style="font-size:0.7rem;color:var(--text-secondary);">${escapeHtml(subtitle)}</div>` : ''}
                        </div>
                    </div>
                    <div class="chat-item-time">${lastMessageTime}</div>
                </div>
                <div class="chat-item-footer">
                    <div class="chat-item-last-message">${escapeHtml(lastMessagePreview)}</div>
                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                </div>
            </div>
        `;

        chatItem.addEventListener('click', () => navigateToChat(chat.id, chatName, chat.is_group));
        chatsList.appendChild(chatItem);
    });
}

function getChatDisplayName(chat) {
    // For direct chats, we need to get members. But the response doesn't include them directly.
    // Use the name from usersCache if we've loaded it.
    // For backward compatibility during migration, also check user_id_1/user_id_2 if present.
    if (chat.user_id_1 || chat.user_id_2) {
        const otherId = chat.user_id_1 === currentUserId ? chat.user_id_2 : chat.user_id_1;
        return getUserDisplayName(otherId);
    }
    // For new structure, we rely on cached name from navigateToChat
    // Return a placeholder if not known
    return chat.name || 'Direct Chat';
}

async function updateChatLastMessage(chatId, messageData) {
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (!chatItem) return;
    const lastMessageEl = chatItem.querySelector('.chat-item-last-message');
    const timeEl = chatItem.querySelector('.chat-item-time');

    let inner = messageData.content || '';
    if (e2eeEnabled && window.E2EE?.loadChatKey(chatId) && (messageData.encrypted_payload || messageData.ciphertext)) {
        const msg = { ...messageData, chat_id: chatId };
        let d = await decryptMessageContentIfNeeded(msg);
        if (d === '[Encrypted message]') d = '';
        inner = d || '';
        if ((!inner || !String(inner).trim()) && messageData.file_url) {
            const pl = getEncryptedPayloadFromMessage(messageData);
            const aad = parseEncryptedAad(pl);
            if (aad?.file_nonce) inner = '';
        }
    }

    let messagePreview = inner;
    if (messageData.file_url) {
        const prefix = messageData.file_type === 'image' ? '📷' : '📎';
        const name = messageData.file_name || (messageData.file_type === 'image' ? 'Image' : 'File');
        messagePreview = messagePreview ? `${prefix} ${name}: ${messagePreview}` : `${prefix} ${name}`;
    }

    if (lastMessageEl) lastMessageEl.textContent = messagePreview;
    if (timeEl && messageData.created_at) timeEl.textContent = formatTime(messageData.created_at);
}

function updateChatUnreadCount(chatId, increment) {
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (!chatItem || currentChatId === chatId) return;

    const unreadBadge = chatItem.querySelector('.unread-badge');
    if (increment > 0) {
        if (!unreadBadge) {
            const footer = chatItem.querySelector('.chat-item-footer');
            if (footer) footer.innerHTML += '<span class="unread-badge">1</span>';
        } else {
            unreadBadge.textContent = parseInt(unreadBadge.textContent) + increment;
        }
    }
}

function clearChatUnreadCount(chatId) {
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (!chatItem) return;
    const unreadBadge = chatItem.querySelector('.unread-badge');
    if (unreadBadge) unreadBadge.remove();
}

// ==================== Messages Rendering ====================
async function loadMessages(chatId) {
    // Reset infinite scroll state
    resetInfiniteScroll();

    try {
        const messages = await getMessages(chatId);
        messagesContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (const msg of messages) {
            msg.display_content = await decryptMessageContentIfNeeded(msg);
            const isSent = msg.sender_id === currentUserId;
            const el = createMessageElement(msg, isSent);
            fragment.appendChild(el);
            void hydrateEncryptedImagePreviews(el, msg);
        }
        messagesContainer.appendChild(fragment);
        scrollToBottom();
        initInfiniteScroll();
    } catch (error) {
        console.error('Error loading messages:', error);
        renderMessagesLoadError(chatId);
    }
}

function createMessageElement(message, isSent) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;
    messageDiv.dataset.senderId = message.sender_id;

    // Context menu (right click / long press)
    messageDiv.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(e, message); return false; });
    let pressTimer;
    const showMenu = (e) => {
        e.preventDefault();
        showContextMenu({ preventDefault:()=>{}, stopPropagation:()=>{}, clientX:e.touches?.[0]?.clientX||e.clientX, clientY:e.touches?.[0]?.clientY||e.clientY, target:e.target }, message);
    };
    messageDiv.addEventListener('touchstart', (e) => { pressTimer = setTimeout(() => showMenu(e), 500); }, { passive: true });
    messageDiv.addEventListener('touchend', () => { if (pressTimer) clearTimeout(pressTimer); });
    messageDiv.addEventListener('touchmove', () => { if (pressTimer) clearTimeout(pressTimer); });
    messageDiv.addEventListener('mousedown', (e) => { if (e.button !== 2) pressTimer = setTimeout(() => showMenu(e), 500); });
    messageDiv.addEventListener('mouseup', () => { if (pressTimer) clearTimeout(pressTimer); });
    messageDiv.addEventListener('mouseleave', () => { if (pressTimer) clearTimeout(pressTimer); });

    // Build message avatar HTML
    const senderId = message.sender_id;
    const sender = usersCache[senderId] || {};
    const initials = (sender.name || sender.email?.split('@')[0] || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const avatarHtml = sender.avatar_url
        ? `<img src="${escapeHtml(sender.avatar_url)}" alt="Avatar">`
        : initials;

    let html = '';

    // Sender avatar + name for received messages (direct & group)
    if (!isSent) {
        html += `<div class="message-sender-row">
            <div class="message-avatar user-clickable" data-user-id="${senderId}" role="button" tabindex="0">${avatarHtml}</div>
            ${currentChatIsGroup ? `<div class="message-sender-name user-clickable" data-user-id="${senderId}" role="button" tabindex="0">${escapeHtml(getUserDisplayName(senderId))}</div>` : ''}
        </div>`;
    } else if (isSent) {
        html += `<div class="message-sender-row message-sender-row-sent">
            ${currentChatIsGroup ? `<div class="message-sender-name user-clickable" data-user-id="${senderId}" role="button" tabindex="0">${escapeHtml(getUserDisplayName(senderId))}</div>` : ''}
            <div class="message-avatar user-clickable" data-user-id="${senderId}" role="button" tabindex="0">${avatarHtml}</div>
        </div>`;
    }

    // Reply quote
    if (message.in_reply_to_id && message.reply_to_content) {
        const replyToName = message.reply_to_sender_name || getUserDisplayName(message.in_reply_to_user_id);
        const truncated = message.reply_to_content.length > 50 ? message.reply_to_content.substring(0, 50) + '...' : message.reply_to_content;
        html += `<div class="message-reply-quote" data-reply-to-id="${message.in_reply_to_id}">
            <strong>@${escapeHtml(replyToName)}</strong><span>${escapeHtml(truncated)}</span></div>`;
    }

    // Attachment
    if (message.file_url) {
        const payload = getEncryptedPayloadFromMessage(message);
        const aadMeta = parseEncryptedAad(payload);
        const isEncryptedFile = Boolean(aadMeta?.file_nonce);
        if (isEncryptedFile) {
            const safeName = escapeHtml(aadMeta.original_name || message.file_name || 'File');
            const mime = (aadMeta.original_type || '').toLowerCase();
            const isEncImage = mime.startsWith('image/');
            if (isEncImage) {
                html += `<div class="message-attachment message-attachment-encrypted-image"
                    data-file-url="${escapeHtml(message.file_url)}"
                    data-file-nonce="${escapeHtml(aadMeta.file_nonce)}"
                    data-file-name="${safeName}"
                    data-file-type="${escapeHtml(aadMeta.original_type || 'image/jpeg')}">
                    <div class="encrypted-media-placeholder"></div></div>`;
            } else {
                html += `<div class="message-attachment message-attachment-file message-attachment-encrypted"
                data-file-url="${escapeHtml(message.file_url)}"
                data-file-nonce="${escapeHtml(aadMeta.file_nonce)}"
                data-file-name="${safeName}"
                data-file-type="${escapeHtml(aadMeta.original_type || 'application/octet-stream')}">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div class="message-attachment-file-info"><div class="message-attachment-file-name">${safeName}</div><div class="message-attachment-file-size">Click to download</div></div></div>`;
            }
        } else if (message.file_type === 'image') {
            html += `<div class="message-attachment"><img src="${message.file_url}" alt="${escapeHtml(message.file_name||'Image')}" onclick="window.open('${message.file_url}','_blank')"></div>`;
        } else {
            html += `<div class="message-attachment message-attachment-file" onclick="window.open('${message.file_url}','_blank')">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div class="message-attachment-file-info"><div class="message-attachment-file-name">${escapeHtml(message.file_name||'File')}</div><div class="message-attachment-file-size">Click to download</div></div></div>`;
        }
    }

    const rawText = (message.display_content ?? message.content ?? '').trim();
    const showText = rawText.length > 0 && rawText !== '[Encrypted message]';

    // Content and meta
    html += `${showText ? `<div class="message-content">${escapeHtml(rawText)}</div>` : ''}
        <div class="message-meta">
            <span class="message-time">${formatTime(message.created_at)}</span>
            ${message.is_edited ? '<span class="message-edited">(edited)</span>' : ''}
            ${isSent ? getMessageStatusIcon(message) : ''}
        </div>`;

    messageDiv.innerHTML = html;

    // Reply quote click
    const replyQuote = messageDiv.querySelector('.message-reply-quote');
    if (replyQuote) {
        replyQuote.addEventListener('click', (e) => { e.stopPropagation(); scrollToMessage(parseInt(replyQuote.dataset.replyToId)); });
    }
    const encryptedAttachment = messageDiv.querySelector('.message-attachment-encrypted:not(.message-attachment-encrypted-image)');
    if (encryptedAttachment) {
        encryptedAttachment.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadAndDecryptAttachment(
                encryptedAttachment.dataset.fileUrl,
                encryptedAttachment.dataset.fileNonce,
                encryptedAttachment.dataset.fileName,
                encryptedAttachment.dataset.fileType,
            );
        });
    }

    return messageDiv;
}

function getMessageStatusIcon(message) {
    if (message.is_read) return '<span class="message-status read" title="Read">✓✓</span>';
    if (message.is_delivered) return '<span class="message-status delivered" title="Delivered">✓✓</span>';
    return '<span class="message-status sent" title="Sent">✓</span>';
}

async function addMessageToUI(message, isSent) {
    const existing = document.querySelector(`.message[data-message-id="${message.id}"]`);
    if (existing) return;
    message.display_content = await decryptMessageContentIfNeeded(message);
    const messageDiv = createMessageElement(message, isSent);
    void hydrateEncryptedImagePreviews(messageDiv, message);
    messageDiv.style.animation = 'messageSlideIn 0.3s ease backwards';
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function updateMessageStatuses(messageIds) {
    messageIds.forEach(id => {
        const msgEl = document.querySelector(`.message[data-message-id="${id}"]`);
        if (msgEl && msgEl.classList.contains('sent')) {
            const statusEl = msgEl.querySelector('.message-status');
            if (statusEl) { statusEl.className = 'message-status read'; statusEl.textContent = '✓✓'; statusEl.title = 'Read'; }
        }
    });
}

function updateAllMessagesAsRead() {
    document.querySelectorAll('.message.sent').forEach(msgEl => {
        const statusEl = msgEl.querySelector('.message-status');
        if (statusEl && !statusEl.classList.contains('read')) {
            statusEl.className = 'message-status read'; statusEl.textContent = '✓✓'; statusEl.title = 'Read';
        }
    });
}

function removeMessageFromUI(messageId) {
    const msgEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (msgEl) { msgEl.style.animation = 'messageSlideOut 0.3s ease forwards'; setTimeout(() => msgEl.remove(), 300); }
}

// ==================== User Online Status ====================
function updateUserOnlineStatusInCache(userId, isOnline) {
    if (usersCache[userId]) {
        usersCache[userId].is_online = isOnline;
        usersCache[userId].last_seen = isOnline ? null : new Date().toISOString();
    }
    updateChatItemOnlineStatus(userId, isOnline);
    // Update header status if viewing this user's direct chat
    if (currentChatId && !currentChatIsGroup && chatOtherUserId[currentChatId] == userId) {
        updateUserOnlineStatus(userId);
    }
}

function updateChatItemOnlineStatus(userId, isOnline) {
    // Find the chat where this user is the other participant
    const chatId = Object.keys(chatOtherUserId).find(id => chatOtherUserId[id] == userId);
    if (!chatId) return;

    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (!chatItem) return;

    const nameEl = chatItem.querySelector('.chat-item-name');
    if (!nameEl) return;

    // Remove existing status indicators
    const existingDot = nameEl.querySelector('.status-dot');
    if (existingDot) existingDot.remove();

    // Add online dot only if user is online (offline = no dot)
    if (isOnline) {
        const dot = document.createElement('span');
        dot.className = 'status-dot online';
        nameEl.insertBefore(dot, nameEl.firstChild);
    }
}

function updateUserOnlineStatus(userId) {
    const user = usersCache[userId];
    if (!user) return;

    // Update header avatar
    if (chatHeaderAvatar) {
        if (user.avatar_url) {
            chatHeaderAvatar.innerHTML = `<img src="${escapeHtml(user.avatar_url)}" alt="Avatar">`;
        } else {
            const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            chatHeaderAvatar.innerHTML = initials;
        }
        chatHeaderAvatar.classList.remove('hidden');
        chatHeaderAvatar.classList.add('user-clickable');
        chatHeaderAvatar.dataset.userId = String(userId);
    }

    // Update header status
    if (user.is_online) {
        chatHeaderStatus.innerHTML = '<span class="online-dot"></span> Online';
        chatHeaderStatus.classList.add('online');
    } else {
        const lastSeen = formatLastSeen(user.last_seen);
        chatHeaderStatus.innerHTML = `<span class="offline-dot"></span> Last seen ${lastSeen}`;
        chatHeaderStatus.classList.remove('online');
    }
}

// ==================== Section Visibility ====================
function showChatSection() { hideElement(authSection); showElement(chatSection); }
function showAuthSection() { showElement(authSection); hideElement(chatSection); }

// ==================== Load Chats & Users ====================
async function loadChats() {
    try {
        if (e2eeEnabled && window.E2EE && authToken) {
            await window.E2EE.uploadMyPublicKey(authToken);
        }
        const currentUser = await getCurrentUserInfo();
        if (!currentUser) {
            throw new Error('Could not load current user profile');
        }
        currentUserId = currentUser.id;
        usersCache[currentUserId] = {
            name: currentUser.name,
            email: currentUser.email,
            username: currentUser.username,
            phone: currentUser.phone,
            bio: currentUser.bio,
            avatar_url: currentUser.avatar_url,
            is_online: currentUser.is_online,
            last_seen: currentUser.last_seen
        };
        await loadUsers();
        const chats = await getChats();

        // Reset caches
        chatNamesCache = {};
        chatOtherUserId = {};

        // For direct chats, fetch members to get the other user's display name
        for (const chat of chats) {
            if (!chat.is_group) {
                try {
                    const members = await getChatMembers(chat.id);
                    const otherMember = members.find(m => m.user_id !== currentUserId);
                    if (otherMember) {
                        const chatName = otherMember.user_name || otherMember.user_email?.split('@')[0] || `User ${otherMember.user_id}`;
                        chatNamesCache[chat.id] = chatName;
                        chatOtherUserId[chat.id] = otherMember.user_id;
                        // Cache user info for online status
                        usersCache[otherMember.user_id] = {
                            name: otherMember.user_name || chatName,
                            email: otherMember.user_email || '',
                            username: otherMember.user_username || null,
                            avatar_url: otherMember.user_avatar_url || null,
                            is_online: false,
                            last_seen: null
                        };
                    }
                } catch(e) { /* ignore individual chat member errors */ }
            } else {
                // Group chats: cache the name from the response
                chatNamesCache[chat.id] = chat.name || 'Group Chat';
            }
        }

        await decorateChatListPreviews(chats);
        renderChats(chats, true);
    } catch (error) {
        console.error('Error loading chats:', error);
        if (!authToken || /401|unauthorized|not authenticated/i.test(String(error?.message || ''))) {
            await handleUnauthorizedSession();
            return;
        }
        showError('Failed to load chats. Please try logging in again.');
    }
}

async function loadUsers() {
    try {
        const users = await getUsers();
        users.forEach(user => {
            usersCache[user.id] = {
                name: user.name,
                email: user.email,
                username: user.username,
                avatar_url: user.avatar_url,
                is_online: user.is_online,
                last_seen: user.last_seen
            };
        });
    } catch (error) { console.error('Error loading users:', error); }
}

// ==================== Context Menu ====================
function showContextMenu(e, message) {
    e.preventDefault();
    contextMenuTarget = message;
    contextMessageId = message.id;
    contextChatId = currentChatId;

    let x = e.clientX, y = e.clientY;
    if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
    if (y + 200 > window.innerHeight) y = window.innerHeight - 210;

    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.remove('hidden');
    contextMenu.style.display = 'flex';

    const pinBtn = contextMenu.querySelector('[data-action="pin"] .pin-text');
    if (pinBtn) pinBtn.textContent = message.is_pinned ? 'Unpin' : 'Pin';

    const editBtn = contextMenu.querySelector('[data-action="edit"]');
    const deleteBtn = contextMenu.querySelector('[data-action="delete"]');
    const isSent = message.sender_id === currentUserId;
    editBtn.style.display = isSent ? 'flex' : 'none';
    deleteBtn.style.display = isSent ? 'flex' : 'none';

    return false;
}

function hideContextMenu() {
    if (contextMenu) { contextMenu.classList.add('hidden'); contextMenu.style.display = 'none'; }
    contextMenuTarget = null;
    contextMessageId = null;
    contextChatId = null;
}

document.addEventListener('click', (e) => {
    const userTarget = e.target.closest('.user-clickable');
    if (userTarget && userTarget.dataset.userId) {
        e.preventDefault();
        e.stopPropagation();
        openUserInfoModal(parseInt(userTarget.dataset.userId));
        return;
    }
    if (contextMenu && !e.target.closest('#context-menu')) hideContextMenu();
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const userTarget = e.target.closest('.user-clickable');
    if (!userTarget || !userTarget.dataset.userId) return;
    e.preventDefault();
    openUserInfoModal(parseInt(userTarget.dataset.userId));
});
document.addEventListener('contextmenu', (e) => { if (e.target.closest('.message')) { e.preventDefault(); return false; } }, { passive: false });

contextMenu.addEventListener('click', async (e) => {
    const item = e.target.closest('.context-menu-item');
    if (!item || !contextMessageId) return;
    const action = item.dataset.action;
    switch (action) {
        case 'edit': startEditingMessage(contextMessageId, contextMenuTarget.content); break;
        case 'delete': await deleteMessage(contextChatId, contextMessageId); break;
        case 'pin':
            if (contextMenuTarget.is_pinned) await unpinMessage(contextChatId, contextMessageId);
            else await pinMessage(contextChatId, contextMessageId);
            break;
        case 'reply': setReplyingTo(contextMenuTarget); break;
    }
    hideContextMenu();
});

// ==================== Reply ====================
function setReplyingTo(message) {
    replyingToMessage = { id: message.id, sender_id: message.sender_id, content: message.content };
    const senderName = getUserDisplayName(message.sender_id);
    if (replyPreview && replyPreviewText) { replyPreviewText.textContent = senderName; replyPreview.classList.remove('hidden'); }
    messageInput.focus();
}

function cancelReply() {
    replyingToMessage = null;
    if (replyPreview) replyPreview.classList.add('hidden');
    messageInput.focus();
}

if (cancelReplyBtn) cancelReplyBtn.addEventListener('click', cancelReply);

// ==================== File Upload ====================
function selectFile(file) {
    selectedFile = file;
    if (filePreview && filePreviewName) { filePreviewName.textContent = file.name; filePreview.classList.remove('hidden'); }
}

function cancelFileSelection() {
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (filePreview) filePreview.classList.add('hidden');
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/uploads/file`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: formData,
    });
    if (!response.ok) { const error = await response.json(); throw new Error(error.detail || 'Failed to upload file'); }
    return await response.json();
}

function initFileUpload() {
    if (fileInput) fileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) selectFile(file); });
    if (attachFileBtn) attachFileBtn.addEventListener('click', () => { if (fileInput) fileInput.click(); });
    if (cancelFileBtn) cancelFileBtn.addEventListener('click', cancelFileSelection);
}
initFileUpload();

// ==================== Message Editing ====================
function startEditingMessage(messageId, currentContent) {
    editingMessageId = messageId;
    messageInput.value = currentContent;
    messageInput.focus();
    messageInput.placeholder = 'Edit message... (Press Esc to cancel)';
}

function cancelEditing() {
    editingMessageId = null;
    messageInput.value = '';
    messageInput.placeholder = 'Type a message...';
}

async function sendMessageEdit(messageId, newContent) {
    try {
        const payload = { content: newContent };
        if (e2eeEnabled && window.E2EE?.loadChatKey(currentChatId)) {
            payload.encrypted_payload = await window.E2EE.encryptText(currentChatId, newContent || '');
            payload.content = null;
        }
        const response = await fetch(`${API_BASE_URL}/chats/${currentChatId}/messages/${messageId}/edit`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error((await response.json()).detail || 'Failed to edit message');
        const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageEl) {
            const contentEl = messageEl.querySelector('.message-content');
            if (contentEl) contentEl.textContent = newContent || '';
            let editedEl = messageEl.querySelector('.message-edited');
            if (!editedEl) {
                const metaEl = messageEl.querySelector('.message-meta');
                editedEl = document.createElement('span'); editedEl.className = 'message-edited'; editedEl.textContent = '(edited)';
                if (metaEl) metaEl.insertBefore(editedEl, metaEl.lastElementChild);
            }
        }
        cancelEditing();
    } catch (error) { console.error('Error editing message:', error); alert('Failed to edit message: ' + error.message); }
}

// ==================== Pinned Messages ====================
async function loadPinnedMessages(chatId) {
    try {
        const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages/pinned`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error('Failed to load pinned messages');
        await renderPinnedMessages(await response.json());
    } catch (error) { console.error('Error loading pinned messages:', error); }
}

async function renderPinnedMessages(messages) {
    pinnedMessagesList.innerHTML = '';
    if (messages.length === 0) {
        pinnedMessagesList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No pinned messages</p>';
        return;
    }
    for (const msg of messages) {
        let inner = await decryptMessageContentIfNeeded({ ...msg, chat_id: currentChatId });
        if (inner === '[Encrypted message]') inner = '';
        let preview = inner;
        if (msg.file_url) {
            const pl = getEncryptedPayloadFromMessage(msg);
            const aad = parseEncryptedAad(pl);
            const isImg = (msg.file_type === 'image') || (aad?.original_type?.toLowerCase().startsWith('image/'));
            const icon = isImg ? '📷' : '📎';
            const name = aad?.original_name || msg.file_name || (isImg ? 'Image' : 'File');
            preview = preview ? `${icon} ${name}: ${preview}` : `${icon} ${name}`;
        }
        if (!preview) preview = '…';
        const item = document.createElement('div');
        item.className = 'pinned-message-item';
        item.innerHTML = `<div class="pinned-message-content">${escapeHtml(preview)}</div>
            <div class="pinned-message-meta"><span>${formatTime(msg.created_at)}</span><span>📌</span></div>`;
        item.addEventListener('click', async () => {
            const found = await ensureMessageLoadedAndScroll(msg.id);
            if (!found) {
                alert('Could not locate pinned message in chat history');
                return;
            }
            const el = document.querySelector(`.message[data-message-id="${msg.id}"]`);
            if (el) {
                el.style.animation = 'pulse 0.5s ease';
                setTimeout(() => { el.style.animation = ''; }, 500);
            }
        });
        pinnedMessagesList.appendChild(item);
    }
}

function togglePinnedPanel() {
    if (pinnedPanel.classList.contains('hidden')) { loadPinnedMessages(currentChatId); pinnedPanel.classList.remove('hidden'); }
    else pinnedPanel.classList.add('hidden');
}

async function pinMessage(chatId, messageId) {
    try {
        const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages/${messageId}/pin`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error('Failed to pin message');
        const el = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (el) el.dataset.isPinned = 'true';
        if (!pinnedPanel.classList.contains('hidden')) loadPinnedMessages(chatId);
    } catch (error) { console.error('Error pinning message:', error); }
}

async function unpinMessage(chatId, messageId) {
    try {
        const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages/${messageId}/unpin`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error('Failed to unpin message');
        const el = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (el) el.dataset.isPinned = 'false';
        if (!pinnedPanel.classList.contains('hidden')) loadPinnedMessages(chatId);
    } catch (error) { console.error('Error unpinning message:', error); }
}

// ==================== Message Search ====================
function toggleSearch() {
    if (searchBar.classList.contains('hidden')) { searchBar.classList.remove('hidden'); searchInput.focus(); }
    else { searchBar.classList.add('hidden'); searchInput.value = ''; clearSearchResults(); }
}

function clearSearchResults() {
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    searchResults = []; currentSearchIndex = -1;
    const infoEl = document.getElementById('search-results-info');
    if (infoEl) infoEl.textContent = '';
}

function updateSearchResultsInfo() {
    const infoEl = document.getElementById('search-results-info');
    if (!infoEl) return;
    infoEl.textContent = searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : 'No results';
}

function navigateSearchResults(direction) {
    if (searchResults.length === 0) return;
    if (searchNavTimeout) clearTimeout(searchNavTimeout);
    searchNavTimeout = setTimeout(() => {
        void (async () => {
            if (currentSearchIndex >= 0 && currentSearchIndex < searchResults.length) {
                const prevEl = document.querySelector(`.message[data-message-id="${searchResults[currentSearchIndex].id}"]`);
                if (prevEl) prevEl.classList.remove('search-highlight');
            }
            currentSearchIndex += direction;
            if (currentSearchIndex < 0) currentSearchIndex = searchResults.length - 1;
            if (currentSearchIndex >= searchResults.length) currentSearchIndex = 0;
            const mid = searchResults[currentSearchIndex].id;
            await ensureMessageLoadedAndScroll(mid);
            const msgEl = document.querySelector(`.message[data-message-id="${mid}"]`);
            if (msgEl) {
                msgEl.classList.add('search-highlight');
                scrollToMessage(mid);
            }
            updateSearchResultsInfo();
        })();
    }, 50);
}

function httpErrorDetailString(detail) {
    if (detail == null) return '';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((e) => (typeof e === 'object' && e !== null && 'msg' in e ? String(e.msg) : JSON.stringify(e)))
            .join(' ');
    }
    return String(detail);
}

function searchMessagesInLoadedDom(queryLower) {
    return Array.from(document.querySelectorAll('.message'))
        .map((el) => {
            const content = el.querySelector('.message-content')?.textContent || '';
            const id = parseInt(el.dataset.messageId, 10);
            return { id, _content: content.toLowerCase() };
        })
        .filter((item) => !Number.isNaN(item.id) && item._content.includes(queryLower))
        .map(({ id }) => ({ id }));
}

async function searchMessagesInEncryptedHistory(queryLower) {
    if (!currentChatId) return [];
    await prepareChatKeyIfNeeded(currentChatId);
    if (!e2eeEnabled || !window.E2EE?.loadChatKey(currentChatId)) {
        return searchMessagesInLoadedDom(queryLower);
    }
    const matches = [];
    let offset = 0;
    while (true) {
        const batch = await getMessages(currentChatId, MESSAGES_PAGE_SIZE, offset);
        if (!batch.length) break;
        for (const msg of batch) {
            let haystack = '';
            const payload = getEncryptedPayloadFromMessage(msg);
            if (payload) {
                let text = await decryptMessageContentIfNeeded({ ...msg, chat_id: currentChatId });
                if (text === '[Encrypted message]') text = '';
                haystack = (text || '').toLowerCase();
                if (!haystack.trim() && msg.file_url) {
                    const aad = parseEncryptedAad(payload);
                    haystack = `${aad?.original_name || ''} ${msg.file_name || ''}`.toLowerCase();
                }
            } else {
                haystack = (msg.content || '').toLowerCase();
                if (msg.file_url && !haystack.includes(queryLower)) {
                    haystack += ` ${(msg.file_name || '').toLowerCase()}`;
                }
            }
            if (haystack.includes(queryLower)) {
                matches.push({ id: msg.id });
            }
        }
        if (batch.length < MESSAGES_PAGE_SIZE) break;
        offset += MESSAGES_PAGE_SIZE;
    }
    return matches;
}

async function searchMessages(query) {
    if (!query || query.length < 2) { clearSearchResults(); return; }
    const qLower = query.toLowerCase();
    try {
        const response = await fetch(`${API_BASE_URL}/chats/${currentChatId}/messages/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const detail = httpErrorDetailString(body.detail).toLowerCase();
            if (detail.includes('encrypt') || detail.includes('server-side search')) {
                const localMatches = await searchMessagesInEncryptedHistory(qLower);
                searchResults = localMatches;
                highlightSearchResults(localMatches);
                navigateSearchResults(1);
                return;
            }
            throw new Error(httpErrorDetailString(body.detail) || 'Search failed');
        }
        const messages = await response.json();
        searchResults = messages; currentSearchIndex = -1;
        highlightSearchResults(messages);
        navigateSearchResults(1);
    } catch (error) {
        console.error('Error searching messages:', error);
        const localMatches = e2eeEnabled && window.E2EE?.loadChatKey(currentChatId)
            ? await searchMessagesInEncryptedHistory(qLower)
            : searchMessagesInLoadedDom(qLower);
        searchResults = localMatches;
        highlightSearchResults(localMatches);
        navigateSearchResults(1);
    }
}

function highlightSearchResults(messages) {
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    document.querySelectorAll('.search-result').forEach(el => el.classList.remove('search-result'));
    messages.forEach(msg => {
        const el = document.querySelector(`.message[data-message-id="${msg.id}"]`);
        if (el) el.classList.add('search-result');
    });
    searchResults = messages; currentSearchIndex = -1; updateSearchResultsInfo();
}

// ==================== Delete Message ====================
async function deleteMessage(chatId, messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages/${messageId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error('Failed to delete message');
        const el = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (el) { el.style.animation = 'messageSlideOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }
    } catch (error) { console.error('Error deleting message:', error); }
}

// ==================== Group Members Panel ====================
async function loadChatMembersPanel(chatId) {
    try {
        const members = await getChatMembers(chatId);
        currentChatMembers = members;
        renderGroupMembers(members);

        // Show/hide add member section based on admin role
        const me = members.find(m => m.user_id === currentUserId);
        const isAdmin = me && me.role === 'admin';
        if (isAdmin) showElement(addMemberSection);
        else hideElement(addMemberSection);

        // Show leave group button
        showElement(leaveGroupSection);
    } catch (error) { console.error('Error loading members:', error); }
}

function renderGroupMembers(members) {
    groupMembersList.innerHTML = '';
    if (members.length === 0) {
        groupMembersList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No members</p>';
        return;
    }

    members.forEach(member => {
        const item = document.createElement('div');
        item.className = 'group-member-item';

        // Cache user info
        const name = member.user_name || getUserDisplayName(member.user_id);
        const email = member.user_email || '';
        usersCache[member.user_id] = {
            name,
            email,
            username: member.user_username || null,
            avatar_url: member.user_avatar_url || null,
            is_online: false,
            last_seen: null
        };

        // Build avatar HTML
        const avatarHtml = member.user_avatar_url
            ? `<img src="${escapeHtml(member.user_avatar_url)}" alt="Avatar">`
            : getUserInitials(member.user_id);

        const isMe = member.user_id === currentUserId;
        const meMember = currentChatMembers.find(m => m.user_id === currentUserId);
        const isAdmin = meMember && meMember.role === 'admin';
        const canKick = isAdmin && member.role !== 'admin' && !isMe;

        item.innerHTML = `
            <div class="group-member-avatar user-clickable" data-user-id="${member.user_id}" role="button" tabindex="0">${avatarHtml}</div>
            <div class="group-member-info">
                <div class="group-member-name user-clickable" data-user-id="${member.user_id}" role="button" tabindex="0">${escapeHtml(name)}${isMe ? ' (you)' : ''}</div>
                <div class="group-member-email">${escapeHtml(email)}</div>
            </div>
            <span class="group-member-role">${member.role}</span>
            ${canKick ? `<button class="group-member-kick-btn" data-user-id="${member.user_id}" title="Remove member">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>` : ''}
        `;
        groupMembersList.appendChild(item);
    });

    // Kick handlers
    groupMembersList.querySelectorAll('.group-member-kick-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.dataset.userId);
            if (!confirm('Remove this member?')) return;
            try {
                await removeChatMember(currentChatId, userId);
                loadChatMembersPanel(currentChatId);
            } catch (error) { alert('Failed to remove member: ' + error.message); }
        });
    });
}

// ==================== Modals ====================
async function openDirectChatModal() {
    showElement(directChatModal);
    await renderFriendCheckboxes();
}

function closeDirectChatModal() {
    hideElement(directChatModal);
    directChatForm.reset();
    hideElement(directChatError);
    hideElement(directChatNoFriends);
}

async function renderFriendCheckboxes() {
    try {
        const friends = await getMyFriends();
        directChatFriendsSelect.innerHTML = '';

        if (friends.length === 0) {
            showElement(directChatNoFriends);
            return;
        }

        hideElement(directChatNoFriends);

        friends.forEach(friend => {
            const div = document.createElement('label');
            div.className = 'friend-checkbox';
            const initials = (friend.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            div.innerHTML = `
                <input type="checkbox" name="direct-chat-friend" value="${friend.user_id}">
                <div class="friend-avatar-select">${friend.avatar_url ? `<img src="${escapeHtml(friend.avatar_url)}" alt="Avatar">` : initials}</div>
                <span class="friend-name-select">${escapeHtml(friend.name)}</span>
                ${friend.username ? `<span class="friend-username-select">@${escapeHtml(friend.username)}</span>` : ''}
            `;
            directChatFriendsSelect.appendChild(div);
        });
    } catch (error) { console.error('Error loading friends for direct chat:', error); }
}

function openGroupChatModal() {
    showElement(groupChatModal);
    groupChatNameInput.value = '';
    renderMemberCheckboxes();
}
function closeGroupChatModal() { hideElement(groupChatModal); groupChatForm.reset(); }

async function renderMemberCheckboxes() {
    try {
        const friends = await getMyFriends();
        groupMembersSelect.innerHTML = '';
        
        if (friends.length === 0) {
            groupMembersSelect.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 12px;">No friends to add. Add friends first!</p>';
            return;
        }
        
        friends.forEach(friend => {
            if (friend.user_id === currentUserId) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'member-checkbox';
            const initials = (friend.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            wrapper.innerHTML = `
                <label style="display:flex;align-items:center;gap:12px;width:100%;cursor:pointer;">
                    <input type="checkbox" name="group-member" value="${friend.user_id}">
                    <div class="member-avatar-small">${friend.avatar_url ? `<img src="${escapeHtml(friend.avatar_url)}" alt="Avatar">` : initials}</div>
                    <div class="member-info-row">
                        <span class="member-name">${escapeHtml(friend.name)}</span>
                        ${friend.username ? `<span class="member-username">@${escapeHtml(friend.username)}</span>` : ''}
                    </div>
                </label>
            `;
            groupMembersSelect.appendChild(wrapper);
        });
    } catch (error) { console.error('Error loading friends for group creation:', error); }
}

// ==================== Event Listeners ====================
showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); hideElement(loginForm); showElement(registerForm); });
showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); hideElement(registerForm); showElement(loginForm); });
showRegisterFromLinkBtn.addEventListener('click', (e) => { e.preventDefault(); hideElement(linkDeviceForm); showElement(registerForm); });
showLoginFromLinkBtn.addEventListener('click', (e) => { e.preventDefault(); hideElement(linkDeviceForm); showElement(loginForm); });
if (showLinkFromLoginBtn) {
    showLinkFromLoginBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        hideElement(loginForm); 
        showElement(linkDeviceForm); 
    });
}

// Link device form submission - for QR code login on new device
linkDeviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = linkTokenInput.value.trim();
    if (!token) {
        showModalError(linkDeviceError, 'Please enter a pairing token or scan QR code');
        return;
    }
    
    try {
        // Generate keys for this new device
        const keyPair = await generateDeviceKeyPair();
        
        // Confirm pairing using the token from existing device
        const result = await confirmDevicePairing(token, keyPair.publicKey);
        
        // Store the auth token and user info from the response
        authToken = result.access_token;
        localStorage.setItem('authToken', authToken);
        currentUserId = result.user.id;
        localStorage.setItem('currentUserId', currentUserId);
        
        showElement(linkDeviceSuccess);
        hideElement(linkDeviceError);
        setTimeout(() => {
            hideElement(linkDeviceSuccess);
            linkDeviceForm.reset();
            hideElement(linkDeviceForm);
            
            // Navigate to chat section directly - user is now logged in
            showChatSection();
            loadChats();
            connectNotificationWebSocket();
        }, 2000);
    } catch (error) {
        showModalError(linkDeviceError, error.message);
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try { 
        await login(email, password); 
        showChatSection(); 
        await loadChats();
        connectNotificationWebSocket();
    }
    catch (error) { showError(error.message); }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const name = document.getElementById('register-name').value;
    const username = document.getElementById('register-username').value.trim() || null;
    const password = document.getElementById('register-password').value;
    const passwordCheck = document.getElementById('register-password-check').value;
    try {
        const result = await register(email, name, username, password, passwordCheck);
        // If registration returned access_token, auto-login
        if (result && result.access_token) {
            authToken = result.access_token;
            localStorage.setItem('authToken', authToken);
            currentUserId = result.user.id;
            localStorage.setItem('currentUserId', currentUserId);
            showChatSection();
            await loadChats();
            connectNotificationWebSocket();
        } else {
            hideElement(registerForm); 
            showElement(loginForm);
            document.getElementById('login-email').value = email;
        }
    } catch (error) { showError(error.message); }
});

logoutBtn.addEventListener('click', async () => { await logout(); showAuthSection(); loginForm.reset(); });
backToChatsBtn.addEventListener('click', () => { navigateToChats(); });

// Create direct chat
createDirectChatBtn.addEventListener('click', () => { openDirectChatModal(); });
closeDirectModalBtn.addEventListener('click', closeDirectChatModal);
directChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedFriend = directChatFriendsSelect.querySelector('input[name="direct-chat-friend"]:checked');
    if (!selectedFriend) { showModalError(directChatError, 'Please select a friend'); return; }
    const friendId = parseInt(selectedFriend.value);
    try {
        const chat = await createDirectChat(friendId);
        closeDirectChatModal();
        await loadChats();
        // Navigate to the new chat
        const friendInfo = usersCache[friendId] || { name: 'Chat' };
        navigateToChat(chat.id, friendInfo.name, false);
    } catch (error) { showModalError(directChatError, error.message); }
});

// Create group chat
createGroupChatBtn.addEventListener('click', () => { openGroupChatModal(); });
closeGroupModalBtn.addEventListener('click', closeGroupChatModal);
groupChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = groupChatNameInput.value.trim();
    if (!name) { alert('Please enter a group name'); return; }

    const selectedMembers = Array.from(groupMembersSelect.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
    if (selectedMembers.length === 0) { alert('Please select at least one member'); return; }

    try {
        const chat = await createGroupChat(name, selectedMembers);
        closeGroupChatModal();
        await loadChats();
        navigateToChat(chat.id, name, true);
        loadChatMembersPanel(chat.id);
    } catch (error) { alert('Failed to create group: ' + error.message); }
});

// Message input and send
messageInput.addEventListener('input', handleTypingInput);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessageBtn.click(); });

sendMessageBtn.addEventListener('click', async () => {
    const content = messageInput.value.trim();
    if (!content && !selectedFile) return;

    if (editingMessageId) {
        await sendMessageEdit(editingMessageId, content);
        return;
    }

    if (!currentChatId) return;

    try {
        let fileData = null;
        let fileMeta = null;
        if (selectedFile) {
            if (e2eeEnabled && window.E2EE?.loadChatKey(currentChatId)) {
                const encryptedFile = await window.E2EE.encryptFile(currentChatId, selectedFile);
                fileData = await uploadFile(
                    new File([encryptedFile.blob], `${selectedFile.name}.enc`, { type: 'application/octet-stream' })
                );
                fileMeta = {
                    file_nonce: encryptedFile.nonce,
                    original_name: encryptedFile.originalName,
                    original_type: encryptedFile.originalType,
                };
            } else {
                fileData = await uploadFile(selectedFile);
            }
        }

        const messagePayload = { content: content || '' };
        if (e2eeEnabled && window.E2EE?.loadChatKey(currentChatId)) {
            messagePayload.encrypted_payload = await window.E2EE.encryptText(currentChatId, content || '', fileMeta);
            messagePayload.content = '';
        }
        if (replyingToMessage) messagePayload.in_reply_to_id = replyingToMessage.id;
        if (fileData) { messagePayload.file_url = fileData.file_url; messagePayload.file_type = fileData.file_type; messagePayload.file_name = fileData.file_name; }

        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify(messagePayload));
        } else {
            await sendMessageWithReply(currentChatId, messagePayload);
        }

        messageInput.value = ''; messageInput.focus();
        if (replyingToMessage) cancelReply();
        if (selectedFile) cancelFileSelection();
        if (isTyping) { isTyping = false; sendTypingStatus(false); }
    } catch (error) { 
        console.error('Error sending message:', error); 
        alert('Failed to send message: ' + error.message); 
    }
});

// Group members panel events
chatTitle.addEventListener('click', () => {
    if (!currentChatIsGroup && currentChatId && chatOtherUserId[currentChatId]) {
        openUserInfoModal(chatOtherUserId[currentChatId]);
        return;
    }
    if (currentChatIsGroup && currentChatId) {
        if (groupMembersPanel.classList.contains('hidden')) {
            loadChatMembersPanel(currentChatId);
            showElement(groupMembersPanel);
        } else {
            hideElement(groupMembersPanel);
        }
    }
});
chatTitle.style.cursor = 'pointer';

closeMembersPanelBtn.addEventListener('click', () => { hideElement(groupMembersPanel); });

addMemberBtn.addEventListener('click', async () => {
    const email = addMemberEmailInput.value.trim();
    if (!email) { alert('Please enter an email'); return; }
    try {
        const users = await getUsers();
        const user = users.find(u => u.email === email);
        if (!user) throw new Error('User not found');
        await addChatMember(currentChatId, user.id);
        addMemberEmailInput.value = '';
        loadChatMembersPanel(currentChatId);
    } catch (error) { alert('Failed to add member: ' + error.message); }
});

leaveGroupBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    try {
        await removeChatMember(currentChatId, currentUserId);
        hideElement(groupMembersPanel);
        navigateToChats();
        await loadChats();
    } catch (error) { alert('Failed to leave group: ' + error.message); }
});

// Feature buttons
if (togglePinnedBtn) togglePinnedBtn.addEventListener('click', togglePinnedPanel);
if (closePinnedBtn) closePinnedBtn.addEventListener('click', () => pinnedPanel.classList.add('hidden'));
if (toggleSearchBtn) toggleSearchBtn.addEventListener('click', toggleSearch);
if (closeSearchBtn) closeSearchBtn.addEventListener('click', () => { searchBar.classList.add('hidden'); searchInput.value = ''; clearSearchResults(); });
if (searchInput) {
    searchInput.addEventListener('input', (e) => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => searchMessages(e.target.value), 300); });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') toggleSearch();
        else if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); navigateSearchResults(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); navigateSearchResults(-1); }
    });
}
// Search navigation buttons
if (searchPrevBtn) searchPrevBtn.addEventListener('click', () => navigateSearchResults(-1));
if (searchNextBtn) searchNextBtn.addEventListener('click', () => navigateSearchResults(1));
messageInput.addEventListener('keydown', (e) => { if (e.key === 'Escape' && editingMessageId) cancelEditing(); });

// ==================== Main Tabs (Chats/Friends) ====================
if (tabChats) {
    tabChats.addEventListener('click', () => switchToTab('chats'));
}
if (tabFriends) {
    tabFriends.addEventListener('click', () => switchToTab('friends'));
}
if (tabSettings) {
    tabSettings.addEventListener('click', () => switchToTab('settings'));
}

// ==================== Friends Sub-tabs ====================
if (friendsTabAll) {
    friendsTabAll.addEventListener('click', () => switchFriendsTab('all'));
}
if (friendsTabRequests) {
    friendsTabRequests.addEventListener('click', () => switchFriendsTab('requests'));
}
if (friendsTabSearch) {
    friendsTabSearch.addEventListener('click', () => switchFriendsTab('search'));
}

// ==================== Search User ====================
if (searchUserBtn) {
    searchUserBtn.addEventListener('click', searchUserAndRender);
}
if (searchUserInput) {
    searchUserInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); searchUserAndRender(); }
    });
}

// ==================== Profile Modal ====================
function openProfileModal() {
    const user = usersCache[currentUserId];
    if (!user) return;

    profileEmail.value = user.email || '';
    profileName.value = user.name || '';
    profileUsername.value = user.username || '';
    profilePhone.value = user.phone || '';
    profileBio.value = user.bio || '';

    // Render avatar
    if (user.avatar_url) {
        profileAvatarDisplay.innerHTML = `<img src="${escapeHtml(user.avatar_url)}" alt="Avatar">`;
    } else {
        const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        profileAvatarDisplay.innerHTML = initials;
    }

    hideElement(profileSuccess);
    hideElement(profileError);
    showElement(profileModal);
}

function closeProfileModal() {
    hideElement(profileModal);
}

async function saveProfile() {
    const updateData = {
        name: profileName.value.trim(),
        username: profileUsername.value.trim() || null,
        phone: profilePhone.value.trim() || null,
        bio: profileBio.value.trim() || null,
    };

    const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(updateData),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to update profile');
    return data;
}

async function uploadAvatarFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/uploads/file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload avatar');
    }
    return await response.json();
}

async function setAvatarUrl(avatarUrl) {
    const response = await fetch(`${API_BASE_URL}/users/me/avatar?avatar_url=${encodeURIComponent(avatarUrl)}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to update avatar');
    return data;
}

if (profileBtn) profileBtn.addEventListener('click', openProfileModal);
if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfileModal);
if (profileModal) {
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) closeProfileModal();
    });
}
if (closeUserInfoBtn) closeUserInfoBtn.addEventListener('click', closeUserInfoModal);
if (userInfoModal) {
    userInfoModal.addEventListener('click', (e) => {
        if (e.target === userInfoModal) closeUserInfoModal();
    });
}
if (userInfoChatBtn) {
    userInfoChatBtn.addEventListener('click', async () => {
        if (!selectedUserInfoId || selectedUserInfoId === currentUserId) return;
        try {
            const targetUserId = selectedUserInfoId;
            const chat = await createDirectChat(targetUserId);
            let chatDisplayName = '';
            try {
                const freshUser = await getUserInfoById(targetUserId);
                usersCache[targetUserId] = { ...(usersCache[targetUserId] || {}), ...freshUser };
                chatDisplayName = freshUser.name || freshUser.email?.split('@')[0] || '';
            } catch (_) {
                chatDisplayName = getUserDisplayName(targetUserId);
            }
            closeUserInfoModal();
            await loadChats();
            if (!chatDisplayName || chatDisplayName.startsWith('User ')) {
                chatDisplayName = chatNamesCache[chat.id] || getUserDisplayName(targetUserId);
            }
            navigateToChat(chat.id, chatDisplayName, false);
        } catch (error) {
            alert('Failed to create chat: ' + error.message);
        }
    });
}
if (userInfoFriendBtn) {
    userInfoFriendBtn.addEventListener('click', async () => {
        if (!selectedUserInfoId || selectedUserInfoId === currentUserId || userInfoFriendBtn.disabled) return;
        try {
            await sendFriendRequest(selectedUserInfoId);
            userInfoFriendBtn.disabled = true;
            userInfoFriendBtn.textContent = 'Request sent';
            await loadPendingRequests();
        } catch (error) {
            alert(error.message);
        }
    });
}

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideElement(profileError);
        hideElement(profileSuccess);
        try {
            const updatedUser = await saveProfile();
            // Update cache
            usersCache[currentUserId] = {
                ...usersCache[currentUserId],
                name: updatedUser.name,
                username: updatedUser.username,
                phone: updatedUser.phone,
                bio: updatedUser.bio,
                avatar_url: updatedUser.avatar_url,
            };
            showElement(profileSuccess);
            setTimeout(() => hideElement(profileSuccess), 3000);
        } catch (error) {
            profileError.textContent = error.message;
            showElement(profileError);
        }
    });
}

if (avatarUploadInput) {
    avatarUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        hideElement(profileError);
        hideElement(profileSuccess);
        try {
            const result = await uploadAvatarFile(file);
            const avatarUrl = result.file_url;
            await setAvatarUrl(avatarUrl);
            // Update cache and display
            usersCache[currentUserId].avatar_url = avatarUrl;
            profileAvatarDisplay.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="Avatar">`;
            showElement(profileSuccess);
            setTimeout(() => hideElement(profileSuccess), 3000);
        } catch (error) {
            profileError.textContent = error.message;
            showElement(profileError);
        }
        avatarUploadInput.value = '';
    });
}

// ==================== Logout update ====================
window.addEventListener('DOMContentLoaded', async () => {
    initUiScaleSettings();
    initDeviceElements(); // Initialize device management elements
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        authToken = savedToken;
        const currentUser = await getCurrentUserInfo();
        if (!currentUser) {
            await handleUnauthorizedSession();
        } else {
            currentUserId = currentUser.id;
            usersCache[currentUserId] = {
                ...(usersCache[currentUserId] || {}),
                name: currentUser.name,
                email: currentUser.email,
                username: currentUser.username,
                phone: currentUser.phone,
                bio: currentUser.bio,
                avatar_url: currentUser.avatar_url,
                is_online: currentUser.is_online,
                last_seen: currentUser.last_seen
            };
            showChatSection();
            loadChats();
            connectNotificationWebSocket();
            
            // Initialize device management after successful login
            if (typeof initializeDeviceManagement === 'function') {
                initializeDeviceManagement();
            }
            if (typeof setupDeviceEventListeners === 'function') {
                setupDeviceEventListeners();
            }
        }
    }

    // Fix mobile keyboard: adjust container height when keyboard shows/hides
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            // Set container height to visible viewport area (excluding keyboard)
            const scalePercent = normalizeUiScalePercent(localStorage.getItem(UI_SCALE_STORAGE_KEY) ?? DEFAULT_UI_SCALE_PERCENT);
            const scaleMultiplier = scalePercent / 100;
            appContainer.style.height = (window.visualViewport.height / scaleMultiplier) + 'px';
            
            // Scroll to bottom of messages when keyboard appears
            if (messagesContainer) {
                setTimeout(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }, 100);
            }
        });
        
        // Reset when keyboard closes
        window.visualViewport.addEventListener('scroll', () => {
            window.scrollTo(0, 0);
        });
    }
});
