// backend/src/services/tokenService.js
const crypto = require('crypto');
const supabase = require('../utils/supabaseClient');

const generateToken = async (username) => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabase
    .from('remember_me_token')
    .insert({
      username: username,
      token_hash: hash,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error('Error saving remember_me token:', error);
    return null;
  }

  return token;
};

const validateToken = async (token) => {
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: tokenData, error: tokenError } = await supabase
    .from('remember_me_token')
    .select('*, users(*)')
    .eq('token_hash', hash)
    .single();

  if (tokenError || !tokenData) {
    return null;
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    await supabase.from('remember_me_token').delete().eq('id', tokenData.id);
    return null;
  }

  return tokenData.users;
};

const deleteToken = async (token) => {
  if (!token) return;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await supabase.from('remember_me_token').delete().eq('token_hash', hash);
};

module.exports = {
  generateToken,
  validateToken,
  deleteToken,
};