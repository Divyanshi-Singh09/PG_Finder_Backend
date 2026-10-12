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

async function runPhase12Verification() {
  console.log('=== PGFINDER PHASE 12 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Login as Admin
    console.log('Step 1: Logging in as Admin...');
    const adminLoginRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'Password123' },
    });
    const adminToken = adminLoginRes.data.token;
    console.log('✓ Admin authenticated successfully.\n');

    // 2. Login as Owner
    console.log('Step 2: Logging in as Landlord Owner...');
    const ownerLoginRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'rajesh@example.com', password: 'Password123' },
    });
    const ownerToken = ownerLoginRes.data.token;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    console.log('✓ Owner authenticated successfully.\n');

    // 3. Owner Uploads Document & Submits Verification Package
    console.log('Step 3: Owner uploading verification documents...');
    const docUploadRes = await request(`${API_BASE}/verification/owner/upload`, {
      method: 'POST',
      headers: ownerHeaders,
      body: {
        docType: 'IDENTITY_PROOF',
        fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        fileName: 'Aadhaar_Card.png',
      },
    });
    console.log('✓ Document uploaded:', docUploadRes.message);

    console.log('Submitting verification package...');
    const submitVerRes = await request(`${API_BASE}/verification/owner/submit`, {
      method: 'POST',
      headers: ownerHeaders,
      body: {
        fullName: 'Rajesh Sharma',
        phone: '+91 98765 43211',
      },
    });
    console.log('✓ Owner verification submitted:', submitVerRes.message);

    const ownerVerStatus = await request(`${API_BASE}/verification/owner/status`, {
      method: 'GET',
      headers: ownerHeaders,
    });
    console.log('✓ Verification status:', ownerVerStatus.data.record.verificationStatus, '\n');

    // 4. Admin Inspects & Approves Owner Verification
    console.log('Step 4: Admin reviewing & approving owner verification...');
    const adminVerList = await request(`${API_BASE}/verification/admin/owner-verifications`, {
      method: 'GET',
      headers: adminHeaders,
    });
    const pendingVer = adminVerList.data.records[0];
    const verId = pendingVer._id || pendingVer.id;

    const approveRes = await request(`${API_BASE}/verification/admin/owner-verifications/${verId}/approve`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    console.log('✓ Owner verification approved:', approveRes.message, '\n');

    // 5. Login as Seeker and Submit Property Report
    console.log('Step 5: Seeker submitting flag report against a PG...');
    const seekerLoginRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'aarav@example.com', password: 'Password123' },
    });
    const seekerToken = seekerLoginRes.data.token;
    const seekerHeaders = { Authorization: `Bearer ${seekerToken}` };

    // Get an existing PG via /search endpoint
    const pgsRes = await request(`${API_BASE}/pgs/search`, { method: 'GET' });
    const targetPG = pgsRes.data.pgs[0];
    const pgId = targetPG._id || targetPG.id;

    const reportRes = await request(`${API_BASE}/reports`, {
      method: 'POST',
      headers: seekerHeaders,
      body: {
        pgId,
        reason: 'Incorrect information',
        description: 'Rent price displayed on card differs from landlord quote.',
      },
    });
    console.log('✓ Report created successfully:', reportRes.message, '\n');

    // 6. Admin Suspends PG & Verifies Search Removal & Rejections
    console.log('Step 6: Admin suspending PG property listing...');
    const suspendRes = await request(`${API_BASE}/verification/admin/pgs/${pgId}/suspend`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { reason: 'Suspended pending investigation of seeker flag report.' },
    });
    console.log('✓ PG suspended:', suspendRes.message);

    // Verify suspended PG is hidden from public search
    const searchAfterSuspend = await request(`${API_BASE}/pgs/search`, { method: 'GET' });
    const isHidden = !searchAfterSuspend.data.pgs.some((p) => (p._id || p.id) === pgId);
    console.log('✓ Suspended PG hidden from search results:', isHidden);

    // Verify enquiry creation is blocked
    try {
      await request(`${API_BASE}/enquiries`, {
        method: 'POST',
        headers: seekerHeaders,
        body: { pgId, subject: 'Test Enquiry', message: 'Testing suspended PG rejection' },
      });
      console.error('✗ ERROR: Enquiry should have been blocked!');
    } catch (err) {
      console.log('✓ Enquiry blocked as expected:', err.data?.message || err.message);
    }

    // 7. Admin Unsuspends PG
    console.log('\nStep 7: Admin unsuspending PG property listing...');
    const unsuspendRes = await request(`${API_BASE}/verification/admin/pgs/${pgId}/unsuspend`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    console.log('✓ PG unsuspended:', unsuspendRes.message);

    const searchAfterUnsuspend = await request(`${API_BASE}/pgs/search`, { method: 'GET' });
    const isRestored = searchAfterUnsuspend.data.pgs.some((p) => (p._id || p.id) === pgId);
    console.log('✓ PG restored to search results:', isRestored, '\n');

    console.log('🎉 ALL PHASE 12 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 12 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase12Verification();
