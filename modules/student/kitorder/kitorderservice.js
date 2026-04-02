const crypto       = require("crypto");
const repo         = require("./kitorderrepo");
const paymentsRepo = require("../../payments/paymentsrepo");
const { createOrder } = require("../../../utils/razorpay");

const VALID_ZONES = ["within_city", "within_state", "outside_state"];

const ZONE_CHARGE_MAP = {
    within_city:   "within_city_charge",
    within_state:  "within_state_charge",
    outside_state: "outside_state_charge",
};

// ── PHASE 1: Park order data + create Razorpay order ─────────────────────────
exports.initiateKitOrder = async (studentUserId, body) => {
    const {
        productId, quantity = 1,
        deliveryZone,                   // user-selected zone from dropdown
        deliveryName, deliveryPhone, deliveryAddress,
        deliveryCity, deliveryState, deliveryPincode,
        ageGroup,
    } = body;

    if (!productId)       throw new Error("productId is required.");
    if (!deliveryZone)    throw new Error("deliveryZone is required.");
    if (!VALID_ZONES.includes(deliveryZone)) throw new Error(`Invalid deliveryZone. Must be one of: ${VALID_ZONES.join(", ")}`);
    if (!deliveryName)    throw new Error("deliveryName is required.");
    if (!deliveryPhone)   throw new Error("deliveryPhone is required.");
    if (!deliveryAddress) throw new Error("deliveryAddress is required.");
    if (!deliveryCity)    throw new Error("deliveryCity is required.");
    if (!deliveryState)   throw new Error("deliveryState is required.");
    if (!deliveryPincode) throw new Error("deliveryPincode is required.");
    if (!ageGroup)        throw new Error("ageGroup is required.");

    const product = await repo.getProductWithVendor(productId);
    if (!product) throw new Error("Product not found.");
    if (product.stock < quantity) throw new Error("Insufficient stock.");

    const deliveryCharge = parseFloat(product[ZONE_CHARGE_MAP[deliveryZone]]);
    const unitPrice      = parseFloat(product.selling_price);
    const totalAmount    = (unitPrice * quantity) + deliveryCharge;

    const tempUuid = crypto.randomUUID();

    const rzpOrder = await createOrder(totalAmount, tempUuid, {
        temp_uuid:        tempUuid,
        service_type:     "kit_order",
        student_user_id:  String(studentUserId),
        product_id:       String(productId),
    });

    // Park everything — no kit_orders row yet
    await repo.insertPendingKitOrder(tempUuid, {
        studentUserId,
        productId,
        vendorId:          product.vendor_id,
        quantity,
        unitPrice,
        deliveryCharge,
        deliveryZone,
        kitOrderZoneUser:  deliveryZone,   // what the user explicitly selected
        totalAmount,
        razorpayOrderId:   rzpOrder.id,
        deliveryName,
        deliveryPhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryPincode,
        ageGroup,
    });

    return {
        success: true,
        data: {
            temp_uuid:         tempUuid,
            razorpay_order_id: rzpOrder.id,
            amount:            totalAmount,
            currency:          "INR",
            delivery_zone:     deliveryZone,
            delivery_charge:   deliveryCharge,
            unit_price:        unitPrice,
            quantity,
            key_id:            process.env.RAZORPAY_KEY_ID,
        },
    };
};

// ── PHASE 2: Finalize after payment verified ──────────────────────────────────
exports.finalizeRegistration = async (tempUuid, razorpayPaymentId, _amount) => {
    const pending = await paymentsRepo.getPendingRegistration(tempUuid);
    if (!pending) throw new Error("Kit order not found for this temp_uuid.");
    if (pending.status === "approved") return { alreadyPaid: true };

    const data = typeof pending.form_data === "string"
        ? JSON.parse(pending.form_data)
        : pending.form_data;

    const order = await repo.createOrder({
        studentUserId:     data.studentUserId,
        productId:         data.productId,
        vendorId:          data.vendorId,
        quantity:          data.quantity,
        unitPrice:         data.unitPrice,
        deliveryCharge:    data.deliveryCharge,
        deliveryZone:      data.deliveryZone,
        kitOrderZoneUser:  data.kitOrderZoneUser,
        totalAmount:       data.totalAmount,
        razorpayOrderId:   data.razorpayOrderId,
        razorpayPaymentId,
        deliveryName:      data.deliveryName,
        deliveryPhone:     data.deliveryPhone,
        deliveryAddress:   data.deliveryAddress,
        deliveryCity:      data.deliveryCity,
        deliveryState:     data.deliveryState,
        deliveryPincode:   data.deliveryPincode,
        ageGroup:          data.ageGroup,
    });

    await paymentsRepo.recordPayment({
        tempUuid,
        razorpayOrderId:   data.razorpayOrderId,
        razorpayPaymentId,
        serviceType:       "kit_order",
        amount:            data.totalAmount,
        termMonths:        1,
        studentUserId:     data.studentUserId,
    });

    await repo.updatePendingStatus(pending.id, "approved");

    return { success: true, kitOrderId: order.id };
};

// ── Vendor: Update order status ───────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
    new_order:          ["in_progress", "rejected"],
    in_progress:        ["ready_for_delivery"],
    ready_for_delivery: ["out_for_delivery"],
    out_for_delivery:   ["mark_as_delivered"],
    mark_as_delivered:  ["completed"],
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

// ── DEV ONLY ──────────────────────────────────────────────────────────────────
exports.devFinalizeKitOrder = async (tempUuid) => {
    const pending = await paymentsRepo.getPendingRegistration(tempUuid);
    if (!pending) throw new Error("Kit order not found for this temp_uuid.");
    if (pending.status === "approved") return { alreadyPaid: true };

    await exports.finalizeRegistration(tempUuid, `dev_pay_${Date.now()}`, 0);
    return { alreadyPaid: false };
};
