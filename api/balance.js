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

    // Fetch released payments (available balance) - paginate up to 1000
    async function fetchPayments(status_detail, offset = 0, acc = 0) {
      const url = "https://api.mercadopago.com/v1/payments/search?limit=100&offset=" + offset +
        "&sort=date_created&criteria=desc&status=approved&money_release_status=" + status_detail;
      const r = await fetch(url, { headers });
      const d = await r.json();
      if (!d.results || d.results.length === 0) return acc;
      const sum = d.results.reduce((s, p) => s + (p.transaction_amount || 0) - (p.amount_refunded || 0), 0);
      const newAcc = acc + sum;
      if (d.paging.offset + d.results.length < d.paging.total && d.paging.offset < 900) {
        return fetchPayments(status_detail, offset + 100, newAcc);
      }
      return newAcc;
    }

    const [released, pending] = await Promise.all([
      fetchPayments("released"),
      fetchPayments("pending")
    ]);

    res.status(200).json({
      available_balance: Math.round(released * 100) / 100,
      pending_amount: Math.round(pending * 100) / 100
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
