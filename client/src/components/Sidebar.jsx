import { NavLink } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import './Sidebar.css';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/worlds', label: 'Worlds' },
  { path: '/players', label: 'Players' },
  { path: '/allowlist', label: 'Allowlist' },
  { path: '/console', label: 'Console' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span>Terraria Server</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <StatusBadge />
      </div>
    </aside>
  );
}
