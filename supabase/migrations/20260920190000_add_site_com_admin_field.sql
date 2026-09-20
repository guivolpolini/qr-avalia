/*
# Campo: site com painel admin

Marca se o site gerado a partir do prompt deve incluir um painel
administrativo. Opcional, default false (a maioria dos sites simples
não precisa).
*/

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS site_com_admin boolean DEFAULT false;
