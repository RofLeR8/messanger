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
const tabChats = document.getElementById('tab-chats');
const tabFriends = document.getElementById('tab-friends');
const friendsPage = document.getElementById('friends-page');
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

// Pages
const chatsPage = document.getElementById('chats-page');
const chatPage = document.getElementById('chat-page');

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
    if (!currentChatId || isLoadingMore) return;
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
            return;
        }

        currentChatOffset += messages.length;

        // Prepend older messages (they come in reverse order, so reverse back)
        const fragment = document.createDocumentFragment();
        const reversedMessages = [...messages].reverse();
        reversedMessages.forEach(msg => {
            const isSent = msg.sender_id === currentUserId;
            fragment.appendChild(createMessageElement(msg, isSent));
        });

        // Insert at the beginning
        if (messagesContainer.firstChild) {
            messagesContainer.insertBefore(fragment, messagesContainer.firstChild);
        } else {
            messagesContainer.appendChild(fragment);
        }

        // Restore scroll position
        const newScrollHeight = messagesContainer.scrollHeight;
        messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;

    } catch (error) {
        console.error('Error loading more messages:', error);
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
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageEl.style.transition = 'background 0.3s ease';
        messageEl.style.background = 'rgba(0, 217, 255, 0.3)';
        setTimeout(() => { messageEl.style.background = ''; }, 2000);
    }
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
    if (user.avatar_url) {
        return `<div class="chat-item-avatar"><img src="${escapeHtml(user.avatar_url)}" alt="Avatar">
            <span class="avatar-status-dot ${user.is_online ? 'online' : ''}"></span></div>`;
    }
    return `<div class="chat-item-avatar">${initials}
        <span class="avatar-status-dot ${user.is_online ? 'online' : ''}"></span></div>`;
}

function getFriendAvatarHtml(user, sizeClass = 'friend-avatar') {
    if (user.avatar_url) {
        return `<div class="${sizeClass}"><img src="${escapeHtml(user.avatar_url)}" alt="Avatar"></div>`;
    }
    const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    return `<div class="${sizeClass}">${initials}</div>`;
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

            const lastMessage = chat.last_message_content;
            const lastMessageTime = chat.last_message_at ? formatTime(chat.last_message_at) : '';
            const lastMessageEl = chatItem.querySelector('.chat-item-last-message');
            const timeEl = chatItem.querySelector('.chat-item-time');

            let messagePreview = lastMessage || '';
            if (chat.last_message_file_url) {
                const prefix = chat.last_message_file_type === 'image' ? '📷' : '📎';
                const name = chat.last_message_file_name || (chat.last_message_file_type === 'image' ? 'Image' : 'File');
                messagePreview = messagePreview ? `${prefix} ${name}: ${messagePreview}` : `${prefix} ${name}`;
            }

            if (lastMessageEl && messagePreview) lastMessageEl.textContent = messagePreview;
            if (timeEl && lastMessageTime) timeEl.textContent = lastMessageTime;
        });
    }
}

function navigateToChat(chatId, chatName, isGroup) {
    currentChatId = chatId;
    currentChatIsGroup = isGroup;
    chatTitle.textContent = chatName;
    chatNamesCache[chatId] = chatName; // Cache the name
    currentChatMembers = [];

    // Update header status
    if (isGroup) {
        chatHeaderStatus.innerHTML = '';
        chatHeaderStatus.classList.remove('online');
        if (chatHeaderAvatar) chatHeaderAvatar.classList.add('hidden');
    } else {
        // For direct chats, show loading then update with actual status
        chatHeaderStatus.innerHTML = '<span class="offline-dot"></span> Loading...';
        if (chatHeaderAvatar) chatHeaderAvatar.classList.add('hidden');
        // Load the other user's status from chat members
        getChatMembers(chatId).then(members => {
            const otherMember = members.find(m => m.user_id !== currentUserId);
            if (otherMember) {
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
    loadMessages(chatId);
    connectWebSocket(chatId);
    stopNotificationCheck();
}

function stopNotificationCheck() {}

// ==================== Tab Switching ====================
function switchToTab(tab) {
    currentActiveTab = tab;
    tabChats.classList.toggle('active', tab === 'chats');
    tabFriends.classList.toggle('active', tab === 'friends');
    chatsPage.classList.toggle('active', tab === 'chats');
    friendsPage.classList.toggle('active', tab === 'friends');
    chatsPage.classList.toggle('inactive', tab !== 'chats');
    friendsPage.classList.toggle('inactive', tab !== 'friends');

    if (tab === 'friends') {
        loadFriendsPage();
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
                <div class="friend-name">
                    ${friend.is_online ? '<span class="status-dot online"></span>' : ''}
                    ${escapeHtml(friend.name)}
                </div>
                ${friend.username ? `<div class="friend-username">@${escapeHtml(friend.username)}</div>` : ''}
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
            ${getFriendAvatarHtml(requester)}
            <div class="pending-request-info">
                <div class="pending-request-name">${escapeHtml(req.requester_name)}</div>
                ${req.requester_username ? `<div class="pending-request-username">@${escapeHtml(req.requester_username)}</div>` : ''}
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
            <div class="search-user-name">${escapeHtml(user.name)}</div>
            <div class="search-user-handle">${user.username ? '@' + escapeHtml(user.username) : escapeHtml(user.email)}</div>
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
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, username: username || null, password, password_check: passwordCheck }),
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

// ==================== API Functions ====================
async function getChats() {
    const response = await fetch(`${API_BASE_URL}/chats/?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
    });
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
    websocket.onclose = () => { console.log('Chat WebSocket disconnected'); };
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
            updateChatLastMessage(data.chat_id, data);
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
            if (msgEl && data.content) {
                const contentEl = msgEl.querySelector('.message-content');
                if (contentEl) contentEl.textContent = data.content;
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
                        updateChatLastMessage(data.chat_id, data);
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
        }
    };

    notificationWs.onerror = (error) => { console.error('Notification WebSocket error:', error); };
    notificationWs.onclose = () => {
        console.log('Notification WebSocket disconnected');
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
        if (chat.is_group) {
            chatName = chat.name || 'Group Chat';
            chatNamesCache[chat.id] = chatName;
            subtitle = `${chat.members_count || 0} members`;
            avatarHtml = `<div class="chat-item-avatar">👥</div>`;
        } else {
            chatName = chatNamesCache[chat.id];
            if (!chatName) {
                chatName = getChatDisplayName(chat);
                chatNamesCache[chat.id] = chatName;
            }
            subtitle = '';
            const otherId = chatOtherUserId[chat.id];
            avatarHtml = getUserAvatarHtml(otherId);
        }

        const lastMessage = chat.last_message_content || '';
        const lastMessageTime = chat.last_message_at ? formatTime(chat.last_message_at) : '';
        const unreadCount = chat.unread_count || 0;

        let lastMessagePreview = '';
        if (chat.last_message_file_url) {
            const prefix = chat.last_message_file_type === 'image' ? '📷' : '📎';
            const name = chat.last_message_file_name || (chat.last_message_file_type === 'image' ? 'Image' : 'File');
            lastMessagePreview = lastMessage ? `${prefix} ${name}: ${lastMessage}` : `${prefix} ${name}`;
        } else {
            lastMessagePreview = lastMessage;
        }

        chatItem.innerHTML = `
            <div class="chat-item-content">
                <div class="chat-item-header">
                    <div class="chat-item-content-with-avatar">
                        ${avatarHtml}
                        <div>
                            <div class="chat-item-name">${escapeHtml(chatName)}</div>
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

function updateChatLastMessage(chatId, messageData) {
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (!chatItem) return;
    const lastMessageEl = chatItem.querySelector('.chat-item-last-message');
    const timeEl = chatItem.querySelector('.chat-item-time');

    let messagePreview = messageData.content || '';
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
function loadMessages(chatId) {
    // Reset infinite scroll state
    resetInfiniteScroll();

    getMessages(chatId)
        .then(messages => {
            messagesContainer.innerHTML = '';
            const fragment = document.createDocumentFragment();
            messages.forEach(msg => {
                const isSent = msg.sender_id === currentUserId;
                fragment.appendChild(createMessageElement(msg, isSent));
            });
            messagesContainer.appendChild(fragment);
            scrollToBottom();

            // Initialize infinite scroll after messages are loaded
            initInfiniteScroll();
        })
        .catch(error => { console.error('Error loading messages:', error); });
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
            <div class="message-avatar">${avatarHtml}</div>
            ${currentChatIsGroup ? `<div class="message-sender-name">${escapeHtml(getUserDisplayName(senderId))}</div>` : ''}
        </div>`;
    } else if (isSent) {
        html += `<div class="message-sender-row message-sender-row-sent">
            ${currentChatIsGroup ? `<div class="message-sender-name">${escapeHtml(getUserDisplayName(senderId))}</div>` : ''}
            <div class="message-avatar">${avatarHtml}</div>
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
        if (message.file_type === 'image') {
            html += `<div class="message-attachment"><img src="${message.file_url}" alt="${escapeHtml(message.file_name||'Image')}" onclick="window.open('${message.file_url}','_blank')"></div>`;
        } else {
            html += `<div class="message-attachment message-attachment-file" onclick="window.open('${message.file_url}','_blank')">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div class="message-attachment-file-info"><div class="message-attachment-file-name">${escapeHtml(message.file_name||'File')}</div><div class="message-attachment-file-size">Click to download</div></div></div>`;
        }
    }

    // Content and meta
    html += `<div class="message-content">${escapeHtml(message.content || '')}</div>
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

    return messageDiv;
}

function getMessageStatusIcon(message) {
    if (message.is_read) return '<span class="message-status read" title="Read">✓✓</span>';
    if (message.is_delivered) return '<span class="message-status delivered" title="Delivered">✓✓</span>';
    return '<span class="message-status sent" title="Sent">✓</span>';
}

function addMessageToUI(message, isSent) {
    const existing = document.querySelector(`.message[data-message-id="${message.id}"]`);
    if (existing) return;
    const messageDiv = createMessageElement(message, isSent);
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
        const currentUser = await getCurrentUserInfo();
        if (currentUser) {
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
        }
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

        renderChats(chats, true);
    } catch (error) {
        console.error('Error loading chats:', error);
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

document.addEventListener('click', (e) => { if (contextMenu && !e.target.closest('#context-menu')) hideContextMenu(); });
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
        const response = await fetch(`${API_BASE_URL}/chats/${currentChatId}/messages/${messageId}/edit`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ content: newContent }),
        });
        if (!response.ok) throw new Error((await response.json()).detail || 'Failed to edit message');
        const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageEl) {
            const contentEl = messageEl.querySelector('.message-content');
            if (contentEl) contentEl.textContent = newContent;
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
        renderPinnedMessages(await response.json());
    } catch (error) { console.error('Error loading pinned messages:', error); }
}

function renderPinnedMessages(messages) {
    pinnedMessagesList.innerHTML = '';
    if (messages.length === 0) {
        pinnedMessagesList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No pinned messages</p>';
        return;
    }
    messages.forEach(msg => {
        const item = document.createElement('div');
        item.className = 'pinned-message-item';
        let preview = msg.content || '';
        if (msg.file_url) {
            const icon = msg.file_type === 'image' ? '📷' : '📎';
            const name = msg.file_name || (msg.file_type === 'image' ? 'Image' : 'File');
            preview = preview ? `${icon} ${name}: ${preview}` : `${icon} ${name}`;
        }
        if (!preview) preview = '<empty message>';
        item.innerHTML = `<div class="pinned-message-content">${escapeHtml(preview)}</div>
            <div class="pinned-message-meta"><span>${formatTime(msg.created_at)}</span><span>📌</span></div>`;
        item.addEventListener('click', () => {
            const el = document.querySelector(`.message[data-message-id="${msg.id}"]`);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.animation = 'pulse 0.5s ease'; setTimeout(() => el.style.animation = '', 500); }
        });
        pinnedMessagesList.appendChild(item);
    });
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
        if (currentSearchIndex >= 0 && currentSearchIndex < searchResults.length) {
            const prevEl = document.querySelector(`.message[data-message-id="${searchResults[currentSearchIndex].id}"]`);
            if (prevEl) prevEl.classList.remove('search-highlight');
        }
        currentSearchIndex += direction;
        if (currentSearchIndex < 0) currentSearchIndex = searchResults.length - 1;
        if (currentSearchIndex >= searchResults.length) currentSearchIndex = 0;
        const msgEl = document.querySelector(`.message[data-message-id="${searchResults[currentSearchIndex].id}"]`);
        if (msgEl) { msgEl.classList.add('search-highlight'); msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        updateSearchResultsInfo();
    }, 50);
}

async function searchMessages(query) {
    if (!query || query.length < 2) { clearSearchResults(); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/chats/${currentChatId}/messages/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error('Search failed');
        const messages = await response.json();
        searchResults = messages; currentSearchIndex = -1;
        highlightSearchResults(messages);
        navigateSearchResults(1);
    } catch (error) { console.error('Error searching messages:', error); }
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
            <div class="group-member-avatar">${avatarHtml}</div>
            <div class="group-member-info">
                <div class="group-member-name">${escapeHtml(name)}${isMe ? ' (you)' : ''}</div>
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
        const users = await getUsers();
        groupMembersSelect.innerHTML = '';
        users.forEach(user => {
            if (user.id === currentUserId) return; // Skip self
            const div = document.createElement('label');
            div.className = 'member-checkbox';
            div.innerHTML = `
                <input type="checkbox" name="group-member" value="${user.id}">
                <span class="member-name">${escapeHtml(user.name)}</span>
                <span class="member-email">${escapeHtml(user.email)}</span>
            `;
            groupMembersSelect.appendChild(div);
        });
    } catch (error) { console.error('Error loading users for group creation:', error); }
}

// ==================== Event Listeners ====================
showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); hideElement(loginForm); showElement(registerForm); });
showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); hideElement(registerForm); showElement(loginForm); });

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try { await login(email, password); showChatSection(); await loadChats(); }
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
        await register(email, name, username, password, passwordCheck);
        hideElement(registerForm); showElement(loginForm);
        document.getElementById('login-email').value = email;
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
        if (selectedFile) fileData = await uploadFile(selectedFile);

        const messagePayload = { content: content || '' };
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
    } catch (error) { console.error('Error sending message:', error); alert('Failed to send message: ' + error.message); }
});

// Group members panel events
chatTitle.addEventListener('click', () => {
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
messageInput.addEventListener('keydown', (e) => { if (e.key === 'Escape' && editingMessageId) cancelEditing(); });

// ==================== Main Tabs (Chats/Friends) ====================
if (tabChats) {
    tabChats.addEventListener('click', () => switchToTab('chats'));
}
if (tabFriends) {
    tabFriends.addEventListener('click', () => switchToTab('friends'));
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
window.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        authToken = savedToken;
        showChatSection();
        loadChats();
        connectNotificationWebSocket();
    }

    // Fix mobile keyboard: adjust container height when keyboard shows/hides
    if (window.visualViewport) {
        const appContainer = document.querySelector('.app-container');
        
        window.visualViewport.addEventListener('resize', () => {
            // Set container height to visible viewport area (excluding keyboard)
            appContainer.style.height = window.visualViewport.height + 'px';
            
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
