const prisma = require("../../../../config/prisma");

// ── Shared ─────────────────────────────────────────────────────────────────
exports.findVendorByUserId = async (userId) => {
    const professional = await prisma.professionals.findFirst({
        where: { user_id: userId },
        select: {
            id: true,
            vendors: { select: { id: true } },
        },
    });
    if (!professional || !professional.vendors.length) return null;
    return { professionalId: professional.id, vendorId: professional.vendors[0].id };
};

// ── Products ───────────────────────────────────────────────────────────────
exports.insertProduct = async (data, vendorId) => {
    return await prisma.vendor_products.create({
        data: {
            vendor_id:            vendorId,
            product_image:        data.productImage ?? null,
            product_name:         data.productName,
            sports_category:      data.sportsCategory,
            price:                parseFloat(data.price),
            selling_price:        parseFloat(data.sellingPrice),
            stock:                parseInt(data.stock, 10),
            description:          data.description ?? null,
            within_city_charge:   parseFloat(data.withinCityCharge),
            within_state_charge:  parseFloat(data.withinStateCharge),
            outside_state_charge: parseFloat(data.outsideStateCharge),
            age_groups:           data.ageGroups ?? [],
        },
    });
};

exports.getProductsByVendor = async (vendorId) => {
    return await prisma.vendor_products.findMany({
        where: { vendor_id: vendorId },
        orderBy: { created_at: "desc" },
    });
};

exports.getProductById = async (productId, vendorId) => {
    return await prisma.vendor_products.findFirst({
        where: { id: productId, vendor_id: vendorId },
    });
};

exports.updateProduct = async (productId, vendorId, data) => {
    return await prisma.vendor_products.updateMany({
        where: { id: productId, vendor_id: vendorId },
        data: {
            ...(data.productImage        !== undefined && { product_image:        data.productImage }),
            ...(data.productName         !== undefined && { product_name:         data.productName }),
            ...(data.sportsCategory      !== undefined && { sports_category:      data.sportsCategory }),
            ...(data.price               !== undefined && { price:                parseFloat(data.price) }),
            ...(data.sellingPrice        !== undefined && { selling_price:        parseFloat(data.sellingPrice) }),
            ...(data.stock               !== undefined && { stock:                parseInt(data.stock, 10) }),
            ...(data.description         !== undefined && { description:          data.description }),
            ...(data.withinCityCharge    !== undefined && { within_city_charge:   parseFloat(data.withinCityCharge) }),
            ...(data.withinStateCharge   !== undefined && { within_state_charge:  parseFloat(data.withinStateCharge) }),
            ...(data.outsideStateCharge  !== undefined && { outside_state_charge: parseFloat(data.outsideStateCharge) }),
            ...(data.ageGroups           !== undefined && { age_groups:           data.ageGroups }),
        },
    });
};

exports.deleteProduct = async (productId, vendorId) => {
    return await prisma.vendor_products.deleteMany({
        where: { id: productId, vendor_id: vendorId },
    });
};

exports.getProductsByIds = async (ids) => {
    return await prisma.vendor_products.findMany({
        where: { id: { in: ids } },
        select: { id: true, product_name: true, selling_price: true },
    });
};

// ── Public ─────────────────────────────────────────────────────────────────
exports.getProductByIdPublic = async (productId) => {
    return await prisma.vendor_products.findFirst({
        where: { id: productId },
    });
};

exports.getAllProductsPublic = async (sportsCategory) => {
    return await prisma.vendor_products.findMany({
        where: {
            ...(sportsCategory && { sports_category: sportsCategory }),
        },
        orderBy: { created_at: "desc" },
    });
};
