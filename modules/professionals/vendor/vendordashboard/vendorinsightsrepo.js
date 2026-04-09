const prisma = require("../../../../config/prisma");

/**
 * All raw DB queries for vendor insights.
 * Called only by vendorinsightsservice.js.
 */

// ── Overview counts ────────────────────────────────────────────────────────

exports.getProductStats = async (vendorId) => {
  const [total, lowStock, outOfStock] = await Promise.all([
    prisma.vendor_products.count({ where: { vendor_id: vendorId } }),
    prisma.vendor_products.count({ where: { vendor_id: vendorId, stock: { gt: 0, lte: 5 } } }),
    prisma.vendor_products.count({ where: { vendor_id: vendorId, stock: 0 } }),
  ]);
  return { total, low_stock: lowStock, out_of_stock: outOfStock };
};

exports.getOrderCounts = async (vendorId) => {
  const rows = await prisma.kit_orders.groupBy({
    by:    ["order_status"],
    where: { vendor_id: vendorId, payment_status: "paid" },
    _count: { id: true },
  });
  const map = Object.fromEntries(rows.map((r) => [r.order_status, r._count.id]));
  return {
    total:               rows.reduce((s, r) => s + r._count.id, 0),
    new_order:           map.new_order           ?? 0,
    in_progress:         map.in_progress         ?? 0,
    ready_for_delivery:  map.ready_for_delivery  ?? 0,
    out_for_delivery:    map.out_for_delivery     ?? 0,
    delivered:           map.delivered            ?? 0,
    cancelled:           map.cancelled            ?? 0,
  };
};

// ── Revenue ────────────────────────────────────────────────────────────────

exports.getRevenueStats = async (vendorId) => {
  // Total revenue from delivered paid orders
  const [delivered, allPaid] = await Promise.all([
    prisma.kit_orders.aggregate({
      where:  { vendor_id: vendorId, payment_status: "paid", order_status: "delivered" },
      _sum:   { total_amount: true },
      _count: { id: true },
    }),
    prisma.kit_orders.aggregate({
      where:  { vendor_id: vendorId, payment_status: "paid" },
      _sum:   { total_amount: true },
    }),
  ]);

  return {
    total_revenue:    parseFloat(delivered._sum.total_amount   ?? 0),
    pending_revenue:  parseFloat(allPaid._sum.total_amount     ?? 0) - parseFloat(delivered._sum.total_amount ?? 0),
    delivered_orders: delivered._count.id,
  };
};

// ── Monthly revenue (last 6 months) ───────────────────────────────────────

exports.getMonthlyRevenue = async (vendorId) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const orders = await prisma.kit_orders.findMany({
    where: {
      vendor_id:      vendorId,
      payment_status: "paid",
      order_status:   "delivered",
      created_at:     { gte: sixMonthsAgo },
    },
    select: { total_amount: true, created_at: true },
  });

  // Group by "YYYY-MM"
  const map = {};
  for (const o of orders) {
    const key = o.created_at.toISOString().slice(0, 7); // "2025-03"
    map[key] = (map[key] ?? 0) + parseFloat(o.total_amount);
  }

  // Build last-6-months array (fill gaps with 0)
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key   = d.toISOString().slice(0, 7);
    const label = d.toLocaleString("default", { month: "short", year: "numeric" }); // "Mar 2025"
    result.push({ month: key, label, revenue: map[key] ?? 0 });
  }
  return result;
};

// ── Top products by units sold ─────────────────────────────────────────────

exports.getTopProducts = async (vendorId, limit = 5) => {
  const rows = await prisma.kit_orders.groupBy({
    by:      ["product_id"],
    where:   { vendor_id: vendorId, payment_status: "paid" },
    _sum:    { quantity: true, total_amount: true },
    _count:  { id: true },
    orderBy: { _sum: { quantity: "desc" } },
    take:    limit,
  });

  if (!rows.length) return [];

  const productIds = rows.map((r) => r.product_id);
  const products   = await prisma.vendor_products.findMany({
    where:  { id: { in: productIds } },
    select: { id: true, product_name: true, product_image: true, selling_price: true, stock: true },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  return rows.map((r) => ({
    product_id:    r.product_id,
    product_name:  productMap[r.product_id]?.product_name  ?? "Unknown",
    product_image: productMap[r.product_id]?.product_image ?? null,
    selling_price: parseFloat(productMap[r.product_id]?.selling_price ?? 0),
    current_stock: productMap[r.product_id]?.stock ?? 0,
    units_sold:    r._sum.quantity    ?? 0,
    orders:        r._count.id,
    revenue:       parseFloat(r._sum.total_amount ?? 0),
  }));
};

// ── Recent orders (last 10) ────────────────────────────────────────────────

exports.getRecentOrders = async (vendorId, limit = 10) => {
  const orders = await prisma.kit_orders.findMany({
    where:   { vendor_id: vendorId },
    orderBy: { created_at: "desc" },
    take:    limit,
    select: {
      id:             true,
      quantity:       true,
      unit_price:     true,
      total_amount:   true,
      order_status:   true,
      payment_status: true,
      delivery_city:  true,
      delivery_state: true,
      created_at:     true,
      vendor_products: { select: { product_name: true, product_image: true } },
      users:           { select: { full_name: true } },
    },
  });

  return orders.map((o) => ({
    order_id:       o.id,
    product_name:   o.vendor_products?.product_name  ?? null,
    product_image:  o.vendor_products?.product_image ?? null,
    customer_name:  o.users?.full_name               ?? null,
    quantity:       o.quantity,
    unit_price:     parseFloat(o.unit_price),
    total_amount:   parseFloat(o.total_amount),
    order_status:   o.order_status,
    payment_status: o.payment_status,
    delivery_city:  o.delivery_city,
    delivery_state: o.delivery_state,
    ordered_at:     o.created_at,
  }));
};

// ── Commission summary from wallet ────────────────────────────────────────

exports.getCommissionSummary = async (professionalId) => {
  const rows = await prisma.commissions.groupBy({
    by:    ["status"],
    where: { professional_id: professionalId },
    _sum:  { commission_amount: true },
  });
  const byStatus = Object.fromEntries(
    rows.map((r) => [r.status, parseFloat(r._sum.commission_amount ?? 0)])
  );
  return {
    pending:  (byStatus.on_hold ?? 0) + (byStatus.pending ?? 0),
    approved: byStatus.approved ?? 0,
    paid:     byStatus.paid     ?? 0,
    total:    Object.values(byStatus).reduce((s, v) => s + v, 0),
  };
};

// ── Category breakdown ─────────────────────────────────────────────────────

exports.getCategoryBreakdown = async (vendorId) => {
  const rows = await prisma.kit_orders.groupBy({
    by:    ["product_id"],
    where: { vendor_id: vendorId, payment_status: "paid" },
    _sum:  { quantity: true, total_amount: true },
  });

  if (!rows.length) return [];

  const productIds = rows.map((r) => r.product_id);
  const products   = await prisma.vendor_products.findMany({
    where:  { id: { in: productIds } },
    select: { id: true, sports_category: true },
  });
  const categoryMap = Object.fromEntries(products.map((p) => [p.id, p.sports_category]));

  const byCategory = {};
  for (const r of rows) {
    const cat = categoryMap[r.product_id] ?? "Other";
    if (!byCategory[cat]) byCategory[cat] = { units_sold: 0, revenue: 0 };
    byCategory[cat].units_sold += r._sum.quantity     ?? 0;
    byCategory[cat].revenue   += parseFloat(r._sum.total_amount ?? 0);
  }

  return Object.entries(byCategory)
    .map(([category, stats]) => ({ category, ...stats }))
    .sort((a, b) => b.revenue - a.revenue);
};
