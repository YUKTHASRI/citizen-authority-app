import { useEffect, useState } from 'react';
import { supabase } from '../supabase/supabaseClient';
import { Link } from 'react-router-dom';

export default function AuthorityDashboardPage() {
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchIssues = async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setError('Failed to load issues.');
      } else {
        setIssues(data);
      }
    };

    fetchIssues();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">All Reported Issues</h2>

      {error && <p className="text-red-600">{error}</p>}
      {issues.length === 0 ? (
        <p>No issues found.</p>
      ) : (
        <table className="w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-4 py-2">Name</th>
              <th className="border px-4 py-2">Address</th>
              <th className="border px-4 py-2">Category</th>
              <th className="border px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id} className="hover:bg-gray-50">
                <td className="border px-4 py-2">{issue.name}</td>
                <td className="border px-4 py-2">{issue.address}</td>
                <td className="border px-4 py-2">{issue.category}</td>
                <td className="border px-4 py-2">
                  <Link
                    to={`/issue/${issue.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
