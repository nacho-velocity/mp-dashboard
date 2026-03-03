export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, client_secret, token: directToken } = req.body;

  try {
    let token = directToken;
    if (client_id && client_secret) {
      const oauthRes = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id, client_secret, grant_type: "client_credentials" })
      });
      const oauthData = await oauthRes.json();
      if (!oauthData.access_token) return res.status(200).json({ error: "OAuth failed", detail: oauthData });
      token = oauthData.access_token;
    }
    if (!token) return res.status(400).json({ error: "Token requerido" });

    // Get one payment to see structure and find money_release_date / available fields
    const r = await fetch("https://api.mercadopago.com/v1/payments/search?limit=1&sort=date_created&criteria=desc", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await r.json();
    const payment = data.results?.[0];
    
    res.status(200).json({ 
      debug: true,
      paging: data.paging,
      payment_keys: payment ? Object.keys(payment) : [],
      sample: payment ? {
        id: payment.id,
        status: payment.status,
        transaction_amount: payment.transaction_amount,
        net_received_amount: payment.net_received_amount,
        amount_refunded: payment.amount_refunded,
        money_release_date: payment.money_release_date,
        date_approved: payment.date_approved,
        available_balance: payment.available_balance,
        collector_id: payment.collector_id,
        operation_type: payment.operation_type,
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
