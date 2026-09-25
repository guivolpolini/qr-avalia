/**
 * Geocode Service
 *
 * Converte texto de localização (ex: "São Caetano do Sul - SP")
 * em coordenadas lat/lng usando Nominatim (OpenStreetMap) — gratuito, sem API key.
 *
 * Isolado do sistema de QR Codes.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * Geocodifica uma string de localização.
 * Adiciona ", Brasil" se não contiver país para melhorar precisão.
 */
export async function geocode(location: string): Promise<GeoResult | null> {
  const query = /brasil/i.test(location) ? location : `${location}, Brasil`;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim requer User-Agent identificando a aplicação
        'User-Agent': 'QRAvalia/1.0 (prospeccao)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      displayName: first.display_name ?? location,
    };
  } catch {
    return null;
  }
}
