-- Add parent-child revision chain to estimates
-- Each revision is a new row linked to the original via parent_estimate_id
-- revision_number: 0 = original, 1+ = revisions

ALTER TABLE estimates ADD COLUMN IF NOT EXISTS parent_estimate_id uuid REFERENCES estimates(id);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS revision_number int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_est_parent ON estimates(parent_estimate_id);
CREATE INDEX IF NOT EXISTS idx_est_file_number ON estimates(file_number);
