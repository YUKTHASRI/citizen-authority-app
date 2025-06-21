// File: pages/shared/AuthForm.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/supabaseClient';

//import { supabase } from '../supabase/supabaseclient';


export default function AuthForm({ role, type }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    let result;
    if (type === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role },
        },
      });
      if (error) return setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setError(error.message);
    }

    if (role === 'citizen') navigate('/issue-form');
    else navigate('/dashboard');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10">
      <h2 className="text-xl mb-4">{type === 'signup' ? 'Sign Up' : 'Login'} as {role}</h2>
      {error && <p className="text-red-600">{error}</p>}
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="input" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password" className="input" />
      <button type="submit" className="btn mt-2">{type === 'signup' ? 'Sign Up' : 'Login'}</button>
    </form>
  );
}
