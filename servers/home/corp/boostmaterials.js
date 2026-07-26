// ============================================================================
// boostmaterials.js — WORK IN PROGRESS, and currently BROKEN. See below.
//
// Boost materials (Hardware, Robots, AI Cores, Real Estate) raise a division's
// production multiplier. They are bought once and held, not consumed, so this
// is a one-shot spend rather than a loop.
//
// BLOCKING BUG: `warehouse.sizedAt` on line ~36 is not a property of the
// Warehouse object (the real one is `sizeUsed`). It evaluates to undefined,
// which makes availableSpace NaN, which makes cappedBudget NaN, which makes
// every downstream comparison false and every quantity NaN — so the purchase
// loop reaches bulkPurchase() with a NaN quantity. This script cannot work as
// written. Nothing here is a code change in this pass; it is documented so it
// is not mistaken for working.
//
// Requires an active corporation (BitNode 3 or SF3).
// ============================================================================

/**
 * Spend a fixed budget once across the four boost materials, weighted toward
 * whichever is furthest below its target ratio and cheapest per point of
 * production benefit.
 *
 * The 4:5:5:15 target ratio is the community-standard boost-material split -
 * Real Estate dominates because it is by far the cheapest per unit of
 * production exponent.
 *
 * Spends in 50 equal chunks rather than one lump: after each purchase the
 * chosen material's stored quantity rises, its marginal return falls, and the
 * next chunk re-scores and usually picks a different material. That is what
 * produces the ratio-following behaviour without solving for it directly.
 *
 * All three arguments are optional and defaulted, so the "usage" guard below
 * can only ever fire on a budget of 0 or a non-numeric budget.
 * @param {NS} ns - The Netscript API object
 * @param {number} [args0=1000000] - ns.args[0], the dollar budget to spend
 * @param {string} [args1="LexaAgricultural"] - ns.args[1], the division name
 * @param {string} [args2="Sector-12"] - ns.args[2], the city whose warehouse to fill
 * @returns {Promise<void>}
 */
export async function main(ns) {
    const budget = Number(ns.args[0] ?? 1000000);
    const divisionName = ns.args[1] ?? "LexaAgricultural";
    const city = ns.args[2] ?? "Sector-12";

    // Mostly dead guard: divisionName and city are ??-defaulted above so they
    // can never be falsy here. Only a budget of 0 or a non-numeric budget
    // (Number("abc") -> NaN, which is falsy) reaches this branch. The usage
    // string also names a file that does not exist - this file is boostmaterials.js.
    if (!divisionName || !city || !budget) {
        ns.tprint("Usage: run corpboostonce.js <budget> <divisionName> <city>");
        return;
    }

    // The four boost materials, and their standard relative weighting. Real
    // Estate is weighted heaviest because it is cheapest per unit of production
    // exponent, not because it is intrinsically more valuable.
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
    // How much each material actually contributes to production FOR THIS
    // INDUSTRY - an agriculture division values Real Estate very differently
    // from a software division. ?? 0 because an industry that does not use a
    // material simply omits the factor.
    const factors = {
        Hardware: industryData.hardwareFactor ?? 0,
        Robots: industryData.robotFactor ?? 0,
        "AI Cores": industryData.aiCoreFactor ?? 0,
        "Real Estate": industryData.realEstateFactor ?? 0,
    };

    const warehouse = ns.corporation.getWarehouse(divisionName, city);
    // BROKEN: `sizedAt` is not a Warehouse property (the real one is `sizeUsed`),
    // so this is NaN and poisons every calculation downstream. See file header.
    const availableSpace = warehouse.size - warehouse.sizedAt;
    // Converts warehouse space into a dollar ceiling via a flat $1e6-per-unit
    // fudge factor, rather than using each material's real per-unit size from
    // ns.corporation.getMaterialData().
    const cappedBudget = Math.min(budget, availableSpace * 1e6);

    // Spend in 50 slices so the scoring below re-evaluates as stock accumulates.
    const chunkCount = 50;
    let remaining = cappedBudget;
    let totalUnitsPurchased = 0;

    for (let i = 0; i < chunkCount; ++i) {
        const chunkBudget = cappedBudget / chunkCount;
        if (remaining < chunkBudget) break;

        // Score every material and pick the single best one to buy this chunk.
        let best = null;
        for (const material of materials) {
            const data = ns.corporation.getMaterial(divisionName, city, material);
            // targetRatio IS a genuine share of the total (e.g. 15/29 for Real Estate)...
            const targetRatio = targetRatios[material] / ratioSum;
            // ...but currentRatio is NOT. It is a saturating 0->1 curve of this
            // one material's stock against a magic 1e6, with no reference to the
            // other three materials at all. Comparing the two is apples to
            // oranges, so `deviation` does not mean what the comment claims.
            const currentRatio = data.stored / (data.stored + 1e6); // normalize current stock
            // Clamped at zero via Math.min: a material at or above target
            // contributes no priority rather than a negative one.
            const deviation = targetRatio - Math.min(currentRatio, targetRatio); // how far below target

            // Score combines: production factor, how far below target ratio, and marginal return per dollar
            const stockPriority = deviation * 100;
            // Diminishing returns: dividing by (0.002 * stored + 1) makes each
            // additional unit of an already-large stockpile score lower, and
            // dividing by marketPrice turns it into benefit-per-dollar so
            // expensive materials must earn their cost.
            const marginalReturn = (factors[material] * 0.002) / (0.002 * data.stored + 1) / data.marketPrice;
            const score = stockPriority + marginalReturn;

            if (!best || score > best.score) {
                best = { material, score, price: data.marketPrice };
            }
        }

        const qty = Math.floor(chunkBudget / best.price);
        // `continue` on the capacity check means that once the warehouse is
        // full every remaining chunk still runs the full four-material scoring
        // loop before failing again - warehouse space only ever shrinks here, so
        // there is nothing left to recover.
        if (qty <= 0 || totalUnitsPurchased + qty > availableSpace) continue;

        ns.corporation.bulkPurchase(divisionName, city, best.material, qty);
        remaining -= qty * best.price;
        totalUnitsPurchased += qty;
    }

    ns.tprint(`Spent $${ns.formatNumber(cappedBudget - remaining)} of $${ns.formatNumber(cappedBudget)} (capped by warehouse)`);
}