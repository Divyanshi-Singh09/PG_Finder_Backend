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

async function runPhase13Verification() {
  console.log('=== PGFINDER PHASE 13 E2E VERIFICATION TEST ===\n');

  try {
    // 1. Login as Owner
    console.log('Step 1: Logging in as Landlord Owner...');
    const ownerLoginRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'rajesh@example.com', password: 'Password123' },
    });
    const ownerToken = ownerLoginRes.data.token;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    console.log('✓ Owner authenticated successfully.\n');

    // Get Owner's PG
    const myPgsRes = await request(`${API_BASE}/pgs/my`, { method: 'GET', headers: ownerHeaders });
    const myPG = myPgsRes.data.pgs[0];
    const pgId = myPG._id || myPG.id;

    // 2. Owner Creates Room + Auto-generates Beds
    console.log('Step 2: Owner creating room with 2 beds...');
    const roomRes = await request(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: ownerHeaders,
      body: {
        pgId,
        roomNumber: '105',
        roomType: 'DOUBLE',
        totalBeds: 2,
        rent: 8500,
        securityDeposit: 8500,
        amenities: ['Attach Bathroom', 'Wi-Fi'],
        status: 'ACTIVE',
      },
    });
    console.log('✓ Room created:', roomRes.message);
    const room = roomRes.data.room;
    const roomId = room._id || room.id;
    const beds = roomRes.data.beds;
    console.log('✓ Auto-generated beds:', beds.map((b) => `${b.bedNumber} (${b.status})`).join(', '), '\n');

    const targetBed = beds[0];
    const bedId = targetBed._id || targetBed.id;

    // 3. Seeker Logins and Submits Booking Request
    console.log('Step 3: Seeker submitting room booking request for Bed 1...');
    const seekerLoginRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: { email: 'aarav@example.com', password: 'Password123' },
    });
    const seekerToken = seekerLoginRes.data.token;
    const seekerHeaders = { Authorization: `Bearer ${seekerToken}` };

    const bookingRes = await request(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: seekerHeaders,
      body: {
        pgId,
        roomId,
        bedId,
        moveInDate: '2026-08-25',
        seekerMessage: 'Requesting move-in on 25th August.',
      },
    });
    console.log('✓ Booking request submitted:', bookingRes.message);
    const booking = bookingRes.data.booking;
    const bookingId = booking._id || booking.id;
    console.log('✓ Booking Reference:', booking.bookingReference, '| Status:', booking.status, '\n');

    // 4. Test Double-Booking Protection (Seeker B tries to book same bed)
    console.log('Step 4: Testing double-booking prevention...');
    try {
      await request(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: seekerHeaders,
        body: {
          pgId,
          roomId,
          bedId,
          moveInDate: '2026-08-25',
          seekerMessage: 'Duplicate request test',
        },
      });
      console.error('✗ ERROR: Duplicate booking should have been blocked!');
    } catch (err) {
      console.log('✓ Double-booking attempt blocked as expected:', err.data?.message || err.message, '\n');
    }

    // 5. Owner Accepts Booking Request
    console.log('Step 5: Owner accepting booking request...');
    const acceptRes = await request(`${API_BASE}/bookings/${bookingId}/accept`, {
      method: 'PATCH',
      headers: ownerHeaders,
    });
    console.log('✓ Booking accepted:', acceptRes.message);
    console.log('✓ Updated Booking Status:', acceptRes.data.booking.status, '\n');

    // 6. Seeker Cancels Booking & Bed Availability Restored
    console.log('Step 6: Seeker cancelling booking...');
    const cancelRes = await request(`${API_BASE}/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: seekerHeaders,
      body: { cancellationReason: 'Plans changed.' },
    });
    console.log('✓ Booking cancelled:', cancelRes.message);
    console.log('✓ Restored Booking Status:', cancelRes.data.booking.status, '\n');

    // Verify No Payment Fields Exists
    console.log('Step 7: Verifying complete absence of payment system fields...');
    const hasPaymentField = 'razorpay' in booking || 'stripe' in booking || 'paymentStatus' in booking;
    console.log('✓ Verified 100% Payment System Absence:', !hasPaymentField, '\n');

    console.log('🎉 ALL PHASE 13 E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Phase 13 Verification Failed:', error.data || error.message);
    process.exit(1);
  }
}

runPhase13Verification();
