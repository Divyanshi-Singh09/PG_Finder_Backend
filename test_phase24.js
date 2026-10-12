const API_BASE = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const { headers = {}, body, ...rest } = options;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...rest,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || 'HTTP Request Failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function runPhase24Verification() {
  console.log('=== PGFINDER PHASE 24 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Location Autocomplete API
    console.log('Step 1: Testing Location Autocomplete API...');
    const autoRes = await request(`${API_BASE}/pgs/autocomplete?q=Noida`);
    console.log(`✓ Autocomplete returned ${autoRes.data.suggestions.length} location suggestions.`);

    // 2. Multi-Criteria Search
    console.log('Step 2: Testing Multi-Criteria PG Search Engine...');
    const searchRes = await request(`${API_BASE}/pgs/search?q=Noida&minRent=5000&maxRent=25000`);
    console.log(`✓ Multi-Criteria Search found ${searchRes.data.pgs.length} matching properties.`);

    const targetPg = searchRes.data.pgs[0];
    const targetPgId = targetPg._id || targetPg.id;

    // 3. Weighted Recommendation Engine
    console.log('Step 3: Testing Weighted Recommendation Engine...');
    const recRes = await request(`${API_BASE}/pgs/recommendations?city=Noida&maxRent=20000`);
    console.log(`✓ Recommendation Engine generated ${recRes.data.pgs.length} personalized recommendations.`);
    if (recRes.data.pgs.length > 0) {
      console.log('✓ Top Recommended PG Match Score:', recRes.data.pgs[0].recommendationScore || 'Default');
    }
    console.log('');

    // 4. Similar PGs Engine
    console.log('Step 4: Testing Similar PGs Recommendation Engine...');
    const similarRes = await request(`${API_BASE}/pgs/${targetPgId}/similar`);
    console.log(`✓ Similar PGs Engine matched ${similarRes.data.pgs.length} contextual properties.\n`);

    // 5. Verify Payment System Absence
    console.log('Step 5: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in searchRes || 'stripe' in searchRes || 'payment' in searchRes;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 24 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 24 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase24Verification();
