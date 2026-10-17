const test = require('node:test');
const assert = require('node:assert/strict');

const { getUserTableName, canUseSupabase, getSupabaseConfig } = require('./supabase-client.js');

test('table User is mapped to the Supabase table name', () => {
  assert.equal(getUserTableName(), '"User"');
});

test('Supabase is disabled when config is not set', () => {
  const config = getSupabaseConfig({});
  assert.equal(canUseSupabase(config), false);
});

test('Supabase is enabled when URL and anon key are configured', () => {
  const config = getSupabaseConfig({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'public-key'
  });
  assert.equal(canUseSupabase(config), true);
});
