// Prévia oficial de compartilhamento da lista pública de pets desaparecidos.
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default function handler(req,res) {
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).end();
  const origin='https://rgpet.vercel.app';
  const share=origin+'/api/perdidos-share';
  const dest=origin+'/?perdidos=1';
  const image=origin+'/api/perdidos-image';
  const title='PETS DESAPARECIDOS — PETFIQ';
  const description='Conheça os pets desaparecidos, veja suas fotos e compartilhe. Ajude uma família a reencontrar seu melhor amigo. PetfiQ • Cão Leotta';
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>'
    +'<title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"/>'
    +'<meta property="og:type" content="website"/><meta property="og:site_name" content="PetfiQ — Cão Leotta"/>'
    +'<meta property="og:title" content="'+esc(title)+'"/><meta property="og:description" content="'+esc(description)+'"/>'
    +'<meta property="og:url" content="'+esc(share)+'"/><meta property="og:image" content="'+esc(image)+'"/>'
    +'<meta property="og:image:secure_url" content="'+esc(image)+'"/><meta property="og:image:type" content="image/webp"/>'
    +'<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="'+esc(title)+'"/>'
    +'<meta name="twitter:description" content="'+esc(description)+'"/><meta name="twitter:image" content="'+esc(image)+'"/>'
    +'<link rel="canonical" href="'+esc(dest)+'"/></head><body><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p>'
    +'<a href="'+esc(dest)+'">Ver os pets desaparecidos</a><script>window.location.replace('+JSON.stringify(dest)+');</script></body></html>';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(200).send(html);
}
