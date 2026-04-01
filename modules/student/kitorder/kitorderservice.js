const repo       = require("./kitorderrepo");
const { createOrder } = require("../../../utils/razorpay");

// ── Resolve delivery zone by comparing student city/state vs vendor city/state
const resolveZone = (studentCity, studentState, vendorAddress) => {
    // vendorAddress is a free-text field — we do a case-insensitive city/state match
    const addr = (vendorAddress || "").toLowerCase();
    if (addr.includes(studentCity.toLowerCase()))  return "within_city";
    if (addr.includes(studentState.toLowerCase())) return "within_state";
    return "outside_state";
};

const ZONE_CHARGE_MAP = {
    within_city:   "within_city_charge",
    within_state:  "within_state_charge",
    outside_state: "outside_state_charge",
};

// ── Create kit order + Razorpay order ─────────────────────────────────────
exports.createKitOrder = async (studentUserId, body) => {
    const {
        productId, quantity = 1,
        deliveryName, deliveryPhone, deliveryAddress,
        deliveryCity, deliveryState, deliveryPincode,
    } = body;

    if (!productId)       throw new Error("productId is required.");
    if (!deliveryName)    throw new Error("deliveryName is required.");
    if (!deliveryPhone)   throw new Error("deliveryPhone is required.");
    if (!deliveryAddress) throw new Error("deliveryAddress is required.");
    if (!deliveryCity)    throw new Error("deliveryCity is required.");
    if (!deliveryState)   throw new Error("deliveryState is required.");
    if (!deliveryPincode) throw new Error("deliveryPincode is required.");

    const product = await repo.getProductWithVendor(productId);
    if (!product) throw new Error("Product not found.");
    if (product.stock < quantity) throw new Error("Insufficient stock.");

    const vendorAddress = product.vendors?.professionals?.users?.address || "";
    const zone          = resolveZone(deliveryCity, deliveryState, vendorAddress);
    const deliveryCharge = parseFloat(product[ZONE_CHARGE_MAP[zone]]);
    const unitPrice      = parseFloat(product.selling_price);
    const totalAmount    = (unitPrice * quantity) + deliveryCharge;

    const receipt = `kit_${studentUserId}_${Date.now()}`;
    const rzpOrder = await createOrder(totalAmount, receipt, {
        service_type:     "kit_order",
        student_user_id:  String(studentUserId),
        product_id:       String(productId),
    });

    const order = await repo.createOrder({
        studentUserId,
        productId,
        vendorId:        product.vendor_id,
        quantity,
        unitPrice,
        deliveryCharge,
        deliveryZone:    zone,
        totalAmount,
        razorpayOrderId: rzpOrder.id,
        deliveryName,
        deliveryPhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryPincode,
    });

    return {
        success: true,
        data: {
            kit_order_id:     order.id,
            razorpay_order_id: rzpOrder.id,
            amount:           totalAmount,
            currency:         "INR",
            delivery_zone:    zone,
            delivery_charge:  deliveryCharge,
        },
    };
};

// ── Finalize after Razorpay payment verified ───────────────────────────────
exports.finalizeKitOrder = async (razorpayOrderId, razorpayPaymentId) => {
    const order = await repo.getOrderByRazorpayOrderId(razorpayOrderId);
    if (!order) throw new Error("Kit order not found for this razorpay_order_id.");
    if (order.payment_status === "paid") return;
    await repo.markOrderPaid(order.id, razorpayPaymentId);
};

// ── Vendor: Update order status ───────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
    new_order:          ["in_progress", "rejected"],
    in_progress:        ["ready_for_delivery"],
    ready_for_delivery: ["out_for_delivery"],
    out_for_delivery:   ["completed"],
};

exports.updateOrderStatus = async (vendorId, orderId, newStatus) => {
    const order = await repo.getOrderByIdForVendor(orderId, vendorId);
    if (!order) throw new Error("Order not found.");
    if (order.payment_status !== "paid") throw new Error("Cannot update status on an unpaid order.");

    const allowed = ALLOWED_TRANSITIONS[order.order_status] || [];
    if (!allowed.includes(newStatus)) {
        throw new Error(`Cannot move order from "${order.order_status}" to "${newStatus}".`);
    }

    await repo.updateOrderStatus(orderId, vendorId, newStatus);
    return { success: true, message: `Order status updated to "${newStatus}".` };
};

// ── DEV ONLY: Instantly mark order as paid ────────────────────────────────
exports.devFinalizeKitOrder = async (kitOrderId) => {
    const order = await repo.getOrderById(kitOrderId);
    if (!order) throw new Error("Kit order not found.");
    if (order.payment_status === "paid") return { alreadyPaid: true };
    await repo.markOrderPaid(order.id, `dev_pay_${Date.now()}`);
    return { alreadyPaid: false };
};
