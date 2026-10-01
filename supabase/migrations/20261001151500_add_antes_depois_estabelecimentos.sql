-- Migration: Adiciona campos de métricas Antes vs Depois da Placa em estabelecimentos
ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS avaliacoes_iniciais integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nota_inicial numeric(2,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avaliacoes_atuais integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nota_atual numeric(2,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_implantacao date DEFAULT NULL;

COMMENT ON COLUMN estabelecimentos.avaliacoes_iniciais IS 'Quantidade de avaliações no Google antes de instalar a placa';
COMMENT ON COLUMN estabelecimentos.nota_inicial IS 'Nota média no Google antes de instalar a placa (ex: 4.2)';
COMMENT ON COLUMN estabelecimentos.avaliacoes_atuais IS 'Quantidade de avaliações no Google atualmente';
COMMENT ON COLUMN estabelecimentos.nota_atual IS 'Nota média no Google atualmente (ex: 4.8)';
COMMENT ON COLUMN estabelecimentos.data_implantacao IS 'Data em que a placa física QR/NFC foi entregue/instalada';
