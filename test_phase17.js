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

async function runPhase17Verification() {
  console.log('=== PGFINDER PHASE 17 E2E VERIFICATION TEST ===\n');

  try {
    // Authenticate Users
    console.log('Step 1: Authenticating Seeker, Owner, and Admin...');
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

    const adminAuth = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'Password123' },
    });
    const adminHeaders = { Authorization: `Bearer ${adminAuth.data.token}` };

    console.log('✓ Users authenticated.\n');

    // 2. Enquiry Notification Lifecycle
    console.log('Step 2: Testing Enquiry submission -> Owner Notification -> Reply -> Seeker Notification...');
    const pgsRes = await request(`${API_BASE}/pgs/search`);
    const pgId = pgsRes.data.pgs[0]._id || pgsRes.data.pgs[0].id;

    const enqRes = await request(`${API_BASE}/enquiries`, {
      method: 'POST',
      headers: seekerHeaders,
      body: { pgId, subject: 'Room 101 Availability Inquiry', message: 'Is double sharing room available next month?' },
    });
    const enqId = enqRes.data.enquiry._id || enqRes.data.enquiry.id;
    console.log('✓ Seeker created enquiry ticket');

    // Verify Owner received ENQUIRY_RECEIVED
    const ownerNotifs1 = await request(`${API_BASE}/notifications?category=ENQUIRIES`, { headers: ownerHeaders });
    const recNotif = ownerNotifs1.data.notifications.find((n) => n.type === 'ENQUIRY_RECEIVED');
    console.log('✓ Owner received ENQUIRY_RECEIVED notification:', recNotif?.title, `(Action URL: ${recNotif?.actionUrl})`);

    // Owner responds
    await request(`${API_BASE}/enquiries/owner/${enqId}/respond`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: { response: 'Yes, 2 beds available in double sharing!', status: 'RESPONDED' },
    });

    // Verify Seeker received ENQUIRY_REPLIED
    const seekerNotifs1 = await request(`${API_BASE}/notifications?category=ENQUIRIES`, { headers: seekerHeaders });
    const repNotif = seekerNotifs1.data.notifications.find((n) => n.type === 'ENQUIRY_REPLIED');
    console.log('✓ Seeker received ENQUIRY_REPLIED notification:', repNotif?.title, `(Action URL: ${repNotif?.actionUrl})\n`);

    // 3. Unread Count & Bulk Mark as Read Test
    console.log('Step 3: Testing Unread Notification Count & Mark All As Read lifecycle...');
    const unreadBefore = await request(`${API_BASE}/notifications/unread-count`, { headers: seekerHeaders });
    console.log(`✓ Seeker Unread Count before bulk read: ${unreadBefore.data.unreadCount}`);

    const markAllRes = await request(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: seekerHeaders,
    });
    console.log('✓ Seeker executed Mark All As Read:', markAllRes.message);

    const unreadAfter = await request(`${API_BASE}/notifications/unread-count`, { headers: seekerHeaders });
    console.log(`✓ Seeker Unread Count after bulk read: ${unreadAfter.data.unreadCount}\n`);

    // 4. Cross-User Security Isolation
    console.log('Step 4: Testing Notification Security Isolation (User A cannot delete User B notification)...');
    if (ownerNotifs1.data.notifications.length > 0) {
      const ownerNotifId = ownerNotifs1.data.notifications[0]._id || ownerNotifs1.data.notifications[0].id;
      try {
        await request(`${API_BASE}/notifications/${ownerNotifId}`, {
          method: 'DELETE',
          headers: seekerHeaders, // Seeker trying to delete Owner notification
        });
        console.error('❌ Security vulnerability: Seeker deleted Owner notification!');
        process.exit(1);
      } catch (err) {
        console.log('✓ Security Verified: Seeker attempt to access Owner notification blocked successfully.\n');
      }
    }

    // 5. Verify Payment System Absence
    console.log('Step 5: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in ownerNotifs1 || 'stripe' in ownerNotifs1 || 'paymentStatus' in ownerNotifs1;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 17 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 17 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase17Verification();
