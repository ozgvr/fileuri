export const PRESET_TAGS = [
  { id: 'document', title: 'Document', color: 'bg-blue-100 text-blue-700' },
  { id: 'image', title: 'Image', color: 'bg-purple-100 text-purple-700' },
  { id: 'audio', title: 'Audio', color: 'bg-pink-100 text-pink-700' },
  { id: 'video', title: 'Video', color: 'bg-red-100 text-red-700' },
  { id: 'archive', title: 'Archive', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'code', title: 'Code', color: 'bg-green-100 text-green-700' },
];

export const DEFAULT_TAG_COLORS = {
  document: '#2563eb',
  image: '#7c3aed',
  audio: '#db2777',
  video: '#dc2626',
  archive: '#d97706',
  code: '#16a34a',
};

export function getTagPillStyle(tag, tagColors = {}) {
  const bg = tagColors[tag] || DEFAULT_TAG_COLORS[tag] || '#64748b';
  return {
    backgroundColor: bg,
    color: '#ffffff',
  };
}

export const DEFAULT_EXTENSION_MAP = {
  // Documents
  doc: 'document', docx: 'document', txt: 'document', rtf: 'document', odt: 'document', md: 'document', pdf: 'document',
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image', bmp: 'image', webp: 'image', ico: 'image', tiff: 'image',
  // Audio
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', ogg: 'audio', m4a: 'audio', wma: 'audio',
  // Video
  mp4: 'video', avi: 'video', mkv: 'video', mov: 'video', wmv: 'video', flv: 'video', webm: 'video',
  // Archives
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', bz2: 'archive', dmg: 'archive',
  // Code
  js: 'code', ts: 'code', jsx: 'code', tsx: 'code', py: 'code', rb: 'code', java: 'code',
  c: 'code', cpp: 'code', h: 'code', rs: 'code', go: 'code', php: 'code', swift: 'code', kt: 'code',
  html: 'code', css: 'code', scss: 'code', json: 'code', xml: 'code', yaml: 'code', yml: 'code',
  sh: 'code', bat: 'code',
};

export function getExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

export function detectTag(filename, extensionMap) {
  const ext = getExtension(filename);
  const map = extensionMap || DEFAULT_EXTENSION_MAP;
  return map[ext] || null;
}

export function formatSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(timestamp) {
  if (timestamp == null) return '-';
  const d = new Date(Number(timestamp));
  if (Number.isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function shortenName(name, maxLen = 20) {
  if (!name) return '';
  if (name.length <= maxLen) return name;
  const ext = getExtension(name);
  const base = ext ? name.slice(0, name.length - ext.length - 1) : name;
  if (ext) {
    const available = maxLen - ext.length - 5;
    if (available < 1) return name;
    return base.slice(0, available) + '....' + ext;
  }
  return base.slice(0, maxLen - 3) + '...';
}

export function getFileName(filePath) {
  if (!filePath) return '';
  return filePath.split('/').pop().split('\\').pop();
}
