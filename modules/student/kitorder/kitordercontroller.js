const service      = require("./kitorderservice");
const kitOrderRepo = require("./kitorderrepo");
const vendorRepo   = require("../../professionals/vendor/vendordashboard/vendordashboardrepo");

// ── Student: Initiate order (park + create Razorpay order) ────────────────────
exports.initiateKitOrder = async (req, res) => {
    try {
        const result = await service.initiateKitOrder(req.user.id ?? req.user.userId, req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// ── DEV ONLY: Instantly confirm payment via temp_uuid ─────────────────────────
exports.devFinalizeKitOrder = async (req, res) => {
    try {
        const result = await service.devFinalizeKitOrder(req.params.temp_uuid);
        res.json({ success: true, message: result.alreadyPaid ? "Already paid." : "Order finalized." });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// ── Student: My orders ────────────────────────────────────────────────────────
exports.getMyOrders = async (req, res) => {
    try {
        const studentUserId = req.user.id ?? req.user.userId;
        const raw = await kitOrderRepo.getOrdersByStudent(studentUserId);

        const data = raw.map((order) => ({
            order_id:        order.id,
            order_status:    order.order_status,
            payment_status:  order.payment_status,
            quantity:        order.quantity,
            unit_price:      order.unit_price,
            delivery_charge: order.delivery_charge,
            delivery_zone:   order.kit_order_zone_user ?? order.delivery_zone,
            total_amount:    order.total_amount,
            created_at:      order.created_at,
            product:         order.vendor_products ?? null,
        }));

        res.json({ success: true, total: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ── Student: Single order with full tracking ──────────────────────────────────
exports.getMyOrderById = async (req, res) => {
    try {
        const studentUserId = req.user.id ?? req.user.userId;
        const order = await kitOrderRepo.getOrderByIdForStudent(Number(req.params.order_id), studentUserId);
        if (!order) return res.status(404).json({ success: false, error: "Order not found." });

        const TRACKING_STEPS = [
            "new_order",
            "in_progress",
            "ready_for_delivery",
            "out_for_delivery",
            "mark_as_delivered",
            "completed",
        ];

        const currentIndex = TRACKING_STEPS.indexOf(order.order_status);

        res.json({
            success: true,
            data: {
                order_id:        order.id,
                order_status:    order.order_status,
                payment_status:  order.payment_status,
                quantity:        order.quantity,
                unit_price:      order.unit_price,
                delivery_charge: order.delivery_charge,
                delivery_zone:   order.kit_order_zone_user ?? order.delivery_zone,
                total_amount:    order.total_amount,
                created_at:      order.created_at,
                product:         order.vendor_products ?? null,
                delivery_info: {
                    name:    order.delivery_name,
                    phone:   order.delivery_phone,
                    address: order.delivery_address,
                    city:    order.delivery_city,
                    state:   order.delivery_state,
                    pincode: order.delivery_pincode,
                },
                tracking: TRACKING_STEPS.map((step, i) => ({
                    step,
                    completed: i <= currentIndex,
                    active:    i === currentIndex,
                })),
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ── Vendor: Update order status ───────────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
    try {
        const { vendorId } = await vendorRepo.findVendorByUserId(req.vendor.id);
        const result = await service.updateOrderStatus(vendorId, Number(req.params.order_id), req.body.status);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// ── Vendor: Get all orders for their products ─────────────────────────────────
exports.getVendorOrders = async (req, res) => {
    try {
        const { vendorId } = await vendorRepo.findVendorByUserId(req.vendor.id);
        const raw = await kitOrderRepo.getOrdersByVendor(vendorId);

        const data = raw.map((order) => {
            const buyerUser      = order.users    || {};
            const studentProfile = buyerUser.students?.[0] || null;

            return {
                order_id:        order.id,
                order_status:    order.order_status,
                payment_status:  order.payment_status,
                quantity:        order.quantity,
                unit_price:      order.unit_price,
                delivery_charge: order.delivery_charge,
                delivery_zone:   order.delivery_zone,
                total_amount:    order.total_amount,
                razorpay_order_id:   order.razorpay_order_id,
                razorpay_payment_id: order.razorpay_payment_id,
                created_at:      order.created_at,

                product: order.vendor_products ?? null,

                delivery_info: {
                    name:    order.delivery_name,
                    phone:   order.delivery_phone,
                    address: order.delivery_address,
                    city:    order.delivery_city,
                    state:   order.delivery_state,
                    pincode: order.delivery_pincode,
                },

                buyer: {
                    user_id:      buyerUser.id        ?? null,
                    full_name:    buyerUser.full_name  ?? null,
                    mobile:       buyerUser.mobile     ?? null,
                    email:        buyerUser.email      ?? null,
                    address:      buyerUser.address    ?? null,
                    photo:        buyerUser.photo      ?? null,
                    student_id:   studentProfile?.id          ?? null,
                    student_type: studentProfile?.student_type ?? null,
                },
            };
        });

        res.json({ success: true, total: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
