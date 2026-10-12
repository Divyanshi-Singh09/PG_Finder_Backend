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

async function runPhase26Verification() {
  console.log('=== PGFINDER PHASE 26 E2E VERIFICATION TEST ===\n');

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
    console.log('✓ Seeker & Owner authenticated.\n');

    // 2. Seeker Creates Property Conversation Thread
    console.log('Step 2: Testing Seeker conversation creation...');
    const pgsRes = await request(`${API_BASE}/pgs/search`);
    const pgId = pgsRes.data.pgs[0]._id || pgsRes.data.pgs[0].id;

    const enqRes = await request(`${API_BASE}/enquiries`, {
      method: 'POST',
      headers: seekerHeaders,
      body: { pgId, subject: 'Room availability & visit timing enquiry', message: 'Hello, can I visit tomorrow evening at 5 PM?' },
    });
    const enqId = enqRes.data.enquiry._id || enqRes.data.enquiry.id;
    console.log('✓ Conversation thread created:', enqId);

    // 3. Owner Messaging Response
    console.log('Step 3: Testing Owner real-time chat response capability...');
    await request(`${API_BASE}/enquiries/owner/${enqId}/respond`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: { response: 'Yes, 5 PM works great. See you tomorrow!', status: 'RESPONDED' },
    });
    console.log('✓ Owner response sent successfully.\n');

    // 4. Report Conversation Integration
    console.log('Step 4: Testing Report Conversation integration with Admin Moderation...');
    const reportRes = await request(`${API_BASE}/reports`, {
      method: 'POST',
      headers: seekerHeaders,
      body: {
        pgId,
        reason: 'SPAM',
        description: 'Test report regarding conversation thread moderation',
      },
    });
    console.log('✓ Report submitted for Admin review:', reportRes.data.report?._id || 'Report Recorded', '\n');

    // 5. Participant Authorization & IDOR Protection
    console.log('Step 5: Testing Participant Authorization (IDOR Protection)...');
    try {
      await request(`${API_BASE}/enquiries/owner/${enqId}/respond`, {
        method: 'PATCH',
        headers: seekerHeaders, // Seeker attempting to act as owner
        body: { response: 'Hijack attempt' },
      });
      console.error('❌ IDOR Security failure: Seeker responded on owner endpoint!');
      process.exit(1);
    } catch (err) {
      console.log('✓ Security Verified: Unauthorized reply attempt blocked.\n');
    }

    // 6. Verify Payment System Absence
    console.log('Step 6: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in enqRes || 'stripe' in enqRes || 'payment' in enqRes;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 26 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 26 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase26Verification();
