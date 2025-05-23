import * as XLSX from 'xlsx';
import FileSaver from 'file-saver';

/**
 * Excel Export Utility - with Arabic language support
 * This utility provides functions to export data to Excel format with proper 
 * support for Arabic and RTL text directionality.
 */

/**
 * Exports data to Excel file with proper Arabic support
 * @param data Array of objects representing rows of data
 * @param columns Array of column IDs to include in the export
 * @param columnLabels Record mapping column IDs to display labels
 * @param fileName Name for the downloaded file
 * @param sheetName Name for the worksheet (default: "Data")
 */
export const exportToExcel = (
  data: any[],
  columns: string[],
  columnLabels: Record<string, string>,
  fileName: string,
  sheetName = "Data"
) => {
  try {
    // Create worksheet data with only selected columns
    const worksheetData = data.map(item => {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        // Use column label as the key in the Excel file
        const label = columnLabels[col] || col;
        row[label] = item[col];
      });
      return row;
    });

    // Create worksheet object
    const worksheet = XLSX.utils.json_to_sheet(worksheetData, { 
      // Add right-to-left (RTL) property to support Arabic
      RTL: true
    });

    // Set right-to-left (RTL) for worksheet
    if (!worksheet['!cols']) worksheet['!cols'] = [];
    columns.forEach((_, i) => {
      if (!worksheet['!cols']) worksheet['!cols'] = [];
      // Set column properties for better Arabic support
      worksheet['!cols'][i] = { wch: 20 }; // Width of 20 characters
    });

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Set RTL property for workbook (for Excel to recognize Arabic correctly)
    workbook.Workbook = {
      Views: [{ RTL: true }]
    };

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Convert to binary and save
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    FileSaver.saveAs(blob, fileName);
    
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return false;
  }
};

/**
 * Prepares column labels map for export
 * @param columns Array of column IDs
 * @returns Record mapping column IDs to display labels
 */
export const prepareColumnLabels = (columns: string[]): Record<string, string> => {
  const defaultLabels: Record<string, string> = {
    'full_name': 'Full Name',
    'first_name': 'First Name',
    'father_name': 'Father Name',
    'last_name': 'Last Name',
    'mother_name': 'Mother Name',
    'register': 'Register',
    'register_sect': 'Register Sect',
    'gender': 'Gender',
    'alliance': 'Alliance',
    'family': 'Family',
    'situation': 'Situation',
    'sect': 'Sect',
    'comments': 'Comments',
    'has_voted': 'Has Voted',
    'voting_time': 'Voting Time',
    'score_from_female': 'Female Votes',
    'score_from_male': 'Male Votes',
    'list_name': 'List Name',
    'candidate_of': 'Candidate Of',
    'WITH_FLAG': 'With',
    'AGAINST': 'Against',
    'N': 'N',
    'N_PLUS': 'N+',
    'N_MINUS': 'N-',
    'DEATH': 'Death',
    'IMMIGRANT': 'Immigrant', 
    'MILITARY': 'Military',
    'NO_VOTE': 'No Vote',
    'UNKNOWN': 'Unknown'
  };
  
  const labels: Record<string, string> = {};
  columns.forEach(col => {
    labels[col] = defaultLabels[col] || col;
  });
  
  return labels;
};

/**
 * Export table instance data to Excel
 * @param table TanStack Table instance
 * @param columns Array of column IDs to include (or undefined for all visible columns)
 * @param fileName Name for the downloaded file
 * @returns boolean success indicator
 */
export const exportTableToExcel = (table: any, columns?: string[], fileName?: string) => {
  try {
    // Get filtered data from table
    const filteredRows = table.getFilteredRowModel().rows;
    const data = filteredRows.map((row: any) => row.original);
    
    // Get visible columns if no specific columns provided
    const exportColumns = columns || 
      table.getAllColumns()
        .filter((col: any) => col.getIsVisible())
        .map((col: any) => col.id);
    
    // Get column labels
    const columnLabels = prepareColumnLabels(exportColumns);
    
    // Generate default filename if not provided
    const defaultFileName = `export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    // Call export function
    return exportToExcel(
      data,
      exportColumns,
      columnLabels,
      fileName || defaultFileName
    );
  } catch (error) {
    console.error('Error exporting table data to Excel:', error);
    return false;
  }
};

/**
 * Export data directly to Excel with headers and rows
 * @param headers Array of column headers
 * @param rows Array of rows data (array of arrays)
 * @param fileName Name for the downloaded file
 * @returns boolean success indicator
 */
export const exportDataToExcel = (headers: string[], rows: any[][], fileName: string) => {
  try {
    // Convert rows and headers to worksheet data
    const worksheetData = rows.map(row => {
      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index];
      });
      return rowData;
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData, {
      header: headers
    });

    // Set column widths for better display
    const cols = worksheet['!cols'] = worksheet['!cols'] || [];
    headers.forEach((_, i) => {
      cols[i] = { wch: 20 }; // Width of 20 characters
    });

    // Create workbook
    const workbook = XLSX.utils.book_new();
    
        // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

    // Convert to binary and save
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    FileSaver.saveAs(blob, fileName);

    return true;
  } catch (error) {
    console.error('Error exporting data to Excel:', error);
    return false;
  }
};

/**
 * Export table data to Excel with headers and rows directly
 * This is a wrapper around exportDataToExcel for direct use with formatted headers and rows
 * @param headers Array of column headers
 * @param rows Array of rows data (array of arrays)
 * @param fileName Name for the downloaded file
 * @returns boolean success indicator
 */
export const exportTableDataToExcel = exportDataToExcel;