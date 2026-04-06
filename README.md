# API Endpoints

## Authentication (`/auth`)

### Register User
```
POST /auth/register/
```
**Description:** Register a new user account

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "string",
  "password_check": "string"
}
```

**Response:**
```json
{
  "message": "Successful registration"
}
```

---

### Login
```
POST /auth/login/
```
**Description:** Authenticate user and receive access token

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "string"
}
```

**Response:**
```json
{
  "ok": true,
  "access_token": "jwt_token",
  "refresh_token": null,
  "message": "Authorization succesfull"
}
```

**Cookies:** `user_access_token` (httponly)

---

### Logout
```
POST /auth/logout/
```
**Description:** Logout user and clear access token cookie

**Response:**
```json
{
  "message": "successful logout"
}
```

---

## Chats (`/chats`)

### Get All User Chats
```
GET /chats/
```
**Description:** Get list of all chats for the current user

**Authentication:** Required (cookie: `user_access_token`)

**Response:** List of chat objects

---

### Get Messages from Chat
```
GET /chats/{chat_id}/messages
```
**Description:** Get all messages from a specific chat

**Authentication:** Required (cookie: `user_access_token`)

**Path Parameters:**
- `chat_id` (integer): Chat ID

**Response:** List of message objects

---

### Create Message
```
POST /chats/{chat_id}/messages
```
**Description:** Create a new message in a chat

**Authentication:** Required (cookie: `user_access_token`)

**Path Parameters:**
- `chat_id` (integer): Chat ID

**Request Body:**
```json
{
  "recipient_id": 1,
  "content": "Message text"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "sender_id": 1,
  "recipient_id": 2,
  "content": "Message text"
}
```

**Errors:**
- `403 Forbidden` - User is not a participant of this chat
- `404 Not Found` - Chat not found

---

## WebSocket (`/chats/ws`)

### Chat WebSocket Connection
```
WS /chats/ws/{chat_id}
```
**Description:** Real-time WebSocket connection for chat messages

**Authentication:** Required via cookie `user_access_token` or query param `?token=<jwt_token>`

**Path Parameters:**
- `chat_id` (integer): Chat ID

**Client → Server Message:**
```json
{
  "content": "Message text"
}
```

**Server → Client Message:**
```json
{
  "type": "new_message",
  "id": 1,
  "sender_id": 1,
  "content": "Message text",
  "created_at": "2024-01-01T12:00:00"
}
```

**Close Codes:**
- `4001` - Authentication failed (missing/invalid/expired token)
- `4003` - Chat not found or user is not a participant

**Example Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8000/chats/ws/1?token=YOUR_JWT_TOKEN');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('New message:', message);
};

// Send a message
ws.send(JSON.stringify({ content: 'Hello!' }));
```

---

## Root

### Redirect to Auth
```
GET /
```
**Description:** Redirects to `/auth`

---

## Notes

- All authenticated endpoints require a valid JWT token in the `user_access_token` cookie
- Token expiration and missing token errors return `401 Unauthorized` for API requests
- Base URL: `http://localhost:8000` (default FastAPI port)
