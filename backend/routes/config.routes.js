const express = require("express");

const router = express.Router();

const parseStockThreshold = () => {
    const raw = Number(process.env.STOCK_BAJO_UMBRAL);

    if (!Number.isFinite(raw) || raw < 1) {
        return 10;
    }

    return Math.floor(raw);
};

router.get("/ui", (req, res) => {
    res.json({
        stock_bajo_umbral: parseStockThreshold()
    });
});

module.exports = router;
