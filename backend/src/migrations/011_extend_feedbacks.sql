-- Enrichit les retours utilisateurs sans perdre les anciens feedbacks.

ALTER TABLE public.feedbacks
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'suggestion',
ADD COLUMN IF NOT EXISTS area text NULL,
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS wants_response boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS admin_response text NULL,
ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'new',
ADD COLUMN IF NOT EXISTS admin_updated_by text NULL,
ADD COLUMN IF NOT EXISTS admin_updated_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feedbacks_admin_updated_by_fkey'
  ) THEN
    ALTER TABLE public.feedbacks
    ADD CONSTRAINT feedbacks_admin_updated_by_fkey FOREIGN KEY (admin_updated_by)
      REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS feedbacks_username_created_at_idx
  ON public.feedbacks (username, created_at DESC);

CREATE INDEX IF NOT EXISTS feedbacks_admin_status_created_at_idx
  ON public.feedbacks (admin_status, created_at DESC);
