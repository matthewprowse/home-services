/**
 * File: 02_rls.sql
 * Description: Basic Row Level Security (RLS) policies for anonymous access.
 * This file is idempotent and can be run multiple times.
 */

-- Enable RLS on all tables
ALTER TABLE cached_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 1. Cached Providers: Public read access for everyone
DROP POLICY IF EXISTS "Public Read Cached Providers" ON cached_providers;
CREATE POLICY "Public Read Cached Providers" 
ON cached_providers FOR SELECT 
USING (true);

-- 2. Conversations: Anonymous users can create and read any conversation
DROP POLICY IF EXISTS "Public All Access Conversations" ON conversations;
CREATE POLICY "Public All Access Conversations" 
ON conversations FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. Messages: Anonymous users can read/write messages
DROP POLICY IF EXISTS "Public All Access Messages" ON messages;
CREATE POLICY "Public All Access Messages" 
ON messages FOR ALL 
USING (true) 
WITH CHECK (true);
