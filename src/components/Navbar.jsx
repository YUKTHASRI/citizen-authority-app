// File: components/Navbar.jsx
import { Link } from 'react-router-dom';
import { supabase } from '../supabase/supabaseClient'; // CORRECT

export default function Navbar() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <nav className="p-4 bg-gray-200 flex justify-between">
      <Link to="/">Home</Link>
      <button onClick={handleLogout}>Logout</button>
    </nav>
  );
}