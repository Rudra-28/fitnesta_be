-- Phase 1: Batch cycle tracking + settlements

-- 1. Add cycle fields + capacity to batches
ALTER TABLE batches
  ADD COLUMN capacity         TINYINT     NOT NULL DEFAULT 25          COMMENT 'Max students per batch',
  ADD COLUMN cycle_start_date DATE        NULL                          COMMENT 'Start of current 30-day cycle',
  ADD COLUMN cycle_end_date   DATE        NULL                          COMMENT 'End of current 30-day cycle (cycle_start + 30 days)',
  ADD COLUMN last_settled_at  TIMESTAMP   NULL                          COMMENT 'When the last cycle was settled';

-- Back-fill cycle dates from start_date for existing active batches
UPDATE batches
SET
  cycle_start_date = start_date,
  cycle_end_date   = DATE_ADD(start_date, INTERVAL 30 DAY)
WHERE is_active = TRUE AND cycle_start_date IS NULL;

-- 2. Add batch_id to individual_participants (which batch they were auto-assigned to)
ALTER TABLE individual_participants
  ADD COLUMN batch_id INT NULL,
  ADD CONSTRAINT fk_ip_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE individual_participants ADD INDEX idx_ip_batch_id (batch_id);

-- 3. Create batch_cycle_settlements table
CREATE TABLE batch_cycle_settlements (
  id                  INT           NOT NULL AUTO_INCREMENT,
  batch_id            INT           NOT NULL,
  cycle_start         DATE          NOT NULL,
  cycle_end           DATE          NOT NULL,
  sessions_allocated  SMALLINT      NOT NULL DEFAULT 0,
  sessions_attended   SMALLINT      NOT NULL DEFAULT 0,
  base_amount         DECIMAL(10,2) NOT NULL DEFAULT 0.00  COMMENT 'Sum of effective_monthly_fees of all batch students',
  commission_rate     DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  commission_amount   DECIMAL(10,2) NOT NULL DEFAULT 0.00  COMMENT 'Prorated: base * rate * (attended/allocated)',
  status              ENUM('pending','settled','paid') NOT NULL DEFAULT 'pending',
  settled_at          TIMESTAMP     NULL,
  paid_at             TIMESTAMP     NULL,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_bcs_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  INDEX idx_bcs_batch_id  (batch_id),
  INDEX idx_bcs_status    (status),
  UNIQUE KEY uq_batch_cycle (batch_id, cycle_start)   COMMENT 'One settlement record per cycle per batch'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
