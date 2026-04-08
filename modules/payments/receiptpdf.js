const PDFDocument = require("pdfkit");

/**
 * Stream a receipt PDF into the Express response.
 * @param {object} receipt  - shaped receipt from paymentsService.getReceipt()
 * @param {object} res      - Express response object
 */
exports.streamReceiptPDF = (receipt, res) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="receipt_${receipt.razorpay_payment_id}.pdf"`
    );
    doc.pipe(res);

    const pageWidth = 595.28;
    const contentWidth = pageWidth - 100; // left+right margin = 50 each

    // ── Header ────────────────────────────────────────────────────────────
    doc.fontSize(22).font("Helvetica-Bold").text("Fitnesta", 50, 50);
    doc.fontSize(10).font("Helvetica").fillColor("#555555")
       .text("Payment Receipt", 50, 78);

    doc.moveTo(50, 95).lineTo(pageWidth - 50, 95).strokeColor("#dddddd").stroke();

    // ── Payment Meta ──────────────────────────────────────────────────────
    doc.fillColor("#000000");
    let y = 110;

    const field = (label, value) => {
        doc.fontSize(9).font("Helvetica").fillColor("#888888").text(label, 50, y);
        doc.fontSize(10).font("Helvetica").fillColor("#000000")
           .text(String(value ?? "—"), 180, y);
        y += 20;
    };

    const paidAt = receipt.paid_at
        ? new Date(receipt.paid_at).toLocaleString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
          })
        : "—";

    field("Payment ID",   receipt.razorpay_payment_id);
    field("Date",         paidAt);
    field("Service",      receipt.service_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
    field("Duration",     `${receipt.term_months} month${receipt.term_months > 1 ? "s" : ""}`);
    field("Student",      receipt.student.name);
    field("Phone",        receipt.student.phone);
    if (receipt.student.email) field("Email", receipt.student.email);

    y += 10;
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).strokeColor("#dddddd").stroke();
    y += 15;

    // ── Activities table ──────────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000")
       .text("Activities / Subjects", 50, y);
    y += 20;

    // Table header
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#555555");
    doc.text("Activity", 50, y);
    doc.text("Fee (INR)", pageWidth - 130, y, { width: 80, align: "right" });
    y += 5;
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).strokeColor("#cccccc").stroke();
    y += 10;

    // Table rows
    doc.font("Helvetica").fillColor("#000000").fontSize(10);
    for (const act of receipt.activities) {
        const fee = act.fee != null ? `₹${parseFloat(act.fee).toFixed(2)}` : "—";
        doc.text(act.name, 50, y, { width: contentWidth - 100 });
        doc.text(fee, pageWidth - 130, y, { width: 80, align: "right" });
        y += 20;
    }

    y += 5;
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).strokeColor("#cccccc").stroke();
    y += 12;

    // Total row
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("Total Paid", 50, y);
    doc.text(`₹${receipt.amount.toFixed(2)}`, pageWidth - 130, y, { width: 80, align: "right" });

    y += 40;
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).strokeColor("#dddddd").stroke();
    y += 12;

    // ── Footer ────────────────────────────────────────────────────────────
    doc.fontSize(8).font("Helvetica").fillColor("#aaaaaa")
       .text("This is a computer-generated receipt and does not require a signature.", 50, y, {
           width: contentWidth, align: "center",
       });

    doc.end();
};
