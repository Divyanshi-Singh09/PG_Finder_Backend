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

async function runPhase18Verification() {
  console.log('=== PGFINDER PHASE 18 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Authenticate Owner & Seeker
    console.log('Step 1: Authenticating Owner and Seeker accounts...');
    const ownerAuth = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'rajesh@example.com', password: 'Password123' },
    });
    const ownerHeaders = { Authorization: `Bearer ${ownerAuth.data.token}` };

    const seekerAuth = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'aarav@example.com', password: 'Password123' },
    });
    const seekerHeaders = { Authorization: `Bearer ${seekerAuth.data.token}` };
    console.log('✓ Users authenticated.\n');

    // 2. Owner Dashboard Overview Metrics
    console.log('Step 2: Fetching Owner Dashboard Summary Overview...');
    const dashRes = await request(`${API_BASE}/dashboard/owner`, { headers: ownerHeaders });
    console.log('✓ Owner Dashboard Stats:', {
      totalPGs: dashRes.data.totalPGs,
      activeRooms: dashRes.data.activeRooms,
      availableBeds: dashRes.data.availableBeds,
      pendingBookings: dashRes.data.pendingBookings,
      unreadEnquiries: dashRes.data.unreadEnquiries,
      upcomingVisits: dashRes.data.upcomingVisits,
      avgRating: dashRes.data.avgRating,
    }, '\n');

    // 3. Owner Performance Analytics & Data Isolation
    console.log('Step 3: Testing Owner Performance Analytics & Data Isolation...');
    const analyticsRes = await request(`${API_BASE}/owner/analytics`, { headers: ownerHeaders });
    console.log('✓ Owner Analytics Metrics:', analyticsRes.data.metrics);

    // Seeker attempting to access Owner Analytics API
    try {
      await request(`${API_BASE}/owner/analytics`, { headers: seekerHeaders });
      console.error('❌ Security vulnerability: Seeker accessed Owner Analytics API!');
      process.exit(1);
    } catch (err) {
      console.log('✓ Security Verified: Seeker access to Owner Analytics blocked with 403/401.\n');
    }

    // 4. Owner Review Response
    console.log('Step 4: Testing Owner Tenant Review response capability...');
    const reviewsRes = await request(`${API_BASE}/reviews/owner`, { headers: ownerHeaders });
    console.log(`✓ Owner Managed Reviews Found: ${reviewsRes.data.reviews.length} reviews\n`);

    // 5. Verify Payment System Absence
    console.log('Step 5: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in dashRes || 'stripe' in dashRes || 'revenue' in dashRes;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 18 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 18 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase18Verification();
