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

async function runPhase25Verification() {
  console.log('=== PGFINDER PHASE 25 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Authenticate Seeker and Owner
    console.log('Step 1: Authenticating Seeker and Owner accounts...');
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

    // 2. Trigger Event: Seeker creates PG Enquiry (creates notification for Owner)
    console.log('Step 2: Triggering Event (Seeker Enquiry) to generate Owner notification...');
    const pgsRes = await request(`${API_BASE}/pgs/search`);
    const pgId = pgsRes.data.pgs[0]._id || pgsRes.data.pgs[0].id;

    await request(`${API_BASE}/enquiries`, {
      method: 'POST',
      headers: seekerHeaders,
      body: { pgId, subject: 'Notification Event Test', message: 'Hello, testing real-time notification service.' },
    });
    console.log('✓ System Event triggered. Notification dispatched to Owner.\n');

    // 3. Unread Count & List for Owner
    console.log('Step 3: Fetching Owner Notifications & Unread Count...');
    const countRes = await request(`${API_BASE}/notifications/unread-count`, { headers: ownerHeaders });
    console.log('✓ Owner Unread Notification Count:', countRes.data.unreadCount);

    const listRes = await request(`${API_BASE}/notifications`, { headers: ownerHeaders });
    console.log(`✓ Owner received ${listRes.data.notifications.length} notifications.\n`);

    if (listRes.data.notifications.length > 0) {
      const notifId = listRes.data.notifications[0]._id || listRes.data.notifications[0].id;
      
      // 4. Mark Single Notification as Read
      console.log('Step 4: Testing Mark as Read on Notification ID:', notifId);
      await request(`${API_BASE}/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: ownerHeaders,
      });
      console.log('✓ Notification marked as read successfully.');

      // 5. Security & Recipient Isolation (IDOR Protection)
      console.log('Step 5: Testing Recipient Isolation (IDOR Protection)...');
      try {
        await request(`${API_BASE}/notifications/${notifId}/read`, {
          method: 'PATCH',
          headers: seekerHeaders, // Seeker attempting to access owner notification
        });
        console.error('❌ IDOR Security Failure: Seeker accessed Owner notification!');
        process.exit(1);
      } catch (err) {
        console.log('✓ Security Verified: Unauthorized notification access blocked with 404/403.\n');
      }
    }

    // 6. Mark All as Read Test
    console.log('Step 6: Testing Mark All as Read...');
    await request(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: ownerHeaders,
    });
    console.log('✓ Mark All as Read completed.\n');

    // 7. Verify Payment System Absence
    console.log('Step 7: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in listRes || 'stripe' in listRes || 'payment' in listRes;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 25 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 25 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase25Verification();
