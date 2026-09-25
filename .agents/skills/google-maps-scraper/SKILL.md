---
name: google-maps-scraper
description: >
  Skill para integrar e operar o Google Maps Scraper Kit no contexto do QR Avalia.
  Ensina o Antigravity a verificar, iniciar, buscar e normalizar resultados do scraper
  de forma segura, com respeito a rate limits e isolamento do sistema de QR Codes.
tags: [prospeccao, google-maps, scraper, leads]
---

# Skill: Google Maps Scraper

## Contexto no QR Avalia

O módulo de Prospecção usa o **gosom/google-maps-scraper** (open-source, MIT) via
**Google Maps Scraper Kit** (`Mahanaicoach/google-maps-scraper-kit`).

O scraper roda **localmente** via Docker e expõe uma API REST em `http://localhost:8080`.
**NÃO é acessível da Vercel/Edge Functions** — a integração é frontend → scraper local.

Arquivos relevantes:
- `src/lib/googleMapsService.ts` — interface com o scraper
- `src/lib/geocodeService.ts` — geocodificação (Nominatim/OSM)
- `src/lib/prospectsService.ts` — CRUD da tabela `prospects` no Supabase
- `src/lib/messageGenerator.ts` — gerador de mensagens WhatsApp
- `src/pages/Prospeccao.tsx` — página completa

## 1. Verificar disponibilidade

Antes de qualquer operação, verificar se o scraper está online:

```typescript
// src/lib/googleMapsService.ts
const ok = await checkScraperAvailable();
// timeout 3s — retorna false sem exceção se offline
```

Se offline → mostrar instruções ao usuário, NÃO tentar contornar.

## 2. Iniciar o scraper (instruções para o usuário)

```bash
# Pré-requisito: Docker Desktop instalado e rodando
# 1. Clonar o kit (uma vez)
git clone https://github.com/Mahanaicoach/google-maps-scraper-kit
cd google-maps-scraper-kit

# 2. Iniciar
docker compose up -d

# 3. Verificar
curl http://localhost:8080/api/v1/jobs   # deve retornar []

# 4. Parar quando não usar
docker compose down
```

**Windows:** usar `python3 scripts/scrape.py` em vez do script bash (precisa de WSL2).

## 3. API REST do scraper

Base URL: `http://localhost:8080` (configurável via `VITE_SCRAPER_URL`)

### Criar job
```
POST /api/v1/jobs
Content-Type: application/json

{
  "keyword": "pet shop em São Caetano do Sul SP",
  "lat": -23.6197,
  "lng": -46.5508,
  "depth": 5,           // 1-20; padrão 5; mais = mais resultados + mais lento
  "zoom": 15,
  "lang": "pt",
  "max_results": 30     // máx recomendado: 50 para evitar rate limit
}
```
Resposta: `{ "id": "uuid-do-job", "status": "pending" }`

### Poll status
```
GET /api/v1/jobs/{id}
```
Resposta: `{ "id": "...", "status": "pending|running|completed|failed", "count": 23 }`

### Baixar resultados
```
GET /api/v1/jobs/{id}/download
```
Retorna CSV com header. Campos relevantes:
`title, category, address, phone, website, google_maps_url, rating, reviews`

## 4. Normalização de resultados

O scraper retorna ~34 campos. Usamos apenas os essenciais:

```typescript
// src/lib/googleMapsService.ts — normalizeResult()
{
  business_name: raw.title,
  category:      raw.category,
  address:       raw.address,
  phone:         raw.phone,
  website:       raw.website,    // '' = sem site (lead quente)
  google_maps_url: raw.google_maps_url,
  rating:        parseFloat(raw.rating),
  review_count:  parseInt(raw.reviews),
  instagram:     raw.instagram,  // só se --socials foi usado
  source:        'google_maps',
}
```

## 5. Geocodificação

Usa Nominatim (OSM) — gratuito, sem API key:

```typescript
// src/lib/geocodeService.ts
const geo = await geocode('São Caetano do Sul - SP');
// → { lat: -23.6197, lng: -46.5508, displayName: '...' }
```

Adiciona "Brasil" automaticamente se não estiver na query.
Rate limit da Nominatim: 1 req/s (uso moderado é suficiente).

## 6. Importação com deduplicação

```typescript
// src/lib/prospectsService.ts
const result = await importProspects(normalizedItems);
// → { imported: 15, skipped: 3, errors: 0 }
```

Deduplicação via índices únicos na tabela `prospects`:
- `(phone_normalized, lower(business_name))` quando phone disponível
- `google_maps_url` quando disponível

## 7. Geração de mensagens

```typescript
// src/lib/messageGenerator.ts
const msg = generateMessage(prospect);
// Tipos: 'sem_site' | 'com_site' | 'geral'
// NUNCA inventa dados — só usa campos reais do Prospect

const waUrl = buildWhatsAppUrl(prospect.phone, msg);
// → 'https://wa.me/5511999999999?text=...' ou null se telefone inválido
```

## 8. Limitações conhecidas

| Limitação | Detalhe |
|-----------|---------|
| Requer Docker local | Não funciona no Vercel/Edge |
| Rate limit Google | IPs podem ser bloqueados temporariamente |
| Contra ToS Google | Use moderadamente, não automatize em massa |
| `--socials` opcional | Instagram só disponível se o scraper for iniciado com essa flag |
| Windows bash | Usar `scripts/scrape.py` em vez de `scrape.sh` |
| Sem autenticação | Scraper bind apenas em 127.0.0.1 — não expor publicamente |
| Campos variáveis | Nem todos os campos estão sempre presentes no CSV |

## 9. Regras de uso seguro

- ✅ Pesquisa iniciada **sempre pelo usuário** (botão manual)
- ✅ Máximo 100 resultados por busca
- ✅ Depth máximo: 20 (padrão: 5)
- ✅ Timeout de 2 minutos por job
- ❌ NUNCA fazer scraping automático/agendado sem proxies
- ❌ NUNCA executar múltiplos jobs simultâneos
- ❌ NUNCA expor o scraper em porta pública

## 10. Tratamento de erros

| Erro | Causa | Ação |
|------|-------|------|
| `checkScraperAvailable() = false` | Docker offline | Mostrar instruções |
| `Erro ao criar job: 500` | Scraper com problema | Aguardar e tentar novamente |
| `Job falhou no scraper` | Rate limit ou keyword inválida | Reduzir depth/maxResults |
| `Timeout aguardando scraper` | Job demorou > 2 min | Reduzir maxResults |
| `Não foi possível encontrar "..."` | Geocode falhou | Tentar nome de cidade diferente |

## 11. Isolamento do sistema QR Codes

O módulo de Prospecção é **completamente isolado**:
- Tabela `prospects` — sem FK para `qr_codes`, `nfc_tags` ou `scans`
- Serviços em `src/lib/` com prefixo próprio
- Página `Prospeccao.tsx` — não importa nada de QR/NFC
- Rota `/prospeccao` — nova, não interfere em `/q/:codigo` nem `/n/:codigo`

**NUNCA** modificar para integrar com o sistema de QR Codes sem análise cuidadosa
de dependências e aprovação explícita do usuário.
