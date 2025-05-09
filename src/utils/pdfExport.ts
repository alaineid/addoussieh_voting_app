import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { amiriRegularBase64 } from '../assets/fonts/Amiri-Regular-normal';

/**
 * PDF Export Utility - with Arabic language support
 * This utility provides functions to export data to PDF format with proper 
 * support for Arabic text rendering.
 */

/**
 * Initialize a PDF document with Arabic font support
 * @param orientation PDF orientation ('portrait' or 'landscape')
 * @returns jsPDF document with Arabic font configured
 */
export const createPDFWithArabicSupport = (orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF => {
  const pdf = new jsPDF(orientation);
  
  // Add the Amiri font for Arabic support
  pdf.addFileToVFS('Amiri-Regular.ttf', amiriRegularBase64);
  pdf.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  pdf.setFont('Amiri');
  
  return pdf;
};

/**
 * Add a standard header to the PDF document
 * @param pdf jsPDF document
 * @param title Title of the report
 * @param extraDetails Optional array of extra detail strings to add below title
 */
export const addPDFHeader = (pdf: jsPDF, title: string, extraDetails: string[] = []): number => {
  // Add title
  pdf.setFontSize(16);
  pdf.text(title, 14, 15);
  
  // Add timestamp
  const now = new Date();
  pdf.setFontSize(10);
  pdf.text(
    `Generated on: ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`, 
    14, 22
  );

  // Add any extra details
  let verticalPosition = 27;
  extraDetails.forEach(detail => {
    pdf.text(detail, 14, verticalPosition);
    verticalPosition += 5;
  });

  // Return the current vertical position for further content
  return verticalPosition + 3;
};

/**
 * Generate a PDF with a table and save it
 * @param headers Table headers
 * @param rows Table rows data
 * @param title PDF document title
 * @param fileName Output file name
 * @param orientation PDF orientation ('portrait' or 'landscape')
 * @param extraDetails Optional extra details to show below title
 * @returns The generated PDF document
 */
export const generatePDFWithTable = (
  headers: string[], 
  rows: (string | number)[][], 
  title: string, 
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'landscape',
  extraDetails: string[] = []
): jsPDF => {
  // Create PDF with Arabic support
  const pdf = createPDFWithArabicSupport(orientation);
  
  // Add header content
  const startY = addPDFHeader(pdf, title, extraDetails);
  
  // Add table with data
  autoTable(pdf, {
    head: [headers],
    body: rows.map(row => row.map(cell => String(cell))), // Ensure all cells are strings
    startY,
    headStyles: { fillColor: [41, 128, 185], textColor: 255, font: 'Amiri' },
    bodyStyles: { font: 'Amiri', fontSize: 9 },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    margin: { top: startY }
  });
  
  // Save the PDF
  pdf.save(fileName);
  
  return pdf;
};

/**
 * Export data directly to PDF with headers and rows
 * @param headers Array of column headers
 * @param rows Array of rows data (array of arrays)
 * @param title Title for the PDF document
 * @param fileName Name for the downloaded file
 * @param orientation PDF orientation ('portrait' or 'landscape')
 * @param extraDetails Optional extra details to show below title
 * @returns boolean success indicator
 */
export const exportDataToPDF = (
  headers: string[],
  rows: (string | number)[][], 
  title: string,
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'landscape',
  extraDetails: string[] = []
): boolean => {
  try {
    generatePDFWithTable(headers, rows, title, fileName, orientation, extraDetails);
    return true;
  } catch (error) {
    console.error('Error exporting data to PDF:', error);
    return false;
  }
};

/**
 * Format a date value for consistent display in exports
 * @param dateString Date string to format
 * @returns Formatted date string as DD/MM/YYYY
 */
export const formatDateForExport = (dateString: string | null): string => {
  if (!dateString) return '-';
  
  // Parse the date - add time to avoid timezone issues
  try {
    const date = new Date(`${dateString}T12:00:00Z`);
    
    // Format as DD/MM/YYYY
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString; // Return original if parsing fails
  }
};