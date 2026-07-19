/**
 * Spends a fixed budget once, split across the four boost materials in
 * proportion to their production exponents (4:5:5:15), prioritizing
 * materials below their target ratio. Respects warehouse capacity.
 * @param {NS} ns
 */
export async function main(ns) {
    const budget = Number(ns.args[0] ?? 1000000);
    const divisionName = ns.args[1] ?? "LexaAgricultural";
    const city = ns.args[2] ?? "Sector-12";

    if (!divisionName || !city || !budget) {
        ns.tprint("Usage: run corpboostonce.js <budget> <divisionName> <city>");
        return;
    }

    const materials = ["Hardware", "Robots", "AI Cores", "Real Estate"];
    const targetRatios = {
        Hardware: 4,
        Robots: 5,
        "AI Cores": 5,
        "Real Estate": 15,
    };
    const ratioSum = Object.values(targetRatios).reduce((a, b) => a + b, 0);

    const division = ns.corporation.getDivision(divisionName);
    const industryData = ns.corporation.getIndustryData(division.industry);
    const factors = {
        Hardware: industryData.hardwareFactor ?? 0,
        Robots: industryData.robotFactor ?? 0,
        "AI Cores": industryData.aiCoreFactor ?? 0,
        "Real Estate": industryData.realEstateFactor ?? 0,
    };

    const warehouse = ns.corporation.getWarehouse(divisionName, city);
    const availableSpace = warehouse.size - warehouse.sizedAt;
    const cappedBudget = Math.min(budget, availableSpace * 1e6);

    const chunkCount = 50;
    let remaining = cappedBudget;
    let totalUnitsPurchased = 0;

    for (let i = 0; i < chunkCount; ++i) {
        const chunkBudget = cappedBudget / chunkCount;
        if (remaining < chunkBudget) break;

        // Calculate current stock ratio vs target
        let best = null;
        for (const material of materials) {
            const data = ns.corporation.getMaterial(divisionName, city, material);
            const targetRatio = targetRatios[material] / ratioSum;
            const currentRatio = data.stored / (data.stored + 1e6); // normalize current stock
            const deviation = targetRatio - Math.min(currentRatio, targetRatio); // how far below target

            // Score combines: production factor, how far below target ratio, and marginal return per dollar
            const stockPriority = deviation * 100;
            const marginalReturn = (factors[material] * 0.002) / (0.002 * data.stored + 1) / data.marketPrice;
            const score = stockPriority + marginalReturn;

            if (!best || score > best.score) {
                best = { material, score, price: data.marketPrice };
            }
        }

        const qty = Math.floor(chunkBudget / best.price);
        if (qty <= 0 || totalUnitsPurchased + qty > availableSpace) continue;

        ns.corporation.bulkPurchase(divisionName, city, best.material, qty);
        remaining -= qty * best.price;
        totalUnitsPurchased += qty;
    }

    ns.tprint(`Spent $${ns.formatNumber(cappedBudget - remaining)} of $${ns.formatNumber(cappedBudget)} (capped by warehouse)`);
}