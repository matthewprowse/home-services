/**
 * File: 01_tables.sql
 * Description: Supabase schema definitions for provider caching and conversation tracking.
 * This file is idempotent and can be run multiple times.
 */

-- 1. Providers Cache
CREATE TABLE IF NOT EXISTS cached_providers (
    place_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    rating DECIMAL(3,2),
    rating_count INTEGER,
    phone TEXT,
    website TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    summary TEXT,
    services TEXT[],
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT DEFAULT 'New Diagnosis',
    image_url TEXT,
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    user_address TEXT,
    diagnosis_json JSONB,                -- Stores the structured diagnosis data
    device_type TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    attachments TEXT[],
    feedback TEXT CHECK (feedback IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
