/*
# Campos para gerar prompt de site (Lovable / Base44)

Adiciona campos opcionais ao estabelecimento, usados só para montar
automaticamente um prompt de geração de site. Nenhum é obrigatório -
o cadastro básico (nome, link do Google) continua funcionando igual.
*/

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS tipo_negocio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS descricao text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cardapio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cor_marca text DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram text DEFAULT '';
