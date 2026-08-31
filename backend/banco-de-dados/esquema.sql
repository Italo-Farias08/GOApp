-- Esquema do banco de dados do #GO
-- Rode este arquivo uma vez no seu PostgreSQL antes de subir o backend:
--   psql -U postgres -d goapp -f banco-de-dados/esquema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome              VARCHAR(150) NOT NULL,
    email             VARCHAR(150) UNIQUE,
    senha_hash        VARCHAR(255),
    telefone          VARCHAR(30) UNIQUE,
    avatar_url        VARCHAR(500),
    status_motorista  VARCHAR(20) NOT NULL DEFAULT 'none'
                      CHECK (status_motorista IN ('none', 'pending', 'approved', 'rejected')),
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS motoristas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cnh_numero      VARCHAR(30) NOT NULL,
    cnh_categoria   VARCHAR(10) NOT NULL,
    veiculo_placa   VARCHAR(15) NOT NULL,
    veiculo_modelo  VARCHAR(100) NOT NULL,
    veiculo_cor     VARCHAR(50) NOT NULL,
    veiculo_ano     VARCHAR(10) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motoristas_usuario_id ON motoristas(usuario_id);
