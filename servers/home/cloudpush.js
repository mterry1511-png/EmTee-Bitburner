/** @param {NS} ns */
// Execute from home. Script pushes itself to the specified targetCloud then restarts but running from the targetCloud instead, 
// updating scripts automatically as they are updated.
export async function main(ns) {
    //set cloud targetCloud name from args, default to "cloud" if not provided
    const targetCloud = ns.args[0] ?? "cloud";
    // Helper - printusage when using help as arg
    if (ns.args[0] === "help") {
        printusage(ns);
        return;
    }
    // if running from home, push scripts to cloud and restart from there
    if (ns.getHostname() === "home") {
        ns.scp("cloudpush.js", targetCloud, "home");
        ns.exec("cloudpush.js", targetCloud, 1, targetCloud);
        return;
    }
    // if running from cloud, start to loop
    else {
        // Automatically tail and disable logs
        // ns.ui.openTail();
        ns.disableLog("disableLog");
        ns.disableLog("scp");
        if (targetCloud === ns.getHostname()) {
            // Loop if ran from the cloud targetCloud, pushing updates from home at the interval defined in cfg.json
            while (true) {
                await pushScripts(ns, targetCloud);
                const cloudpushSleep = JSON.parse(ns.read("cfg.json")).cloudpushSleep ?? 5000;
                await ns.sleep(cloudpushSleep);
            }
        }
    }
}
// Push scripts function, called in main loop
export async function pushScripts(ns, targetCloud) {
    // Define all .js and .json files to push here
    const scripts = ns.ls("home", ".js");
    scripts.push(...ns.ls("home", ".json"));
    // Update scripts on cloud
    ns.scp(scripts, targetCloud, "home");
    // Print results to terminal
    ns.print("Pushed the following scripts to " + targetCloud + ":");
    for (const s of scripts) {
        ns.print("- " + s + "\n");
    }
}
// printusage function
function printusage(ns) {
    ns.tprint("");
    ns.tprint("Usage: Run from home server only. run cloudpush.js [targetCloud]");
    ns.tprint("If no cloudservername is provided, it will default to 'cloud'.");
    ns.tprint("This script will copy all scripts to the specified targetCloud then execute itself from there.");
    ns.tprint("Will constantly push updates to the cloud server.");
    ns.tprint("i.e. run cloudpush.js cloud");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWRwdXNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2Nsb3VkcHVzaC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxxQkFBcUI7QUFFckIsZ0lBQWdJO0FBQ2hJLHNEQUFzRDtBQUN0RCxNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FBQyxFQUFFO0lBQzNCLDBFQUEwRTtJQUMxRSxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQztJQUUxQyw2Q0FBNkM7SUFDN0MsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQU0sRUFBRTtRQUN6QixVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDZixPQUFPO0tBQ1I7SUFFRCxxRUFBcUU7SUFDckUsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLEtBQUssTUFBTSxFQUFFO1FBQy9CLEVBQUUsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM1QyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3JELE9BQU87S0FDUjtJQUNELHVDQUF1QztTQUNsQztRQUNILHNDQUFzQztRQUN0QyxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2pCLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDNUIsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVyQixJQUFJLFdBQVcsS0FBSyxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDcEMsd0dBQXdHO1lBQ3hHLE9BQU8sSUFBSSxFQUFFO2dCQUNYLE1BQU0sV0FBVyxDQUFDLEVBQUUsRUFBRSxXQUFXLENBQUMsQ0FBQztnQkFDbkMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQztnQkFDOUUsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO2FBQ2hDO1NBQ0Y7S0FDRjtBQUNILENBQUM7QUFFRCw2Q0FBNkM7QUFDN0MsTUFBTSxDQUFDLEtBQUssVUFBVSxXQUFXLENBQUMsRUFBRSxFQUFFLFdBQVc7SUFFL0MsOENBQThDO0lBQzlDLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3JDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBRXhDLDBCQUEwQjtJQUMxQixFQUFFLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFckMsNEJBQTRCO0lBQzVCLEVBQUUsQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEdBQUcsV0FBVyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ2pFLEtBQUssTUFBTSxDQUFDLElBQUksT0FBTyxFQUFFO1FBQ3ZCLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztLQUMzQjtBQUNILENBQUM7QUFFRCxzQkFBc0I7QUFDdEIsU0FBUyxVQUFVLENBQUMsRUFBRTtJQUNwQixFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2QsRUFBRSxDQUFDLE1BQU0sQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO0lBQzlFLEVBQUUsQ0FBQyxNQUFNLENBQUMsZ0VBQWdFLENBQUMsQ0FBQztJQUM1RSxFQUFFLENBQUMsTUFBTSxDQUFDLGdHQUFnRyxDQUFDLENBQUM7SUFDNUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxtREFBbUQsQ0FBQyxDQUFDO0lBQy9ELEVBQUUsQ0FBQyxNQUFNLENBQUMsNkJBQTZCLENBQUMsQ0FBQztBQUMzQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqIEBwYXJhbSB7TlN9IG5zICovXHJcblxyXG4vLyBFeGVjdXRlIGZyb20gaG9tZS4gU2NyaXB0IHB1c2hlcyBpdHNlbGYgdG8gdGhlIHNwZWNpZmllZCB0YXJnZXRDbG91ZCB0aGVuIHJlc3RhcnRzIGJ1dCBydW5uaW5nIGZyb20gdGhlIHRhcmdldENsb3VkIGluc3RlYWQsIFxyXG4vLyB1cGRhdGluZyBzY3JpcHRzIGF1dG9tYXRpY2FsbHkgYXMgdGhleSBhcmUgdXBkYXRlZC5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1haW4obnMpIHtcclxuICAvL3NldCBjbG91ZCB0YXJnZXRDbG91ZCBuYW1lIGZyb20gYXJncywgZGVmYXVsdCB0byBcImNsb3VkXCIgaWYgbm90IHByb3ZpZGVkXHJcbiAgY29uc3QgdGFyZ2V0Q2xvdWQgPSBucy5hcmdzWzBdID8/IFwiY2xvdWRcIjtcclxuXHJcbiAgLy8gSGVscGVyIC0gcHJpbnR1c2FnZSB3aGVuIHVzaW5nIGhlbHAgYXMgYXJnXHJcbiAgaWYgKG5zLmFyZ3NbMF0gPT09IFwiaGVscFwiKSB7XHJcbiAgICBwcmludHVzYWdlKG5zKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8vIGlmIHJ1bm5pbmcgZnJvbSBob21lLCBwdXNoIHNjcmlwdHMgdG8gY2xvdWQgYW5kIHJlc3RhcnQgZnJvbSB0aGVyZVxyXG4gIGlmIChucy5nZXRIb3N0bmFtZSgpID09PSBcImhvbWVcIikge1xyXG4gICAgbnMuc2NwKFwiY2xvdWRwdXNoLmpzXCIsIHRhcmdldENsb3VkLCBcImhvbWVcIik7XHJcbiAgICBucy5leGVjKFwiY2xvdWRwdXNoLmpzXCIsIHRhcmdldENsb3VkLCAxLCB0YXJnZXRDbG91ZCk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIC8vIGlmIHJ1bm5pbmcgZnJvbSBjbG91ZCwgc3RhcnQgdG8gbG9vcFxyXG4gIGVsc2Uge1xyXG4gICAgLy8gQXV0b21hdGljYWxseSB0YWlsIGFuZCBkaXNhYmxlIGxvZ3NcclxuICAgIG5zLnVpLm9wZW5UYWlsKCk7XHJcbiAgICBucy5kaXNhYmxlTG9nKFwiZGlzYWJsZUxvZ1wiKTtcclxuICAgIG5zLmRpc2FibGVMb2coXCJzY3BcIik7XHJcblxyXG4gICAgaWYgKHRhcmdldENsb3VkID09PSBucy5nZXRIb3N0bmFtZSgpKSB7XHJcbiAgICAgIC8vIExvb3AgaWYgcmFuIGZyb20gdGhlIGNsb3VkIHRhcmdldENsb3VkLCBwdXNoaW5nIHVwZGF0ZXMgZnJvbSBob21lIGF0IHRoZSBpbnRlcnZhbCBkZWZpbmVkIGluIGNmZy5qc29uXHJcbiAgICAgIHdoaWxlICh0cnVlKSB7XHJcbiAgICAgICAgYXdhaXQgcHVzaFNjcmlwdHMobnMsIHRhcmdldENsb3VkKTtcclxuICAgICAgICBjb25zdCBjbG91ZHB1c2hTbGVlcCA9IEpTT04ucGFyc2UobnMucmVhZChcImNmZy5qc29uXCIpKS5jbG91ZHB1c2hTbGVlcCA/PyA1MDAwO1xyXG4gICAgICAgIGF3YWl0IG5zLnNsZWVwKGNsb3VkcHVzaFNsZWVwKTsgXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8vIFB1c2ggc2NyaXB0cyBmdW5jdGlvbiwgY2FsbGVkIGluIG1haW4gbG9vcFxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHVzaFNjcmlwdHMobnMsIHRhcmdldENsb3VkKSB7XHJcbiAgXHJcbiAgLy8gRGVmaW5lIGFsbCAuanMgYW5kIC5qc29uIGZpbGVzIHRvIHB1c2ggaGVyZVxyXG4gIGNvbnN0IHNjcmlwdHMgPSBucy5scyhcImhvbWVcIiwgXCIuanNcIik7XHJcbiAgc2NyaXB0cy5wdXNoKC4uLm5zLmxzKFwiaG9tZVwiLCBcIi5qc29uXCIpKTtcclxuXHJcbiAgLy8gVXBkYXRlIHNjcmlwdHMgb24gY2xvdWRcclxuICBucy5zY3Aoc2NyaXB0cywgdGFyZ2V0Q2xvdWQsIFwiaG9tZVwiKTtcclxuXHJcbiAgLy8gUHJpbnQgcmVzdWx0cyB0byB0ZXJtaW5hbFxyXG4gIG5zLnByaW50KFwiUHVzaGVkIHRoZSBmb2xsb3dpbmcgc2NyaXB0cyB0byBcIiArIHRhcmdldENsb3VkICsgXCI6XCIpO1xyXG4gIGZvciAoY29uc3QgcyBvZiBzY3JpcHRzKSB7IFxyXG4gICAgbnMucHJpbnQoXCItIFwiICsgcyArIFwiXFxuXCIpO1xyXG4gIH1cclxufVxyXG5cclxuLy8gcHJpbnR1c2FnZSBmdW5jdGlvblxyXG5mdW5jdGlvbiBwcmludHVzYWdlKG5zKSB7XHJcbiAgbnMudHByaW50KFwiXCIpO1xyXG4gIG5zLnRwcmludChcIlVzYWdlOiBSdW4gZnJvbSBob21lIHNlcnZlciBvbmx5LiBydW4gY2xvdWRwdXNoLmpzIFt0YXJnZXRDbG91ZF1cIik7XHJcbiAgbnMudHByaW50KFwiSWYgbm8gY2xvdWRzZXJ2ZXJuYW1lIGlzIHByb3ZpZGVkLCBpdCB3aWxsIGRlZmF1bHQgdG8gJ2Nsb3VkJy5cIik7XHJcbiAgbnMudHByaW50KFwiVGhpcyBzY3JpcHQgd2lsbCBjb3B5IGFsbCBzY3JpcHRzIHRvIHRoZSBzcGVjaWZpZWQgdGFyZ2V0Q2xvdWQgdGhlbiBleGVjdXRlIGl0c2VsZiBmcm9tIHRoZXJlLlwiKTtcclxuICBucy50cHJpbnQoXCJXaWxsIGNvbnN0YW50bHkgcHVzaCB1cGRhdGVzIHRvIHRoZSBjbG91ZCBzZXJ2ZXIuXCIpO1xyXG4gIG5zLnRwcmludChcImkuZS4gcnVuIGNsb3VkcHVzaC5qcyBjbG91ZFwiKTtcclxufSJdfQ==