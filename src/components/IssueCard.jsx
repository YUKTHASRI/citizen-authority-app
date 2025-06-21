// File: components/IssueCard.jsx
export default function IssueCard({ issue }) {
  return (
    <div className="p-4 border rounded mb-2">
      <h3 className="text-lg font-bold">{issue.title}</h3>
      <p>{issue.description}</p>
      <p>Status: {issue.status}</p>
    </div>
  );
}