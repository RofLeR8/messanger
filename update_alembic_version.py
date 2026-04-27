import asyncio
import asyncpg
import os

async def update_alembic():
    # Get DB config from environment or use defaults
    user = os.getenv("POSTGRES_USER", "ws-test")
    password = os.getenv("POSTGRES_PASSWORD", "ws-test")
    host = os.getenv("POSTGRES_HOST", "db")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "ws-test")
    
    print(f"Connecting to {host}:{port}/{db}...")
    
    try:
        conn = await asyncpg.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            database=db
        )
        
        # First, check and fix the enum
        exists = await conn.fetchval('''
            SELECT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'devicestatus')
                AND enumlabel = 'pending'
            )
        ''')
        
        if not exists:
            print("Adding 'pending' to devicestatus enum...")
            await conn.execute("ALTER TYPE devicestatus ADD VALUE 'pending'")
        else:
            print("'pending' already exists in devicestatus enum")
        
        # Update alembic version to the latest migration
        print("Updating alembic version...")
        await conn.execute("""
            UPDATE alembic_version 
            SET version_num='20260427_210000_add_pending_status_to_device_enum'
        """)
        
        # Verify
        version = await conn.fetchval("SELECT version_num FROM alembic_version")
        print(f"Alembic version set to: {version}")
        
        # Show current enum values
        values = await conn.fetch('SELECT unnest(enum_range(NULL::devicestatus))')
        print(f"Current enum values: {[v[0] for v in values]}")
        
        await conn.close()
        print("Done!")
        
    except Exception as e:
        print(f"Error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(update_alembic())
