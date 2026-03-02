export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token requerido" });

  try {
    const mpRes = await fetch("https://api.mercadopago.com/v1/account/balance", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await mpRes.json();
    if (!mpRes.ok) return res.status(mpRes.status).json({ error: data.message || "Error de MP" });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
