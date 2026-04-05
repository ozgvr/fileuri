import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save, ask } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import Sidebar from './components/Sidebar';
import FileTable from './components/FileTable';
import ImportModal from './components/ImportModal';
import EditModal from './components/EditModal';
import { getFileName, PRESET_TAGS, DEFAULT_EXTENSION_MAP, DEFAULT_TAG_COLORS, getTagPillStyle, formatSize, formatDate, getExtension } from './utils';
import * as db from './db';

const UNTAGGED_TAG = '__untagged__';

function getTagDisplayName(tag) {
  return tag === UNTAGGED_TAG ? 'Untagged' : tag;
}

function EditTagModal({ oldName, initialColor, onConfirm, onCancel }) {
  const [value, setValue] = useState(oldName);
  const [color, setColor] = useState(initialColor || '#64748b');
  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[380px] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-3">Edit Tag</h3>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(value, color); }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 mb-3"
        />
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-9 w-14 p-1 border border-gray-300 rounded-md bg-white"
            />
            <span
              className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full capitalize"
              style={{ backgroundColor: color, color: '#fff' }}
            >
              {value || oldName}
            </span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg dialogBtn transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(value, color)}
            disabled={!value.trim()}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              value.trim()
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

function FileDetailsModal({ file, onClose, onOpenLocation, onEdit, onRemove }) {
  if (!file) return null;
  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-[520px] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">File Details</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-500">Name: </span>
            <span className="text-gray-800 font-medium">{file.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Size: </span>
            <span className="text-gray-800">{formatSize(file.size)}</span>
          </div>
          <div>
            <span className="text-gray-500">Extension: </span>
            <span className="text-gray-800">{getExtension(file.name) || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">Date: </span>
            <span className="text-gray-800">{formatDate(file.createdAt)}</span>
          </div>
          <div>
            <span className="text-gray-500">Index Date: </span>
            <span className="text-gray-800">{formatDate(file.indexedAt)}</span>
          </div>
          <div>
            <span className="text-gray-500">Tags: </span>
            <span className="text-gray-800 capitalize">{(file.tags || []).join(', ') || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">Path: </span>
            <button
              onClick={() => onOpenLocation(file.path)}
              className="pathLink break-all text-left"
            >
              {file.path}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => onEdit(file)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 dialogBtn transition"
          >
            Edit
          </button>
          <button
            onClick={() => onRemove(file)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-500 dialogBtnDanger transition"
          >
            Remove
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg dialogBtn transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const PAGE_SIZE = 10;
  const [pageFiles, setPageFiles] = useState([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [page, setPage] = useState(0);
  const [allTags, setAllTags] = useState([]); // [{tag, count}]
  const [untaggedCount, setUntaggedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('search');
  const [selectedTag, setSelectedTag] = useState('');
  const [detailsFile, setDetailsFile] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [searchTokens, setSearchTokens] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [tagsSearchInput, setTagsSearchInput] = useState('');
  const [tagDetailSearchTokens, setTagDetailSearchTokens] = useState([]);
  const [tagDetailSearchInput, setTagDetailSearchInput] = useState('');
  const [editTagTarget, setEditTagTarget] = useState(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [extensionMap, setExtensionMap] = useState(DEFAULT_EXTENSION_MAP);
  const [tagColors, setTagColors] = useState(DEFAULT_TAG_COLORS);
  const [mappingExtInput, setMappingExtInput] = useState('');
  const [mappingTagInput, setMappingTagInput] = useState(PRESET_TAGS[0].id);

  function parseDateToken(token, prefix = 'date:') {
    const lower = token.toLowerCase();
    if (!lower.startsWith(prefix)) return null;
    let raw = token.slice(prefix.length).trim();
    let op = 'eq';
    if (raw.startsWith('>')) {
      op = 'gt';
      raw = raw.slice(1).trim();
    } else if (raw.startsWith('<')) {
      op = 'lt';
      raw = raw.slice(1).trim();
    }

    const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const yearRaw = m[3];
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    const start = new Date(year, month - 1, day).getTime();
    if (Number.isNaN(start)) return null;
    const end = start + 24 * 60 * 60 * 1000;

    if (op === 'eq') return { op: 'eq', start, end };
    if (op === 'gt') return { op: 'gt', value: end - 1 };
    return { op: 'lt', value: start };
  }

  // Parse search tokens into structured filters
  function parseTokens(tokens) {
    const names = [];
    const tags = [];
    const extensions = [];
    const dates = [];
    const indexDates = [];
    for (const t of tokens) {
      const lower = t.toLowerCase();
      if (lower.startsWith('date:')) {
        const parsed = parseDateToken(t);
        if (parsed) dates.push(parsed);
      } else if (lower.startsWith('index:')) {
        const parsed = parseDateToken(t, 'index:');
        if (parsed) indexDates.push(parsed);
      } else if (lower.startsWith('tag:')) tags.push(lower.slice(4));
      else if (lower.startsWith('ext:')) extensions.push(lower.slice(4).replace(/^\./, ''));
      else names.push(lower);
    }
    return { names, tags, extensions, dates, indexDates };
  }

  async function loadPage(pageName, pageNum, tag, tokens, sort = sortBy, dir = sortDir) {
    let result;
    switch (pageName) {
      case 'search': {
        const filters = parseTokens(tokens);
        if (tokens.length === 0) {
          result = await db.loadFilesPage(pageNum, PAGE_SIZE, sort, dir);
        } else {
          result = await db.searchFiles(filters, pageNum, PAGE_SIZE, sort, dir);
        }
        break;
      }
      case 'recent':
        result = await db.loadFilesPage(pageNum, PAGE_SIZE, sort, dir);
        break;
      case 'tag-detail': {
        if (tag === UNTAGGED_TAG) {
          if (tokens.length > 0) {
            const parsed = parseTokens(tokens);
            result = await db.searchFiles(
              {
                names: parsed.names,
                tags: parsed.tags,
                extensions: parsed.extensions,
                dates: parsed.dates,
                indexDates: parsed.indexDates,
                untagged: true,
              },
              pageNum,
              PAGE_SIZE,
              sort,
              dir
            );
          } else {
            result = await db.loadUntaggedFilesPage(pageNum, PAGE_SIZE, sort, dir);
          }
          break;
        }
        if (tokens.length > 0) {
          const parsed = parseTokens(tokens);
          result = await db.searchFiles(
            {
              names: parsed.names,
              tags: [...new Set([...(parsed.tags || []), tag.toLowerCase()])],
              extensions: parsed.extensions,
              dates: parsed.dates,
              indexDates: parsed.indexDates,
            },
            pageNum,
            PAGE_SIZE,
            sort,
            dir
          );
        } else {
          result = await db.loadFilesByTag(tag, pageNum, PAGE_SIZE, sort, dir);
        }
        break;
      }
      default:
        return;
    }
    setPageFiles(result.files);
    setTotalFiles(result.total);
    setPage(pageNum);
  }

  async function refreshTags() {
    const [tags, untagged] = await Promise.all([
      db.loadAllTags(),
      db.getUntaggedCount(),
    ]);
    setAllTags(tags);
    setUntaggedCount(untagged);
  }

  // Initial load
  useEffect(() => {
    Promise.all([
      db.loadFilesPage(0, PAGE_SIZE),
      db.loadAllTags(),
      db.getUntaggedCount(),
      db.getSetting('extension_map'),
      db.getSetting('tag_colors'),
    ]).then(([result, tags, untagged, savedMap, savedColors]) => {
      setPageFiles(result.files);
      setTotalFiles(result.total);
      setAllTags(tags);
      setUntaggedCount(untagged);
      if (savedMap && typeof savedMap === 'object' && !Array.isArray(savedMap)) {
        setExtensionMap({ ...DEFAULT_EXTENSION_MAP, ...savedMap });
      }
      if (savedColors && typeof savedColors === 'object' && !Array.isArray(savedColors)) {
        setTagColors({ ...DEFAULT_TAG_COLORS, ...savedColors });
      }
      setLoading(false);
    });
  }, []);

  // Reload when search tokens change
  useEffect(() => {
    if (!loading && currentPage === 'search') {
      if (searchTokens.length > 0) {
        loadPage('search', 0, selectedTag, searchTokens);
      } else {
        setPageFiles([]);
        setTotalFiles(0);
        setPage(0);
      }
    }
  }, [searchTokens, hasSearched]);

  useEffect(() => {
    if (searchTokens.length > 0 && !hasSearched) {
      setHasSearched(true);
    }
  }, [searchTokens, hasSearched]);

  useEffect(() => {
    if (!loading && currentPage === 'tag-detail' && selectedTag) {
      loadPage('tag-detail', 0, selectedTag, tagDetailSearchTokens, sortBy, sortDir);
    }
  }, [tagDetailSearchTokens]);

  // Tauri drag/drop listener
  useEffect(() => {
    let unlisten;
    let lastDrop = 0;

    getCurrentWebview()
      .onDragDropEvent(event => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setIsDraggingFiles(true);
          return;
        }

        if (event.payload.type === 'leave') {
          setIsDraggingFiles(false);
          return;
        }

        if (event.payload.type === 'drop') {
          setIsDraggingFiles(false);
          const now = Date.now();
          if (now - lastDrop < 500) return;
          lastDrop = now;
          const paths = event.payload.paths || [];
          if (paths.length > 0) handleNewPaths(paths);
        }
      })
      .then(fn => {
        unlisten = fn;
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  function handleNewPaths(paths) {
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length === 0) return;
    db.getExistingPaths(uniquePaths).then(existingSet => {
      const newPaths = uniquePaths.filter(p => !existingSet.has(p));
      if (newPaths.length === 0) return;
      setPendingFiles(newPaths);
      setShowImportModal(true);
    });
  }

  async function handleAddFiles() {
    try {
      const selected = await open({ multiple: true, directory: false });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      handleNewPaths(paths);
    } catch (err) {
      console.error('File picker error:', err);
    }
  }

  async function handleImportSave(tags, customTagColors = {}) {
    if (customTagColors && Object.keys(customTagColors).length > 0) {
      const nextColors = { ...tagColors, ...customTagColors };
      setTagColors(nextColors);
      await db.setSetting('tag_colors', nextColors);
    }
    for (const path of pendingFiles) {
      let size = 0;
      let createdAt = Date.now();
      try {
        size = await invoke('get_file_size', { path });
      } catch {
        /* ignore size errors */
      }
      try {
        const ts = await invoke('get_file_timestamps', { path });
        const created = Number(ts?.created || 0);
        const modified = Number(ts?.modified || 0);
        if (created > 0) createdAt = created;
        else if (modified > 0) createdAt = modified;
      } catch {
        /* ignore timestamp errors */
      }
      const file = {
        path,
        name: getFileName(path),
        tags: [...tags],
        size: Number(size),
        createdAt,
        indexedAt: Date.now(),
      };
      await db.insertFile(file);
    }
    await refreshTags();
    await loadPage(
      currentPage,
      page,
      selectedTag,
      currentPage === 'tag-detail' ? tagDetailSearchTokens : searchTokens
    );
    setShowImportModal(false);
    setPendingFiles([]);
  }

  function handleImportCancel() {
    setShowImportModal(false);
    setPendingFiles([]);
  }

  function handleNavigate(pageName, detail) {
    setCurrentPage(pageName);
    const tag = pageName === 'tag-detail' ? detail : selectedTag;
    let nextSortBy = sortBy;
    let nextSortDir = sortDir;
    if (pageName === 'recent') {
      nextSortBy = 'indexed_at';
      nextSortDir = 'desc';
      setSortBy(nextSortBy);
      setSortDir(nextSortDir);
    }
    if (pageName === 'tag-detail') {
      setSelectedTag(detail);
      setTagDetailSearchTokens([]);
      setTagDetailSearchInput('');
    }
    setDetailsFile(null);
    const shouldLoad = !(pageName === 'search' && searchTokens.length === 0);
    if (shouldLoad) {
      loadPage(pageName, 0, tag, pageName === 'search' ? searchTokens : [], nextSortBy, nextSortDir);
    }
    if (pageName === 'tags' || pageName === 'settings') refreshTags();
  }

  async function handleOpenLocation(path) {
    try {
      await invoke('show_in_folder', { path });
    } catch (err) {
      console.error('show_in_folder error:', err);
    }
  }

  function handleRowClick(file) {
    setDetailsFile(file);
  }

  function handleDetailsEdit(file) {
    setDetailsFile(null);
    handleEdit(file);
  }

  async function handleDetailsRemove(file) {
    setDetailsFile(null);
    await handleRemove(file);
  }

  function handleEdit(file) {
    setEditingFile(file);
  }

  async function handleEditSave(tags, customTagColors = {}) {
    if (customTagColors && Object.keys(customTagColors).length > 0) {
      const nextColors = { ...tagColors, ...customTagColors };
      setTagColors(nextColors);
      await db.setSetting('tag_colors', nextColors);
    }
    await db.updateFileTags(editingFile.path, tags);
    await refreshTags();
    await loadPage(
      currentPage,
      page,
      selectedTag,
      currentPage === 'tag-detail' ? tagDetailSearchTokens : searchTokens
    );
    setEditingFile(null);
  }

  async function handleRemove(file) {
    const yes = await ask(`Remove "${file.name}" from the list?`, {
      title: 'Confirm Removal',
      kind: 'warning',
      okLabel: 'Yes',
      cancelLabel: 'No',
    });
    if (yes) {
      await db.removeFile(file.path);
      await refreshTags();
      await loadPage(
        currentPage,
        page,
        selectedTag,
        currentPage === 'tag-detail' ? tagDetailSearchTokens : searchTokens
      );
    }
  }

  function handleTagClick(tag) {
    handleNavigate('tag-detail', tag);
  }

  function handleEditTag(oldName) {
    setEditTagTarget({ oldName, color: tagColors[oldName] || DEFAULT_TAG_COLORS[oldName] || '#64748b' });
  }

  async function handleEditTagConfirm(newName, color) {
    if (!editTagTarget || !newName.trim()) {
      setEditTagTarget(null);
      return;
    }
    const oldName = editTagTarget.oldName;
    const trimmed = newName.trim();
    if (trimmed !== oldName) {
      await db.renameTag(oldName, trimmed);
    }

    const nextColors = { ...tagColors };
    if (trimmed !== oldName) {
      delete nextColors[oldName];
    }
    nextColors[trimmed] = color;
    setTagColors(nextColors);
    await db.setSetting('tag_colors', nextColors);

    setSelectedTag(trimmed);
    setEditTagTarget(null);
    await refreshTags();
    await loadPage('tag-detail', page, trimmed, tagDetailSearchTokens);
  }

  async function handleDeleteTag(tagName) {
    const yes = await ask(`Delete tag "${tagName}" from all files?`, {
      title: 'Delete Tag',
      kind: 'warning',
      okLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!yes) return;

    await db.deleteTag(tagName);

    const nextColors = { ...tagColors };
    delete nextColors[tagName];
    setTagColors(nextColors);
    await db.setSetting('tag_colors', nextColors);

    setEditTagTarget(null);
    setTagDetailSearchTokens([]);
    setTagDetailSearchInput('');
    if (selectedTag === tagName) {
      setSelectedTag('');
      setCurrentPage('tags');
    }
    await refreshTags();
    await loadPage('search', 0, '', searchTokens);
  }

  function handlePageChange(newPage) {
    loadPage(
      currentPage,
      newPage,
      selectedTag,
      currentPage === 'tag-detail' ? tagDetailSearchTokens : searchTokens
    );
  }

  function handleSort(column) {
    const newDir = sortBy === column && sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortDir(newDir);
    loadPage(
      currentPage,
      0,
      selectedTag,
      currentPage === 'tag-detail' ? tagDetailSearchTokens : searchTokens,
      column,
      newDir
    );
  }

  async function updateExtensionMap(nextMap) {
    setExtensionMap(nextMap);
    await db.setSetting('extension_map', nextMap);
  }

  async function handleAddExtensionMapping() {
    const ext = mappingExtInput.trim().replace(/^\./, '').toLowerCase();
    if (!ext || !mappingTagInput.trim()) return;
    await updateExtensionMap({ ...extensionMap, [ext]: mappingTagInput.trim().toLowerCase() });
    setMappingExtInput('');
  }

  async function handleRemoveExtensionMapping(ext) {
    const nextMap = { ...extensionMap };
    delete nextMap[ext];
    await updateExtensionMap(nextMap);
  }

  // Unique tag names for sidebar/modals
  const allTagNames = allTags.map(t => t.tag);
  const mappingTagOptions = [...new Set([
    ...PRESET_TAGS.map(t => t.id),
    ...allTagNames,
  ])];
  const mappingRows = Object.entries(extensionMap)
    .sort(([a], [b]) => a.localeCompare(b));

  const tableProps = {
    onRowClick: handleRowClick,
    onTagClick: handleTagClick,
    onOpenLocation: handleOpenLocation,
    total: totalFiles,
    page,
    onPageChange: handlePageChange,
    sortBy,
    sortDir,
    onSort: handleSort,
    tagColors,
  };

  function renderPage() {
    switch (currentPage) {
      case 'search':
        return (
          <div>
            <h2 className="text-4xl font-bold text-gray-800 mb-6">Search</h2>
            <div
              className="flex flex-wrap items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white mb-5 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-400 cursor-text"
              onClick={e => e.currentTarget.querySelector('input')?.focus()}
            >
              {searchTokens.map((token, i) => {
                const lower = token.toLowerCase();
                const isTag = lower.startsWith('tag:');
                const isExt = lower.startsWith('ext:');
                const isDate = lower.startsWith('date:') || lower.startsWith('index:');
                const color = isTag
                  ? 'bg-blue-100 text-blue-700'
                  : isExt
                    ? 'bg-purple-100 text-purple-700'
                    : isDate
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-700';
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}
                  >
                    {token}
                    <button
                      onClick={e => { e.stopPropagation(); setSearchTokens(prev => prev.filter((_, j) => j !== i)); }}
                      className="ml-0.5 hover:opacity-70 text-current font-bold leading-none"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchInput.trim()) {
                    e.preventDefault();
                    setHasSearched(true);
                    setSearchTokens(prev => [...prev, searchInput.trim()]);
                    setSearchInput('');
                  } else if (e.key === 'Backspace' && !searchInput && searchTokens.length > 0) {
                    setSearchTokens(prev => prev.slice(0, -1));
                  }
                }}
                placeholder="filename  tag:document  ext:png  index:<10.05.26 — press Enter"
                className="flex-1 min-w-[180px] py-1 text-sm outline-none bg-transparent"
              />
            </div>
            {searchTokens.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-5">
                <h3 className="text-base font-semibold text-gray-700 mb-1 text-center">Search a file</h3>
                <p className="text-xs text-gray-500 mb-4 text-center">
                  Type a token, press Enter to add it, and combine multiple tokens to narrow results.
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 mb-1">Name text</div>
                    <p className="text-xs text-gray-700">Matches file name or full path.</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">report</p>
                  </div>

                  <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 mb-1">tag:</div>
                    <p className="text-xs text-gray-700">Filter by tag.</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">tag:document</p>
                  </div>

                  <div className="rounded-md border border-purple-200 bg-purple-50 p-2.5">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 mb-1">ext:</div>
                    <p className="text-xs text-gray-700">Filter by extension.</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">ext:png</p>
                  </div>

                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 mb-1">date:</div>
                    <p className="text-xs text-gray-700">File date filter.</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">date:&lt;10.05.26</p>
                  </div>

                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 mb-1">index:</div>
                    <p className="text-xs text-gray-700">Index date filter.</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">index:&lt;10.05.26</p>
                  </div>

                  <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5 sm:col-span-2 lg:col-span-1">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 mb-1">Tip</div>
                    <p className="text-xs text-gray-700">Combine tokens.</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">report tag:document ext:pdf</p>
                  </div>
                </div>
              </div>
            ) : (
              <FileTable files={pageFiles} {...tableProps} />
            )}
          </div>
        );

      case 'recent': {
        return (
          <div>
            <h2 className="text-4xl font-bold text-gray-800 mb-6">
              Recent Files
            </h2>
            <FileTable files={pageFiles} {...tableProps} />
          </div>
        );
      }

      case 'tags': {
        const query = tagsSearchInput.toLowerCase().trim();
        const tagCountMap = Object.fromEntries(allTags.map(({ tag, count }) => [tag, count]));
        const combinedTags = [
          ...(untaggedCount > 0 ? [{ tag: UNTAGGED_TAG, count: untaggedCount }] : []),
          ...PRESET_TAGS.map(t => ({ tag: t.id, count: tagCountMap[t.id] || 0 })),
          ...allTags
            .filter(({ tag }) => !PRESET_TAGS.some(p => p.id === tag))
            .sort((a, b) => a.tag.localeCompare(b.tag)),
        ];
        const filteredTags = combinedTags.filter(({ tag }) =>
          query.length === 0
            ? true
            : getTagDisplayName(tag).toLowerCase().includes(query)
        );
        return (
          <div>
            <h2 className="text-4xl font-bold text-gray-800 mb-6">Tags</h2>
            <div
              className="flex flex-wrap items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white mb-5 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-400 cursor-text"
              onClick={e => e.currentTarget.querySelector('input')?.focus()}
            >
              <input
                type="text"
                value={tagsSearchInput}
                onChange={e => setTagsSearchInput(e.target.value)}
                placeholder="Search tags by name"
                className="flex-1 min-w-[180px] py-1 text-sm outline-none bg-transparent"
              />
            </div>
            <div className="overflow-x-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Tag</th>
                    <th className="py-3 px-4">Files</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTags.map(({ tag, count }) => (
                    <tr
                      key={tag}
                      className="border-b border-gray-100 cursor-pointer row-hover"
                      onClick={() => handleNavigate('tag-detail', tag)}
                    >
                      <td className="py-3 px-4">
                        <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${tag === UNTAGGED_TAG ? '' : 'capitalize'}`} style={getTagPillStyle(tag, tagColors)}>
                          {getTagDisplayName(tag)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {count} file{count !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  ))}
                  {filteredTags.length === 0 && (
                    <tr>
                      <td
                        colSpan="2"
                        className="py-16 text-center text-gray-400 text-sm"
                      >
                        No tags yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'tag-detail': {
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-4xl font-bold text-gray-800 ${selectedTag === UNTAGGED_TAG ? '' : 'capitalize'}`}>
                {getTagDisplayName(selectedTag)}
              </h2>
              {selectedTag !== UNTAGGED_TAG && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditTag(selectedTag)}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-600 dialogBtn transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTag(selectedTag)}
                    className="px-3 py-1.5 text-sm font-medium border border-red-200 rounded-lg text-red-500 dialogBtnDanger transition"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <div
              className="flex flex-wrap items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white mb-5 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-400 cursor-text"
              onClick={e => e.currentTarget.querySelector('input')?.focus()}
            >
              {tagDetailSearchTokens.map((token, i) => {
                const lower = token.toLowerCase();
                const isTag = lower.startsWith('tag:');
                const isExt = lower.startsWith('ext:');
                const isDate = lower.startsWith('date:') || lower.startsWith('index:');
                const color = isTag
                  ? 'bg-blue-100 text-blue-700'
                  : isExt
                    ? 'bg-purple-100 text-purple-700'
                    : isDate
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-700';
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}
                  >
                    {token}
                    <button
                      onClick={e => { e.stopPropagation(); setTagDetailSearchTokens(prev => prev.filter((_, j) => j !== i)); }}
                      className="ml-0.5 hover:opacity-70 text-current font-bold leading-none"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <input
                type="text"
                value={tagDetailSearchInput}
                onChange={e => setTagDetailSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagDetailSearchInput.trim()) {
                    e.preventDefault();
                    setTagDetailSearchTokens(prev => [...prev, tagDetailSearchInput.trim()]);
                    setTagDetailSearchInput('');
                  } else if (e.key === 'Backspace' && !tagDetailSearchInput && tagDetailSearchTokens.length > 0) {
                    setTagDetailSearchTokens(prev => prev.slice(0, -1));
                  }
                }}
                placeholder="filename  tag:document  ext:png  index:<10.05.26 — press Enter"
                className="flex-1 min-w-[180px] py-1 text-sm outline-none bg-transparent"
              />
            </div>
            <FileTable files={pageFiles} {...tableProps} />
          </div>
        );
      }

      case 'settings':
        return (
          <div>
            <h2 className="text-4xl font-bold text-gray-800 mb-6">Settings</h2>
            <div className="space-y-4 max-w-xl">
              {/* Export Data */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Export Data</h3>
                <p className="text-xs text-gray-400 mb-3">Download all file entries as a JSON file.</p>
                <button
                  onClick={async () => {
                    const path = await save({
                      defaultPath: 'fileuri-export.json',
                      filters: [
                        { name: 'JSON', extensions: ['json'] },
                      ],
                    });
                    if (!path) return;
                    const allFiles = await db.loadFiles();
                    await invoke('write_text_file', {
                      path,
                      content: JSON.stringify(allFiles, null, 2),
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Export JSON
                </button>
              </div>

              {/* Import Data */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Import Data</h3>
                <p className="text-xs text-gray-400 mb-3">Load file entries from a previously exported JSON file.</p>
                <button
                  onClick={async () => {
                    const path = await open({
                      multiple: false,
                      directory: false,
                      filters: [
                        { name: 'JSON', extensions: ['json'] },
                      ],
                    });
                    if (!path || Array.isArray(path)) return;
                    try {
                      const text = await invoke('read_text_file', { path });
                      const imported = JSON.parse(text);
                      if (Array.isArray(imported)) {
                        await db.importFiles(imported);
                        await refreshTags();
                        await loadPage(currentPage, 0, selectedTag, searchTokens);
                      }
                    } catch {
                      /* ignore bad files */
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                >
                  Import JSON
                </button>
              </div>

              {/* Extension Mapping */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Extension Mapping</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Map file extensions to tags. These mappings are used for auto-detection on import.
                </p>

                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Extension</label>
                    <input
                      type="text"
                      value={mappingExtInput}
                      onChange={e => setMappingExtInput(e.target.value)}
                      placeholder="e.g. psd"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    />
                  </div>
                  <div className="w-40">
                    <label className="block text-xs text-gray-500 mb-1">Tag</label>
                    <select
                      value={mappingTagInput}
                      onChange={e => setMappingTagInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 capitalize"
                    >
                      {mappingTagOptions.map(tag => (
                        <option key={tag} value={tag} className="capitalize">{tag}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAddExtensionMapping}
                    disabled={!mappingExtInput.trim()}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      mappingExtInput.trim()
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Add
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2">Extension</th>
                        <th className="text-left px-3 py-2">Tag</th>
                        <th className="text-right px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappingRows.map(([ext, tag]) => (
                        <tr key={ext} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-mono text-xs">.{ext}</td>
                          <td className="px-3 py-2 capitalize">{tag}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => handleRemoveExtensionMapping(ext)}
                              className="px-2.5 py-1 text-xs font-medium rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clear All Data */}
              <div className="bg-white rounded-lg border border-red-200 p-4">
                <h3 className="text-sm font-semibold text-red-600 mb-1">Clear All Data</h3>
                <p className="text-xs text-gray-400 mb-3">Remove all file entries from the app. This cannot be undone.</p>
                <button
                  onClick={async () => {
                    const yes = await ask('This will remove all file entries. Continue?', {
                      title: 'Clear All Data',
                      kind: 'warning',
                      okLabel: 'Yes, clear',
                      cancelLabel: 'Cancel',
                    });
                    if (yes) {
                      await db.clearAllFiles();
                      setPageFiles([]);
                      setTotalFiles(0);
                      setAllTags([]);
                      setCurrentPage('search');
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  Clear All
                </button>
              </div>

              {/* Stats */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Statistics</h3>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-gray-800">{totalFiles}</div>
                    <div className="text-xs text-gray-400">Files</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-gray-800">{allTags.length}</div>
                    <div className="text-xs text-gray-400">Tags</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar
        currentPage={currentPage}
        selectedTag={selectedTag}
        onNavigate={handleNavigate}
        allTags={allTagNames}
        untaggedCount={untaggedCount}
        tagColors={tagColors}
        onAddFiles={handleAddFiles}
      />
      <main className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
        ) : (
          renderPage()
        )}
      </main>

      {isDraggingFiles && (
        <div
          className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(59, 162, 246, 0.09)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div className="w-full h-full p-4">
            <div className="w-full h-full rounded-2xl border-2 border-dashed border-blue-500 bg-white/15 flex items-center justify-center">
              <div className="px-6 py-3 rounded-xl bg-white/45 text-blue-900 text-2xl font-semibold tracking-wide">
                Drop your files here
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportModal
          pendingFiles={pendingFiles}
          existingTags={allTagNames}
          extensionMap={extensionMap}
          tagColors={tagColors}
          onSave={handleImportSave}
          onCancel={handleImportCancel}
        />
      )}

      {editingFile && (
        <EditModal
          file={editingFile}
          existingTags={allTagNames}
          tagColors={tagColors}
          onSave={handleEditSave}
          onCancel={() => setEditingFile(null)}
        />
      )}

      {editTagTarget && (
        <EditTagModal
          oldName={editTagTarget.oldName}
          initialColor={editTagTarget.color}
          onConfirm={handleEditTagConfirm}
          onCancel={() => setEditTagTarget(null)}
        />
      )}

      {detailsFile && (
        <FileDetailsModal
          file={detailsFile}
          onClose={() => setDetailsFile(null)}
          onOpenLocation={handleOpenLocation}
          onEdit={handleDetailsEdit}
          onRemove={handleDetailsRemove}
        />
      )}
    </div>
  );
}

export default App;
