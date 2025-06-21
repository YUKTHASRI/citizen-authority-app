import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome to CivicFlow</h1>
      <p>
        CivicFlow helps citizens report civic issues and enables authorities to track and resolve them efficiently.
      </p>

      {/* Citizens and Authorities Section Side by Side */}
      <div style={{ display: 'flex', gap: '40px', marginTop: '30px' }}>
        {/* Citizens Section */}
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '20px', borderRadius: '10px' }}>
          <h2> Citizens</h2>
          <p>Report potholes, garbage, broken streetlights, and other local issues in your area.</p>
          <div style={{ marginTop: '10px' }}>
            <Link to="/signup/citizen" style={{ marginRight: '10px' }}>Sign Up as Citizen</Link>
            <Link to="/login/citizen">Login as Citizen</Link>
          </div>
        </div>

        {/* Authorities Section */}
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '20px', borderRadius: '10px' }}>
          <h2> Authorities</h2>
          <p>Track reports, verify citizen-submitted issues, and resolve them systematically.</p>
          <div style={{ marginTop: '10px' }}>
            <Link to="/signup/authority" style={{ marginRight: '10px' }}>Sign Up as Authority</Link>
            <Link to="/login/authority">Login as Authority</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
