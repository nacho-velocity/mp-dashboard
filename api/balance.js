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

    const headers = { Authorization: "Bearer " + token };

    // Date range: last 90 days
    const now = new Date();
    const from = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split('.')[0] + '.000-00:00';
    const to = now.toISOString().split('.')[0] + '.000-00:00';

    // Fetch released and pending in parallel, max 2 pages each (200 payments)
    async function sumPayments(releaseStatus) {
      let total = 0;
      for (let offset = 0; offset < 200; offset += 100) {
        const url = "https://api.mercadopago.com/v1/payments/search?limit=100&offset=" + offset +
          "&status=approved&money_release_status=" + releaseStatus +
          "&begin_date=" + from + "&end_date=" + to;
        const r = await fetch(url, { headers });
        const d = await r.json();
        if (!d.results || d.results.length === 0) break;
        total += d.results.reduce((s, p) => s + (p.transaction_amount || 0) - (p.amount_refunded || 0), 0);
        if (d.results.length < 100) break;
      }
      return Math.round(total * 100) / 100;
    }

    const [released, pending] = await Promise.all([
      sumPayments("released"),
      sumPayments("pending")
    ]);

    res.status(200).json({ available_balance: released, pending_amount: pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
