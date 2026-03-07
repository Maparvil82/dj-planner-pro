-- Migration: Create Vault System (Folders & Files)
-- Run this in your Supabase SQL Editor

-- 1. Create vault_folders table
CREATE TABLE IF NOT EXISTS public.vault_folders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    associated_type text CHECK (associated_type IN ('session', 'venue', 'general')) DEFAULT 'general',
    associated_id uuid, -- Can be session_id or venue_id
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Create vault_files table
CREATE TABLE IF NOT EXISTS public.vault_files (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id uuid NOT NULL REFERENCES public.vault_folders(id) ON DELETE CASCADE,
    name text NOT NULL,
    url text NOT NULL,
    file_type text, -- e.g., 'application/pdf', 'image/jpeg'
    size bigint, -- in bytes
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.vault_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for vault_folders
CREATE POLICY "Users can manage their own folders" 
    ON public.vault_folders 
    FOR ALL 
    TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Create RLS Policies for vault_files
CREATE POLICY "Users can manage their own files" 
    ON public.vault_files 
    FOR ALL 
    TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Create 'vault' storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault', 'vault', false) -- Private bucket, access via signed URLs or RLS
ON CONFLICT (id) DO NOTHING;

-- 7. Storage RLS Policies
-- Allow users to upload to their own folder: vault/{userId}/*
CREATE POLICY "Authenticated users can upload vault files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to see their own vault files
CREATE POLICY "Users can view their own vault files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own vault files
CREATE POLICY "Users can delete their own vault files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);
