-- Migration pour ajouter le système de signalement Cékilui

-- 1. Création de la table pour stocker les signalements de photos
CREATE TABLE public.ceki_photo_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  photo_name text NOT NULL,
  reported_by_username text NOT NULL,
  reason text NOT NULL, -- Ex: 'not_the_person', 'inappropriate', 'other'
  details text NULL,
  status text NOT NULL DEFAULT 'pending'::text, -- Ex: 'pending', 'resolved_photo_deleted', 'resolved_user_banned', 'resolved_dismissed'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT ceki_photo_reports_pkey PRIMARY KEY (id),
  CONSTRAINT ceki_photo_reports_reported_by_username_fkey FOREIGN KEY (reported_by_username) REFERENCES public.users (username) ON DELETE CASCADE
);

-- Commentaire sur la nouvelle table pour clarifier son usage
COMMENT ON TABLE public.ceki_photo_reports IS 'Stocke les signalements effectués par les utilisateurs sur les photos du jeu Cékilui.';

-- 2. Ajout de la colonne de bannissement à la table des utilisateurs
ALTER TABLE public.users
ADD COLUMN photo_banned_until timestamp with time zone NULL;

-- Commentaire sur la nouvelle colonne pour expliquer son rôle
COMMENT ON COLUMN public.users.photo_banned_until IS 'Date jusqu''à laquelle l''utilisateur est banni de l''upload de nouvelles photos pour le jeu Cékilui. NULL si non banni.';
