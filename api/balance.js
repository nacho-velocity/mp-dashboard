export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token requerido" });
  try {
    const userRes = await fetch("https://api.mercadopago.com/v1/users/me", {
      headers: { Authorization: "Bearer " + token }
    });
    const userData = await userRes.json();
    if (!userRes.ok) return res.status(200).json({ debug: "user_error", data: userData });
    const userId = userData.id;

    const [r1, r2, r3] = await Promise.all([
      fetch("https://api.mercadolibre.com/users/" + userId + "/mercadopago_account/balance", { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => ({ url: "mercadolibre", status: "ok", data: d })).catch(e => ({ url: "mercadolibre", error: e.message })),
      fetch("https://api.mercadopago.com/v1/account/balance", { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => ({ url: "mp_v1_balance", data: d })).catch(e => ({ url: "mp_v1_balance", error: e.message })),
      fetch("https://api.mercadopago.com/users/" + userId + "/mercadopago_account/balance", { headers: { Authorization: "Bearer " + token } }).then(r => r.json()).then(d => ({ url: "mp_user_balance", data: d })).catch(e => ({ url: "mp_user_balance", error: e.message }))
    ]);

    res.status(200).json({ userId, debug: true, r1, r2, r3 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
