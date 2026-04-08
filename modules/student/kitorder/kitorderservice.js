const crypto                        = require("crypto");
const repo                          = require("./kitorderrepo");
const paymentsRepo                  = require("../../payments/paymentsrepo");
const commissionRepo                = require("../../commissions/commissionrepo");
const { createOrder }               = require("../../../utils/razorpay");
const prisma                        = require("../../../config/prisma");
const { sendNotification }          = require("../../../utils/fcm");

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

    const deliveryCharge  = parseFloat(product[ZONE_CHARGE_MAP[deliveryZone]]);
    const unitPrice       = parseFloat(product.selling_price);
    const purchasePrice   = parseFloat(product.price);
    const totalAmount     = (unitPrice * quantity) + deliveryCharge;

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
        purchasePrice,
        deliveryCharge,
        deliveryZone,
        kitOrderZoneUser:  deliveryZone,
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

    // Notify the student of the status change
    const STATUS_MESSAGES = {
        in_progress:        "Your kit order has been accepted and is being prepared.",
        ready_for_delivery: "Your kit order is ready for delivery.",
        out_for_delivery:   "Your kit order is out for delivery!",
        mark_as_delivered:  "Your kit order has been delivered.",
        completed:          "Your kit order is complete. Enjoy!",
        rejected:           "Your kit order was rejected. A refund will be initiated.",
    };
    const statusMsg = STATUS_MESSAGES[newStatus];
    if (statusMsg) {
        sendNotification(order.student_user_id, "Kit Order Update", statusMsg, { type: "kit_order_status", order_id: String(orderId), status: newStatus });
    }

    // When vendor rejects the order, create a refund record for admin to process
    if (order.order_status === "new_order" && newStatus === "rejected") {
        try {
            await prisma.kit_order_refunds.create({
                data: {
                    kit_order_id:    orderId,
                    student_user_id: order.student_user_id,
                    amount:          order.total_amount,
                    reason:          "Vendor rejected the order",
                    status:          "pending",
                },
            });
        } catch (err) {
            console.error("[KitOrder] refund record create error:", err.message);
        }
    }

    // When vendor accepts the order (new_order → in_progress), create a pending commission entry
    if (order.order_status === "new_order" && newStatus === "in_progress") {
        try {
            const vendorProfessional = await repo.getProfessionalByVendorId(vendorId);
            if (vendorProfessional) {
                const totalAmount    = parseFloat(order.total_amount);
                const unitPrice      = parseFloat(order.unit_price);
                const purchasePrice  = parseFloat(order.vendor_products?.price ?? 0);
                const deliveryCharge = parseFloat(order.delivery_charge);
                const qty            = order.quantity;

                const profitMargin      = (unitPrice - purchasePrice) * qty;
                const adminCut          = parseFloat((profitMargin * 0.10).toFixed(2));
                const vendorPayout      = parseFloat((profitMargin * 0.90 + purchasePrice * qty + deliveryCharge).toFixed(2));
                const fitnestaProfit    = adminCut;

                await commissionRepo.recordCommission({
                    professionalId:   vendorProfessional.id,
                    professionalType: "vendor",
                    sourceType:       "kit_order",
                    sourceId:         orderId,
                    baseAmount:       totalAmount,
                    commissionRate:   0,
                    commissionAmount: vendorPayout,
                    status:           "pending",
                });

                await prisma.fitnesta_profit_logs.create({
                    data: {
                        source_type:      "kit_order",
                        source_id:        orderId,
                        total_collected:  totalAmount,
                        commissions_paid: vendorPayout,
                        fitnesta_profit:  fitnestaProfit,
                        notes: `Kit order #${orderId}: profit_margin=${profitMargin}, admin_cut(10%)=${adminCut}, vendor_payout(90%+base+delivery)=${vendorPayout}`,
                    },
                });
            }
        } catch (err) {
            console.error("[KitOrder] vendor commission create error:", err.message);
        }
    }

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
