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
  'Possibility of using the same items for other project',
  'Necessary of using hardware technologies',
  'Initiation of condemnation of store',
  'Remarks',
  'Attachment',
  'Action',
];

export const modalFields = [
  { label: 'Enter Division Name', placeholder: 'Enter', key: 'division_name' },
  { label: 'Descriptions', placeholder: 'Enter', key: 'descriptions' },
  { label: 'Enter Item', placeholder: 'Enter', key: 'item' },
  { label: 'QTY', placeholder: 'Enter', key: 'qty' },
  { label: 'Previous Procurement date of similar Item', type: 'date', key: 'previous_procurement_date' },
  { label: 'Estimated cost each (in Lac)', placeholder: 'Enter amount', key: 'estimated_cost' },
  { label: 'Demand Indication Months', placeholder: 'Enter Number', key: 'demand_indication_months' },
  { label: 'Build or Project/Misc', placeholder: 'Enter Name', key: 'build_or_project' },
  { label: 'DPP 2020 S No.', placeholder: 'Enter Number', key: 'dpp_number' },
  { label: 'Likely amount of cash Outgo Rs', placeholder: 'Enter Number', key: 'cash_outgo' },
  { label: 'Cash Outgo split amount', placeholder: 'Enter', key: 'cash_outgo_split' },
  { label: 'Existing Stock', placeholder: 'Enter Number', key: 'existing_stock' },
  { label: 'Whether Common TDCC Possible', placeholder: 'Enter Yes/ No', key: 'common_tdcc' },
  { label: 'Possibility of using the same items for other project', placeholder: 'Enter Yes/ No', key: 'cross_project_use' },
  { label: 'Necessary of using hardware technologies', placeholder: 'Enter Yes/ No', key: 'hardware_need' },
  { label: 'Initiation of condemnation of store', placeholder: 'Enter Yes/ No', key: 'condemnation' },
  { label: 'Remarks', placeholder: 'Enter remarks', key: 'remarks', multiline: true },
];

export const defaultFormState = Object.fromEntries(modalFields.map((field) => [field.key, '']));
