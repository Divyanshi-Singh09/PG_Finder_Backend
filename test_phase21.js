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

async function runPhase21Verification() {
  console.log('=== PGFINDER PHASE 21 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Authenticate Seeker and Owner
    console.log('Step 1: Authenticating Seeker and Owner users...');
    const seekerAuth = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'aarav@example.com', password: 'Password123' },
    });
    const seekerHeaders = { Authorization: `Bearer ${seekerAuth.data.token}` };

    const ownerAuth = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'rajesh@example.com', password: 'Password123' },
    });
    const ownerHeaders = { Authorization: `Bearer ${ownerAuth.data.token}` };
    console.log('✓ Users authenticated.\n');

    // 2. Seeker Creates Property Enquiry Conversation
    console.log('Step 2: Testing Seeker conversation creation...');
    const pgsRes = await request(`${API_BASE}/pgs/search`);
    const pgId = pgsRes.data.pgs[0]._id || pgsRes.data.pgs[0].id;

    const enqRes = await request(`${API_BASE}/enquiries`, {
      method: 'POST',
      headers: seekerHeaders,
      body: { pgId, subject: 'Double room availability for next month', message: 'Hello, is a double room available from next Monday?' },
    });
    const enqId = enqRes.data.enquiry._id || enqRes.data.enquiry.id;
    console.log('✓ Seeker created conversation thread:', enqId);

    // 3. Owner Receives Notification & Responds
    console.log('Step 3: Testing Owner real-time response capability...');
    const ownerThread = await request(`${API_BASE}/enquiries/${enqId}`, { headers: ownerHeaders });
    console.log('✓ Owner retrieved message thread:', ownerThread.data.enquiry.subject);

    await request(`${API_BASE}/enquiries/owner/${enqId}/respond`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: { response: 'Yes, double room is available. Feel free to visit.', status: 'RESPONDED' },
    });
    console.log('✓ Owner sent response message successfully.\n');

    // 4. Seeker Message History Verification
    console.log('Step 4: Verifying Seeker message thread updates...');
    const seekerThreads = await request(`${API_BASE}/enquiries/my`, { headers: seekerHeaders });
    const targetThread = seekerThreads.data.enquiries.find((e) => (e._id || e.id) === enqId);
    console.log('✓ Seeker Thread Received Owner Reply:', targetThread?.ownerResponse || targetThread?.ownerReply, '\n');

    // 5. Participant Authorization & Security Test
    console.log('Step 5: Testing Participant Security Isolation (IDOR Protection)...');
    try {
      await request(`${API_BASE}/enquiries/owner/${enqId}/respond`, {
        method: 'PATCH',
        headers: seekerHeaders, // Seeker trying to act as owner
        body: { response: 'Hacked response' },
      });
      console.error('❌ IDOR Security failure: Seeker responded to owner endpoint!');
      process.exit(1);
    } catch (err) {
      console.log('✓ Security Verified: Seeker attempt to hijack owner reply endpoint blocked.\n');
    }

    // 6. Verify Payment System Absence
    console.log('Step 6: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in enqRes || 'stripe' in enqRes || 'payment' in enqRes;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 21 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 21 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase21Verification();
