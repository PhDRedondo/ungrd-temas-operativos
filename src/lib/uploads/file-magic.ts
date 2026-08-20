/**
 * Validación de firmas binarias (magic numbers) para uploads Excel.
 */

export function isZipOoxml(buf: Buffer): boolean {
  // XLSX / OOXML = ZIP: PK\x03\x04 (o variantes de firma ZIP)
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
    (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  );
}

export function isOleCompound(buf: Buffer): boolean {
  // XLS legado (OLE Compound File)
  return (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1
  );
}

export function looksLikeExcelBuffer(buf: Buffer, fileName: string): boolean {
  const name = fileName.toLowerCase();
  if (name.endsWith(".xlsx")) return isZipOoxml(buf);
  if (name.endsWith(".xls")) return isOleCompound(buf) || isZipOoxml(buf);
  return false;
}
