const repo = require("./vendordashboardrepo");

// ── Resolve vendor identity from JWT userId ────────────────────────────────
const resolveVendor = async (userId) => {
    const vendor = await repo.findVendorByUserId(userId);
    if (!vendor) throw new Error("Vendor profile not found for this user.");
    return vendor;
};

// ── Add Product ────────────────────────────────────────────────────────────
exports.addProduct = async (userId, data) => {
    if (!data.productName)    throw new Error("productName is required.");
    if (!data.sportsCategory) throw new Error("sportsCategory is required.");
    if (!data.price)          throw new Error("price is required.");
    if (!data.sellingPrice)   throw new Error("sellingPrice is required.");
    if (data.stock === undefined || data.stock === null) throw new Error("stock is required.");
    if (data.withinCityCharge   === undefined || data.withinCityCharge   === null) throw new Error("withinCityCharge is required.");
    if (data.withinStateCharge  === undefined || data.withinStateCharge  === null) throw new Error("withinStateCharge is required.");
    if (data.outsideStateCharge === undefined || data.outsideStateCharge === null) throw new Error("outsideStateCharge is required.");
    if (!data.ageGroups || !Array.isArray(data.ageGroups) || data.ageGroups.length === 0) throw new Error("ageGroups is required and must be a non-empty array.");

    const validAgeGroups = ["under_6", "6_to_10", "11_to_14", "15_to_18", "adult"];
    const invalid = data.ageGroups.filter(g => !validAgeGroups.includes(g));
    if (invalid.length) throw new Error(`Invalid age group(s): ${invalid.join(", ")}. Allowed: ${validAgeGroups.join(", ")}.`);

    const { vendorId } = await resolveVendor(userId);
    const product = await repo.insertProduct(data, vendorId);
    return { success: true, data: product };
};

// ── Get All Products ───────────────────────────────────────────────────────
exports.getProducts = async (userId) => {
    const { vendorId } = await resolveVendor(userId);
    const products = await repo.getProductsByVendor(vendorId);
    return { success: true, total: products.length, data: products };
};

// ── Get Single Product ─────────────────────────────────────────────────────
exports.getProductById = async (userId, productId) => {
    const { vendorId } = await resolveVendor(userId);
    const product = await repo.getProductById(productId, vendorId);
    if (!product) throw new Error("Product not found.");
    return { success: true, data: product };
};

// ── Update Product ─────────────────────────────────────────────────────────
exports.updateProduct = async (userId, productId, data) => {
    const { vendorId } = await resolveVendor(userId);
    const existing = await repo.getProductById(productId, vendorId);
    if (!existing) throw new Error("Product not found.");
    await repo.updateProduct(productId, vendorId, data);
    return { success: true, message: "Product updated successfully." };
};

// ── Public: Get All Products ───────────────────────────────────────────────
exports.getAllProductsPublic = async (sportsCategory) => {
    const products = await repo.getAllProductsPublic(sportsCategory);
    return { success: true, total: products.length, data: products };
};

// ── Delete Product ─────────────────────────────────────────────────────────
exports.deleteProduct = async (userId, productId) => {
    const { vendorId } = await resolveVendor(userId);
    const existing = await repo.getProductById(productId, vendorId);
    if (!existing) throw new Error("Product not found.");
    await repo.deleteProduct(productId, vendorId);
    return { success: true, message: "Product deleted successfully." };
};
