function StatCard({ dotClass, title, value, description }) {
  return (
    <article className="stat-card">
      <div className="stat-card-heading">
        <span className={`stat-dot ${dotClass}`}></span>
        <span>{title}</span>
      </div>

      <strong className="stat-value">{value}</strong>

      <p>{description}</p>
    </article>
  );
}

export default StatCard;