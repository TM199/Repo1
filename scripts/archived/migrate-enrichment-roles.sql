-- Add default enrichment roles to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS default_enrichment_roles TEXT[] DEFAULT ARRAY['CEO', 'Founder', 'Head of Talent', 'Hiring Manager'];

COMMENT ON COLUMN user_settings.default_enrichment_roles IS 'Default roles to search for during contact enrichment';
