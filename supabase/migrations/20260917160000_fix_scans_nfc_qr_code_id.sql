/*
# Fix: scans.qr_code_id blocking NFC scans

`scans.qr_code_id` was created as NOT NULL, but `resolve_nfc_tag` inserts
scans with `qr_code_id = NULL` (since an NFC scan has no associated QR
code). Every NFC scan insert was failing the NOT NULL constraint, so
`resolve_nfc_tag` always returned an error and every NFC redirect showed
"Tag NFC não disponível" even for valid, active tags.

This makes qr_code_id nullable, matching nfc_tag_id, since a scan row now
represents either a QR scan or an NFC scan.
*/

ALTER TABLE scans ALTER COLUMN qr_code_id DROP NOT NULL;
