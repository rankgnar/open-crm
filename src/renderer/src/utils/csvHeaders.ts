// Maps CSV column names (lowercase) to our internal column names.
// Empty string = column is ignored/skipped.
// Pass to parseCsv() as the headerMap argument.

export const LEVERANTORER_HEADERS: Record<string, string> = {
  leverantorsnr: '',
  namn: 'namn',
  org_personnr: 'org_nummer',
  postnr: '',
  ort: '',
  land: '',
  telefon: 'telefon',
  'e-post': 'email',
}
