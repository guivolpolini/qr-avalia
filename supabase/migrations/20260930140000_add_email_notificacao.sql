/*
# Migração: Campo email_notificacao para recebimento de queixas privadas

Adiciona coluna `email_notificacao` na tabela `estabelecimentos` para envio
de alertas de insatisfação (1 a 3 estrelas) por e-mail.
*/

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS email_notificacao text DEFAULT '';
