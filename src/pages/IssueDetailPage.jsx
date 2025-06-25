import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase/supabaseClient';
import axios from 'axios';

export default function IssueDetailPage() {
  const { id } = useParams();
  const [issue, setIssue] = useState(null);
  const [summary, setSummary] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [priority, setPriority] = useState('');

  useEffect(() => {
    const fetchIssue = async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Fetch error:', error.message);
      } else {
        setIssue(data);
        setPriority(data.priority || '');
        generateSummaryAndReply(data.description);
      }

      setLoading(false);
    };

    const generateSummaryAndReply = async (description) => {
      try {
        const sumRes = await axios.post(
          'https://api.cohere.ai/v1/summarize',
          {
            text: description,
            length: 'medium',
            format: 'paragraph',
            model: 'summarize-xlarge',
          },
          {
            headers: {
              Authorization: `Bearer xyV9r163fmM8ieMhIFAUbmymr6DakgKJ8wj520lv`,
              'Content-Type': 'application/json',
            },
          }
        );

        const summaryText = sumRes.data.summary || '';
        setSummary(summaryText);

        const replyPrompt = `You are a municipal officer. Write a polite and informative response to the citizen about the following issue:\n\n"${summaryText}"\n\nReply:`;
        const replyRes = await axios.post(
          'https://api.cohere.ai/v1/generate',
          {
            model: 'command',
            prompt: replyPrompt,
            max_tokens: 100,
            temperature: 0.5,
          },
          {
            headers: {
              Authorization: `Bearer xyV9r163fmM8ieMhIFAUbmymr6DakgKJ8wj520lv`,
              'Content-Type': 'application/json',
            },
          }
        );

        setReply(replyRes.data.generations[0].text.trim());
      } catch (err) {
        console.error('AI error:', err.message);
      }
    };

    fetchIssue();
  }, [id]);

  const handlePriorityChange = async (e) => {
    const newPriority = e.target.value;
    setPriority(newPriority);

    const { error } = await supabase
      .from('issues')
      .update({ priority: newPriority })
      .eq('id', id);

    if (error) {
      console.error('Priority update error:', error.message);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!issue) return <p>Issue not found.</p>;

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px', background: '#f9f9f9' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>{issue.title}</h2>

      <p><strong>Name:</strong> {issue.name}</p>
      <p><strong>Address:</strong> {issue.address}</p>
      <p><strong>Phone:</strong> {issue.phone}</p>
      <p><strong>Category:</strong> {issue.category}</p>
      <p><strong>Description:</strong> {issue.description}</p>

      <div style={{ marginTop: '10px' }}>
        <strong>Summary (AI):</strong>
        <p style={{ backgroundColor: '#eef', padding: '10px' }}>{summary}</p>
      </div>

      <div style={{ marginTop: '10px' }}>
        <strong>Suggested Reply (AI):</strong>
        <p style={{ backgroundColor: '#e8f5e9', padding: '10px', fontStyle: 'italic' }}>{reply}</p>
      </div>

      <div style={{ marginTop: '10px' }}>
        <strong>Assign Priority:</strong>
        <select
          value={priority}
          onChange={handlePriorityChange}
          style={{ marginLeft: '10px', padding: '6px' }}
        >
          <option value="">Select</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {issue.images && issue.images.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <strong>Images:</strong>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {issue.images.map((url, i) => (
              <img key={i} src={url} alt={`Issue ${i}`} style={{ width: '120px', borderRadius: '4px' }} />
            ))}
          </div>
        </div>
      )}

      {issue.location_url && (
        <div style={{ marginTop: '20px' }}>
          <a href={issue.location_url} target="_blank" rel="noopener noreferrer">
            📍 View Location on Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
