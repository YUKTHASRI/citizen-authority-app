import { useState } from 'react';
import { supabase } from '../supabase/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function LoginCitizenPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      return;
    }

    const user = loginData?.user;
    if (!user) {
      setError("Login succeeded but user info is missing.");
      return;
    }

    // 🔍 Step 1: Fetch profile
    let { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // 🧩 Step 2: Insert citizen role if missing
    if (!profileData || profileError?.code === 'PGRST116') {
      const { error: insertError } = await supabase.from('profiles').insert([
        { id: user.id, role: 'citizen' }
      ]);

      if (insertError) {
        setError("Failed to insert citizen profile.");
        return;
      }

      const { data: newProfile, error: newFetchError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (newFetchError || !newProfile) {
        setError("Unable to retrieve role after inserting.");
        return;
      }

      profileData = newProfile;
    }

    // 📝 Step 3: Log login
    await supabase.from('logins').insert([
      { user_id: user.id, role: profileData.role }
    ]);

    // 🚀 Step 4: Redirect
    if (profileData.role === 'citizen') {
      navigate('/issue-form');
    } else if (profileData.role === 'authority') {
      navigate('/dashboard');
    } else {
      setError("Unknown user role.");
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <h2>Login as Citizen</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button type="submit">Login</button>
    </form>
  );
}
