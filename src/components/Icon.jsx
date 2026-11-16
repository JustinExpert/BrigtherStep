// Static SVG path data (trusted constants, never user input).
const P = {
  home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v5"/>',
  teachers: '<circle cx="12" cy="6" r="2.5"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M8 20v-4a4 4 0 0 1 8 0v4M2 20v-2a3 3 0 0 1 4-2.8M22 20v-2a3 3 0 0 0-4-2.8"/>',
  book: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M12 8h4M12 12h4"/>',
  account: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5c1.5-2 3.4-3 5.5-3s4 1 5.5 3"/>',
  class: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/><path d="M6 8h1M6 11h1M17 8h1M17 11h1"/>',
  subject: '<path d="M3 5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0zM21 5c-3-1.5-6-1.5-9 0v15c3-1.5 6-1.5 9 0z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  list: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  exam: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3M3 5h4M5 3v4M18 15h4M20 13v4"/>',
  notice: '<path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
  bus: '<rect x="4" y="4" width="14" height="13" rx="2"/><path d="M4 11h14M7 20v-3M15 20v-3M7.5 14h.01M14.5 14h.01M19 6c1.5 0 2.5 1 2.5 2.5M19 3c3 0 5 2 5 5"/>',
  building: '<path d="M3 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M14 10h5a2 2 0 0 1 2 2v9M2 21h20M7 7h3M7 11h3M7 15h3M17 14h1M17 17h1"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4M4 22h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  more: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  teacher: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/><path d="M12 14l-1.5 3 1.5 3 1.5-3z"/>',
  parents: '<circle cx="8" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><path d="M2 20c0-3.5 2.7-6 6-6 1.6 0 3 .5 4 1.4 1-.9 2.4-1.4 4-1.4 3.3 0 6 2.5 6 6"/>',
  money: '<path d="M9 3h6l-1.5 3h-3z"/><path d="M12 6c5 0 8 4 8 9a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6c0-5 3-9 8-9z"/><path d="M14 11.5c-.4-.8-1.2-1.2-2-1.2-1.2 0-2 .6-2 1.5 0 2 4 1 4 3 0 .9-.8 1.6-2 1.6-.9 0-1.7-.4-2.1-1.2M12 9v1.3M12 16.4V18"/>',
  course: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  event: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
};

export default function Icon({ name, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest} dangerouslySetInnerHTML={{ __html: P[name] || "" }} />
  );
}

export const Logo = () => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M9 26c0-6 3-12 7-16" stroke="#7b2cdf" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M16 26c0-5 2-10 6-13" stroke="#ff7a3d" strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="20" cy="6" r="3" fill="#7b2cdf" />
  </svg>
);
