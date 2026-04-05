import { shortenName, formatSize, formatDate, getExtension, getTagPillStyle } from '../utils';

const PAGE_SIZE = 10;

export default function FileTable({
  files,
  total,
  page,
  onPageChange,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  onTagClick,
  onOpenLocation,
  tagColors,
}) {
  const totalPages = Math.max(1, Math.ceil((total || files.length) / PAGE_SIZE));

  function SortHeader({ column, label, className }) {
    const active = sortBy === column;
    return (
      <th
        className={`${className} cursor-pointer select-none hover:text-gray-700 transition-colors`}
        onClick={() => onSort(column)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (
            <span className="text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
          )}
        </span>
      </th>
    );
  }

  return (
    <div>
      <div className="overflow-x-hidden rounded-lg border border-gray-200 bg-white min-h-[520px]">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <SortHeader column="name" label="Name" className="py-3 px-3 w-[16%]" />
              <th className="py-3 px-2 w-[18%]">Tags</th>
              <SortHeader column="created_at" label="Date" className="py-3 px-2 w-[11%]" />
              <SortHeader column="indexed_at" label="Index Date" className="py-3 px-2 w-[11%]" />
              <SortHeader column="size" label="Size" className="py-3 px-2 w-[8%]" />
              <SortHeader column="ext" label="Ext" className="py-3 px-2 w-[6%]" />
              <th className="py-3 px-2 w-[30%]">Path</th>
            </tr>
          </thead>
          <tbody>
            {files.map(file => (
              <tr
                key={file.path}
                className="border-b border-gray-100 cursor-pointer row-hover"
                onClick={() => onRowClick(file)}
              >
                <td className="py-2.5 px-3 truncate" title={file.name}>
                  <span className="text-[13px] text-gray-800 font-medium">
                    {shortenName(file.name)}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  <div className="flex flex-wrap gap-1">
                    {(file.tags || []).map(tag => (
                      <button
                        type="button"
                        key={tag}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => {
                          e.stopPropagation();
                          onTagClick(tag);
                        }}
                        className="inline-block relative z-10 px-2 py-0.5 text-[11px] font-semibold rounded-full opacity-95 hover:opacity-85 transition capitalize cursor-pointer"
                        style={getTagPillStyle(tag, tagColors)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 px-2 text-[13px] text-gray-600 truncate">
                  {formatDate(file.createdAt)}
                </td>
                <td className="py-2.5 px-2 text-[13px] text-gray-600 truncate">
                  {formatDate(file.indexedAt)}
                </td>
                <td className="py-2.5 px-2 text-[13px] text-gray-600 truncate">
                  {formatSize(file.size)}
                </td>
                <td className="py-2.5 px-2 text-[13px] text-gray-500 truncate">
                  {getExtension(file.name) || '-'}
                </td>
                <td
                  className="py-2.5 px-2 text-[12px] text-gray-400 truncate"
                  title={file.path}
                >
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onOpenLocation(file.path);
                    }}
                    className="truncate max-w-full text-left pathLink"
                    title={file.path}
                  >
                    {file.path}
                  </button>
                </td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td
                  colSpan="7"
                  className="py-16 text-center text-gray-400 text-sm"
                >
                  No files found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition ${
                page === 0
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-300 text-gray-600 pagerBtn'
              }`}
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500 px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition ${
                page >= totalPages - 1
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-300 text-gray-600 pagerBtn'
              }`}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
