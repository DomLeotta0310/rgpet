// Imagem pública do pet para prévias de compartilhamento (sem dados do tutor).
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  const pet = String(req.query.pet || '');
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(pet)) return res.status(400).end();
  const url = process.env.SUPABASE_URL || 'https://hlptvfzthfdvjikogjek.supabase.co';
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return res.status(503).end();
  try {
    const response = await fetch(url + '/rest/v1/pets?public_id=eq.' + encodeURIComponent(pet) + '&select=foto&limit=1', {
      headers: { apikey:key, Authorization:'Bearer '+key }
    });
    if (!response.ok) return res.status(502).end();
    const records = await response.json();
    const foto = records?.[0]?.foto;
    if (!foto || typeof foto !== 'string') return res.status(404).end();
    if (/^https:\/\//i.test(foto)) {
      // Evita usar este endpoint como proxy de URLs arbitrárias.
      return res.status(404).end();
    }
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(foto);
    if (!match || match[2].length > 5500000) return res.status(404).end();
    const data = Buffer.from(match[2], 'base64');
    if (!data.length || data.length > 4000000) return res.status(404).end();
    res.setHeader('Content-Type', match[1]);
    res.setHeader('Cache-Control','public, max-age=300, s-maxage=600');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).send(data);
  } catch (_) { return res.status(500).end(); }
}
