import { useState } from 'react';
import { supabase } from '../supabase/supabaseClient';
import axios from 'axios';
import emailjs from 'emailjs-com'; // 👈 Already imported

// ... [AI functions: summarizeIssue, embedText, cosineSimilarity, generateTags] ...

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

  const [customCategory, setCustomCategory] = useState('');
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

    if (formData.location_url) {
      const regex = /^https:\/\/www\.google\.com\/maps\?q=(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
      if (!regex.test(formData.location_url.trim())) {
        setError('Invalid Google Maps link.');
        return;
      }
    }

    if (formData.category === 'other' && !customCategory.trim()) {
      setError('Please specify the issue category.');
      return;
    }

    const finalCategory = formData.category === 'other' ? customCategory.trim() : formData.category;

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

    if (formData.description.length < 250) {
      setError('Description must be at least 250 characters for AI summarization.');
      return;
    }

    let summary = '', embedding = [], sentiment = '', tags = [];
    try {
      summary = await summarizeIssue(formData.description);
      embedding = await embedText(formData.description);
      sentiment = "unclassified";
      tags = await generateTags(formData.description);
    } catch (err) {
      console.error('AI error:', err.response?.data || err.message);
      setError('AI services failed. Please try again later.');
      return;
    }

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
        setError('This issue may already be reported.');
        return;
      }
    } catch (err) {
      console.error('Duplicate check failed:', err.message);
    }

    const { error: insertError } = await supabase.from('issues').insert({
      ...formData,
      category: finalCategory,
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
      setCustomCategory('');
      setImages([]);

      // ✅ Send confirmation email
      const userEmail = user?.email;
      
      if (userEmail) {
        try {
          await emailjs.send(
            'service_0lso4od',       // 🔁 Replace with EmailJS service ID
            'template_rpsj2zc',      // 🔁 Replace with template ID
            {
              name: formData.name,
              title: formData.title,
              description: formData.description,
              to_email: userEmail     // Template variable
            },
            'hRaD4qFMR-kuDWqtN'         // 🔁 Replace with your public key
          );
          console.log("Confirmation email sent.");
        } catch (emailErr) {
          console.error("Email failed:", emailErr.message);
        }
      }
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <h2>Submit an Issue</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
  <div style={{ display: 'flex', gap: '16px' }}>
    <label style={{ flex: 1 }}>
      Name:
      <input type="text" name="name" value={formData.name} onChange={handleChange} required />
    </label>
    <label style={{ flex: 1 }}>
      Phone:
      <input type="text" name="phone" value={formData.phone} onChange={handleChange} required />
    </label>
  </div>

  <label>
    Address:
    <input type="text" name="address" value={formData.address} onChange={handleChange} required />
  </label>

  <div style={{ display: 'flex', gap: '16px' }}>
    <label style={{ flex: 1 }}>
      Title:
      <input type="text" name="title" value={formData.title} onChange={handleChange} required />
    </label>
    <label style={{ flex: 1 }}>
      Category:
      <select name="category" value={formData.category} onChange={handleChange} required>
        <option value="">Select Category</option>
        <option value="pothole">Pothole</option>
        <option value="water">Water Issue</option>
        <option value="garbage">Garbage</option>
        <option value="light">Light Outage</option>
        <option value="other">Other</option>
      </select>
    </label>
  </div>

  {formData.category === 'other' && (
    <label>
      Specify Category:
      <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} required />
    </label>
  )}

  <label>
    Description:
    <textarea name="description" value={formData.description} onChange={handleChange} required />
  </label>

  <div style={{ display: 'flex', gap: '16px' }}>
    <label style={{ flex: 1 }}>
      Priority:
      <select name="priority" value={formData.priority} onChange={handleChange} required>
        <option value="">Select Priority</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </label>

    <label style={{ flex: 2 }}>
      Maps Link:
      <input
        type="url"
        name="location_url"
        placeholder="https://www.google.com/maps?q=12.9716,77.5946"
        value={formData.location_url}
        onChange={handleChange}
      />
    </label>
  </div>

  <label>
    Upload Images:
    <input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files).slice(0, 3))} />
  </label>

  <button type="submit" style={{ padding: '10px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px' }}>
    Submit
  </button>
</form>

    </div>
  );
}
