const prisma = require("../../../config/prisma");

exports.getProductWithVendor = async (productId) => {
    return await prisma.vendor_products.findFirst({
        where: { id: productId },
        include: {
            vendors: {
                include: {
                    professionals: {
                        include: { users: { select: { address: true } } },
                    },
                },
            },
        },
    });
};

exports.createOrder = async (data) => {
    return await prisma.kit_orders.create({
        data: {
            student_user_id:    data.studentUserId,
            product_id:         data.productId,
            vendor_id:          data.vendorId,
            quantity:           data.quantity,
            unit_price:         data.unitPrice,
            delivery_charge:    data.deliveryCharge,
            delivery_zone:      data.deliveryZone,
            total_amount:       data.totalAmount,
            payment_status:     "pending",
            razorpay_order_id:  data.razorpayOrderId,
            delivery_name:      data.deliveryName,
            delivery_phone:     data.deliveryPhone,
            delivery_address:   data.deliveryAddress,
            delivery_city:      data.deliveryCity,
            delivery_state:     data.deliveryState,
            delivery_pincode:   data.deliveryPincode,
        },
    });
};

exports.getOrderById = async (id) => {
    return await prisma.kit_orders.findFirst({ where: { id } });
};

exports.getOrderByRazorpayOrderId = async (razorpayOrderId) => {
    return await prisma.kit_orders.findFirst({
        where: { razorpay_order_id: razorpayOrderId },
    });
};

exports.markOrderPaid = async (orderId, razorpayPaymentId) => {
    return await prisma.kit_orders.update({
        where: { id: orderId },
        data: { payment_status: "paid", razorpay_payment_id: razorpayPaymentId },
    });
};

exports.markOrderFailed = async (orderId) => {
    return await prisma.kit_orders.update({
        where: { id: orderId },
        data: { payment_status: "failed" },
    });
};

exports.updateOrderStatus = async (orderId, vendorId, status) => {
    return await prisma.kit_orders.updateMany({
        where: { id: orderId, vendor_id: vendorId },
        data:  { order_status: status },
    });
};

exports.getOrderByIdForVendor = async (orderId, vendorId) => {
    return await prisma.kit_orders.findFirst({
        where: { id: orderId, vendor_id: vendorId },
    });
};

// ── Vendor side ────────────────────────────────────────────────────────────
exports.getOrdersByVendor = async (vendorId) => {
    return await prisma.kit_orders.findMany({
        where: { vendor_id: vendorId },
        orderBy: { created_at: "desc" },
        include: {
            vendor_products: {
                select: { product_name: true, sports_category: true, age_groups: true, product_image: true },
            },
            users: {
                select: {
                    id:        true,
                    full_name: true,
                    mobile:    true,
                    email:     true,
                    address:   true,
                    photo:     true,
                    students:  { select: { id: true, student_type: true } },
                },
            },
        },
    });
};
