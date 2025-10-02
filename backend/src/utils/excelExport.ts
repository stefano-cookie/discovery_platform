import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  style?: Partial<ExcelJS.Style>;
}

export class ExcelExporter {
  private workbook: ExcelJS.Workbook;
  private worksheet: ExcelJS.Worksheet;

  constructor(sheetName: string = 'Export') {
    this.workbook = new ExcelJS.Workbook();
    this.worksheet = this.workbook.addWorksheet(sheetName);
  }

  /**
   * Imposta le colonne del foglio
   */
  setColumns(columns: ExcelColumn[]) {
    this.worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
      style: col.style
    }));

    // Style header row
    this.worksheet.getRow(1).font = { bold: true, size: 12 };
    this.worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' } // Indigo
    };
    this.worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    this.worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    this.worksheet.getRow(1).height = 25;
  }

  /**
   * Aggiunge righe di dati
   */
  addRows(data: any[]) {
    data.forEach(row => {
      this.worksheet.addRow(row);
    });

    // Auto-filter
    this.worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: this.worksheet.columns.length }
    };

    // Freeze header row
    this.worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];
  }

  /**
   * Applica formattazione alternata alle righe
   */
  applyAlternatingRows() {
    this.worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' } // Gray-50
        };
      }
    });
  }

  /**
   * Applica bordi alle celle
   */
  applyBorders() {
    const borderStyle: Partial<ExcelJS.Border> = {
      style: 'thin',
      color: { argb: 'FFE5E7EB' } // Gray-200
    };

    this.worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: borderStyle,
          left: borderStyle,
          bottom: borderStyle,
          right: borderStyle
        };
      });
    });
  }

  /**
   * Aggiunge una riga di totali
   */
  addTotalRow(totals: { [key: string]: string | number }) {
    const totalRow = this.worksheet.addRow(totals);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' } // Purple-100
    };
  }

  /**
   * Aggiunge metadati in alto (prima dell'header)
   */
  addMetadata(metadata: { label: string; value: string }[]) {
    // Insert rows at top
    metadata.forEach((meta, index) => {
      this.worksheet.insertRow(index + 1, {});
      const row = this.worksheet.getRow(index + 1);
      row.getCell(1).value = meta.label;
      row.getCell(2).value = meta.value;
      row.getCell(1).font = { bold: true };
    });

    // Add empty row
    this.worksheet.insertRow(metadata.length + 1, {});
  }

  /**
   * Genera il buffer del file Excel
   */
  async generate() {
    return await this.workbook.xlsx.writeBuffer();
  }

  /**
   * Salva il file su filesystem
   */
  async saveToFile(filepath: string): Promise<void> {
    await this.workbook.xlsx.writeFile(filepath);
  }
}

/**
 * Helper per formattare valori comuni
 */
export const ExcelFormatters = {
  currency: (value: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  },

  date: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('it-IT');
  },

  datetime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('it-IT');
  },

  yesNo: (value: boolean): string => {
    return value ? 'Sì' : 'No';
  },

  percentage: (value: number): string => {
    return `${value.toFixed(2)}%`;
  }
};