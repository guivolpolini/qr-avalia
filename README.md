# 📱 QR Avalia

> **Do hardware de balcão ao aplicativo na palma da mão.**  
> Um sistema completo para gerenciar placas físicas inteligentes (QR Code + NFC) que transformam clientes de balcão em avaliações 5 estrelas no Google.

---

## 💡 Por que este projeto existe?

Quase todo bom comércio local enfrenta o mesmo problema: dezenas de clientes elogiam o atendimento no balcão todos os dias, mas menos de 1% lembra de deixar uma avaliação no Google depois que sai da loja. Pedir "de boca em boca" não funciona porque o cliente esquece ou tem preguiça de procurar o nome da empresa.

O **QR Avalia** nasceu para eliminar 100% desse atrito. 

Ao aproximar o celular da placa (via chip NFC) ou apontar a câmera (via QR Code), a página oficial de avaliação 5 estrelas do Google abre instantaneamente na tela do cliente.

Para controlar toda a produção, ativação nas lojas, entrega e acompanhamento de resultados sem depender de planilhas ou intermediários, desenvolvi este **aplicativo e painel administrativo próprio**.

---

## ✨ Principais Funcionalidades

### 1. 📲 Aplicativo de Campo no Celular (PWA)
Desenvolvido como um app instalável no smartphone (iOS e Android), pensado para ser usado na rua durante as visitas aos clientes:
* **Leitor de Câmera Integrado**: Ao entregar uma nova placa no comércio, basta abrir o app, apontar a câmera traseira para o QR Code e vincular o cliente em menos de 2 segundos.
* **Pareamento Duplo (QR + NFC)**: Reconhece a tag NFC correspondente e vincula as duas mídias físicas juntas automaticamente.
* **Teste Imediato com Feedback Tátil**: Botão para testar o redirecionamento na hora com o lojista e vibração tátil no celular confirmando o sucesso.
* **Modais em Bottom Sheet**: No celular, tudo desliza confortavelmente de baixo para cima com puxador nativo, respeitando as *Safe Areas* do iPhone.
* **Atalhos Rápidos (3D Touch)**: Segurando o ícone na tela inicial do celular, abre diretamente a câmera de ativação ou o cadastro de novo cliente.
* **Funcionamento Offline**: O aplicativo abre instantaneamente mesmo em locais fechados com sinal 4G fraco graças ao cache do App Shell via Service Worker.

### 2. ⚡ Redirecionamento Dinâmico em Edge (Placas que nunca morrem)
As placas de acrílico e adesivos NFC são físicos, mas os redirecionamentos são 100% digitais e flexíveis:
* As rotas `/q/:codigo` (QR Code) e `/n/:codigo` (NFC) rodam em **Vercel Edge Functions**.
* Se um estabelecimento mudar de dono, alterar o link do Google ou trocar de endereço, basta atualizar no painel. **A placa física no balcão continua funcionando perfeitamente**, sem custo de reimpressão.
* Cada toque ou leitura registra estatísticas anônimas em milissegundos sem atrasar o cliente.

### 3. 🖨️ Gabarito Gráfico & Geração em Lote
* Geração em massa de lotes de placas (até 200 por vez).
* Módulo exclusivo de gabarito para impressão: gera os arquivos com medidas exatas, margens de sangria e exportação em PDF vetorial pronto para enviar diretamente à gráfica.

### 4. 📊 Painel de Métricas & Clientes
* Acompanhamento em tempo real de quantas pessoas usaram o QR Code e o NFC em cada estabelecimento.
* Gráficos de evolução temporal e comparação entre as tecnologias.
* Gerador inteligente de dados/prompts para criação de sites institucionais para os clientes atendidos.

### 5. 🎯 Radar de Prospecção & SEO Local
* Mapeamento de empresas da região via Google Maps para identificar negócios com poucas avaliações ou sem presença digital.
* Gerador de abordagens personalizadas prontas para envio pelo WhatsApp.
* Checklist de otimização de perfil do Google Meu Negócio por cliente.

---

## 🛠️ Stack Tecnológica

O projeto foi construído priorizando alta performance, baixo consumo de dados e confiabilidade:

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
* **Mobile / PWA**: Web App Manifest, Service Worker, Apple Web App Tags, `html5-qrcode`
* **Backend & Banco de Dados**: Supabase (PostgreSQL, Row Level Security, Auth)
* **Edge & Hospedagem**: Vercel (Edge Serverless Functions para redirecionamentos com cache CDN)
* **Ferramentas**: `qrcode`, `lucide-react`, `react-router-dom`

---

## 🚀 Como Rodar Localmente

### 1. Pré-requisitos
* Node.js (versão 18 ou superior)
* Conta no Supabase (com o banco de dados configurado)

### 2. Instalação

```bash
# Clone o repositório
git clone https://github.com/guivolpolini/qr-avalia.git

# Acesse a pasta
cd qr-avalia

# Instale as dependências
npm install
```

### 3. Configuração de Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (use `.env.example` como base):

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase

# Opcional (apenas para o scraper local de prospecção)
VITE_SCRAPER_URL=http://localhost:8080
```

### 4. Iniciar o Ambiente de Desenvolvimento

```bash
npm run dev
```

Acesse no navegador: `http://localhost:5173`

---

## 📱 Dica: Instalando no Celular como Aplicativo

1. Abra a URL do sistema no Safari (iPhone) ou Chrome (Android).
2. Toque em **Compartilhar** (ou nos 3 pontinhos do Chrome).
3. Selecione **"Adicionar à Tela de Início"**.
4. O app será instalado com ícone próprio, tela cheia e sem barras de navegação do navegador.

---

<p align="center">
  Desenvolvido com foco em resolver um problema real do comércio físico com tecnologia simples, elegante e eficiente.
</p>
