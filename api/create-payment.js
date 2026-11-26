const ROOT = 'https://rgpet.vercel.app';
const SUPABASE_DEFAULT = 'https://hlptvfzthfdvjikogjek.supabase.co';
const moneyInCents = v => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n*100) : NaN;
};
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ROOT);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});

  const token = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE_DEFAULT;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!token || !supabaseKey) return res.status(503).json({error:'Serviço de pagamento indisponível'});

  try {
    const {orderId,petId,tipo,valor} = req.body || {};
    if (!/^\d{1,18}$/.test(String(orderId ?? '')) || !/^\d{1,18}$/.test(String(petId ?? '')) || !['combo1','combo2'].includes(tipo)) {
      return res.status(400).json({error:'Pedido inválido'});
    }
    const headers={apikey:supabaseKey,Authorization:'Bearer '+supabaseKey};
    const endpoint = supabaseUrl+'/rest/v1/pedidos?id=eq.'+encodeURIComponent(String(orderId))+'&select=id,pet_id,tutor_id,tipo,valor,valor_base,cupom,status,metodo&limit=1';
    const orderResp = await fetch(endpoint,{headers});
    if (!orderResp.ok) return res.status(502).json({error:'Não foi possível conferir o pedido'});
    const pedidos = await orderResp.json();
    const pedido = pedidos?.[0];
    if (!pedido || String(pedido.pet_id)!==String(petId) || pedido.tipo!==tipo || pedido.status!=='pendente' || pedido.metodo!=='automatico') {
      return res.status(400).json({error:'Pedido inexistente, incompatível ou já processado'});
    }
    const cents=moneyInCents(pedido.valor);
    if (!Number.isFinite(cents) || cents<1 || cents>100000000 || moneyInCents(valor)!==cents) {
      return res.status(400).json({error:'Valor do pedido não confere'});
    }
    // O preço oficial é sempre lido no servidor; não confiamos em preços enviados ou gravados pelo navegador.
    const configResp = await fetch(supabaseUrl+'/rest/v1/configuracoes?id=eq.1&select=price_combo1,price_combo2,payment_mode&limit=1',{headers});
    if (!configResp.ok) return res.status(502).json({error:'Não foi possível validar o preço'});
    const config=(await configResp.json())?.[0];
    if (!config || config.payment_mode!=='auto') return res.status(409).json({error:'Cobrança automática indisponível'});
    const price = tipo==='combo1' ? config.price_combo1 : config.price_combo2;
    const baseCents=moneyInCents(price);
    if (!Number.isFinite(baseCents) || moneyInCents(pedido.valor_base)!==baseCents) {
      return res.status(409).json({error:'Preço oficial alterado. Atualize a página e tente novamente'});
    }
    let discounted=baseCents;
    if (pedido.cupom) {
      const couponResp=await fetch(supabaseUrl+'/rest/v1/cupons?code=eq.'+encodeURIComponent(pedido.cupom)+'&select=code,desconto,ativo&limit=1',{headers});
      if (!couponResp.ok) return res.status(502).json({error:'Não foi possível verificar o cupom'});
      const coupon=(await couponResp.json())?.[0];
      const percent=Number(coupon?.desconto);
      if (!coupon?.ativo || !Number.isInteger(percent) || percent<0 || percent>100) {
        return res.status(409).json({error:'Cupom inválido ou expirado'});
      }
      discounted=Math.round(baseCents*(100-percent)/100);
    }
    if (cents!==discounted) return res.status(409).json({error:'Valor do pedido diferente do preço oficial'});
    const petResp=await fetch(supabaseUrl+'/rest/v1/pets?id=eq.'+encodeURIComponent(String(petId))+'&select=id,tutor_id&limit=1',{headers});
    if (!petResp.ok) return res.status(502).json({error:'Não foi possível conferir o pet'});
    const pet=(await petResp.json())?.[0];
    if (!pet || String(pet.tutor_id)!==String(pedido.tutor_id)) return res.status(400).json({error:'Pet não pertence ao pedido'});
    const tutorResp=await fetch(supabaseUrl+'/rest/v1/tutores?id=eq.'+encodeURIComponent(String(pedido.tutor_id))+'&select=email&limit=1',{headers});
    if (!tutorResp.ok) return res.status(502).json({error:'Não foi possível conferir o tutor'});
    const tutor=(await tutorResp.json())?.[0];
    const title=tipo==='combo1'?'PetfiQ — Documentos digitais':'PetfiQ — QR Code virtual';
    const preference={
      items:[{title,quantity:1,unit_price:cents/100,currency_id:'BRL'}],
      payer:{email:tutor?.email||undefined},
      back_urls:{
        success:ROOT+'/?pagamento=sucesso&pedido='+encodeURIComponent(String(orderId)),
        failure:ROOT+'/?pagamento=falha',
        pending:ROOT+'/?pagamento=pendente'
      },
      auto_return:'approved',
      external_reference:String(orderId),
      notification_url:ROOT+'/api/webhook',
      statement_descriptor:'RG PET'
    };
    const response=await fetch('https://api.mercadopago.com/checkout/preferences',{
      method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify(preference)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok || !data.init_point) {
      console.error('Falha ao criar preferência MP:',response.status);
      return res.status(502).json({error:'Não foi possível iniciar o pagamento'});
    }
    return res.status(200).json({init_point:data.init_point,sandbox_init_point:data.sandbox_init_point,id:data.id});
  } catch(err) {
    console.error('Falha ao iniciar pagamento:',err?.message);
    return res.status(500).json({error:'Erro ao iniciar pagamento'});
  }
}
