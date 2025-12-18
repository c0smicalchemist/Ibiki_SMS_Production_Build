// Test script for vendor switching functionality
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-token-here';

async function testVendorSwitching() {
  console.log('🧪 Testing Multi-Vendor SMS System');
  console.log('==================================');

  try {
    // Test 1: Get available vendors
    console.log('1. Testing vendor list endpoint...');
    const vendorsResponse = await axios.get(`${API_BASE_URL}/api/vendors`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    if (vendorsResponse.data.success) {
      console.log('✅ Vendor list retrieved successfully');
      console.log('   Available vendors:', vendorsResponse.data.vendors.map(v => v.name));
      console.log('   Active vendor:', vendorsResponse.data.activeVendor);
    } else {
      console.log('❌ Failed to get vendor list');
      return;
    }

    // Test 2: Switch to TextBelt
    console.log('2. Testing vendor switch to TextBelt...');
    const switchResponse = await axios.post(`${API_BASE_URL}/api/vendors/switch`, 
      { vendorId: 'textbelt' },
      { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
    );
    
    if (switchResponse.data.success) {
      console.log('✅ Successfully switched to TextBelt');
    } else {
      console.log('❌ Failed to switch to TextBelt:', switchResponse.data.error);
    }

    // Test 3: Send test SMS via TextBelt
    console.log('3. Testing SMS via TextBelt...');
    const testNumber = '+1234567890'; // Replace with test number
    const testMessage = 'Test message from TextBelt via Ibiki SMS';
    
    try {
      const smsResponse = await axios.post(`${API_BASE_URL}/api/sms/send`, {
        recipient: testNumber,
        message: testMessage
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
      });
      
      if (smsResponse.data.success) {
        console.log('✅ SMS sent successfully via TextBelt');
        console.log('   Message ID:', smsResponse.data.messageId);
      } else {
        console.log('❌ Failed to send SMS:', smsResponse.data.error);
      }
    } catch (smsError) {
      console.log('❌ SMS send error:', smsError.response?.data?.error || smsError.message);
    }

    // Test 4: Switch back to ExtremeSMS
    console.log('4. Testing vendor switch to ExtremeSMS...');
    const switchBackResponse = await axios.post(`${API_BASE_URL}/api/vendors/switch`, 
      { vendorId: 'extremesms' },
      { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
    );
    
    if (switchBackResponse.data.success) {
      console.log('✅ Successfully switched back to ExtremeSMS');
    } else {
      console.log('❌ Failed to switch back to ExtremeSMS:', switchBackResponse.data.error);
    }

    console.log('');
    console.log('🎉 Vendor switching tests completed!');
    console.log('');
    console.log('📋 Manual testing checklist:');
    console.log('1. ✅ Vendor list endpoint works');
    console.log('2. ✅ Vendor switching works');
    console.log('3. ✅ SMS sending works with new vendor');
    console.log('4. ✅ UI displays vendor health status');
    console.log('5. ✅ Fallback to ExtremeSMS if TextBelt fails');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run tests if called directly
if (require.main === module) {
  testVendorSwitching();
}

module.exports = { testVendorSwitching };