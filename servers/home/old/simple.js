/**
 * Main entry point that continuously hacks/grows/weakens a target based on security and money thresholds.
 * @param {NS} ns - The Netscript API object
 * @returns {Promise<void>}
 */
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
  openPorts(ns, targetServer);

  // Call infinite loop
  await loop(ns, targetServer, moneyThresh, securityThresh, debug);
}

/**
 * Infinite loop that continuously hacks/grows/weakens the target based on conditions.
 * @param {NS} ns - The Netscript API object
 * @param {string} targetServer - The target server hostname
 * @param {number} moneyThresh - Money threshold for hacking
 * @param {number} securityThresh - Security threshold for weakening
 * @param {boolean} debug - Enable debug logging
 * @returns {Promise<void>}
 */
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
      if (debug) ns.print(`Current Security Level is higher than the threshold - ${currentsec} (current) > ${securityThresh} (threshold)`);
      await ns.weaken(targetServer);
      weakcount++;
      if (debug) ns.print("Ran ns.weaken");

    } else if (currentmoney < moneyThresh) {
      // If the server's money is less than our threshold, grow it
      if (debug) ns.print(`Current Money is lower than the threshold - ${currentmoney} (current) < ${moneyThresh} (threshold)`);
      await ns.grow(targetServer);
      growcount++;
      if (debug) ns.print("Ran ns.grow")

    } else {
      // Otherwise, hack it
      if (debug) ns.print(`Optimal hack conditions met`);
      await ns.hack(targetServer);
      hackcount++;
      if (debug) ns.print("Ran ns.hack");
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

/**
 * Autocomplete function for simple.js arguments.
 * @param {object} data - The autocomplete data object
 * @param {array} args - Current command arguments
 * @returns {array} Array of autocomplete suggestions
 */
export function autocomplete(data, args) {
  const servers = data.servers;
  const thresholdMoneyPct = "80"
  const thresholdMinSecAdd = "5"
  // Offer a list of all servers, ThresholdMoneyPct in %, Levels to add to minimum security
  return [...servers, thresholdMoneyPct, thresholdMinSecAdd, "--debug", "--tail", "-t 1"];
}

// help - printusage when help is given as arg[0]
function printusage(ns) {
  ns.tprint("Functionality:");
  ns.tprint("Executes port attacks and gains root if required. Then Hack, Grow, Weaken as is optimal)");
  ns.tprint("If no args are provided - runs on local server with default settings")
  ns.tprint("Recommended to run with the '--debug' flag")
  ns.tprint("Usage: ");
  ns.tprint("run simple.js <targetServer> <moneypercent> <minSecurityoffset> --debug -t <numberofthreads>");
  ns.tprint("Example: run simple.js n00dles --debug --tail -t 1")
}

// Open ports function
function openPorts(ns, targetServer) {
  //* Opens ports then grants root
  let runExes = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "SQLInject.exe",
    "HTTPWorm.exe"
  ]

  for (const exe of runExes) {
    //* Open ports *//
    switch (exe) {
      case "BruteSSH.exe":
        // If we have the BruteSSH.exe program, use it to open the SSH Port on the targetServer
        if (ns.fileExists("BruteSSH.exe", "home")) {
          ns.brutessh(targetServer);
        }
        break;

      case "FTPCrack.exe":
        // If we have the FTPCrack.exe program, use it to open the FTP Port on the targetServer
        if (ns.fileExists("FTPCrack.exe", "home")) {
          ns.ftpcrack(targetServer);
        }
        break;

      case "relaySMTP.exe":
        // If we have the relaySMTP.exe program, use it to open the SMTP Port on the targetServer
        if (ns.fileExists("relaySMTP.exe", "home")) {
          ns.relaysmtp(targetServer);
        }
        break;

      case "SQLInject.exe":
        // If we have the SQLInject.exe program, use it to open the SQL Port on the targetServer
        if (ns.fileExists("SQLInject.exe", "home")) {
          ns.sqlinject(targetServer);
        }
        break;

      case "HTTPWorm.exe":
        // If we have the HTTPWorm.exe program, use it to open the HTTP Port on the targetServer
        if (ns.fileExists("HTTPWorm.exe", "home")) {
          ns.httpworm(targetServer);
        }
        break;
    }
  }
  // Get root access to targetServer server if no root access
  if (!ns.hasRootAccess(targetServer)) {
    ns.nuke(targetServer);
    ns.print("Successfully Nuked for root")
  }
  else {
    ns.print("Already had root");
    return
  }
}

