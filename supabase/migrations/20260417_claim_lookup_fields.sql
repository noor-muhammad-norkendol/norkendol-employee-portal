-- Add claim_number, file_number, and loss_address to onboarding_clients
-- so onboarding becomes the primary entry point for claim data

ALTER TABLE onboarding_clients ADD COLUMN IF NOT EXISTS claim_number TEXT;
ALTER TABLE onboarding_clients ADD COLUMN IF NOT EXISTS file_number TEXT;
ALTER TABLE onboarding_clients ADD COLUMN IF NOT EXISTS loss_address TEXT;

-- Indexes for fast claim lookup across the system
CREATE INDEX IF NOT EXISTS idx_onboarding_clients_claim_number
  ON onboarding_clients (org_id, claim_number) WHERE claim_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_clients_file_number
  ON onboarding_clients (org_id, file_number) WHERE file_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_clients_client_name
  ON onboarding_clients (org_id, client_name);
