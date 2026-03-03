export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, client_secret, token: directToken } = req.body;

  try {
    let token = directToken;

    // Get OAuth token if client credentials provided
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

    // Extract user ID from token
    const parts = token.split("-");
    const userId = parts[parts.length - 1];

    // Probe all known endpoints
    const probes = [
      "https://api.mercadopago.com/v1/account/settlement_report",
      "https://api.mercadopago.com/v1/account/release_report",
      "https://api.mercadopago.com/v1/account/bank_report",
      "https://api.mercadopago.com/v1/payments/search?limit=1",
      "https://api.mercadolibre.com/users/" + userId,
      "https://api.mercadolibre.com/users/" + userId + "/mercadopago_account/balance",
      "https://api.mercadopago.com/users/" + userId + "/mercadopago_account/balance",
      "https://api.mercadopago.com/v1/account/balance",
      "https://api.mercadolibre.com/sites/MLA/payment_methods",
    ];

    const results = await Promise.all(probes.map(url =>
      fetch(url, { headers: { Authorization: "Bearer " + token } })
        .then(r => ({ url, status: r.status, ok: r.ok, data: r.json() }))
        .then(async o => ({ url: o.url, status: o.status, data: await o.data }))
        .catch(e => ({ url, error: e.message }))
    ));

    // Check if any has balance data
    for (const r of results) {
      if (!r.data) continue;
      if (r.data.available_balance !== undefined) {
        return res.status(200).json({ available_balance: r.data.available_balance, pending_amount: r.data.pending_amount || 0 });
      }
      if (r.data.own_money !== undefined) {
        return res.status(200).json({ available_balance: r.data.own_money, pending_amount: r.data.blocked_money || 0 });
      }
    }

    // Return probe results for debugging
    const summary = results.map(r => ({ url: r.url.replace('https://api.mercadopago.com','MP').replace('https://api.mercadolibre.com','ML'), status: r.status, keys: r.data ? Object.keys(r.data).slice(0,5) : r.error }));
    res.status(200).json({ debug: true, userId, token: token.substring(0,25)+"...", summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
