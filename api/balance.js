export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { client_id, client_secret } = req.body;
  if (!client_id || !client_secret) return res.status(400).json({ error: "client_id y client_secret requeridos" });

  try {
    // Step 1: Get OAuth token using client_credentials flow
    const oauthRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id,
        client_secret,
        grant_type: "client_credentials"
      })
    });
    const oauthData = await oauthRes.json();
    if (!oauthRes.ok || !oauthData.access_token) {
      return res.status(200).json({ error: "OAuth failed", detail: oauthData });
    }

    const token = oauthData.access_token;
    const userId = oauthData.user_id || client_id.split("-").pop();

    // Step 2: Try balance endpoints with the fresh OAuth token
    const [r1, r2] = await Promise.all([
      fetch("https://api.mercadolibre.com/users/" + userId + "/mercadopago_account/balance", {
        headers: { Authorization: "Bearer " + token }
      }).then(r => r.json()).catch(e => ({ error: e.message })),
      fetch("https://api.mercadopago.com/users/" + userId + "/mercadopago_account/balance", {
        headers: { Authorization: "Bearer " + token }
      }).then(r => r.json()).catch(e => ({ error: e.message }))
    ]);

    const winner = [r1, r2].find(r => r.available_balance !== undefined || r.own_money !== undefined || r.total !== undefined);
    if (winner) {
      return res.status(200).json({
        available_balance: winner.available_balance ?? winner.own_money ?? winner.total ?? 0,
        pending_amount: winner.pending_amount ?? winner.blocked_money ?? 0
      });
    }

    res.status(200).json({ debug: true, userId, token: token.substring(0,20)+"...", r1, r2 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
