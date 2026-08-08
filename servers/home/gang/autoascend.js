
export async function main(ns, ascendThreshold) {
    const gang = ns.gang.getMemberNames();

    // ascend check
    for (const member of gang) {
        const ascendMults = ns.gang.getAscensionResult(member);
        // getAscensionResult returns undefined when ascension isn't possible yet
        // (e.g. a freshly recruited member with no ascension gains) - skip rather
        // than crash on ascendMults.hack below
        if (!ascendMults) continue;

        const meanMult = (ascendMults.hack + ascendMults.str + ascendMults.def + ascendMults.dex + ascendMults.agi + ascendMults.cha) / 6;
        if (ascendThreshold < meanMult) {
            ns.gang.ascendMember(member);
            ns.print(member + " ascended");
        }
    }
}