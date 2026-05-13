#!/usr/bin/env python3
"""
Test E2EE key management scenarios
"""
import asyncio
import httpx

BASE_URL = "http://localhost:8000"

async def register_user(email: str, password: str, name: str):
    """Register a new user"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/users/register",
            json={"email": email, "password": password, "name": name}
        )
        print(f"✓ Registered user: {email} - Status: {response.status_code}")
        return response.json()

async def login_user(email: str, password: str):
    """Login and get token"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/users/login",
            data={"username": email, "password": password}
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"✓ Logged in: {email}")
            return token
        else:
            print(f"✗ Login failed: {email} - {response.status_code}")
            return None

async def create_direct_chat(token: str, user_id: int):
    """Create a direct chat"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/chats/",
            json={"user_id": user_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Created direct chat: {data.get('id')}")
            return data.get("id")
        else:
            print(f"✗ Failed to create chat: {response.status_code}")
            return None

async def get_chats(token: str):
    """Get all chats"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/chats/",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            chats = response.json()
            print(f"✓ Retrieved {len(chats)} chats")
            return chats
        else:
            print(f"✗ Failed to get chats: {response.status_code}")
            return []

async def upload_device_key(token: str, key_id: str, public_key: str):
    """Upload device public key"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/users/me/keys",
            json={
                "key_id": key_id,
                "algorithm": "RSA-OAEP",
                "public_key": public_key
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            print(f"✓ Uploaded device key: {key_id}")
            return True
        else:
            print(f"✗ Failed to upload key: {response.status_code}")
            return False

async def get_user_keys(token: str, user_id: int):
    """Get user's public keys"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/users/{user_id}/keys",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            keys = response.json()
            print(f"✓ User {user_id} has {len(keys)} device keys")
            return keys
        else:
            print(f"✗ Failed to get keys: {response.status_code}")
            return []

async def get_chat_key_meta(token: str, chat_id: int):
    """Get chat key metadata"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/chats/{chat_id}/keys/meta",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            meta = response.json()
            print(f"✓ Chat {chat_id} key meta: has_keys={meta.get('has_any_keys')}, version={meta.get('latest_version')}")
            return meta
        else:
            print(f"✗ Failed to get key meta: {response.status_code}")
            return None

async def main():
    print("=" * 60)
    print("E2EE Key Management Test")
    print("=" * 60)
    print()
    
    # Test 1: Register users
    print("Test 1: Register users")
    print("-" * 60)
    try:
        await register_user("alice@test.com", "password123", "Alice")
        await register_user("bob@test.com", "password123", "Bob")
    except Exception as e:
        print(f"Note: Users may already exist - {e}")
    print()
    
    # Test 2: Login users
    print("Test 2: Login users")
    print("-" * 60)
    alice_token = await login_user("alice@test.com", "password123")
    bob_token = await login_user("bob@test.com", "password123")
    print()
    
    if not alice_token or not bob_token:
        print("✗ Login failed, cannot continue tests")
        return
    
    # Test 3: Check user keys
    print("Test 3: Check device keys")
    print("-" * 60)
    alice_keys = await get_user_keys(alice_token, 1)
    bob_keys = await get_user_keys(bob_token, 2)
    print()
    
    # Test 4: Get chats
    print("Test 4: Get chats")
    print("-" * 60)
    alice_chats = await get_chats(alice_token)
    bob_chats = await get_chats(bob_token)
    print()
    
    # Test 5: Check chat key metadata
    if alice_chats:
        print("Test 5: Check chat key metadata")
        print("-" * 60)
        for chat in alice_chats[:3]:  # Check first 3 chats
            await get_chat_key_meta(alice_token, chat['id'])
        print()
    
    print("=" * 60)
    print("Test Summary:")
    print(f"  - Alice has {len(alice_keys)} device keys")
    print(f"  - Bob has {len(bob_keys)} device keys")
    print(f"  - Alice has {len(alice_chats)} chats")
    print(f"  - Bob has {len(bob_chats)} chats")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
