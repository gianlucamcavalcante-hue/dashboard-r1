-- Cole este script inteiro no SQL Editor do Supabase e clique em "Run"

CREATE TABLE IF NOT EXISTS prova (
    id             SERIAL PRIMARY KEY,
    banca          TEXT NOT NULL,
    ano            INTEGER NOT NULL,
    data_feita     DATE,
    total_questoes INTEGER NOT NULL,
    acertos        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS desempenho_area (
    id       SERIAL PRIMARY KEY,
    prova_id INTEGER NOT NULL REFERENCES prova(id) ON DELETE CASCADE,
    area     TEXT NOT NULL,
    acertos  INTEGER NOT NULL,
    total    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS erro (
    id             SERIAL PRIMARY KEY,
    prova_id       INTEGER REFERENCES prova(id) ON DELETE SET NULL,
    numero_questao INTEGER,
    area           TEXT,
    tema           TEXT,
    tipo_erro      TEXT,
    conceito       TEXT,
    resposta       TEXT,
    prioridade     INTEGER DEFAULT 1,
    card_feito     BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT
);

INSERT INTO config (chave, valor)
VALUES ('meta_percentual', '70')
ON CONFLICT (chave) DO NOTHING;
