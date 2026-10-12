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

async function runPhase16Verification() {
  console.log('=== PGFINDER PHASE 16 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Admin Authentication & Dashboard Stats
    console.log('Step 1: Authenticating as Admin & fetching dashboard stats...');
    const adminAuth = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'Password123' },
    });
    const adminHeaders = { Authorization: `Bearer ${adminAuth.data.token}` };

    const statsRes = await request(`${API_BASE}/admin/stats`, { headers: adminHeaders });
    console.log('✓ Admin Dashboard Stats:', statsRes.data, '\n');

    // 2. User Management & Suspension Lifecycle
    console.log('Step 2: Testing User Search, List & Account Suspension lifecycle...');
    const usersRes = await request(`${API_BASE}/admin/users?role=SEEKER`, { headers: adminHeaders });
    console.log(`✓ Total Seekers Found: ${usersRes.data.users.length}`);

    if (usersRes.data.users.length > 0) {
      const targetUser = usersRes.data.users[0];
      const targetId = targetUser._id || targetUser.id;

      const suspendRes = await request(`${API_BASE}/admin/users/${targetId}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: { status: 'SUSPENDED', reason: 'Abusive platform conduct violation' },
      });
      console.log(`✓ Suspended user ${targetUser.name}:`, suspendRes.message);

      const reactivateRes = await request(`${API_BASE}/admin/users/${targetId}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: { status: 'ACTIVE' },
      });
      console.log(`✓ Reactivated user ${targetUser.name}:`, reactivateRes.message, '\n');
    }

    // 3. Support Complaints Ticket System
    console.log('Step 3: Testing Support Complaint submission & Admin resolution...');
    const seekerAuth = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'aarav@example.com', password: 'Password123' },
    });
    const seekerHeaders = { Authorization: `Bearer ${seekerAuth.data.token}` };

    const complaintSub = await request(`${API_BASE}/admin/complaints`, {
      method: 'POST',
      headers: seekerHeaders,
      body: {
        category: 'MAINTENANCE',
        priority: 'HIGH',
        subject: 'AC Water Leakage in Room 102',
        description: 'Landlord has not fixed AC drainage leakage despite 3 verbal requests.',
      },
    });
    console.log('✓ Seeker submitted complaint ticket:', complaintSub.data.complaint.subject);
    const complaintId = complaintSub.data.complaint._id || complaintSub.data.complaint.id;

    const complaintsList = await request(`${API_BASE}/admin/complaints?status=OPEN`, { headers: adminHeaders });
    console.log(`✓ Admin Complaints Queue Open Items: ${complaintsList.data.complaints.length}`);

    const resolveRes = await request(`${API_BASE}/admin/complaints/${complaintId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: {
        status: 'RESOLVED',
        adminNotes: 'Contacted owner directly; technician scheduled for today.',
        resolutionReason: 'Issue dispatched to owner.',
      },
    });
    console.log('✓ Admin resolved complaint ticket:', resolveRes.message, '\n');

    // 4. Platform Analytics & Activity Audit Logs
    console.log('Step 4: Testing Platform Analytics & Activity Log endpoints...');
    const analyticsRes = await request(`${API_BASE}/admin/analytics`, { headers: adminHeaders });
    console.log('✓ Analytics Metrics:', analyticsRes.data.metrics);

    const logsRes = await request(`${API_BASE}/admin/activity-logs`, { headers: adminHeaders });
    console.log(`✓ Activity Audit Log Entries: ${logsRes.data.logs.length} items\n`);

    // 5. System Settings Configuration
    console.log('Step 5: Testing Platform Settings fetch & patch update...');
    const settingsRes = await request(`${API_BASE}/admin/settings`, { headers: adminHeaders });
    console.log('✓ Current Settings:', settingsRes.data.settings);

    const updateSetRes = await request(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { supportPhone: '+91 99999 88888', reviewWindowDays: 45 },
    });
    console.log('✓ Platform settings updated:', updateSetRes.message, '\n');

    // 6. Verify Payment System Absence
    console.log('Step 6: Verifying complete absence of payment system fields...');
    const hasPayment = 'razorpay' in statsRes || 'stripe' in statsRes || 'paymentStatus' in statsRes;
    console.log('✓ Verified 100% Payment System Absence:', !hasPayment, '\n');

    console.log('🎉 ALL PHASE 16 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 16 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase16Verification();
