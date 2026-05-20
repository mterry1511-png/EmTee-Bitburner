import * as targeting from "./lib/targeting.js";
import { getAvailableThreads } from "./lib/util.js";

/** @param {NS} ns */
// pass no args for default behaviour
// pass function the hostname of the host it will run on/from
export async function start(ns, scriptHost, targetMode) {
    // handle args
    const target = targeting.getTarget(ns, targetMode);

    // load config
    const cfg = JSON.parse(ns.read("./data/cfg.json"));
    const moneyThresh = cfg.moneyThresh * ns.getServerMaxMoney(target);

    // minDifficulty is called from targeting to reduce accessing networks.json here
    const minDifficulty = targeting.getMinDifficulty(ns, target);
    if (minDifficulty === null) return;
    const securityThreshActual = targeting.getMinDifficulty(ns, target) + cfg.securityThresh;

    // state as obj
    const state = { waiting: false };

    // we only want our ns.prints
    ns.disableLog("ALL");

    // lets for each loop
    let script;
    let threads;
    let currentSec;
    let currentMoney;

    // array that holds PID of child scripts - to cull on finally
    let childArr = [];

    //Counters
    let weakCount = 0;
    let growCount = 0;
    let hackCount = 0;

    //Cleanup - kill child processes and print report
    ns.atExit(() => {
        for (const p of childArr) {
            ns.kill(p);
        }
        ns.print(" ");
        ns.print("* Hack on " + target + " terminated");
        ns.print("* Run Counts *");
        ns.print(`weaken.js: ${weakCount}`);
        ns.print(`grow.js: ${growCount}`);
        ns.print(`hack.js: ${hackCount}`);
        ns.print(" ");
    });

    // while loop calls grow, weaken or hack as per simple HGW logic
    // uses 'try' and 'finally' to kill childen when deployer is killed

    // deploy 1 off script up to max ram usage
    while (true) {
        // update server details
        currentSec = ns.getServerSecurityLevel(target);
        currentMoney = ns.getServerMoneyAvailable(target);
        // sleep to prevent infinite loop -
        await ns.sleep(2000);
        // prune array for deployed scripts that have finished
        childArr = childArr.filter(pid => ns.isRunning(pid));

        // If the server's security level is above our threshold, weaken it
        if (currentSec > securityThreshActual) {

            script = "weaken.js"
            // get available threads from util.js
            threads = getAvailableThreads(ns, scriptHost, script);

            //run it all, return success for counter and flag reset
            const success = await execute(ns, target, threads, script, scriptHost, childArr, state);
            if (success) {
                state.waiting = false;
                weakCount++;
            }

            // print only if not in waiting
            if (!state.waiting) {
                ns.print(`Security too high - ${currentSec} (current) > ${securityThreshActual} (threshold)`);

            }
        }


        // If the server's money is less than our threshold, grow it
        else if (currentMoney < moneyThresh) {

            script = "grow.js"
            // get available threads from util.js
            threads = getAvailableThreads(ns, scriptHost, script);

            //run it all, return success for counter and flag reset
            const success = await execute(ns, target, threads, script, scriptHost, childArr, state);
            if (success) {
                state.waiting = false;
                growCount++;
            }

            // print only if not in waiting
            if (!state.waiting) {
                ns.print(`Money too low - ${currentMoney} (current) < ${moneyThresh} (threshold)`);
            }

        }


        // Otherwise, hack it
        else {

            // pass everything and execute
            script = "hack.js";
            // get available threads from util.js
            threads = getAvailableThreads(ns, scriptHost, script);

            //run it all, return success for counter and flag reset
            const success = await execute(ns, target, threads, script, scriptHost, childArr, state);
            if (success) {
                state.waiting = false;
                hackCount++;
            }

            // print and count only if not in waiting
            if (!state.waiting) {
                ns.print(`Optimal hack conditions met`);
            }
        }
    }
}



// runs different mode depending on script passed
export async function execute(ns, target, threads, script, scriptHost, childArr, state) {
    ns.disableLog("ALL");

    // loop if threads = 0 (error) 
    if (threads < 1) {
        if (!state.waiting) {
            ns.print("\nInsufficient RAM. Waiting...\n");
            state.waiting = true;
        }
        await ns.sleep(3000);
        return false;   // return for success if
    }

    // Runs desired behaviour and adds PID to array
    const pid = ns.exec(script, scriptHost, threads, target);
    if (pid !== 0) {        // when execution fails, don't push PID
        childArr.push(pid);
        ns.print(`Ran ${script} [${pid}] with ${threads} threads on ${scriptHost} targeting ${target}`);
        return true;    // return for success if
    }
    return false;       // return for success if
}





//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGVwbG95ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEscUJBQXFCO0FBR3JCLE1BQU0sQ0FBQyxLQUFLLFVBQVUsSUFBSSxDQUFDLEVBQUUsSUFBRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqIEBwYXJhbSB7TlN9IG5zICovXHJcblxyXG5pbXBvcnQgeyBvcGVuUG9ydHMgfSBmcm9tIFwiLi91dGlsLmpzXCI7XHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtYWluKG5zKSB7fSJdfQ==