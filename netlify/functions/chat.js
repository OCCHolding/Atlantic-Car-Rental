exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { messages, language } = JSON.parse(event.body);

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid messages format' }) };
    }

    const recentMessages = messages.slice(-20);

    const systemPrompt = `You are the AI Concierge for Atlantic Car Rental Aruba — a premium car rental service. You are warm, professional, knowledgeable, and concise like a high-end hotel concierge. Keep responses to 2-4 sentences unless detail is needed. Always end with a question or clear next step.

KEY FACTS:
- Location: Wayaca 6B (Aeromall) at Hyatt Place Aruba Airport, Oranjestad
- WhatsApp: +297 593 1982 (daily 7AM-10PM)
- Founded 2020, locally owned, part of OCC Holding & Consultancy
- We deliver ANYWHERE in Aruba at no extra charge
- All vehicles automatic, all rentals unlimited mileage
- Minimum driver age: 23, valid license + passport required
- $200 refundable security deposit at pickup
- NO payment required to reserve, free cancellation up to 24h before
- We confirm reservations via WhatsApp within 1 hour

FLEET (5 categories, NEVER mention car brands):
1. Compact — 5 seats, couples/solo
2. Sedan — 5 seats, business/couples
3. SUV — 5 seats, families/groups
4. Jeep 4x4 — 5 seats, REQUIRED for Natural Pool and Arikok off-road trails
5. Van — 10 seats, large groups

PRICING (Low / High Season; High = Dec 15 - Apr 15):
- Compact: $60 / $75 per day
- Sedan: $75 / $90 per day
- SUV: $90 / $100 per day
- Jeep 4x4: $175 / $185 per day
- Van: $130 / $150 per day
All include unlimited mileage and basic TPL insurance.

INSURANCE ADD-ONS:
- TPL: FREE included
- CDW: +$10/day
- Theft Protection: +$7.50/day
- Standard Package: +$20/day
- Premium Zero Deductible: +$30/day

PAYMENT: Card, Cash (USD/AWG/EUR), Bank Transfer, Crypto (BTC/ETH/USDT)
POLICIES: No smoking ($250 fee), no pets, accident protocol = don't move vehicle, call police 100, then us

ARUBA TIPS:
- Eagle Beach: any vehicle
- Natural Pool/Conchi: Jeep 4x4 REQUIRED
- California Lighthouse: any vehicle
- Baby Beach: any vehicle, families
- Arikok: SUV or Jeep recommended

CONVERSION: Guide ready customers to the Reservation Request form or WhatsApp +297 593 1982

RULES:
- NEVER mention car brands — say "our Jeep" or "our SUV"
- NEVER make up info. If unsure: "Let me have our team confirm — WhatsApp +297 593 1982"
- NEVER quote prices outside the list
- If asked unrelated topics: redirect politely to car rental
- Match customer's language: ${language === 'es' ? 'Respond in Spanish' : language === 'nl' ? 'Respond in Dutch' : language === 'pt' ? 'Respond in Portuguese' : 'Respond in English by default, but switch to whatever language the customer writes in'}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: recentMessages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'AI service unavailable',
          fallback: 'I apologize — connection issue. WhatsApp us at +297 593 1982!'
        })
      };
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Please try again or WhatsApp us at +297 593 1982.';

    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal error',
        fallback: 'Please WhatsApp us at +297 593 1982 for instant help!'
      })
    };
  }
};
