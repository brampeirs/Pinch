-- Remove unused chat tables
-- These tables were created but never used (AI chat uses local mock logic)

DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.chat_conversations;

