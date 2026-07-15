
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Status enum
CREATE TYPE public.lot_status AS ENUM ('available', 'reserved', 'sold');

-- Lots
CREATE TABLE public.lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  area_m2 numeric(10,2) NOT NULL,
  price numeric(12,2) NOT NULL,
  status lot_status NOT NULL DEFAULT 'available',
  grid_x integer NOT NULL,
  grid_z integer NOT NULL,
  width numeric(6,2) NOT NULL DEFAULT 4,
  depth numeric(6,2) NOT NULL DEFAULT 5,
  whatsapp text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lots TO authenticated;
GRANT ALL ON public.lots TO service_role;

ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lots"
ON public.lots FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can insert lots"
ON public.lots FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update lots"
ON public.lots FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete lots"
ON public.lots FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER lots_updated_at BEFORE UPDATE ON public.lots
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed 24 lots (6 x 4 grid)
INSERT INTO public.lots (number, area_m2, price, grid_x, grid_z, whatsapp)
SELECT
  LPAD(((z * 6) + x + 1)::text, 3, '0'),
  250 + (random() * 150)::int,
  180000 + (random() * 120000)::int,
  x, z,
  '5511999990000'
FROM generate_series(0, 5) x, generate_series(0, 3) z;
