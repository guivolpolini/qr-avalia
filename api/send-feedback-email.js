export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const body = await req.json();
    const { to, estabelecimentoNome, rating, mensagem, clienteNome, clienteContato } = body;

    if (!to || !to.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'E-mail de destino inválido ou não configurado.' }),
        { status: 400, headers }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          missingKey: true,
          error: 'Chave RESEND_API_KEY não configurada nas variáveis de ambiente da Vercel.',
        }),
        { status: 200, headers }
      );
    }

    const nomeLoja = estabelecimentoNome || 'Seu Estabelecimento';
    const estrelas = '★'.repeat(rating || 1) + '☆'.repeat(5 - (rating || 1));
    const autor = clienteNome ? `${clienteNome} (${clienteContato || 'Sem contato'})` : (clienteContato || 'Cliente anônimo');

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
        <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <span style="background-color: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
              Alerta de Feedback Privado
            </span>
          </div>
          
          <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 8px; font-size: 20px;">
            ${nomeLoja}
          </h2>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 0; margin-bottom: 20px;">
            Um cliente acabou de registrar uma avaliação intermediária através da sua placa interativa. Esta mensagem foi enviada de forma privada para sua gerência resolver antes de virar uma avaliação pública no Google.
          </p>

          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <div style="font-size: 18px; color: #dc2626; font-weight: bold; margin-bottom: 8px;">
              Nota dada pelo cliente: ${estrelas} (${rating} de 5)
            </div>
            <div style="font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-wrap; font-style: italic;">
              "${mensagem || 'O cliente não detalhou por escrito, mas solicitou contato da gerência.'}"
            </div>
          </div>

          <div style="font-size: 13px; color: #475569; border-top: 1px solid #f1f5f9; pt-3; margin-top: 16px;">
            <p style="margin: 4px 0;"><strong>Identificação do Cliente:</strong> ${autor}</p>
            <p style="margin: 4px 0;"><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
          Tecnologia <strong>QR Avalia • VolpoTech</strong> | Escudo de Reputação Ativo
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'QR Avalia Alertas <onboarding@resend.dev>',
        to: [to],
        subject: `⚠️ Alerta de Avaliação Privada (${rating}★) — ${nomeLoja}`,
        html: htmlContent,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: resData?.message || 'Falha na API do Resend' }),
        { status: res.status, headers }
      );
    }

    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
}
