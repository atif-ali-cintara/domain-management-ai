CREATE OR REPLACE FUNCTION public.enforce_cintara_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(split_part(coalesce(NEW.email,''), '@', 2)) <> 'cintara.ai' THEN
    RAISE EXCEPTION 'Only @cintara.ai accounts can sign in';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_cintara_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, lower(NEW.email), NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_cintara_signup ON auth.users;
CREATE TRIGGER enforce_cintara_signup BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_cintara_signup();

DROP TRIGGER IF EXISTS on_cintara_user_created ON auth.users;
CREATE TRIGGER on_cintara_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_cintara_user();