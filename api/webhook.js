export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!accessToken || !supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
    }

    let paymentId = null;

    if (req.method === 'POST' && req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body.type === 'payment' && body.data && body.data.id) {
        paymentId = body.data.id;
      } else if (body.data && body.data.id) {
        paymentId = body.data.id;
      }
    }

    if (req.method === 'GET' && req.query && req.query['data.id']) {
      paymentId = req.query['data.id'];
    }

    if (!paymentId) {
      return res.status(200).json({ ok: true, msg: 'sem paymentId' });
    }

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments/' + paymentId, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    const pagamento = await mpRes.json();

    if (!mpRes.ok) {
      console.error('Erro MP:', pagamento);
      return res.status(200).json({ ok: true, msg: 'erro ao consultar MP' });
    }

    const status = pagamento.status;
    const externalRef = pagamento.external_reference;

    if (!externalRef) {
      return res.status(200).json({ ok: true, msg: 'sem external_reference' });
    }

    const partes = externalRef.split('|');
    const petId = partes[0];
    const tipo = partes[1];

    if (status !== 'approved') {
      return res.status(200).json({ ok: true, msg: 'pagamento ainda não aprovado: ' + status });
    }

    const pedidoId = Date.now();

    const insertPedido = await fetch(supabaseUrl + '/rest/v1/pedidos', {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: pedidoId,
        pet_id: Number(petId),
        tipo: tipo,
        valor: pagamento.transaction_amount,
        valor_base: pagamento.transaction_amount,
        status: 'pago',
        metodo: 'automatico',
        cupom: null
      })
    });

    if (!insertPedido.ok) {
      const erro = await insertPedido.text();
      console.error('Erro Supabase:', erro);
      return res.status(200).json({ ok: true, msg: 'erro ao gravar pedido' });
    }

    return res.status(200).json({ ok: true, msg: 'pagamento registrado com sucesso' });

  } catch (error) {
    console.error('Erro webhook:', error);
    return res.status(200).json({ ok: true, msg: 'erro tratado' });
  }
}
