(function (global) {
  function getSupabaseConfig(source = globalThis) {
    const config = source && typeof source === 'object' ? source : {};
    const url = String(config.SUPABASE_URL || config.url || '').trim();
    const anonKey = String(config.SUPABASE_ANON_KEY || config.anonKey || '').trim();

    return {
      url,
      anonKey,
    };
  }

  function getUserTableName() {
    return '"User"';
  }

  function canUseSupabase(config = getSupabaseConfig(globalThis)) {
    const url = String(config.url || '').trim();
    const anonKey = String(config.anonKey || '').trim();

    return Boolean(
      url &&
        anonKey &&
        !url.includes('YOUR_') &&
        !anonKey.includes('YOUR_') &&
        !url.includes('your-project') &&
        !anonKey.includes('your-anon')
    );
  }

  async function getSupabaseClient(config = getSupabaseConfig(globalThis)) {
    if (!canUseSupabase(config) || !global.supabase || typeof global.supabase.createClient !== 'function') {
      return null;
    }

    if (!global.__siteSupabaseClient) {
      global.__siteSupabaseClient = global.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }

    return global.__siteSupabaseClient;
  }

  async function listUsers() {
    const client = await getSupabaseClient();
    if (!client) {
      const response = await fetch('/users');
      if (!response.ok) throw new Error('Impossible de charger les utilisateurs.');
      return response.json();
    }

    const { data, error } = await client.from(getUserTableName()).select('*').order('email', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function findUserByEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const client = await getSupabaseClient();
    if (!client) {
      const response = await fetch(`/users?email=${encodeURIComponent(normalizedEmail)}`);
      if (!response.ok) throw new Error('Impossible de vérifier le compte.');
      const users = await response.json();
      return users.find((entry) => String(entry.email || '').trim().toLowerCase() === normalizedEmail) || null;
    }

    const { data, error } = await client
      .from(getUserTableName())
      .select('*')
      .ilike('email', normalizedEmail)
      .limit(1);

    if (error) throw error;
    return data && data.length ? data[0] : null;
  }

  async function createUserRecord(user) {
    const client = await getSupabaseClient();
    if (!client) {
      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (!response.ok) throw new Error('La création du compte est impossible.');
      return response.json();
    }

    const { data, error } = await client
      .from(getUserTableName())
      .insert([user])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function updateUserRecord(id, changes) {
    const client = await getSupabaseClient();
    if (!client) {
      const response = await fetch(`/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error('La mise à jour du compte est impossible.');
      return response.json();
    }

    const { data, error } = await client
      .from(getUserTableName())
      .update(changes)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function deleteUserRecord(id) {
    const client = await getSupabaseClient();
    if (!client) {
      const response = await fetch(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('La suppression du compte est impossible.');
      return response;
    }

    const { error } = await client.from(getUserTableName()).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  const api = {
    getSupabaseConfig,
    getUserTableName,
    canUseSupabase,
    getSupabaseClient,
    listUsers,
    findUserByEmail,
    createUserRecord,
    updateUserRecord,
    deleteUserRecord,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.SupabaseClient = api;
})(typeof window !== 'undefined' ? window : globalThis);
