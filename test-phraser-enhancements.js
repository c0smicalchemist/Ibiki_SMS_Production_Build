#!/usr/bin/env node

// Test script for enhanced Ibiki Phraser
// Tests: Levenshtein similarity, dynamic temperatures, strategy-based prompts

const SERVER_URL = 'http://151.243.109.66:5000';

async function testPhraserEnhancements() {
  console.log('🧪 Testing Enhanced Ibiki Phraser\n');
  console.log('=' .repeat(60));
  
  // Test 1: Levenshtein Similarity Detection
  console.log('\n📊 Test 1: Similarity Detection');
  console.log('-'.repeat(60));
  
  const testMessage = "Hi {{name}}, your order is ready! Visit {{url}} to track it.";
  
  try {
    const response = await fetch(`${SERVER_URL}/api/tools/paraphrase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with real token
      },
      body: JSON.stringify({
        text: testMessage,
        n: 10, // Request 10 variants
        creativity: 0.7
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Generated ${data.variants.length} diverse variants`);
      console.log(`📡 Provider used: ${data.providerUsed}`);
      
      // Calculate actual similarity between variants
      const similarities = [];
      for (let i = 0; i < data.variants.length; i++) {
        for (let j = i + 1; j < data.variants.length; j++) {
          const sim = calculateSimilarity(
            data.variants[i].text.toLowerCase(),
            data.variants[j].text.toLowerCase()
          );
          similarities.push(sim);
        }
      }
      
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      const maxSimilarity = Math.max(...similarities);
      
      console.log(`📈 Average similarity: ${(avgSimilarity * 100).toFixed(2)}%`);
      console.log(`📈 Max similarity: ${(maxSimilarity * 100).toFixed(2)}%`);
      console.log(`✅ Expected: Max <75% (threshold check passed: ${maxSimilarity < 0.75})`);
      
      // Show sample variants
      console.log('\n📝 Sample Variants:');
      data.variants.slice(0, 5).forEach((v, i) => {
        console.log(`\n${i + 1}. [Score: ${v.score}${v.strategy ? ', Strategy: ' + v.strategy : ''}]`);
        console.log(`   "${v.text}"`);
      });
      
    } else {
      console.error('❌ Failed:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Make sure to replace YOUR_TOKEN_HERE with a real admin token');
    console.log('⚠️  You can get a token by logging into the admin dashboard');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Levenshtein distance (same as server implementation)
function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[b.length][a.length];
}

function calculateSimilarity(a, b) {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

// Run test
testPhraserEnhancements();
