-- Add 'pending' status to devicestatus enum
-- Execute this script directly in the PostgreSQL database

-- Check current enum values first (optional)
-- SELECT unnest(enum_range(NULL::devicestatus));

-- Add the new 'pending' value to the enum using DO block for safety
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'devicestatus')
        AND enumlabel = 'pending'
    ) THEN
        ALTER TYPE devicestatus ADD VALUE 'pending';
    END IF;
END $$;

-- Verify the update (optional)
-- SELECT unnest(enum_range(NULL::devicestatus));
