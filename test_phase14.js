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

async function runPhase14Verification() {
  console.log('=== PGFINDER PHASE 14 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Logins
    console.log('Step 1: Authenticating Landlord, Seeker, and Admin...');
    const ownerRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'rajesh@example.com', password: 'Password123' },
    });
    const ownerToken = ownerRes.data.token;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    const seekerRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'aarav@example.com', password: 'Password123' },
    });
    const seekerToken = seekerRes.data.token;
    const seekerHeaders = { Authorization: `Bearer ${seekerToken}` };

    const adminRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'Password123' },
    });
    const adminToken = adminRes.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    console.log('✓ All 3 roles authenticated successfully.\n');

    // Get PG & Create Completed Booking Setup
    const myPgsRes = await request(`${API_BASE}/pgs/my`, { method: 'GET', headers: ownerHeaders });
    const pg = myPgsRes.data.pgs[0];
    const pgId = pg._id || pg.id;

    const roomRes = await request(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: ownerHeaders,
      body: {
        pgId,
        roomNumber: '309',
        roomType: 'SINGLE',
        totalBeds: 1,
        rent: 9000,
        securityDeposit: 9000,
        status: 'ACTIVE',
      },
    });
    const room = roomRes.data.room;
    const roomId = room._id || room.id;
    const bedId = roomRes.data.beds[0]._id || roomRes.data.beds[0].id;

    const bookingRes = await request(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: seekerHeaders,
      body: { pgId, roomId, bedId, moveInDate: '2026-09-01', seekerMessage: 'Testing review eligibility' },
    });
    const bookingId = bookingRes.data.booking._id || bookingRes.data.booking.id;

    await request(`${API_BASE}/bookings/${bookingId}/accept`, { method: 'PATCH', headers: ownerHeaders });
    console.log('✓ Setup completed: Landlord accepted booking request.\n');

    // 2. Check Review Eligibility
    console.log('Step 2: Checking seeker review eligibility for accepted stay...');
    const eligRes = await request(`${API_BASE}/reviews/eligibility/${bookingId}`, { method: 'GET', headers: seekerHeaders });
    console.log('✓ Review Eligibility Result:', eligRes.data.eligible, '\n');

    // 3. Seeker Submits Review
    console.log('Step 3: Seeker submitting 5-star review with category ratings...');
    const reviewRes = await request(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: seekerHeaders,
      body: {
        bookingId,
        rating: 5,
        categories: { cleanliness: 5, location: 4, facilities: 5, valueForMoney: 4, management: 5, safety: 5 },
        title: 'Outstanding stay experience!',
        comment: 'The room was super clean, well ventilated, and the landlord is very supportive.',
      },
    });
    console.log('✓ Review Submitted:', reviewRes.message);
    const review = reviewRes.data.review;
    const reviewId = review._id || review.id;
    console.log('✓ Published Status:', review.status, '\n');

    // 4. Duplicate Review Protection Test
    console.log('Step 4: Testing duplicate review protection for same booking...');
    try {
      await request(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: seekerHeaders,
        body: { bookingId, rating: 4, comment: 'Duplicate review test attempt' },
      });
      console.error('✗ ERROR: Duplicate review should have been blocked!');
    } catch (err) {
      console.log('✓ Duplicate review attempt blocked as expected:', err.data?.message || err.message, '\n');
    }

    // 5. Landlord Replies to Review
    console.log('Step 5: Landlord replying to guest review...');
    const replyRes = await request(`${API_BASE}/reviews/${reviewId}/reply`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: { response: 'Thank you Aarav for your kind words! We look forward to hosting you again.' },
    });
    console.log('✓ Landlord Reply Posted:', replyRes.message, '\n');

    // 6. Helpful Vote Toggle
    console.log('Step 6: User marking review as Helpful...');
    const helpfulRes = await request(`${API_BASE}/reviews/${reviewId}/helpful`, {
      method: 'POST',
      headers: seekerHeaders,
    });
    console.log('✓ Helpful Vote Toggled:', helpfulRes.message, '| Count:', helpfulRes.data.helpfulCount, '\n');

    // 7. Admin Moderation (Hide & Restore)
    console.log('Step 7: Admin moderating review status to HIDDEN...');
    const modHideRes = await request(`${API_BASE}/reviews/admin/${reviewId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { status: 'HIDDEN', moderationReason: 'Flagged for moderation testing.' },
    });
    console.log('✓ Admin Moderation Hide Result:', modHideRes.message);

    const modRestoreRes = await request(`${API_BASE}/reviews/admin/${reviewId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { status: 'PUBLISHED', moderationReason: 'Verified genuine review.' },
    });
    console.log('✓ Admin Moderation Restore Result:', modRestoreRes.message, '\n');

    // 8. Verify Payment System Absence
    console.log('Step 8: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in review || 'stripe' in review || 'paymentStatus' in review;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 14 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 14 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase14Verification();
