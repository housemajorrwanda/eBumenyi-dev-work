/* eslint-disable @typescript-eslint/no-explicit-any */
import { FC, ReactElement, ReactNode, useEffect, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from "@heroicons/react/20/solid";
import SyncLoader from "react-spinners/SyncLoader";

export interface TableFilterDef {
  key: string;
  label?: string;
  type?: "select" | "date";
  options?: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  renderFilter?: ReactNode;
}

export interface TableColumn {
  title: string;
  key: string;
  render?: (row: any) => React.ReactNode;
  sortable?: boolean;
}

export interface TableProps {
  columns: TableColumn[];
  data: Array<any>;
  totalItems?: number;
  currentPage?: number;
  itemsPerPage?: number;
  filtersComponent?: ReactNode;
  headerComponent?: ReactNode;
  actionBtn?: ReactNode | ReactElement;
  searchComponent?: ReactNode | ReactElement;
  allowFilter?: boolean;
  searchFun?: (searchq: string) => void;
  isLoading?: boolean;
  onChangePage?: (page: number) => void;
  hideFilters?: boolean;
  position?: string;
  paginate?: boolean;
  
  // New features
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  currentSortKey?: string;
  currentSortOrder?: "asc" | "desc";
  rowsPerPageOptions?: number[];
  onRowsPerPageChange?: (limit: number) => void;
  filters?: TableFilterDef[];
  onResetFilters?: () => void;
}

const Table: FC<TableProps> = ({
  columns,
  data,
  currentPage = 1,
  totalItems = data.length,
  itemsPerPage = 15,
  filtersComponent,
  actionBtn,
  allowFilter = true,
  searchFun,
  isLoading,
  searchComponent,
  onChangePage,
  position,
  headerComponent,
  paginate = true,
  selectable = false,
  onSelectionChange,
  onSort,
  currentSortKey,
  currentSortOrder,
  rowsPerPageOptions = [10, 15, 30, 50, 100],
  onRowsPerPageChange,
  filters,
  onResetFilters,
}) => {
  const [searchText, setSearchText] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showPagination = paginate ? totalItems > 0 : false;
  const startPage = Math.max(1, currentPage - 2);
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const endPage = Math.min(totalPages, Math.max(1, startPage + 2));

  const handleTableSearch = (searchq: string) => {
    setSearchText(searchq);
  };

  useEffect(() => {
    const handleSearch = setTimeout(() => {
      if (searchFun && searchText !== undefined) {
        searchFun(searchText);
      }
    }, 300);
    return () => clearTimeout(handleSearch);
  }, [searchText, searchFun]);

  // Handle row selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map((r, i) => r.id || i.toString());
      setSelectedIds(new Set(allIds));
      if (onSelectionChange) onSelectionChange(allIds);
    } else {
      setSelectedIds(new Set());
      if (onSelectionChange) onSelectionChange([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
    if (onSelectionChange) onSelectionChange(Array.from(newSet));
  };

  const allSelected = data.length > 0 && selectedIds.size === data.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < data.length;

  const handleSortClick = (columnKey: string) => {
    if (!onSort) return;
    if (currentSortKey === columnKey) {
      // Toggle
      onSort(columnKey, currentSortOrder === "asc" ? "desc" : "asc");
    } else {
      onSort(columnKey, "asc");
    }
  };

  return (
    <div className='rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden'>
      <div className='p-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        {/* Left side: Search & Inline Filters */}
        <div className='flex flex-wrap items-center gap-3 w-full lg:w-auto'>
          {searchComponent}
          {searchFun && (
            <div className='relative rounded-lg shadow-sm w-full sm:w-auto sm:min-w-[240px]'>
              <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3'>
                <MagnifyingGlassIcon className='w-4 text-gray-400' />
              </div>
              <input
                type='text'
                value={searchText}
                onChange={(e) => handleTableSearch(e.target.value)}
                className='block w-full rounded-lg border-0 py-2 pl-9 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-[#3363AD] sm:text-sm sm:leading-6'
                placeholder='Search CHWs...'
              />
            </div>
          )}
          
          {/* Dynamic Filters Array */}
          {filters && filters.length > 0 && (
            <div className='flex flex-wrap items-center gap-2'>
              {filters.map((f) => {
                if (f.renderFilter) {
                  return <div key={f.key} className='min-w-[160px]'>{f.renderFilter}</div>;
                }
                if (f.type === "date") {
                  return (
                    <div key={f.key} className='flex items-center gap-1.5'>
                      <label className='text-xs text-gray-500 whitespace-nowrap'>{f.label}</label>
                      <input
                        type='date'
                        value={f.value}
                        onChange={(e) => f.onChange(e.target.value)}
                        className='border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-600 outline-none focus:border-[#3363AD]'
                      />
                    </div>
                  );
                }
                return (
                  <select
                    key={f.key}
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    className='border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-600 outline-none focus:border-[#3363AD]'
                  >
                    <option value=''>{f.label}</option>
                    {f.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                );
              })}
            </div>
          )}

          {headerComponent}
          {allowFilter && filtersComponent && (
            <div className='flex items-center gap-2'>
              {filtersComponent}
            </div>
          )}

          {onResetFilters && (searchText || (filters && filters.some(f => f.value))) && (
             <button 
                onClick={() => {
                  setSearchText("");
                  onResetFilters();
                }} 
                className="text-[#3363AD] text-sm font-medium hover:underline px-2 whitespace-nowrap"
              >
                Reset Filters
              </button>
          )}
        </div>
        
        {/* Right side: Actions */}
        <div className='flex items-center gap-3 justify-end'>
          {actionBtn}
        </div>
      </div>

      <div className='relative w-full overflow-x-auto'>
        {isLoading && (
          <div className='absolute inset-0 bg-white/60 z-10 flex justify-center items-center backdrop-blur-[1px]'>
            <SyncLoader color='#3363AD' size={10} />
          </div>
        )}

        {data.length > 0 ? (
          <table className='w-full text-sm text-left text-gray-600'>
            <thead className='text-xs text-gray-500 bg-white border-b border-gray-100'>
              <tr>
                {selectable && (
                  <th scope='col' className='px-6 py-4 w-12'>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={input => {
                          if (input) input.indeterminate = someSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-[#3363AD] bg-white border-gray-300 rounded focus:ring-[#3363AD] cursor-pointer"
                      />
                    </div>
                  </th>
                )}
                {columns.map((column, columnIndex) => (
                  <th 
                    key={columnIndex} 
                    scope='col' 
                    className={`px-6 py-4 font-medium tracking-wide ${column.sortable ? 'cursor-pointer hover:bg-gray-50 transition-colors group' : ''}`}
                    onClick={() => column.sortable && handleSortClick(column.key)}
                  >
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {column.title}
                      {column.sortable && (
                        <span className="text-gray-400 group-hover:text-gray-600 flex-shrink-0">
                          {currentSortKey === column.key ? (
                            currentSortOrder === 'asc' ? <ArrowUpIcon className="w-3.5 h-3.5 text-[#3363AD]" /> : <ArrowDownIcon className="w-3.5 h-3.5 text-[#3363AD]" />
                          ) : (
                            <ArrowsUpDownIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((row, rowIndex) => {
                const rowId = row.id || rowIndex.toString();
                const isSelected = selectedIds.has(rowId);
                return (
                  <tr 
                    key={rowId} 
                    className={`bg-white hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}
                  >
                    {selectable && (
                      <td className='px-6 py-3 w-12'>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                            className="w-4 h-4 text-[#3363AD] bg-white border-gray-300 rounded focus:ring-[#3363AD] cursor-pointer"
                          />
                        </div>
                      </td>
                    )}
                    {columns.map((column, cellIndex) => (
                      <td className='px-6 py-3' key={cellIndex}>
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className='p-12 text-center text-gray-500'>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
              <FunnelIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className='text-lg font-medium text-gray-900'>No data found</h2>
            <p className="mt-1">Try adjusting your search or filters to find what you're looking for.</p>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {showPagination && data.length > 0 && (
        <div className='px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4'>
          <div className="flex items-center text-sm text-gray-500 whitespace-nowrap">
            <span>
              Showing <span className="font-medium text-gray-900">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> to <span className="font-medium text-gray-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-medium text-gray-900">{totalItems}</span>
            </span>
          </div>

          <div className="flex items-center gap-6">
            {onRowsPerPageChange && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                <label htmlFor="rows-per-page">Rows per page</label>
                <select
                  id="rows-per-page"
                  value={itemsPerPage}
                  onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                  className="rounded border-gray-200 text-gray-700 text-sm py-1 pl-2 pr-6 focus:ring-[#3363AD] focus:border-[#3363AD] outline-none"
                >
                  {rowsPerPageOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            <nav className='flex items-center gap-1'>
              <button
                onClick={() => onChangePage && currentPage > 1 && onChangePage(currentPage - 1)}
                disabled={currentPage === 1}
                className='p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent transition-colors'
              >
                <ChevronLeftIcon className='w-5 h-5' />
              </button>

              {startPage > 1 && (
                <>
                  <button
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors ${currentPage === 1 ? 'bg-[#3363AD] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => onChangePage && onChangePage(1)}
                  >
                    1
                  </button>
                  {startPage > 2 && <span className="px-1 text-gray-400">...</span>}
                </>
              )}

              {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                const pg = startPage + i;
                const isActive = pg === currentPage;
                return (
                  <button
                    key={pg}
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors ${isActive ? 'bg-[#3363AD] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => onChangePage && onChangePage(pg)}
                  >
                    {pg}
                  </button>
                );
              })}

              {endPage < totalPages && (
                <>
                  {endPage < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
                  <button
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors ${currentPage === totalPages ? 'bg-[#3363AD] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => onChangePage && onChangePage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                onClick={() => onChangePage && currentPage < totalPages && onChangePage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className='p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent transition-colors'
              >
                <ChevronRightIcon className='w-5 h-5' />
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
