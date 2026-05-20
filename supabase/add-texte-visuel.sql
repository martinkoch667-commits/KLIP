-- Run this in the Supabase SQL Editor to add the texte_visuel column
alter table posts add column if not exists texte_visuel text;
