export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token requerido" });
  try {
    // Get user ID first
    const userRes = await fetch("https://api.mercadopago.com/v1/users/me", {
      headers: { Authorization: "Bearer " + token }
    });
    const userData = await userRes.json();
    if (!userRes.ok) return res.status(userRes.status).json({ error: userData.message || "Error usuario" });
    const userId = userData.id;

    // Try mercadolibre.com domain (works for AR accounts)
    const balRes = await fetch("https://api.mercadolibre.com/users/" + userId + "/mercadopago_account/balance", {
      headers: { Authorization: "Bearer " + token }
    });
    const balData = await balRes.json();

    // If that fails try mercadopago.com domain
    if (!balRes.ok) {
      const balRes2 = await fetch("https://api.mercadopago.com/v1/account/balance", {
        headers: { Authorization: "Bearer " + token }
      });
      const balData2 = await balRes2.json();
      if (!balRes2.ok) return res.status(balRes2.status).json({ error: JSON.stringify(balData2) });
      return res.status(200).json(balData2);
    }

    res.status(200).json(balData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
