# QR Avalia

Sistema de gerenciamento de QR Codes e Tags NFC dinâmicas para avaliações de estabelecimentos.

## O que faz

- Gera QR Codes e Tags NFC que redirecionam para o link de avaliação do Google de cada estabelecimento.
- Permite trocar o estabelecimento associado a um código sem precisar reimprimir a placa/tag.
- Registra cada scan (QR ou NFC) para relatórios e estatísticas.
- Painel administrativo protegido por autenticação (Supabase Auth).

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Postgres + Auth + Row Level Security)
- React Router

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com suas credenciais do Supabase
npm run dev
```

## Estrutura

- `src/pages` — telas do painel (Dashboard, Estabelecimentos, QR Codes, NFC, Scans, Configurações)
- `src/context` — autenticação
- `supabase/migrations` — schema do banco e políticas de RLS