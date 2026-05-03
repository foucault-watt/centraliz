ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS ceki_no_photo_games_played integer NOT NULL DEFAULT 0;
