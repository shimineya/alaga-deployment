-- Updates for Backend Integration Feature
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_initial VARCHAR(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'Pending_Review';

-- Medical Profile Updates
ALTER TABLE profiles_medical_staff 
ADD COLUMN IF NOT EXISTS practice_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_solo_practitioner BOOLEAN DEFAULT FALSE;

-- Caregiver Profile Updates
ALTER TABLE profiles_caregivers 
ADD COLUMN IF NOT EXISTS work_shift VARCHAR(50),
ADD COLUMN IF NOT EXISTS notification_preferences TEXT[];