CREATE TABLE public.saved_hunts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Hunt',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_hunts TO authenticated;
GRANT ALL ON public.saved_hunts TO service_role;
ALTER TABLE public.saved_hunts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read hunts" ON public.saved_hunts FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert hunts" ON public.saved_hunts FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update hunts" ON public.saved_hunts FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete hunts" ON public.saved_hunts FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER saved_hunts_updated BEFORE UPDATE ON public.saved_hunts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_shared_hunt(_token text)
RETURNS TABLE(name text, data jsonb, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.name, h.data, h.updated_at FROM public.saved_hunts h
  WHERE _token IS NOT NULL AND length(_token) >= 20 AND h.share_token = _token LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_shared_hunt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_hunt(text) TO anon, authenticated;