


export async function main(ns) {
    // define
    let cfg = JSON.parse(ns.read("/data/cfg.json"));

    while (cfg.autoStocks == true) {


        // update cfg to ensure the toggle is still on
        cfg = JSON.parse(ns.read("/data/cfg.json"));
    }

        symbols = ns.stock.getSymbols();


}