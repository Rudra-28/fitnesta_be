const service         = require("./vendordashboardservice");
const insightsService = require("./vendorinsightsservice");

exports.addProduct = async (req, res) => {
    try {
        const data = { ...req.body };
        if (req.file) data.productImage = req.file.path;
        if (data.ageGroups && typeof data.ageGroups === "string") {
            try { data.ageGroups = JSON.parse(data.ageGroups); } catch { data.ageGroups = [data.ageGroups]; }
        }

        const result = await service.addProduct(req.vendor.id, data);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const result = await service.getProducts(req.vendor.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const result = await service.getProductById(req.vendor.id, Number(req.params.id));
        res.json(result);
    } catch (err) {
        res.status(404).json({ success: false, error: err.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const data = { ...req.body };
        if (req.file) data.productImage = req.file.path;

        const result = await service.updateProduct(req.vendor.id, Number(req.params.id), data);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

exports.getProductByIdPublic = async (req, res) => {
    try {
        const result = await service.getProductByIdPublic(Number(req.params.id));
        res.json(result);
    } catch (err) {
        res.status(err.message === "Product not found." ? 404 : 500).json({ success: false, error: err.message });
    }
};

exports.getAllProductsPublic = async (req, res) => {
    try {
        const result = await service.getAllProductsPublic(req.query.category);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const result = await service.deleteProduct(req.vendor.id, Number(req.params.id));
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// ── Wallet ─────────────────────────────────────────────────────────────────

exports.getWalletSummary = async (req, res) => {
    try {
        const data = await service.getWalletSummary(req.vendor.id);
        res.json({ success: true, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};

exports.getWalletBreakdown = async (req, res) => {
    try {
        const data = await service.getWalletBreakdown(req.vendor.id, req.params.status);
        res.json({ success: true, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};

exports.getTransactionHistory = async (req, res) => {
    try {
        const { status, source_type, page, limit } = req.query;
        const data = await service.getTransactionHistory(req.vendor.id, {
            status, source_type,
            page:  page  ? Number(page)  : 1,
            limit: limit ? Number(limit) : 20,
        });
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ── Insights ───────────────────────────────────────────────────────────────

exports.getInsights = async (req, res) => {
    try {
        const data = await insightsService.getInsights(req.vendor.id);
        res.json({ success: true, data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};
