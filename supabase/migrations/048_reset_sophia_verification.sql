-- Reset sophia.belle verification status for testing Persona flow
UPDATE profiles
SET verification_status = 'none',
    persona_inquiry_id = NULL,
    persona_status = NULL,
    verified_at = NULL
WHERE username = 'sophia.belle';
