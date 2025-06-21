import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/supabaseClient';

export default function ProtectedRoute({ children, role }) {
  const [status, setStatus] = useState('loading'); // 'loading', 'allowed', 'denied'
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user || userError) {
        setStatus('denied');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || profile.role !== role) {
        setStatus('denied');
      } else {
        setStatus('allowed');
      }
    };

    checkUserRole();
  }, [role]);

  if (status === 'loading') return <p>Checking access...</p>;
  if (status === 'denied') {
    navigate('/');
    return null;
  }

  return children;
}
