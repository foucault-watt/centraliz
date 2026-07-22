-- Création de la table pour les meilleurs scores
CREATE TABLE public.ceki_best_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  score integer NOT NULL,
  game_type text NOT NULL, -- 'all_promos' ou le nom d'une promo, ex: 'ITEEM2025'
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ceki_best_scores_pkey PRIMARY KEY (id),
  CONSTRAINT ceki_best_scores_username_fkey FOREIGN KEY (username) REFERENCES public.users (username) ON DELETE CASCADE,
  CONSTRAINT ceki_best_scores_user_game_type_unique UNIQUE (username, game_type)
);

-- Fonction pour insérer ou mettre à jour le meilleur score
CREATE OR REPLACE FUNCTION upsert_best_score(username_in text, score_in integer, game_type_in text)
RETURNS void AS $$
BEGIN
  INSERT INTO public.ceki_best_scores (username, score, game_type)
  VALUES (username_in, score_in, game_type_in)
  ON CONFLICT (username, game_type)
  DO UPDATE SET
    score = score_in,
    updated_at = now()
  WHERE
    public.ceki_best_scores.score < score_in;
END;
$$ LANGUAGE plpgsql;