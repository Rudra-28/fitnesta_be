const repo = require("./vendorinsightsrepo");
const vendorRepo = require("./vendordashboardrepo");

exports.getInsights = async (userId) => {
  const vendor = await vendorRepo.findVendorByUserId(userId);
  if (!vendor) throw Object.assign(new Error("Vendor profile not found"), { statusCode: 404 });

  const { vendorId, professionalId } = vendor;

  const [
    product_stats,
    order_counts,
    revenue_stats,
    monthly_revenue,
    top_products,
    recent_orders,
    commission_summary,
    category_breakdown,
  ] = await Promise.all([
    repo.getProductStats(vendorId),
    repo.getOrderCounts(vendorId),
    repo.getRevenueStats(vendorId),
    repo.getMonthlyRevenue(vendorId),
    repo.getTopProducts(vendorId, 5),
    repo.getRecentOrders(vendorId, 10),
    repo.getCommissionSummary(professionalId),
    repo.getCategoryBreakdown(vendorId),
  ]);

  return {
    product_stats,
    order_counts,
    revenue_stats,
    monthly_revenue,
    top_products,
    recent_orders,
    commission_summary,
    category_breakdown,
  };
};
