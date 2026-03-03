export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token requerido" });
  try {
    // Extract user ID from token: APP_USR-{appId}-{date}-{hash}-{userId}
    const parts = token.split("-");
    const userId = parts[parts.length - 1];

    const [r1, r2, r3] = await Promise.all([
      fetch("https://api.mercadolibre.com/users/" + userId + "/mercadopago_account/balance", {
        headers: { Authorization: "Bearer " + token }
      }).then(r => r.json()),
      fetch("https://api.mercadopago.com/users/" + userId + "/mercadopago_account/balance", {
        headers: { Authorization: "Bearer " + token }
      }).then(r => r.json()),
      fetch("https://api.mercadopago.com/v1/account/balance", {
        headers: { Authorization: "Bearer " + token }
      }).then(r => r.json())
    ]);

    // Find whichever response has real balance data
    const winner = [r1, r2, r3].find(r => r.available_balance !== undefined || r.total !== undefined || r.own_money !== undefined);
    if (winner) return res.status(200).json(winner);

    // Return all for debugging
    res.status(200).json({ userId, r1, r2, r3 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
