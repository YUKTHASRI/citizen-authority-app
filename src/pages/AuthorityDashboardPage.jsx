import { useEffect, useState } from 'react';
import { supabase } from '../supabase/supabaseClient';
import axios from 'axios';

function extractCoordinatesFromURL(url) {
  try {
    const query = new URL(url).searchParams.get('q');
    const [lat, lng] = query?.split(',') || [];
    return { lat, lng };
  } catch (e) {
    return {};
  }
}

// ✅ Updated function to use issue summary as prompt input
async function generateAuthorityReply(summaryText) {
  if (!summaryText || summaryText.length < 10) {
    throw new Error("Summary is missing or too short for generating a reply.");
  }

  const prompt = `You are a municipal officer. Write a polite and informative response to the citizen about the following issue:\n\n"${summaryText}"\n\nReply:`;

  const res = await axios.post('https://api.cohere.ai/v1/generate', {
    model: 'command',
    prompt,
    max_tokens: 100,
    temperature: 0.5
  }, {
    headers: {
      Authorization: `Bearer xyV9r163fmM8ieMhIFAUbmymr6DakgKJ8wj520lv`,
      'Content-Type': 'application/json'
    }
  });

  const text = res.data.generations?.[0]?.text?.trim();
  return text || "No response generated.";
}

export default function AuthorityDashboardPage() {
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState('');
  const [replies, setReplies] = useState({});

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

  // ✅ Now uses summary as input for AI
  const handleGenerateReply = async (id, summary) => {
    try {
      const reply = await generateAuthorityReply(summary);
      setReplies(prev => ({ ...prev, [id]: reply }));
    } catch (err) {
      console.error("Reply generation error:", err.response?.data || err.message);
      setReplies(prev => ({ ...prev, [id]: 'Failed to generate reply.' }));
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>All Submitted Issues</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {issues.length === 0 && <p>No issues found.</p>}

      {issues.map((issue) => {
        const { lat, lng } = extractCoordinatesFromURL(issue.location_url || '') || {};
        const tags = issue.tags || [];

        return (
          <div
            key={issue.id}
            style={{
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '15px',
              background: '#f7f7f7'
            }}
          >
            <h3>{issue.title}</h3>
            <p><strong>Description:</strong> {issue.description}</p>
            {issue.summary && <p><strong>Summary:</strong> {issue.summary}</p>}
            {issue.sentiment && <p><strong>Sentiment:</strong> {issue.sentiment}</p>}
            {tags.length > 0 && <p><strong>Tags:</strong> {tags.join(', ')}</p>}
            <p><strong>Category:</strong> {issue.category}</p>
            <p><strong>Priority:</strong> {issue.priority}</p>
            <p><strong>Name:</strong> {issue.name}</p>
            <p><strong>Phone:</strong> {issue.phone}</p>
            <p><strong>Address:</strong> {issue.address}</p>
            <p><small><strong>Submitted by:</strong> {issue.citizen_id}</small></p>

            {lat && lng && (
              <>
                <p>
                  <a
                    href={issue.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#007bff' }}
                  >
                    📍 View on Google Maps
                  </a>
                </p>
                <iframe
                  width="100%"
                  height="250"
                  frameBorder="0"
                  style={{ border: 0 }}
                  src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
                  allowFullScreen
                  title="Issue Location Map"
                ></iframe>
              </>
            )}

            {issue.images && issue.images.length > 0 && (
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {issue.images.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Issue Image ${index + 1}`}
                    style={{
                      width: '100px',
                      height: 'auto',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid #999'
                    }}
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            )}

            <div style={{ marginTop: '10px' }}>
              <button
                onClick={() => handleGenerateReply(issue.id, issue.summary || issue.description)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✉️ Generate Reply
              </button>

              {replies[issue.id] && (
                <p style={{ marginTop: '10px', fontStyle: 'italic', backgroundColor: '#e8f5e9', padding: '10px' }}>
                  <strong>Suggested Reply:</strong><br />
                  {replies[issue.id]}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
