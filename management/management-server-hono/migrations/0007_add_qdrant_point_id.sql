-- Add qdrant_point_id to link D1 records with Qdrant points
ALTER TABLE knowledge_assets ADD COLUMN qdrant_point_id TEXT;

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_qdrant_point ON knowledge_assets(qdrant_point_id);
