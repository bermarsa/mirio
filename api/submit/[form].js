// ── Backend público de formularios MIRIO → Airtable (Vercel) ──
// SOLO permite CREAR (POST) registros en dos tablas concretas.
// No lee, no edita, no borra. El token vive en variables de entorno.
// Archivo: /api/submit/[form].js  → atiende /api/submit/empresa y /api/submit/embajador

export default async function handler(req, res) {
  // Solo POST (crear)
  if (req.method !== 'POST') {
    return res.status(405).send('Método no permitido');
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID        = process.env.AIRTABLE_BASE_ID;
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return res.status(500).send('Faltan variables de entorno (AIRTABLE_TOKEN / AIRTABLE_BASE_ID).');
  }

  // Tablas permitidas (lista blanca: nadie puede escribir en otra tabla)
  const TABLES = {
    empresa:   'tblWlrhx6WR0acxcp', // Empresas
    embajador: 'tblZxGJnqLnMWT0IP', // Embajadores
  };
  const form = Array.isArray(req.query.form) ? req.query.form[0] : req.query.form;
  const tableId = TABLES[form];
  if (!tableId) return res.status(400).send('Formulario no válido');

  // Leer los campos enviados
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const fields = body && body.fields ? body.fields : null;
  if (!fields || typeof fields !== 'object') {
    return res.status(400).send('Faltan campos');
  }

  try {
    const r = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).send('Error al contactar Airtable: ' + e.message);
  }
}
