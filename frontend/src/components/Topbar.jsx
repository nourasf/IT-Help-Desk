function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <span className="search-icon">⌕</span>
        <input type="text" placeholder="Search anything..." />
      </div>

      <div className="topbar-user">
        <button className="topbar-icon-button" type="button">
          ♧
        </button>

        <div className="user-avatar">♟</div>

        <span className="user-name">Nour Asfour</span>

        <button className="topbar-arrow" type="button">
         ⌄
        </button>
      </div>
    </header>
  );
}

export default Topbar;