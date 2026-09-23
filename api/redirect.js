export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const tipo = url.searchParams.get('tipo') || 'qr';
  const codigo = url.searchParams.get('codigo') || '';

  if (!codigo) {
    return Response.redirect(`${url.origin}/`, 302);
  }

  // Permite ler tanto variáveis VITE_ quanto padrão
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const fallbackUrl = `${url.origin}/${tipo === 'nfc' ? 'n' : 'q'}/${encodeURIComponent(codigo)}?direct=false`;

  if (!supabaseUrl || !supabaseKey) {
    return Response.redirect(fallbackUrl, 302);
  }

  const rpcName = tipo === 'nfc' ? 'resolve_nfc_tag' : 'resolve_qr_code';
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';

  // Detecta bots/crawlers de pré-visualização de links para não registrar acessos falsos
  const isBot = /bot|crawl|spider|facebookexternalhit|whatsapp|telegram|twitterbot|slack|discord|linkedin|preview/i.test(userAgent);

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_codigo: codigo,
        p_user_agent: userAgent,
        p_ip: ip,
        p_skip_scan: isBot,
      }),
    });

    if (res.ok) {
      const link = await res.json();
      if (typeof link === 'string' && link.startsWith('http')) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': link,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }
    }
  } catch (err) {
    console.error('Erro no Edge redirect:', err);
  }

  // Se o código não existe, está desativado ou deu erro, abre a SPA com a tela informativa
  return Response.redirect(fallbackUrl, 302);
}
