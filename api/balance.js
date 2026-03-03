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
      const o = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id, client_secret, grant_type: "client_credentials" })
      }).then(r => r.json());
      if (!o.access_token) return res.status(200).json({ error: "OAuth failed", detail: o });
      token = o.access_token;
    }
    if (!token) return res.status(400).json({ error: "Token requerido" });
    const headers = { Authorization: "Bearer " + token };

    // Get last 10 payments with NO filters to see what fields look like
    const raw = await fetch("https://api.mercadopago.com/v1/payments/search?limit=10&sort=date_created&criteria=desc", { headers }).then(r => r.json());
    
    const sample = (raw.results || []).map(p => ({
      id: p.id,
      status: p.status,
      transaction_amount: p.transaction_amount,
      net_received_amount: p.net_received_amount,
      money_release_status: p.money_release_status,
      money_release_date: p.money_release_date,
      operation_type: p.operation_type,
    }));

    res.status(200).json({ total_payments: raw.paging?.total, sample });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
