/** @param {NS} ns */
export async function main(ns) {
  var target = ns.args[0];

  while (true) {

    if (ns.getServerSecurityLevel(target) > (ns.getServerMinSecurityLevel(target) + 5)) {
      break
    }
    else if (ns.getServerMoneyAvailable(target) < (ns.getServerMaxMoney(target) * 0.05)) {
      break
    }
    await ns.hack(target);
  }
}