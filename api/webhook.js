const BASE='https://hlptvfzthfdvjikogjek.supabase.co';
const cents=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100):NaN;};
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['POST','GET'].includes(req.method)) return res.status(405).json({error:'Método não permitido'});
  const token=process.env.MP_ACCESS_TOKEN;
  const supabaseUrl=process.env.SUPABASE_URL||BASE;
  const key=process.env.SUPABASE_ANON_KEY;
  if(!token||!key) return res.status(503).json({error:'Serviço de pagamento indisponível'});
  try {
    const payload=typeof req.body==='string'?JSON.parse(req.body):req.body;
    const paymentId=req.method==='POST'?(payload?.data?.id):(req.query?.['data.id']);
    if(!/^\d{1,24}$/.test(String(paymentId??''))) return res.status(200).json({ok:true,ignored:true});
    // Confirmação independente junto ao Mercado Pago. Nunca usar status enviado no webhook.
    const mpResp=await fetch('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(String(paymentId)),{
      headers:{Authorization:'Bearer '+token}
    });
    if(!mpResp.ok) return res.status(502).json({error:'Consulta ao pagamento indisponível'});
    const pagamento=await mpResp.json();
    if(pagamento.status!=='approved') return res.status(200).json({ok:true,pending:true});
    const ref=String(pagamento.external_reference??'');
    if(!/^\d{1,18}$/.test(ref) || pagamento.currency_id!=='BRL') return res.status(200).json({ok:true,ignored:true});
    const headers={apikey:key,Authorization:'Bearer '+key};
    const pedidoResp=await fetch(supabaseUrl+'/rest/v1/pedidos?id=eq.'+encodeURIComponent(ref)+'&select=id,tipo,valor,pet_id,tutor_id,status,metodo&limit=1',{headers});
    if(!pedidoResp.ok) return res.status(502).json({error:'Consulta ao pedido indisponível'});
    const pedido=(await pedidoResp.json())?.[0];
    if(!pedido || !['combo1','combo2'].includes(pedido.tipo) || pedido.metodo!=='automatico') return res.status(200).json({ok:true,ignored:true});
    const expected=cents(pedido.valor), paid=cents(pagamento.transaction_amount);
    if(!Number.isFinite(expected)||expected<1||paid!==expected) {
      console.error('Valor de pagamento divergente no pedido:',ref);
      return res.status(200).json({ok:true,ignored:true});
    }
    if(pedido.status==='pago') return res.status(200).json({ok:true,alreadyProcessed:true});
    if(pedido.status!=='pendente') return res.status(200).json({ok:true,ignored:true});
    const petResp=await fetch(supabaseUrl+'/rest/v1/pets?id=eq.'+encodeURIComponent(String(pedido.pet_id))+'&select=id,tutor_id&limit=1',{headers});
    if(!petResp.ok) return res.status(502).json({error:'Consulta ao pet indisponível'});
    const pet=(await petResp.json())?.[0];
    if(!pet||String(pet.tutor_id)!==String(pedido.tutor_id)) return res.status(200).json({ok:true,ignored:true});
    const updateResp=await fetch(supabaseUrl+'/rest/v1/pedidos?id=eq.'+encodeURIComponent(ref)+'&status=eq.pendente',{
      method:'PATCH',
      headers:{...headers,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({status:'pago',metodo:'automatico'})
    });
    if(!updateResp.ok) return res.status(502).json({error:'Não foi possível confirmar o pedido'});
    const updated=await updateResp.json();
    if(!updated?.length) return res.status(200).json({ok:true,alreadyProcessed:true});
    return res.status(200).json({ok:true,confirmed:true});
  } catch(err) {
    console.error('Falha ao processar confirmação:',err?.message);
    return res.status(500).json({error:'Falha ao processar confirmação'});
  }
}
