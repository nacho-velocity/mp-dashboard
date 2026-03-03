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

    // Sum ALL released payments (no date filter) up to 1000 most recent
    async function sumByStatus(releaseStatus) {
      let total = 0;
      let offset = 0;
      while (offset < 1000) {
        const url = "https://api.mercadopago.com/v1/payments/search?limit=100&offset=" + offset +
          "&status=approved&money_release_status=" + releaseStatus +
          "&sort=date_created&criteria=desc";
        const d = await fetch(url, { headers }).then(r => r.json());
        if (!d.results || d.results.length === 0) break;
        for (const p of d.results) {
          total += (p.transaction_amount || 0) - (p.amount_refunded || 0);
        }
        if (d.results.length < 100) break;
        offset += 100;
      }
      return Math.round(total * 100) / 100;
    }

    const [released, pending] = await Promise.all([
      sumByStatus("released"),
      sumByStatus("pending")
    ]);

    res.status(200).json({ available_balance: released, pending_amount: pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
