-- Add insurance_company and policy_number to onboarding_clients
-- These are required on the intake form and should be captured at onboarding

ALTER TABLE onboarding_clients ADD COLUMN IF NOT EXISTS insurance_company TEXT;
ALTER TABLE onboarding_clients ADD COLUMN IF NOT EXISTS policy_number TEXT;
