// Link de compartilhamento PetfiQ: metadados para WhatsApp/Facebook.
// A página visual oficial continua em /?pet=<public_id>.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[c]);

export default async function handler(req,res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
  const petId = String(req.query.pet || '');
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(petId)) return res.status(400).send('Identificação inválida');
  const url = process.env.SUPABASE_URL || 'https://hlptvfzthfdvjikogjek.supabase.co';
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return res.status(503).send('Compartilhamento indisponível');
  let registro;
  try {
    const response = await fetch(url+'/rest/v1/pets?public_id=eq.'+encodeURIComponent(petId)+'&select=nome,is_lost&limit=1', {
      headers:{apikey:key,Authorization:'Bearer '+key}
    });
    if (!response.ok) return res.status(502).send('Consulta indisponível');
    const dados = await response.json();
    registro = dados?.[0];
  } catch (_) { return res.status(502).send('Consulta indisponível'); }
  if (!registro) return res.status(404).send('Pet não encontrado');
  const origin = 'https://rgpet.vercel.app';
  const shareUrl = origin+'/api/pet-share?pet='+encodeURIComponent(petId);
  const publicUrl = origin+'/?pet='+encodeURIComponent(petId);
  const imageUrl = origin+'/api/pet-image?pet='+encodeURIComponent(petId);
  const nome = String(registro.nome||'Pet').trim().slice(0,100);
  const title = (registro.is_lost ? 'PET DESAPARECIDO — ' : 'Identificação PetfiQ — ')+nome;
  const description = registro.is_lost
    ? 'Ajude '+nome+' a voltar para casa. Veja a identificação e os contatos na página oficial do PetfiQ.'
    : 'Conheça a identificação digital de '+nome+' no PetfiQ.';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>'
    +'<meta name="viewport" content="width=device-width, initial-scale=1"/>'
    +'<title>'+esc(title)+'</title>'
    +'<meta name="description" content="'+esc(description)+'"/>'
    +'<meta property="og:type" content="website"/>'
    +'<meta property="og:site_name" content="PetfiQ — RG Pet"/>'
    +'<meta property="og:title" content="'+esc(title)+'"/>'
    +'<meta property="og:description" content="'+esc(description)+'"/>'
    +'<meta property="og:url" content="'+esc(shareUrl)+'"/>'
    +'<meta property="og:image" content="'+esc(imageUrl)+'"/>'
    +'<meta property="og:image:secure_url" content="'+esc(imageUrl)+'"/>'
    +'<meta name="twitter:card" content="summary_large_image"/>'
    +'<meta name="twitter:title" content="'+esc(title)+'"/>'
    +'<meta name="twitter:description" content="'+esc(description)+'"/>'
    +'<meta name="twitter:image" content="'+esc(imageUrl)+'"/>'
    +'<link rel="canonical" href="'+esc(publicUrl)+'"/>'
    +'</head><body style="font-family:system-ui;text-align:center;padding:40px;color:#12402b">'
    +'<h1>'+esc(title)+'</h1><p>'+esc(description)+'</p>'
    +'<a href="'+esc(publicUrl)+'">Abrir identificação digital do pet</a>'
    +'<script>window.location.replace('+JSON.stringify(publicUrl)+');</script>'
    +'</body></html>';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(200).send(html);
}
