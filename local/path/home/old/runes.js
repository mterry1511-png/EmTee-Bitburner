/** @param {NS} ns */
export async function main(ns) {
  var target = ns.args[0];
  var maxseclevel = ns.getServerMinSecurityLevel(target) + 5;
  var moneythresh = ns.getServerMaxMoney(target) * 0.75;

  ns.print(``);
  ns.print(``);
  ns.print(`target: ${target}`);
  ns.print(`Max Security Level: ${maxseclevel}`);
  ns.print(`Money Threshold: ${moneythresh}`);
  ns.print(``);
  ns.print(``);

  while (true) {
    if (ns.getServerSecurityLevel(target) > maxseclevel) {
      await ns.weaken(target);
    }
    else if (ns.getServerMoneyAvailable(target) < moneythresh) {
      await ns.grow(target);
    }
    else {
      await ns.hack(target);
    }

  }
}