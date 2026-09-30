/*
# Migração: Campo canal_queixas para preferência de recebimento do lojista

Define como o lojista prefere receber queixas do Escudo de Reputação:
- 'ambos': WhatsApp e E-mail (padrão)
- 'email': Apenas E-mail (preserva a privacidade do celular do lojista)
- 'whatsapp': Apenas WhatsApp
*/

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS canal_queixas text DEFAULT 'ambos';
