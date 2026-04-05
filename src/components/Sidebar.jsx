import { PRESET_TAGS, DEFAULT_TAG_COLORS } from '../utils';

const UNTAGGED_TAG = '__untagged__';

const NAV_ITEMS = [
  { id: 'search', label: 'Search' },
  { id: 'recent', label: 'Recent Files' },
  { id: 'tags', label: 'Tags' },
  { id: 'settings', label: 'Settings', bottom: true },
];

function hexToRgba(hex, alpha) {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3
    ? h.split('').map(ch => ch + ch).join('')
    : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(100,116,139,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function Sidebar({ currentPage, selectedTag, onNavigate, allTags, onAddFiles, tagColors, untaggedCount = 0 }) {
  const presetIds = PRESET_TAGS.map(p => p.id);
  const customTags = allTags.filter(t => !presetIds.includes(t));
  const sidebarTags = [
    ...(untaggedCount > 0 ? [UNTAGGED_TAG] : []),
    ...presetIds,
    ...customTags,
  ];

  function getTagColor(tag) {
    return (tagColors && tagColors[tag]) || DEFAULT_TAG_COLORS[tag] || '#64748b';
  }

  function getTagLabel(tag) {
    return tag === UNTAGGED_TAG ? 'Untagged' : tag;
  }

  return (
    <aside className="w-[260px] min-w-[260px] sidebarSurface border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 pb-3 pt-8">
        <button
          onClick={onAddFiles}
          className="w-full py-2.5 px-4 bg-blue-500 text-white rounded-lg sidebarAddBtn active:bg-blue-700 transition text-sm font-semibold"
        >
          Add Files
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_ITEMS.filter(i => !i.bottom).map(item => (
          <div key={item.id}>
            <button
              onClick={() => onNavigate(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 text-[15px] font-medium transition ${
                currentPage === item.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 nav-hover'
              }`}
            >
              {item.label}
            </button>

            {item.id === 'tags' && (
              <div className="mb-1">
                {sidebarTags.map(tag => (
                  (() => {
                    const active = currentPage === 'tag-detail' && selectedTag === tag;
                    const color = getTagColor(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => onNavigate('tag-detail', tag)}
                        className={`block w-full text-left px-2 pl-4 py-1.5 text-[13px] rounded truncate ${tag === UNTAGGED_TAG ? '' : 'capitalize'} ${
                          active
                            ? 'font-semibold'
                            : 'text-gray-500 subnav-hover'
                        }`}
                        style={active ? { backgroundColor: hexToRgba(color, 0.18), color } : undefined}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span>{getTagLabel(tag)}</span>
                        </span>
                      </button>
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="px-3 pb-4 border-t border-gray-200 pt-2">
        {NAV_ITEMS.filter(i => i.bottom).map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-[15px] font-medium transition ${
              currentPage === item.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 nav-hover'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
