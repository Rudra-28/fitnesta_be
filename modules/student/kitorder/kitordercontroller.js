const service      = require("./kitorderservice");
const kitOrderRepo = require("./kitorderrepo");
const vendorRepo   = require("../../professionals/vendor/vendordashboard/vendordashboardrepo");

// ── Student: Place order ───────────────────────────────────────────────────
exports.createKitOrder = async (req, res) => {
    try {
        const result = await service.createKitOrder(req.user.id ?? req.user.userId, req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// ── DEV ONLY: Instantly confirm payment ───────────────────────────────────
exports.devFinalizeKitOrder = async (req, res) => {
    try {
        const result = await service.devFinalizeKitOrder(Number(req.params.kit_order_id));
        res.json({ success: true, message: result.alreadyPaid ? "Already paid." : "Order marked as paid." });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// ── Vendor: Update order status ───────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
    try {
        const { vendorId } = await vendorRepo.findVendorByUserId(req.vendor.id);
        const result = await service.updateOrderStatus(vendorId, Number(req.params.order_id), req.body.status);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// ── Vendor: Get all orders for their products ──────────────────────────────
exports.getVendorOrders = async (req, res) => {
    try {
        const { vendorId } = await vendorRepo.findVendorByUserId(req.vendor.id);
        const raw = await kitOrderRepo.getOrdersByVendor(vendorId);

        const data = raw.map((order) => {
            const buyerUser    = order.users    || {};
            const studentProfile = buyerUser.students?.[0] || null;

            return {
                order_id:        order.id,
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

                // What the student typed at checkout (may differ from their profile)
                delivery_info: {
                    name:    order.delivery_name,
                    phone:   order.delivery_phone,
                    address: order.delivery_address,
                    city:    order.delivery_city,
                    state:   order.delivery_state,
                    pincode: order.delivery_pincode,
                },

                // Actual buyer account data fetched by mapping student_user_id → users
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
