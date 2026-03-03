export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token requerido" });
  try {
    // Extract user ID from token format: APP_USR-{appId}-{date}-{hash}-{userId}
    const parts = token.split("-");
    const userId = parts[parts.length - 1];

    // Try all known balance endpoints for AR accounts
    const endpoints = [
      "https://api.mercadopago.com/v1/account/balance",
      "https://api.mercadopago.com/users/" + userId + "/mercadopago_account/balance",
      "https://api.mercadolibre.com/users/" + userId + "/mercadopago_account/balance",
      "https://api.mercadopago.com/v1/account",
    ];

    const results = await Promise.all(endpoints.map(url =>
      fetch(url, { headers: { Authorization: "Bearer " + token } })
        .then(r => r.json())
        .then(d => ({ url, data: d }))
        .catch(e => ({ url, error: e.message }))
    ));

    // Look for any field that might contain balance
    for (const r of results) {
      const d = r.data;
      if (!d) continue;
      if (d.available_balance !== undefined) return res.status(200).json({ available_balance: d.available_balance, pending_amount: d.pending_amount || 0 });
      if (d.own_money !== undefined) return res.status(200).json({ available_balance: d.own_money, pending_amount: d.blocked_money || 0 });
      if (d.money !== undefined) return res.status(200).json({ available_balance: d.money, pending_amount: 0 });
    }

    // Nothing worked - return all results for debugging
    res.status(200).json({ debug: true, userId, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
