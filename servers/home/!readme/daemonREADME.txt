**Daemon-managed cloud scripts — conventions and requirements**

Scripts added to `watchedScripts` in `cfg.json` are automatically supervised by `daemon.js`. For each cloud server each tick, the daemon calls `ensureRunning()` which checks if the script is running on that cloud and execs it if not. The following conventions must be followed for any new watched script:

**Argument convention**
Every watched script receives `cloudName` as its first argument, passed automatically by `ensureRunning`. This is hardcoded inside the function — you do not pass it at the call site. New scripts must declare `ns.args[0]` as their target cloud name and handle it accordingly. If a script needs additional args beyond `cloudName`, `ensureRunning` will need to be extended to support them — this is not currently implemented.

**Script placement**
Scripts must live on home. `cloudpush.js` handles copying all home scripts to cloud servers each tick, so any new watched script will be available on cloud servers automatically without manual `scp` calls. Do not add scp logic to `ensureRunning` or `daemon.js`.

**Script behaviour**
Watched scripts run on the cloud server, not home. They should be self-contained loops with their own sleep interval. If they need config, they read `cfg.json` directly. If they exit or crash, the daemon will re-exec them on the next tick.

**Adding a new watched script**
1. Write the script, ensuring `ns.args[0]` is used as the target cloud name
2. Add the filename to `watchedScripts` in `cfg.json`
3. Nothing else — the daemon and cloudpush handle the rest

**`ensureRunning` signature**
```js
ensureRunning(ns, script, cloudName, pid = null)
```
The `pid` parameter is a placeholder for future PID-based process checking and is not yet implemented. Leave it unused for now.