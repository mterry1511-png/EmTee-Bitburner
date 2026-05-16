/**
 * @param {NS} ns
 * @param {string} targetServer
 * @param {number} moneyPercent
 * @param {number} minSecurityoffset
 * @param {boolean} debug*/
import { openPorts } from "./lib/util.js";
// Main
export async function main(ns) {
    // Disable logging for ns functions
    ns.disableLog("disableLog");
    ns.disableLog("getServerSecurityLevel");
    ns.disableLog("getServerMoneyAvailable");
    ns.disableLog("getServerMaxMoney");
    ns.disableLog("getServerMinSecurityLevel");
    ns.disableLog("getHostname");
    //* pull from args *//
    const targetServer = ns.args.find(a => !a.startsWith("-")) ?? ns.getHostname();
    // Debug controls logging 
    const debug = ns.args.includes("--debug");
    // printusage check
    const help = ns.args.includes("help");
    if (help) {
        printusage(ns);
        return;
    }
    if (targetServer.startsWith("-")) {
        ns.tprint("Invalid usage: first non-flag arg must be a server name");
        return;
    }
    // Defines how much money a server should have before we hack it 
    // In this case, it is set to 80% of max
    const moneyMult = (ns.args[1] ?? 80) / 100;
    const moneyThresh = ns.getServerMaxMoney(targetServer) * moneyMult;
    // Defines the minimum security level the targetServer server can have. 
    const securityThresh = ns.getServerMinSecurityLevel(targetServer) + (ns.args[2] ?? 5);
    // Execute hacks once
    await openPorts(ns, targetServer);
    // Call infinite loop
    await loop(ns, targetServer, moneyThresh, securityThresh, debug);
}
// Infinite loop
export async function loop(ns, targetServer, moneyThresh, securityThresh, debug) {
    //Counters
    let weakcount = 0;
    let growcount = 0;
    let hackcount = 0;
    // Infinite loop that continously hacks/grows/weakens the targetServer, based on config
    while (true) {
        // define
        const currentsec = ns.getServerSecurityLevel(targetServer);
        const currentmoney = ns.getServerMoneyAvailable(targetServer);
        ns.print(" ");
        if (currentsec > securityThresh) {
            // If the server's security level is above our threshold, weaken it
            if (debug)
                ns.print(`Current Security Level is higher than the threshold - ${currentsec} (current) > ${securityThresh} (threshold)`);
            await ns.weaken(targetServer);
            weakcount++;
            if (debug)
                ns.print("Ran ns.weaken");
        }
        else if (currentmoney < moneyThresh) {
            // If the server's money is less than our threshold, grow it
            if (debug)
                ns.print(`Current Money is lower than the threshold - ${currentmoney} (current) < ${moneyThresh} (threshold)`);
            await ns.grow(targetServer);
            growcount++;
            if (debug)
                ns.print("Ran ns.grow");
        }
        else {
            // Otherwise, hack it
            if (debug)
                ns.print(`Optimal hack conditions met`);
            await ns.hack(targetServer);
            hackcount++;
            if (debug)
                ns.print("Ran ns.hack");
        }
        //Print report if in debug
        if (debug) {
            ns.print(" ");
            ns.print(" ");
            ns.print("* Run Counts *");
            ns.print(`ns.weaken: ${weakcount} `);
            ns.print(`ns.grow: ${growcount} `);
            ns.print(`ns.hack: ${hackcount} `);
        }
    }
}
// Autocomplete function
export function autocomplete(data, args) {
    const servers = data.servers;
    const thresholdMoneyPct = "80";
    const thresholdMinSecAdd = "5";
    // Offer a list of all servers, ThresholdMoneyPct in %, Levels to add to minimum security
    return [...servers, thresholdMoneyPct, thresholdMinSecAdd, "--debug", "--tail", "-t 1"];
}
// help - printusage when help is given as arg[0]
function printusage(ns) {
    ns.tprint("Functionality:");
    ns.tprint("Executes port attacks and gains root if required. Then Hack, Grow, Weaken as is optimal)");
    ns.tprint("If no args are provided - runs on local server with default settings");
    ns.tprint("Recommended to run with the '--debug' flag");
    ns.tprint("Usage: ");
    ns.tprint("run simple.js <targetServer> <moneypercent> <minSecurityoffset> --debug -t <numberofthreads>");
    ns.tprint("Example: run simple.js n00dles --debug --tail -t 1");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltcGxlMS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9zaW1wbGUxLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7OzsyQkFLMkI7QUFFM0IsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUV0QyxPQUFPO0FBQ1AsTUFBTSxDQUFDLEtBQUssVUFBVSxJQUFJLENBQUMsRUFBRTtJQUMzQixtQ0FBbUM7SUFDbkMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUM1QixFQUFFLENBQUMsVUFBVSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDeEMsRUFBRSxDQUFDLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQ3pDLEVBQUUsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUNuQyxFQUFFLENBQUMsVUFBVSxDQUFDLDJCQUEyQixDQUFDLENBQUM7SUFDM0MsRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUM3QixzQkFBc0I7SUFDdEIsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDL0UsMEJBQTBCO0lBQzFCLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBRTFDLG1CQUFtQjtJQUNuQixNQUFNLElBQUksR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QyxJQUFJLElBQUksRUFBRTtRQUNSLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNmLE9BQU87S0FDUjtJQUVELElBQUksWUFBWSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFB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QUMsS0FBSyxDQUFDLGNBQWMsU0FBUyxHQUFHLENBQUMsQ0FBQztZQUNyQyxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksU0FBUyxHQUFHLENBQUMsQ0FBQztZQUNuQyxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksU0FBUyxHQUFHLENBQUMsQ0FBQztTQUNwQztLQUNGO0FBQ0gsQ0FBQztBQUVELHdCQUF3QjtBQUN4QixNQUFNLFVBQVUsWUFBWSxDQUFDLElBQUksRUFBRSxJQUFJO0lBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUE7SUFDOUIsTUFBTSxrQkFBa0IsR0FBRyxHQUFHLENBQUE7SUFDOUIseUZBQXlGO0lBQ3pGLE9BQU8sQ0FBQyxHQUFHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRCxpREFBaUQ7QUFDakQsU0FBUyxVQUFVLENBQUMsRUFBRTtJQUNwQixFQUFFLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDNUIsRUFBRSxDQUFDLE1BQU0sQ0FBQywwRkFBMEYsQ0FBQyxDQUFDO0lBQ3RHLEVBQUUsQ0FBQyxNQUFNLENBQUMsc0VBQXNFLENBQUMsQ0FBQTtJQUNqRixFQUFFLENBQUMsTUFBTSxDQUFDLDRDQUE0QyxDQUFDLENBQUE7SUFDdkQsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNyQixFQUFFLENBQUMsTUFBTSxDQUFDLDhGQUE4RixDQUFDLENBQUM7SUFDMUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxvREFBb0QsQ0FBQyxDQUFBO0FBQ2pFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiogXHJcbiAqIEBwYXJhbSB7TlN9IG5zIFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGFyZ2V0U2VydmVyIFxyXG4gKiBAcGFyYW0ge251bWJlcn0gbW9uZXlQZXJjZW50XHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBtaW5TZWN1cml0eW9mZnNldFxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGRlYnVnKi9cclxuXHJcbmltcG9ydCB7IG9wZW5Qb3J0cyB9IGZyb20gXCIuL3V0aWwuanNcIjtcclxuXHJcbi8vIE1haW5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4obnMpIHtcclxuICAvLyBEaXNhYmxlIGxvZ2dpbmcgZm9yIG5zIGZ1bmN0aW9uc1xyXG4gIG5zLmRpc2FibGVMb2coXCJkaXNhYmxlTG9nXCIpO1xyXG4gIG5zLmRpc2FibGVMb2coXCJnZXRTZXJ2ZXJTZWN1cml0eUxldmVsXCIpO1xyXG4gIG5zLmRpc2FibGVMb2coXCJnZXRTZXJ2ZXJNb25leUF2YWlsYWJsZVwiKTtcclxuICBucy5kaXNhYmxlTG9nKFwiZ2V0U2VydmVyTWF4TW9uZXlcIik7XHJcbiAgbnMuZGlzYWJsZUxvZyhcImdldFNlcnZlck1pblNlY3VyaXR5TGV2ZWxcIik7XHJcbiAgbnMuZGlzYWJsZUxvZyhcImdldEhvc3RuYW1lXCIpO1xyXG4gIC8vKiBwdWxsIGZyb20gYXJncyAqLy9cclxuICBjb25zdCB0YXJnZXRTZXJ2ZXIgPSBucy5hcmdzLmZpbmQoYSA9PiAhYS5zdGFydHNXaXRoKFwiLVwiKSkgPz8gbnMuZ2V0SG9zdG5hbWUoKTtcclxuICAvLyBEZWJ1ZyBjb250cm9scyBsb2dnaW5nIFxyXG4gIGNvbnN0IGRlYnVnID0gbnMuYXJncy5pbmNsdWRlcyhcIi0tZGVidWdcIik7XHJcblxyXG4gIC8vIHByaW50dXNhZ2UgY2hlY2tcclxuICBjb25zdCBoZWxwID0gbnMuYXJncy5pbmNsdWRlcyhcImhlbHBcIik7XHJcbiAgaWYgKGhlbHApIHtcclxuICAgIHByaW50dXNhZ2UobnMpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgaWYgKHRhcmdldFNlcnZlci5zdGFydHNXaXRoKFwiLVwiKSkge1xyXG4gICAgbnMudHByaW50KFwiSW52YWxpZCB1c2FnZTogZmlyc3Qgbm9uLWZsYWcgYXJnIG11c3QgYmUgYSBzZXJ2ZXIgbmFtZVwiKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8vIERlZmluZXMgaG93IG11Y2ggbW9uZXkgYSBzZXJ2ZXIgc2hvdWxkIGhhdmUgYmVmb3JlIHdlIGhhY2sgaXQgXHJcbiAgLy8gSW4gdGhpcyBjYXNlLCBpdCBpcyBzZXQgdG8gODAlIG9mIG1heFxyXG4gIGNvbnN0IG1vbmV5TXVsdCA9IChucy5hcmdzWzFdID8/IDgwKSAvIDEwMDtcclxuICBjb25zdCBtb25leVRocmVzaCA9IG5zLmdldFNlcnZlck1heE1vbmV5KHRhcmdldFNlcnZlcikgKiBtb25leU11bHQ7XHJcblxyXG4gIC8vIERlZmluZXMgdGhlIG1pbmltdW0gc2VjdXJpdHkgbGV2ZWwgdGhlIHRhcmdldFNlcnZlciBzZXJ2ZXIgY2FuIGhhdmUuIFxyXG4gIGNvbnN0IHNlY3VyaXR5VGhyZXNoID0gbnMuZ2V0U2VydmVyTWluU2VjdXJpdHlMZXZlbCh0YXJnZXRTZXJ2ZXIpICsgKG5zLmFyZ3NbMl0gPz8gNSk7XHJcblxyXG4gIC8vIEV4ZWN1dGUgaGFja3Mgb25jZVxyXG4gIGF3YWl0IG9wZW5Qb3J0cyhucywgdGFyZ2V0U2VydmVyKTtcclxuXHJcbiAgLy8gQ2FsbCBpbmZpbml0ZSBsb29wXHJcbiAgYXdhaXQgbG9vcChucywgdGFyZ2V0U2VydmVyLCBtb25leVRocmVzaCwgc2VjdXJpdHlUaHJlc2gsIGRlYnVnKTtcclxufVxyXG5cclxuLy8gSW5maW5pdGUgbG9vcFxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9vcChucywgdGFyZ2V0U2VydmVyLCBtb25leVRocmVzaCwgc2VjdXJpdHlUaHJlc2gsIGRlYnVnKSB7XHJcbiAgLy9Db3VudGVyc1xyXG4gIGxldCB3ZWFrY291bnQgPSAwO1xyXG4gIGxldCBncm93Y291bnQgPSAwO1xyXG4gIGxldCBoYWNrY291bnQgPSAwO1xyXG5cclxuICAvLyBJbmZpbml0ZSBsb29wIHRoYXQgY29udGlub3VzbHkgaGFja3MvZ3Jvd3Mvd2Vha2VucyB0aGUgdGFyZ2V0U2VydmVyLCBiYXNlZCBvbiBjb25maWdcclxuICB3aGlsZSAodHJ1ZSkge1xyXG4gICAgLy8gZGVmaW5lXHJcbiAgICBjb25zdCBjdXJyZW50c2VjID0gbnMuZ2V0U2VydmVyU2VjdXJpdHlMZXZlbCh0YXJnZXRTZXJ2ZXIpO1xyXG4gICAgY29uc3QgY3VycmVudG1vbmV5ID0gbnMuZ2V0U2VydmVyTW9uZXlBdmFpbGFibGUodGFyZ2V0U2VydmVyKTtcclxuICAgIG5zLnByaW50KFwiIFwiKTtcclxuXHJcbiAgICBpZiAoY3VycmVudHNlYyA+IHNlY3VyaXR5VGhyZXNoKSB7XHJcbiAgICAgIC8vIElmIHRoZSBzZXJ2ZXIncyBzZWN1cml0eSBsZXZlbCBpcyBhYm92ZSBvdXIgdGhyZXNob2xkLCB3ZWFrZW4gaXRcclxuICAgICAgaWYgKGRlYnVnKSBucy5wcmludChgQ3VycmVudCBTZWN1cml0eSBMZXZlbCBpcyBoaWdoZXIgdGhhbiB0aGUgdGhyZXNob2xkIC0gJHtjdXJyZW50c2VjfSAoY3VycmVudCkgPiAke3NlY3VyaXR5VGhyZXNofSAodGhyZXNob2xkKWApO1xyXG4gICAgICBhd2FpdCBucy53ZWFrZW4odGFyZ2V0U2VydmVyKTtcclxuICAgICAgd2Vha2NvdW50Kys7XHJcbiAgICAgIGlmIChkZWJ1ZykgbnMucHJpbnQoXCJSYW4gbnMud2Vha2VuXCIpO1xyXG5cclxuICAgIH0gZWxzZSBpZiAoY3VycmVudG1vbmV5IDwgbW9uZXlUaHJlc2gpIHtcclxuICAgICAgLy8gSWYgdGhlIHNlcnZlcidzIG1vbmV5IGlzIGxlc3MgdGhhbiBvdXIgdGhyZXNob2xkLCBncm93IGl0XHJcbiAgICAgIGlmIChkZWJ1ZykgbnMucHJpbnQoYEN1cnJlbnQgTW9uZXkgaXMgbG93ZXIgdGhhbiB0aGUgdGhyZXNob2xkIC0gJHtjdXJyZW50bW9uZXl9IChjdXJyZW50KSA8ICR7bW9uZXlUaHJlc2h9ICh0aHJlc2hvbGQpYCk7XHJcbiAgICAgIGF3YWl0IG5zLmdyb3codGFyZ2V0U2VydmVyKTtcclxuICAgICAgZ3Jvd2NvdW50Kys7XHJcbiAgICAgIGlmIChkZWJ1ZykgbnMucHJpbnQoXCJSYW4gbnMuZ3Jvd1wiKVxyXG5cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIE90aGVyd2lzZSwgaGFjayBpdFxyXG4gICAgICBpZiAoZGVidWcpIG5zLnByaW50KGBPcHRpbWFsIGhhY2sgY29uZGl0aW9ucyBtZXRgKTtcclxuICAgICAgYXdhaXQgbnMuaGFjayh0YXJnZXRTZXJ2ZXIpO1xyXG4gICAgICBoYWNrY291bnQrKztcclxuICAgICAgaWYgKGRlYnVnKSBucy5wcmludChcIlJhbiBucy5oYWNrXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vUHJpbnQgcmVwb3J0IGlmIGluIGRlYnVnXHJcbiAgICBpZiAoZGVidWcpIHtcclxuICAgICAgbnMucHJpbnQoXCIgXCIpO1xyXG4gICAgICBucy5wcmludChcIiBcIik7XHJcbiAgICAgIG5zLnByaW50KFwiKiBSdW4gQ291bnRzICpcIik7XHJcbiAgICAgIG5zLnByaW50KGBucy53ZWFrZW46ICR7d2Vha2NvdW50fSBgKTtcclxuICAgICAgbnMucHJpbnQoYG5zLmdyb3c6ICR7Z3Jvd2NvdW50fSBgKTtcclxuICAgICAgbnMucHJpbnQoYG5zLmhhY2s6ICR7aGFja2NvdW50fSBgKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8vIEF1dG9jb21wbGV0ZSBmdW5jdGlvblxyXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlKGRhdGEsIGFyZ3MpIHtcclxuICBjb25zdCBzZXJ2ZXJzID0gZGF0YS5zZXJ2ZXJzO1xyXG4gIGNvbnN0IHRocmVzaG9sZE1vbmV5UGN0ID0gXCI4MFwiXHJcbiAgY29uc3QgdGhyZXNob2xkTWluU2VjQWRkID0gXCI1XCJcclxuICAvLyBPZmZlciBhIGxpc3Qgb2YgYWxsIHNlcnZlcnMsIFRocmVzaG9sZE1vbmV5UGN0IGluICUsIExldmVscyB0byBhZGQgdG8gbWluaW11bSBzZWN1cml0eVxyXG4gIHJldHVybiBbLi4uc2VydmVycywgdGhyZXNob2xkTW9uZXlQY3QsIHRocmVzaG9sZE1pblNlY0FkZCwgXCItLWRlYnVnXCIsIFwiLS10YWlsXCIsIFwiLXQgMVwiXTtcclxufVxyXG5cclxuLy8gaGVscCAtIHByaW50dXNhZ2Ugd2hlbiBoZWxwIGlzIGdpdmVuIGFzIGFyZ1swXVxyXG5mdW5jdGlvbiBwcmludHVzYWdlKG5zKSB7XHJcbiAgbnMudHByaW50KFwiRnVuY3Rpb25hbGl0eTpcIik7XHJcbiAgbnMudHByaW50KFwiRXhlY3V0ZXMgcG9ydCBhdHRhY2tzIGFuZCBnYWlucyByb290IGlmIHJlcXVpcmVkLiBUaGVuIEhhY2ssIEdyb3csIFdlYWtlbiBhcyBpcyBvcHRpbWFsKVwiKTtcclxuICBucy50cHJpbnQoXCJJZiBubyBhcmdzIGFyZSBwcm92aWRlZCAtIHJ1bnMgb24gbG9jYWwgc2VydmVyIHdpdGggZGVmYXVsdCBzZXR0aW5nc1wiKVxyXG4gIG5zLnRwcmludChcIlJlY29tbWVuZGVkIHRvIHJ1biB3aXRoIHRoZSAnLS1kZWJ1ZycgZmxhZ1wiKVxyXG4gIG5zLnRwcmludChcIlVzYWdlOiBcIik7XHJcbiAgbnMudHByaW50KFwicnVuIHNpbXBsZS5qcyA8dGFyZ2V0U2VydmVyPiA8bW9uZXlwZXJjZW50PiA8bWluU2VjdXJpdHlvZmZzZXQ+IC0tZGVidWcgLXQgPG51bWJlcm9mdGhyZWFkcz5cIik7XHJcbiAgbnMudHByaW50KFwiRXhhbXBsZTogcnVuIHNpbXBsZS5qcyBuMDBkbGVzIC0tZGVidWcgLS10YWlsIC10IDFcIilcclxufVxyXG4iXX0=