export const filterOptions = {
  type: [
    { value: 'all', label: 'All Types' },
    { value: 'hardware', label: 'Hardware' },
    { value: 'software', label: 'Software' },
    { value: 'services', label: 'Services' },
  ],
  sort: [
    { value: 'none', label: 'None' },
    { value: 'asc', label: 'A to Z' },
    { value: 'desc', label: 'Z to A' },
  ],
};

export const fiscalYearOptions = ['2023-24', '2024-25', '2025-26', '2026-27', '2027-28'];

export const forecastColumns = (cashSplitLabel) => [
  'Sl. No.',
  'Division name',
  'Item',
  'Item Descriptions',
  'QTY',
  'Existing Stock',
  'Previous Procurement date of similar Item',
  'Estimated cost each',
  'Likely amount of cash Outgo Rs',
  `Cash Outgo split over ${cashSplitLabel}`,
  'Whether Common TDCC Possible',
  'Reusability for other projects',
  'Necessary of using hardware technologies',
  'Initiation of condemnation of store',
  'capital_or_revenue',
  'Remarks',
  'Attachment',
  'Action',
];

export const modalFields = [
  { label: 'Enter Division Name', placeholder: 'Enter Division Name', key: 'division_name' },
  { label: 'Descriptions', placeholder: 'Write descriptions', key: 'descriptions' },
  { label: 'Enter Item', placeholder: 'Enter item', key: 'item' },
  { label: 'QTY', placeholder: 'Enter qty', key: 'qty' },
  { label: 'Existing Stock', placeholder: 'Enter Number', key: 'existing_stock' },
  { label: 'Previous Procurement date of similar Item', type: 'date', key: 'previous_procurement_date' },
  { label: 'Estimated cost each (in Lac)', placeholder: 'Enter amount', key: 'estimated_cost' },
  { label: 'Demand Indication Months', placeholder: 'Enter Number', key: 'demand_indication_months' },
  // for the revenue / capital 
  { label: "Capital/Revenue", placeholder: "Enter Capital or revenue", key: 'capital_or_revenue' },
  { label: 'Build or Project/Misc', placeholder: 'Enter Name', key: 'build_or_project' },
  { label: 'DPP 2020 S No.', placeholder: 'Enter Number', key: 'dpp_number' },
  { label: 'Likely amount of cash Outgo Rs', placeholder: 'Enter Number', key: 'cash_outgo' },
  { label: 'Cash Outgo split amount', placeholder: 'Enter cash outgo split amount', key: 'cash_outgo_split' },
  
  { label: 'Whether Common TDCC Possible', placeholder: 'Enter Yes/ No', key: 'common_tdcc' },
  { label: 'Reusability for other projects', placeholder: 'Enter Yes/ No', key: 'cross_project_use' },
  { label: 'Necessary of using hardware technologies', placeholder: 'Enter Yes/ No', key: 'hardware_need' },
  { label: 'Initiation of condemnation of store', placeholder: 'Enter Yes/ No', key: 'condemnation' },
  { label: 'Note', placeholder: 'Enter Note', key: 'Note', multiline: true },
];

export const defaultFormState = Object.fromEntries(modalFields.map((field) => [field.key, '']));

export const budgetExportColumns = (cashSplitLabel) => [
  { header: 'Forecast Year', key: 'forecast_year' },
  { header: 'Division name', key: 'division_name' },
  { header: 'Item', key: 'item' },
  { header: 'Item Descriptions', key: 'descriptions' },
  { header: 'QTY', key: 'qty' },
  { header: 'Existing Stock', key: 'existing_stock' },
  {
    header: 'Previous Procurement date of similar Item',
    accessor: (row) =>
      row.previous_procurement_date
        ? new Date(row.previous_procurement_date).toLocaleDateString('en-GB')
        : '',
  },
  { header: 'Estimated cost each', key: 'estimated_cost' },
  { header: 'Likely amount of cash Outgo Rs', key: 'cash_outgo' },
  { header: `Cash Outgo split over ${cashSplitLabel}`, key: 'cash_outgo_split' },
  { header: 'Whether Common TDCC Possible', key: 'common_tdcc' },
  { header: 'Reusability for other projects', key: 'cross_project_use' },
  { header: 'Necessary of using hardware technologies', key: 'hardware_need' },
  { header: 'Initiation of condemnation of store', key: 'condemnation' },
  { header: 'Capital / Revenue', key: 'capital_or_revenue' },

  { header: 'Note', key: 'Note' },
  {
    header: 'Attachment Name',
    accessor: (row) => row.original_name || '',
  },
];
