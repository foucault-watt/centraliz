-- Phase 1: Préparation de la base de données pour la migration vers l'authentification CLA

-- 1.1. Création de la table de mapping des utilisateurs
-- Cette table fera le lien entre l'ancien username (CAS) et le nouveau (CLA).
CREATE TABLE public.user_mapping (
  cas_username TEXT NOT NULL,
  cla_username TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  CONSTRAINT user_mapping_pkey PRIMARY KEY (cas_username),
  CONSTRAINT user_mapping_cla_username_key UNIQUE (cla_username),
  CONSTRAINT user_mapping_cas_username_fkey FOREIGN KEY (cas_username) REFERENCES public.users (username) ON DELETE CASCADE
);

-- 1.2. Ajout des colonnes first_name et last_name à la table users
-- Ces colonnes contiendront les informations de nom provenant de CLA.
ALTER TABLE public.users
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;