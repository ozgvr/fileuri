import { useState } from 'react';
import { DEFAULT_TAG_COLORS, PRESET_TAGS } from '../utils';

export default function TagPicker({
  initialSelectedTags = [],
  initialCustomTags = [],
  existingTags = [],
  tagColors = {},
  datalistId = 'picker',
}) {
  const presetIds = PRESET_TAGS.map(p => p.id);

  const [selectedPresets, setSelectedPresets] = useState(
    initialSelectedTags.filter(t => presetIds.includes(t))
  );
  const [customTags, setCustomTags] = useState(
    initialCustomTags.length > 0
      ? initialCustomTags
      : initialSelectedTags.filter(t => !presetIds.includes(t))
  );
  const [customInput, setCustomInput] = useState('');
  const [customInputColor, setCustomInputColor] = useState('#64748b');
  const [customTagColors, setCustomTagColors] = useState(() => {
    const map = {};
    for (const t of initialSelectedTags.filter(t => !presetIds.includes(t))) {
      if (tagColors[t]) map[t] = tagColors[t];
    }
    for (const t of initialCustomTags) {
      if (tagColors[t]) map[t] = tagColors[t];
    }
    return map;
  });

  const existingCustomTags = existingTags.filter(t => !presetIds.includes(t));
  const customOptions = [...new Set([...existingCustomTags, ...customTags])].sort((a, b) =>
    a.localeCompare(b)
  );

  const selectedTags = [...selectedPresets, ...customTags];
  const selectedCustomTagColors = Object.fromEntries(
    customTags
      .filter(t => customTagColors[t])
      .map(t => [t, customTagColors[t]])
  );

  function handleCustomKeyDown(e) {
    if (e.key === 'Enter' && customInput.trim()) {
      e.preventDefault();
      const val = customInput.trim();
      if (!customTags.includes(val) && !selectedPresets.includes(val)) {
        setCustomTags(prev => [...prev, val]);
        setCustomTagColors(prev => ({ ...prev, [val]: customInputColor }));
      }
      setCustomInput('');
    }
  }

  function removeCustomTag(tag) {
    setCustomTags(prev => prev.filter(t => t !== tag));
  }

  function toggleCustomTag(tag) {
    if (customTags.includes(tag)) {
      removeCustomTag(tag);
      return;
    }
    setCustomTags(prev => [...prev, tag]);
  }

  function getTagColor(tagId) {
    return customTagColors[tagId] || tagColors[tagId] || DEFAULT_TAG_COLORS[tagId] || '#64748b';
  }

  return {
    selectedTags,
    selectedCustomTagColors,
    render: (
      <>
        {/* Preset Tags */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tags</label>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_TAGS.map(tag => (
              <button
                key={tag.id}
                onClick={() => {
                  setSelectedPresets(prev =>
                    prev.includes(tag.id)
                      ? prev.filter(t => t !== tag.id)
                      : [...prev, tag.id]
                  );
                }}
                className={`p-2.5 rounded-lg border text-left transition tagCard ${
                  selectedPresets.includes(tag.id)
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200'
                }`}
              >
                <div
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1"
                  style={{ backgroundColor: getTagColor(tag.id), color: '#fff' }}
                >
                  {tag.title.charAt(0)}
                </div>
                <div className="text-sm font-medium text-gray-800">{tag.title}</div>
              </button>
            ))}
            {customOptions.map(tag => (
              <button
                key={tag}
                onClick={() => toggleCustomTag(tag)}
                className={`p-2.5 rounded-lg border text-left transition tagCard ${
                  customTags.includes(tag)
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200'
                }`}
              >
                <div
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1"
                  style={{ backgroundColor: getTagColor(tag), color: '#fff' }}
                >
                  {tag.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm font-medium text-gray-800 truncate">{tag}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-600 mb-1">Add a new tag</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              list={`${datalistId}-custom-tags`}
              placeholder="Enter tag name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
            <input
              type="color"
              value={customInputColor}
              onChange={e => setCustomInputColor(e.target.value)}
              className="h-10 w-14 p-1 border border-gray-300 rounded-lg bg-white"
              title="Tag color"
            />
            <button
              onClick={() => {
                const val = customInput.trim();
                if (!val) return;
                if (!customTags.includes(val) && !selectedPresets.includes(val)) {
                  setCustomTags(prev => [...prev, val]);
                  setCustomTagColors(prev => ({ ...prev, [val]: customInputColor }));
                }
                setCustomInput('');
              }}
              disabled={!customInput.trim()}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition ${
                customInput.trim()
                  ? 'border-gray-300 text-gray-700 tagAddBtn'
                  : 'border-gray-200 text-gray-300 cursor-not-allowed'
              }`}
            >
              Add
            </button>
          </div>
          <datalist id={`${datalistId}-custom-tags`}>
            {existingCustomTags.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
      </>
    ),
  };
}
