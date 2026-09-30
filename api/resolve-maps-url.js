export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const body = await request.json();
    const url = body?.url;

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL obrigatória' }), {
        status: 400,
        headers,
      });
    }

    const targetUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;

    // Faz requisição para seguir redirecionamento de links curtos como maps.app.goo.gl
    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const finalUrl = res.url || targetUrl;

    return new Response(JSON.stringify({ resolvedUrl: finalUrl }), {
      status: 200,
      headers,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Falha ao resolver URL' }),
      { status: 500, headers }
    );
  }
}
