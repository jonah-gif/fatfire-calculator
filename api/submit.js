/**
 * /api/submit.js — FatFIRE Calculator Lead Capture
 * Vercel serverless function (Node.js)
 * Creates a GHL contact + opportunity with full calculator context
 */

const GHL_API_KEY     = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const PIPELINE_ID     = 'dGPOo5EyspFfEBAham7N'; // Leads pipeline
const STAGE_ID        = '00cbc90a-d360-473d-bcf3-0986100a212c'; // New stage

const GHL_BASE = 'https://services.leadconnectorhq.com';
const HEADERS  = {
  'Authorization': `Bearer ${GHL_API_KEY}`,
  'Content-Type':  'application/json',
  'Version':       '2021-07-28',
};

async function ghlFetch(path, method, body) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`GHL ${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// Format calculator results into a readable note
function buildNote(data) {
  const {
    firstName, email,
    // Calc 1
    currentAge, annualIncome, currentSavings, retirementExpenses, province,
    fatfireTarget, fatfireAge, fatfireYears,
    // Calc 2
    mortgageBalance, mortgageRate, mortgageAmort, heloc,
    scenarioAAge, scenarioBAge, yearsSooner,
    interestSaved, smTaxBenefit, lifetimeFreed,
  } = data;

  return `
=== FatFIRE Calculator Lead ===
Submitted: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}

--- Profile ---
Age: ${currentAge}
Province: ${province}
Annual Income: $${Number(annualIncome).toLocaleString('en-CA')}
Current Savings: $${Number(currentSavings).toLocaleString('en-CA')}
Retirement Expenses: $${Number(retirementExpenses).toLocaleString('en-CA')}

--- FatFIRE Number ---
Target: $${Number(fatfireTarget).toLocaleString('en-CA')}
Standard Path: FatFIRE at age ${scenarioAAge}

--- Mortgage Inputs ---
Balance: $${Number(mortgageBalance).toLocaleString('en-CA')}
Rate: ${(Number(mortgageRate) * 100).toFixed(2)}%
Amortization: ${mortgageAmort} years
HELOC Available: $${Number(heloc).toLocaleString('en-CA')}

--- With Freedom Accelerator ---
FatFIRE at age ${scenarioBAge} (${yearsSooner} year${yearsSooner !== 1 ? 's' : ''} sooner)
Interest Saved: $${Number(interestSaved).toLocaleString('en-CA')}
SM Tax Benefit: $${Number(smTaxBenefit).toLocaleString('en-CA')}
Lifetime Payments Freed: $${Number(lifetimeFreed).toLocaleString('en-CA')}

Source: FatFIRE Canada Calculator
`.trim();
}

export default async function handler(req, res) {
  // CORS — allow from same origin + your Vercel domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { firstName, email } = data;
  if (!firstName || !email) {
    return res.status(400).json({ error: 'firstName and email are required' });
  }

  try {
    // 1. Create or update contact
    const contactPayload = {
      firstName,
      email,
      locationId: GHL_LOCATION_ID,
      source:     'FatFIRE Calculator',
      tags:       ['fatfire-calculator', 'calculator-lead'],
    };

    const contactRes = await ghlFetch('/contacts/upsert', 'POST', contactPayload);
    const contactId  = contactRes.contact?.id;

    if (!contactId) throw new Error('No contact ID returned from GHL upsert');

    // 2. Add note with calculator results
    const note = buildNote(data);
    await ghlFetch('/contacts/notes', 'POST', {
      contactId,
      body: note,
      userId: null,
    });

    // 3. Create opportunity in Leads pipeline → New stage
    await ghlFetch('/opportunities/', 'POST', {
      pipelineId:    PIPELINE_ID,
      locationId:    GHL_LOCATION_ID,
      name:          `${firstName} — FatFIRE Calculator`,
      pipelineStageId: STAGE_ID,
      status:        'open',
      contactId,
      source:        'FatFIRE Calculator',
    });

    return res.status(200).json({ success: true, contactId });

  } catch (err) {
    console.error('[FatFIRE submit]', err.message);
    return res.status(500).json({ error: 'Failed to submit lead. Please try again.' });
  }
}
