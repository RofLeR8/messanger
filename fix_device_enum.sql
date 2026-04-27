-- Add 'pending' status to devicestatus enum
-- Execute this script directly in the PostgreSQL database

-- Check current enum values first (optional)
-- SELECT unnest(enum_range(NULL::devicestatus));

-- Add the new 'pending' value to the enum
ALTER TYPE devicestatus ADD VALUE IF NOT EXISTS 'pending';

-- Verify the update (optional)
-- SELECT unnest(enum_range(NULL::devicestatus));
