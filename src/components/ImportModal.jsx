import TagPicker from './CategoryTagPicker';
import { detectTag, getExtension, getFileName } from '../utils';

export default function ImportModal({ pendingFiles, existingTags, extensionMap, tagColors, onSave, onCancel }) {
  const extensions = pendingFiles.map(f => getExtension(getFileName(f)) || '');
  const allSameExtension = new Set(extensions).size <= 1;
  const shouldAutoDetect = pendingFiles.length === 1 || allSameExtension;
  const detectedTags = shouldAutoDetect
    ? [...new Set(pendingFiles.map(f => detectTag(getFileName(f), extensionMap)).filter(Boolean))]
    : [];
  const autoHint = detectedTags.length > 0 ? detectedTags.join(', ') : null;

  const picker = TagPicker({
    initialSelectedTags: detectedTags,
    existingTags,
    tagColors,
    datalistId: 'import',
  });

  function handleSave() {
    if (picker.selectedTags.length === 0) return;
    onSave(picker.selectedTags, picker.selectedCustomTagColors);
  }

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[760px] max-w-[92vw] max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Import Files</h2>
        <p className="text-sm text-gray-500 mb-4">
          {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} selected
        </p>

        {autoHint && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            Auto-detected: <strong className="capitalize">{autoHint}</strong>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 items-start mb-4">
          <div>
            {picker.render}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Files to be indexed</h3>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/70">
              <ul className="divide-y divide-gray-200">
                {pendingFiles.map(path => (
                  <li key={path} className="px-3 py-2 text-sm text-gray-700" title={path}>
                    <span className="font-medium text-gray-800">{getFileName(path)}</span>
                    <span className="block text-xs text-gray-400 truncate mt-0.5">{path}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg dialogBtn transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={picker.selectedTags.length === 0}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition ${
              picker.selectedTags.length > 0
                ? 'bg-blue-500 text-white dialogBtnPrimary'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
