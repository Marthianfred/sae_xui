CREATE TABLE IF NOT EXISTS xui_sync_mapping (
    id_contrato text PRIMARY KEY,
    cedula text,
    xui_id int,
    username text,
    status text,
    last_sync timestamp,
    sync_message text
);

CREATE INDEX IF NOT EXISTS mapping_cedula ON xui_sync_mapping (cedula);
CREATE INDEX IF NOT EXISTS mapping_status ON xui_sync_mapping (status);
