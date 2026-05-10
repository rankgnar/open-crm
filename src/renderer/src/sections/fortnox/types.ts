export interface FortnoxInvoiceSummary {
  '@url': string
  Balance: number
  Booked: boolean
  Cancelled: boolean
  Currency: string
  CustomerName: string
  CustomerNumber: string
  DocumentNumber: number
  DueDate: string
  ExternalInvoiceReference1: string
  ExternalInvoiceReference2: string
  InvoiceDate: string
  InvoiceType: string
  NoxFinans: boolean
  OCR: string
  OurReference: string
  Project: string
  Sent: boolean
  Total: number
  WayOfDelivery: string
  YourOrderNumber: string
  YourReference: string
  NotCompleted: boolean
  Credit: boolean
}

export interface FortnoxInvoiceRow {
  AccountNumber: number
  ArticleNumber: string
  CostCenter: string
  DeliveredQuantity: number
  Description: string
  Discount: number
  DiscountType: 'AMOUNT' | 'PERCENT'
  HouseWork: boolean
  HouseWorkHoursToReport: number
  HouseWorkType: string
  Price: number
  Project: string
  RowId: number
  Total: number
  Unit: string
  VAT: number
}

export interface FortnoxInvoice extends FortnoxInvoiceSummary {
  Address1: string
  Address2: string
  City: string
  ZipCode: string
  Country: string
  DeliveryAddress1: string
  DeliveryAddress2: string
  DeliveryCity: string
  DeliveryZipCode: string
  DeliveryDate: string
  Freight: number
  Gross: number
  InvoiceRows: FortnoxInvoiceRow[]
  Net: number
  Remarks: string
  RoundOff: number
  TermsOfPayment: string
  TotalVAT: number
  VATIncluded: boolean
}

export interface FortnoxSupplierInvoiceSummary {
  '@url': string
  Balance: number
  Booked: boolean
  Cancelled: boolean
  Credit: boolean
  Currency: string
  DueDate: string
  GivenNumber: number
  InvoiceDate: string
  InvoiceNumber: string
  SupplierName: string
  SupplierNumber: string
  Total: number
  VAT: number
}

export interface FortnoxSupplierInvoice extends FortnoxSupplierInvoiceSummary {
  Comments: string
  CostCenter: string
  OurReference: string
  Project: string
  SupplierInvoiceRows: Array<{
    Account: number
    Description: string
    Debit: number
    Credit: number
    Total: number
    VAT: number
  }>
}

export interface FortnoxCustomer {
  '@url': string
  Address1: string
  Address2: string
  City: string
  CustomerNumber: string
  Email: string
  Name: string
  OrganisationNumber: string
  Phone1: string
  ZipCode: string
  Type: 'PRIVATE' | 'COMPANY'
  Active: boolean
}

export interface FortnoxSupplier {
  '@url': string
  Address1: string
  City: string
  Email: string
  Name: string
  OrganisationNumber: string
  Phone: string
  SupplierNumber: string
  ZipCode: string
}

export interface FortnoxPayment {
  Number: number
  Amount: number
  Booked: boolean
  Currency: string
  InvoiceCustomerName: string
  InvoiceNumber: number
  InvoiceOCR: string
  InvoiceTotal: number
  ModeOfPayment: string
  PaymentDate: string
  Source: string
}

export interface FortnoxSupplierPayment {
  Number: number
  Amount: number
  Booked: boolean
  Currency: string
  InvoiceNumber: number
  InvoiceSupplierName: string
  InvoiceTotal: number
  ModeOfPayment: string
  PaymentDate: string
}

export interface FortnoxArticle {
  '@url': string
  ArticleNumber: string
  Description: string
  EAN: string
  PurchasePrice: number
  SalesPrice: number
  StockGoods: boolean
  Type: 'STOCK' | 'SERVICE'
  Unit: string
  VAT: number
  Active: boolean
}

export interface FortnoxMeta {
  totalResources: number
  totalPages: number
  currentPage: number
}

export interface FortnoxListResult<T> {
  items: T[]
  meta: FortnoxMeta
}

export interface FortnoxInboxFile {
  Id: string
  Name: string
  Path: string
  Size: number
  Mimetype?: string
}


export type FortnoxTab = 'fakturor' | 'lev-fakturor' | 'betalningar' | 'kunder' | 'leverantorer' | 'artiklar'

export type SortOrder = 'ascending' | 'descending'

export interface SortState {
  field: string
  order: SortOrder
}
