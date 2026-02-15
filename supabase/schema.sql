-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- UNITS (Apartamentos/Casas)
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(50) NOT NULL UNIQUE, -- e.g., "101", "205B"
  coefficient DECIMAL(10, 6) NOT NULL, -- Coeficiente de copropiedad (e.g., 0.012500)
  owner_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USERS (Asambleístas / Operadores / Admin)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id), -- Linked to Supabase Auth
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'OPERATOR', 'USER')),
  unit_id UUID REFERENCES units(id), -- Nullable (Admin/Operador might not have unit)
  username VARCHAR(50) UNIQUE, -- Login Identifier
  is_proxy BOOLEAN DEFAULT FALSE, -- Si es verdadero, está actuando como apoderado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RPC Function for Username Login
-- Gets email from auth.users based on username in public.users
CREATE OR REPLACE FUNCTION get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT au.email INTO v_email
    FROM public.users pu
    JOIN auth.users au ON pu.id = au.id
    WHERE pu.username = p_username;
    
    RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated, service_role;

-- POWER TOKENS (Poderes Digitales)
CREATE TABLE power_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES units(id) NOT NULL,
  proxy_name VARCHAR(255) NOT NULL,
  proxy_email VARCHAR(255),
  proxy_phone VARCHAR(50),
  token_code VARCHAR(10), -- OTP Code
  is_validated BOOLEAN DEFAULT FALSE,
  validation_method VARCHAR(20) CHECK (validation_method IN ('SMS', 'EMAIL', 'MANUAL')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- VOTING SESSIONS (Preguntas)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'SINGLE' CHECK (type IN ('SINGLE', 'MULTIPLE')),
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE
);

-- VOTE OPTIONS (Opciones de respuesta)
CREATE TABLE vote_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID REFERENCES votes(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  order_index INTEGER DEFAULT 0
);

-- BALLOTS (Votos emitidos - SECRETO O PÚBLICO SEGÚN CONFIG, AQUÍ PÚBLICO PARA AUDITORÍA)
CREATE TABLE ballots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID REFERENCES votes(id),
  unit_id UUID REFERENCES units(id), -- El voto está ligado a la unidad (coeficiente)
  user_id UUID REFERENCES users(id), -- Quién emitió el voto
  option_id UUID REFERENCES vote_options(id),
  weight DECIMAL(10, 6) NOT NULL, -- Snapshot del coeficiente al momento de votar
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(vote_id, unit_id) -- Solo un voto por unidad por pregunta
);

-- QUORUM LOG (Historial de asistencia)
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES units(id),
  user_id UUID REFERENCES users(id), -- Quién registró la asistencia
  check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  device_id VARCHAR(255) -- Para auditoría
);

-- RLS POLICIES (Seguridad Row Level Security)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read units (for checking quorum)
CREATE POLICY "Public units are viewable by everyone" ON units FOR SELECT USING (true);

-- Policy: Only Admins can create votes
CREATE POLICY "Admins can manage votes" ON votes FOR ALL USING (
  exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
);

-- Policy: Authenticated users can vote if vote is OPEN
CREATE POLICY "Users can vote" ON ballots FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  exists (select 1 from votes where id = vote_id and status = 'OPEN')
);
