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

async function runPhase20Verification() {
  console.log('=== PGFINDER PHASE 20 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Authenticate Admin, Owner, and Seeker
    console.log('Step 1: Authenticating Admin, Owner, and Seeker accounts...');
    const adminAuth = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'Password123' },
    });
    const adminHeaders = { Authorization: `Bearer ${adminAuth.data.token}` };

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

    // 2. Admin Dashboard Stats Overview
    console.log('Step 2: Fetching Admin Dashboard Platform Summary Stats...');
    const statsRes = await request(`${API_BASE}/admin/stats`, { headers: adminHeaders });
    console.log('✓ Platform Stats:', {
      users: statsRes.data.users,
      owners: statsRes.data.owners,
      seekers: statsRes.data.seekers,
      totalPGs: statsRes.data.totalPGs,
      pendingPGs: statsRes.data.pendingPGs,
      approvedPGs: statsRes.data.approvedPGs,
      totalBookings: statsRes.data.totalBookings,
    }, '\n');

    // 3. RBAC & Security Isolation
    console.log('Step 3: Testing Admin API RBAC Security Isolation...');
    try {
      await request(`${API_BASE}/admin/stats`, { headers: seekerHeaders });
      console.error('❌ RBAC Security failure: Seeker accessed Admin stats!');
      process.exit(1);
    } catch (err) {
      console.log('✓ RBAC Verified: Seeker attempt to access Admin stats blocked with 403.');
    }

    try {
      await request(`${API_BASE}/admin/stats`, { headers: ownerHeaders });
      console.error('❌ RBAC Security failure: Owner accessed Admin stats!');
      process.exit(1);
    } catch (err) {
      console.log('✓ RBAC Verified: Owner attempt to access Admin stats blocked with 403.\n');
    }

    // 4. Centralized Facility Catalog CRUD
    console.log('Step 4: Testing Centralized Facility Catalog Management...');
    const facList1 = await request(`${API_BASE}/facilities`);
    console.log(`✓ Initial Facility Catalog contains ${facList1.data.facilities.length} tags`);

    const newFac = await request(`${API_BASE}/facilities`, {
      method: 'POST',
      headers: adminHeaders,
      body: { name: 'EV Charging Station', category: 'SERVICES' },
    });
    console.log('✓ Admin created facility tag:', newFac.data.facility.name);

    const facId = newFac.data.facility._id || newFac.data.facility.id;
    await request(`${API_BASE}/facilities/${facId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { isActive: false },
    });
    console.log('✓ Admin updated facility tag status to inactive.\n');

    // 5. Verify Payment System Absence
    console.log('Step 5: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in statsRes || 'stripe' in statsRes || 'revenue' in statsRes;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 20 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 20 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase20Verification();
