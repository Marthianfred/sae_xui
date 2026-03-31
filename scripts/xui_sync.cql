-- TABLA DE MAPEO DE IDENTIDADES SAE <-> XUI
CREATE TABLE IF NOT EXISTS marthianfred.xui_sync_mapping (
    id_contrato text PRIMARY KEY,
    cedula text,
    nro_contrato text,
    xui_id int,
    xui_username text,
    status text,
    last_sync timestamp
);

-- INDICE POR CEDULA PARA BUSQUEDAS RAPIDAS
CREATE INDEX IF NOT EXISTS idx_xui_mapping_cedula ON marthianfred.xui_sync_mapping (cedula);
