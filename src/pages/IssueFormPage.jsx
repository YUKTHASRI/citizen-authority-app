import { useState } from 'react';
import { supabase } from '../supabase/supabaseClient';
import axios from 'axios';

// 🔹 Cohere: Summarize the issue
async function summarizeIssue(description) {
  if (!description || !description.trim()) {
    throw new Error("Description is empty");
  }

  const res = await axios.post(
    'https://api.cohere.ai/v1/summarize',
    {
      text: description,
      length: 'medium',
      format: 'paragraph',
      model: 'summarize-xlarge'
    },
    {
      headers: {
        Authorization: `Bearer xyV9r163fmM8ieMhIFAUbmymr6DakgKJ8wj520lv`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!res.data.summary) {
    throw new Error("No summary returned from Cohere");
  }

  return res.data.summary;
}

// 🔹 Cohere: Generate embedding
async function embedText(text) {
  const res = await axios.post(
    'https://api.cohere.ai/v1/embed',
    {
      texts: [text],
      model: 'embed-english-v3.0',
      input_type: 'search_document'
    },
    {
      headers: {
        Authorization: `Bearer xyV9r163fmM8ieMhIFAUbmymr6DakgKJ8wj520lv`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!res.data.embeddings || !Array.isArray(res.data.embeddings) || res.data.embeddings.length === 0) {
    throw new Error("Cohere embedding failed: empty or invalid response.");
  }

  return res.data.embeddings[0];
}

// 🔹 Local cosine similarity
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}

// 🔹 Cohere: Generate tags
async function generateTags(text) {
  const prompt = `Extract relevant hashtags from this civic issue report:\n"${text}"\nHashtags:`;
  const res = await axios.post('https://api.cohere.ai/v1/generate', {
    model: 'command',
    prompt,
    max_tokens: 30,
    temperature: 0.5
  }, {
    headers: {
      Authorization: `Bearer xyV9r163fmM8ieMhIFAUbmymr6DakgKJ8wj520lv`,
      'Content-Type': 'application/json'
    }
  });

  const tagsRaw = res.data.generations[0].text.trim();
  return tagsRaw.match(/#[\w-]+/g) || [];
}

export default function IssueFormPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    title: '',
    description: '',
    location_url: '',
    category: '',
    priority: ''
  });

  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user || userError) {
      setError('User not authenticated.');
      return;
    }

    // ✅ Validate Google Maps URL
    if (formData.location_url) {
      const regex = /^https:\/\/www\.google\.com\/maps\?q=(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
      if (!regex.test(formData.location_url.trim())) {
        setError('Invalid Google Maps link. Use format: https://www.google.com/maps?q=12.9716,77.5946');
        return;
      }
    }

    // ✅ Upload images
    let imageUrls = [];
    if (images.length > 0) {
      try {
        const uploads = await Promise.all(
          images.map(async (file, index) => {
            const filePath = `${user.id}/${Date.now()}_${index}_${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from('issue-images')
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
              .from('issue-images')
              .getPublicUrl(filePath);

            return publicData.publicUrl;
          })
        );
        imageUrls = uploads;
      } catch (uploadError) {
        console.error('Upload Failed:', uploadError.message);
        setError(`Failed to upload images: ${uploadError.message}`);
        return;
      }
    }

    // ✅ Validate description length
    if (formData.description.length < 250) {
      setError('Description must be at least 250 characters for AI summarization.');
      return;
    }

    // ✅ AI Enhancements
    let summary = '', embedding = [], sentiment = '', tags = [];
    try {
      console.log("Description sent to summarizer:", formData.description);
      summary = await summarizeIssue(formData.description);
      embedding = await embedText(formData.description);
      sentiment = "unclassified"; // classification removed (deprecated)
      tags = await generateTags(formData.description);
    } catch (err) {
      console.error('AI error:', err.response?.data || err.message);
      setError('AI services failed. Please try again later.');
      return;
    }

    // ✅ Duplicate check
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('embedding');

      if (error) throw error;

      const existingEmbeddings = data.filter(row => row.embedding);
      const isDuplicate = existingEmbeddings.some(existing =>
        cosineSimilarity(embedding, existing.embedding) > 0.9
      );

      if (isDuplicate) {
        setError('This issue may already be reported. Please check existing reports.');
        return;
      }
    } catch (err) {
      console.error('Duplicate check failed:', err.message);
    }

    // ✅ Save to Supabase
    const { error: insertError } = await supabase.from('issues').insert({
      ...formData,
      citizen_id: user.id,
      images: imageUrls,
      summary,
      embedding,
      sentiment,
      tags
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess('Issue submitted successfully.');
      setFormData({
        name: '',
        phone: '',
        address: '',
        title: '',
        description: '',
        location_url: '',
        category: '',
        priority: ''
      });
      setImages([]);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Submit an Issue</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}

      <form onSubmit={handleSubmit}>
        {['name', 'phone', 'address', 'title'].map(field => (
          <label key={field} style={{ display: 'block', marginBottom: '10px' }}>
            {field.charAt(0).toUpperCase() + field.slice(1)}:
            <input
              type="text"
              name={field}
              value={formData[field]}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', marginTop: '4px', marginBottom: '15px' }}
            />
          </label>
        ))}

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Description:
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            style={{ width: '100%', height: '100px', padding: '8px', marginBottom: '15px' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Category:
          <select name="category" value={formData.category} onChange={handleChange} required style={{ width: '100%', padding: '8px' }}>
            <option value="">Select Category</option>
            <option value="pothole">Pothole</option>
            <option value="water">Water Issue</option>
            <option value="garbage">Garbage</option>
            <option value="light">Light Outage</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Priority:
          <select name="priority" value={formData.priority} onChange={handleChange} required style={{ width: '100%', padding: '8px' }}>
            <option value="">Select Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Google Maps Link:
          <input
            type="url"
            name="location_url"
            value={formData.location_url}
            onChange={handleChange}
            placeholder="https://www.google.com/maps?q=12.9716,77.5946"
            style={{ width: '100%', padding: '8px', marginBottom: '15px' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Upload Images (up to 3):
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages(Array.from(e.target.files).slice(0, 3))}
            style={{ display: 'block', marginTop: '5px' }}
          />
        </label>

        <button
          type="submit"
          style={{ padding: '10px 20px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Submit
        </button>
      </form>
    </div>
  );
}
