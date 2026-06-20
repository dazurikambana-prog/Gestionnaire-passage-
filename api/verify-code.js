// /api/verify-code.js
// Vercel Serverless Function - verifies and activates access codes against Supabase
// Durée de validité : 7 mois à compter de la date d'activation

const SUPABASE_URL = 'https://vsvbxuzaypwdbxuegsll.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TfDVmmrvxc-jthBAR32iMw_wfgn_gfC';

const DUREE_VALIDITE_MS = 7 * 30 * 24 * 60 * 60 * 1000; // 7 mois ≈ 210 jours

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { code, deviceId } = req.body || {};

    if (!code || !deviceId) {
      return res.status(400).json({ ok: false, error: 'missing_params' });
    }

    const cleanCode = String(code).trim();

    const lookupUrl = `${SUPABASE_URL}/rest/v1/codes_acces?code=eq.${encodeURIComponent(cleanCode)}&select=code,appareil_id,date_activation,date_expiration`;
    const lookupRes = await fetch(lookupUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!lookupRes.ok) {
      return res.status(500).json({ ok: false, error: 'supabase_error' });
    }

    const rows = await lookupRes.json();

    if (!rows || rows.length === 0) {
      return res.status(200).json({ ok: false, error: 'invalid_code' });
    }

    const row = rows[0];

    if (row.appareil_id && row.appareil_id !== deviceId) {
      return res.status(200).json({ ok: false, error: 'code_already_used' });
    }

    if (row.appareil_id && row.appareil_id === deviceId) {
      if (row.date_expiration) {
        const expirationDate = new Date(row.date_expiration);
        if (Date.now() > expirationDate.getTime()) {
          return res.status(200).json({
            ok: false,
            error: 'code_expired',
            dateExpiration: row.date_expiration
          });
        }
      }
      return res.status(200).json({
        ok: true,
        alreadyActivated: true,
        dateActivation: row.date_activation,
        dateExpiration: row.date_expiration
      });
    }

    const maintenant = new Date();
    const dateExpiration = new Date(maintenant.getTime() + DUREE_VALIDITE_MS);

    const updateUrl = `${SUPABASE_URL}/rest/v1/codes_acces?code=eq.${encodeURIComponent(cleanCode)}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        appareil_id: deviceId,
        date_activation: maintenant.toISOString(),
        date_expiration: dateExpiration.toISOString()
      })
    });

    if (!updateRes.ok) {
      return res.status(500).json({ ok: false, error: 'activation_failed' });
    }

    return res.status(200).json({
      ok: true,
      alreadyActivated: false,
      dateActivation: maintenant.toISOString(),
      dateExpiration: dateExpiration.toISOString()
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(err) });
  }
  }
