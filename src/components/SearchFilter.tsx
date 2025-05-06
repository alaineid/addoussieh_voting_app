import React, { useMemo } from 'react';

interface SearchFilterProps {
  type: 'text' | 'select';
  column: any;
  table: any;
  options?: string[]; // For select type, provide options
}

const SearchFilter: React.FC<SearchFilterProps> = ({ type, column, table, options = [] }) => {
  const columnFilterValue = column.getFilterValue() ?? '';

  const sortedUniqueValues = useMemo(() => {
    if (type === 'select') {
      // If options are provided, use them instead of extracting from the table
      if (options && options.length > 0) {
        return options;
      }
      
      // Otherwise extract values from the table data
      const values = table.getPreFilteredRowModel().flatRows
        .map((row: any) => row.getValue(column.id))
        .map((v: any) => (v === null || v === undefined || v === '' ? '__EMPTY__' : v));
      const set = new Set(values);
      const arr = Array.from(set);
      return arr.sort((a, b) => {
        if (a === '__EMPTY__') return -1;
        if (b === '__EMPTY__') return 1;
        return String(a).localeCompare(String(b), 'ar', { sensitivity: 'base' });
      });
    }
    return [];
  }, [type, column.id, table.getPreFilteredRowModel().flatRows, options]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    column.setFilterValue(e.target.value);
  };

  if (type === 'text') {
    return (
      <input
        type="text"
        value={columnFilterValue}
        onChange={handleFilterChange}
        placeholder="Filter..."
        className="w-full px-2 py-1 text-xs border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
      />
    );
  }

  if (type === 'select') {
    return (
      <select
        value={columnFilterValue}
        onChange={handleFilterChange}
        className="w-full px-2 py-1 text-xs border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
      >
        <option value="">All</option>
        {sortedUniqueValues.map((value) => (
          <option key={value as string} value={value as string}>
            {value === '__EMPTY__' ? '-' : (value as string)}
          </option>
        ))}
      </select>
    );
  }

  return null;
};

export default SearchFilter;