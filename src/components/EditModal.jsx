import TagPicker from './CategoryTagPicker';

export default function EditModal({ file, existingTags, tagColors, onSave, onCancel }) {
  const picker = TagPicker({
    initialSelectedTags: [...(file.tags || [])],
    existingTags,
    tagColors,
    datalistId: 'edit',
  });

  function handleSave() {
    if (picker.selectedTags.length === 0) return;
    onSave(picker.selectedTags, picker.selectedCustomTagColors);
  }

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[580px] max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Edit File</h2>
        <p className="text-sm text-gray-500 mb-4 truncate">{file.name}</p>

        {picker.render}

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
