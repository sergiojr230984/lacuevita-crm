CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'manager', 'salesperson');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lead_source AS ENUM ('meta_ads', 'whatsapp', 'walk_in', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lead_status AS ENUM ('New', 'Contacted', 'Quote Sent', 'Follow-Up', 'Negotiation', 'Closed Won', 'Lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stores (
  id text PRIMARY KEY,
  name text NOT NULL,
  whatsapp_number text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text,
  role user_role NOT NULL,
  store_id text REFERENCES stores(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  phone text NOT NULL,
  whatsapp_number text NOT NULL,
  store_id text NOT NULL REFERENCES stores(id),
  assigned_user_id uuid REFERENCES users(id),
  source lead_source NOT NULL DEFAULT 'whatsapp',
  status lead_status NOT NULL DEFAULT 'New',
  budget numeric(12, 2),
  notes text,
  last_contact_date timestamptz,
  next_follow_up_date timestamptz,
  follow_up_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_follow_up_count_nonnegative CHECK (follow_up_count >= 0),
  CONSTRAINT leads_store_whatsapp_unique UNIQUE (store_id, whatsapp_number)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  provider text NOT NULL DEFAULT 'whatsapp',
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text,
  external_message_id text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  type text NOT NULL,
  from_status lead_status,
  to_status lead_status,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_store_role ON users(store_id, role);
CREATE INDEX IF NOT EXISTS idx_leads_store_status ON leads(store_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_last_activity ON leads(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_messages_lead_created ON messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_lead_created ON activities(lead_id, created_at DESC);

INSERT INTO stores (id, name, whatsapp_number)
VALUES
  ('hialeah', 'La Cuevita Furniture Hialeah', '+17867489064'),
  ('sw', 'La Cuevita Furniture SW', '+13058019649')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    whatsapp_number = EXCLUDED.whatsapp_number;

INSERT INTO users (name, email, password_hash, role, store_id)
VALUES
  ('Owner', 'owner@lacuevitafurniture.com', crypt('Owner123!', gen_salt('bf')), 'owner', NULL),
  ('Manager', 'manager@lacuevitafurniture.com', crypt('Manager123!', gen_salt('bf')), 'manager', NULL),
  ('Hialeah Sales', 'hialeah.sales@lacuevitafurniture.com', crypt('Hialeah123!', gen_salt('bf')), 'salesperson', 'hialeah'),
  ('SW Sales', 'sw.sales@lacuevitafurniture.com', crypt('SW123!', gen_salt('bf')), 'salesperson', 'sw')
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash),
    role = EXCLUDED.role,
    store_id = EXCLUDED.store_id,
    active = true;

UPDATE users
SET active = false
WHERE email IN (
  'hialeah.manager@lacuevitafurniture.com',
  'sw.manager@lacuevitafurniture.com',
  'hialeah.sales1@lacuevitafurniture.com',
  'hialeah.sales2@lacuevitafurniture.com',
  'sw.sales1@lacuevitafurniture.com',
  'sw.sales2@lacuevitafurniture.com'
);
