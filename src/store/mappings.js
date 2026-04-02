// ─── Shared DB ↔ JS field mappings ───────────────────────────────────────────

export const mapToDb = (data, mapping) => {
  const result = {};
  for (const key in data) {
    result[mapping[key] || key] = data[key];
  }
  return result;
};

export const mapFromDb = (data, mapping) => {
  const result = {};
  const reverseMapping = Object.fromEntries(
    Object.entries(mapping).map(([k, v]) => [v, k])
  );
  for (const key in data) {
    result[reverseMapping[key] || key] = data[key];
  }
  return result;
};

export const productMapping  = { minStock: 'min_stock', imageUrl: 'image_url', costPrice: 'cost_price' };
export const cycleMapping    = { startTime: 'start_time', endTime: 'end_time', startStock: 'start_stock', endStock: 'end_stock', openedBy: 'opened_by', closedBy: 'closed_by' };
export const orderMapping    = { tableNumber: 'table_number', paymentMethod: 'payment_method', cycleId: 'cycle_id' };
export const movementMapping = { productId: 'product_id', productName: 'product_name', cycleId: 'cycle_id' };
export const expenseMapping  = { cycleId: 'cycle_id' };

export const mockTables = Array.from({ length: 12 }, (_, i) => ({
  id: (i + 1).toString(),
  number: i + 1,
  status: 'libre'
}));
