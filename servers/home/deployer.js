import * as targeting from "./lib/targeting.js";

/** @param {NS} ns */
// pass no args for default behaviour
// pass function the hostname of the host it will run on/from
export async function start(ns, scriptHost) {
    // handle args
    const targetMode = ns.args[1] ?? "";
    const target = ns.args[0] ?? targeting.getTarget(ns, targetMode);

    // load config
    const cfg = JSON.parse(ns.read("./data/cfg.json"));
    const moneyThresh = cfg.moneyThresh;
    const securityThresh = cfg.securityThresh;

    // we only want our ns.prints
    ns.disablelog("ALL");

    // const for calculations
    const growCost = ns.getScriptRam("grow.js");
    const weakenCost = ns.getScriptRam("weaken.js");
    const hackCost = ns.getScriptRam("hack.js");

    // lets for each loop
    let threads;
    let freeRam;
    let currentSec;
    let currentMoney;

    // array that holds PID of child scripts - to cull on finally
    let childArr = [];

    //Counters
    let weakcount = 0;
    let growcount = 0;
    let hackcount = 0;


    // while loop calls grow, weaken or hack as per simple HGW logic
    // uses 'try' and 'finally' to kill childen when deployer is killed
    try {
        // deploy 1 off script up to max ram usage
        while (true) {
            // update server details
            currentSec = ns.getServerSecurityLevel(target);
            currentMoney = ns.getServerMoneyAvailable(target);
            freeRam = (ns.getServerMaxRam() - ns.getServerUsedRam());

            // sleep to prevent infinite loop -
            await ns.sleep(2000);

            // If the server's security level is above our threshold, weaken it
            if (currentSec > securityThresh) {
                ns.print(`Current Security Level is higher than the threshold - ${currentSec} (current) > ${securityThresh} (threshold)`);
                // calculate threads to fill available ram
                threads = Math.floor(freeRam / weakenCost);

                // loop if threads = 0 (error) 
                if (threads < 1) {
                    await ns.sleep(1000);
                    continue;
                }

                // Runs desired behaviour and adds PID to array
                const pid = ns.exec("weaken.js", scriptHost, threads, target);
                if (pid !== 0) {childArr.push(pid);}        // when execution fails, don't push PID
                weakcount++;

                ns.print("Ran weaken.js with " + threads + " threads");
            }

            // If the server's money is less than our threshold, grow it
            else if (currentMoney < moneyThresh) {
                ns.print(`Current Money is lower than the threshold - ${currentMoney} (current) < ${moneyThresh} (threshold)`);
                // calculate threads to fill available ram
                threads = Math.floor(freeRam / growCost);

                // loop if threads = 0 (error) 
                if (threads < 1) {
                    await ns.sleep(1000);
                    continue;
                }

                // Runs desired behaviour and adds PID to array
                const pid = ns.exec("grow.js", scriptHost, threads, target);
                if (pid !== 0) {childArr.push(pid);}        // when execution fails, don't push PID
                growcount++;

                ns.print("Ran grow.js with " + threads + " threads");
            }

            // Otherwise, hack it
            else {

                ns.print(`Optimal hack conditions met`);
                // calculate threads to fill available ram
                threads = Math.floor(freeRam / hackCost);

                // loop if threads = 0 (error) 
                if (threads < 1) {
                    await ns.sleep(1000);
                    continue;
                }

                // Runs desired behaviour and adds PID to array
                const pid = ns.exec("hack.js", scriptHost, threads, target);
                if (pid !== 0) {childArr.push(pid);}        // when execution fails, don't push PID
                hackcount++;

                ns.print("Ran hack.js with " + threads + " threads");
            }

        }


    }
    finally {

        // kill children processes
        for (const p of childArr) {
            ns.kill(p);
        }

        // print counters
        ns.print(" ");
        ns.print("* Hack on " + target + " terminated");
        ns.print("* Run Counts *");
        ns.print(`weaken.js: ${weakcount} `);
        ns.print(`grow.js: ${growcount} `);
        ns.print(`hack.js: ${hackcount} `);
        ns.print(" ");
    }
}





//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGVwbG95ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEscUJBQXFCO0FBR3JCLE1BQU0sQ0FBQyxLQUFLLFVBQVUsSUFBSSxDQUFDLEVBQUUsSUFBRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqIEBwYXJhbSB7TlN9IG5zICovXHJcblxyXG5pbXBvcnQgeyBvcGVuUG9ydHMgfSBmcm9tIFwiLi91dGlsLmpzXCI7XHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtYWluKG5zKSB7fSJdfQ==