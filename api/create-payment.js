export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { titulo, valor, petId, tipo, orderId, userEmail } = req.body;
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({ error: 'Token do Mercado Pago não configurado' });
    }

    const preference = {
      items: [
        {
          title: titulo || 'RG Pet - Documento Digital',
          quantity: 1,
          unit_price: Number(valor) || 29.90,
          currency_id: 'BRL'
        }
      ],
      payer: {
        email: userEmail || 'comprador@email.com'
      },
      back_urls: {
        success: 'https://rgpet.vercel.app/?pagamento=sucesso&pet=' + petId + '&tipo=' + tipo,
        failure: 'https://rgpet.vercel.app/?pagamento=falha',
        pending: 'https://rgpet.vercel.app/?pagamento=pendente'
      },
      auto_return: 'approved',
      external_reference: String(orderId),
      notification_url: 'https://rgpet.vercel.app/api/webhook',
      statement_descriptor: 'RG PET'
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro MP:', data);
      return res.status(response.status).json({ error: 'Erro ao criar pagamento', detalhe: data });
    }

    return res.status(200).json({
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      id: data.id
    });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno', detalhe: error.message });
  }
}
