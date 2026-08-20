import ExcelJS from "exceljs";

/** Descarga un .xlsx en el navegador a partir de filas (AOA). */
export async function downloadAoaXlsx(
  sheets: { name: string; rows: (string | number | boolean | null | undefined)[][] }[],
  fileName: string,
) {
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31) || "Hoja");
    for (const row of sheet.rows) {
      ws.addRow(row.map((c) => (c === undefined || c === null ? "" : c)));
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
