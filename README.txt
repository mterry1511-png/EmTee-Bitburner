EmTee's Bitburner v1.1
Updated go.js args 1-6 for semi-automation of things

Next steps:
- add to daemon: 
    Hacknet buy script
    programs buy script  !! REQUIRES SINGULARITY (add flags for dispatch.js to relaunch)
        Relaunch dispatch.js every x time or on flag

-set defaults in cfg scripts

- Dashboard for cloud servers status?????

Future:
- Scheduler!
- BIG batching hack code


                 ``          
             -odmmNmds:      
           `hNmo:..-omNh.    
           yMd`      `hNh    
           mMd        oNm    
           oMNo      .mM/    
           `dMN+    -mM+     
            -mMNo  -mN+      
  .+-        :mMNo/mN/       
:yNMd.        :NMNNN/        
-mMMMh.        /NMMh`        
 .dMMMd.       /NMMMy`       
  `yMMMd.     /NNyNMMh`      
   `sMMMd.   +Nm: +NMMh.     
     oMMMm- oNm:   /NMMd.    
      +NMMmsMm-     :mMMd.   
       /NMMMm-       -mMMd.  
        /MMMm-        -mMMd. 
       `sMNMMm-        .mMmo 
      `sMd:hMMm.        ./.  
     `yMy` `yNMd`            
    `hMs`    oMMy            
   `hMh       sMN-           
   /MM-       .NMo           
   +MM:       :MM+           
    sNNo-.`.-omNy`           
     -smNNNNmdo-             
        `..`                 s






Older notes (needs cleaning up :) )
                                        Next Step: dispatch tweak
                                        Dispatch adjustment summary:

                                        **Goal:** Dispatch clouds efficiently — 1 deployer per cloud server, 1 target each, paired by RAM rank.

                                        **Step 1 — `getCloudServers(ns)` in util.js**
                                        New exported function. Returns `ns.getPurchasedServers()` sorted by max RAM descending, filtered to those with enough RAM to run deployer.js. No `leaveRamFree` applied. Signature: `getCloudServers(ns)`.

                                        **Step 2 — dispatch.js new default behaviour**
                                        Triggered when no args passed. Before dispatching, kill all running deployer.js instances on all cloud servers — this cascades to their children via the existing `ns.atExit` cleanup in deployer. Then get ranked targets and cloud list, zip by index, exec one deployer per cloud passing the cloud as scripthost and its assigned target. Launch count is `Math.min(targets.length, clouds.length)`. Existing modes untouched.

                                        **Step 3 — buyserver.js threshold check**
                                        After the doubling loop finds `affordableRam`, check against `cfg.purchaseConfig.mincloudRAM` before purchasing. If below threshold, print and exit without buying. Config key already exists in cfg.json.

                                        **Decisions resolved:**
                                        - Dispatch kills all deployers on clouds before re-dispatching ✓
                                        - Home excluded from cloud pool ✓
                                        - `leaveRamFree` not applied to clouds ✓


                                        tweak dispatch.js?
                                        cloudBuy.js
                                        Scheduler from home (STRONG AS HELL)

                                        Next up
                                            dispatch.js v2
                                            1. Load cfg
                                            2. Build myServers list:
                                        - Always include purchased servers
                                        - Include home only if cfg.deployToHome is true
                                            3. Kill all deployer.js on all myServers
                                            4. Get ranked targets from targeting
                                            5. Sort myServers by available RAM descending
                                                - For home, subtract leaveRamFree from available RAM
                                            6. Filter out servers with insufficient RAM to run deployer.js
                                            7. Assign targets to servers:
                                                - Zip targets and servers together cycling through servers
                                                - Skip if target already being attacked (post-kill this is unlikely but safe to check)
                                                - Skip server if insufficient RAM for this specific exec
                                            8. Exec deployer on each assignment
                                            9. Print summary and exit



                                            basic controller
                                            config json handler script
                                            add cloud ram json for glancing at
                                            watch tools
                                            autopurchase watch
                                            only launch enough threads to take all the moneyyyyyy
                                            


                                        stuff I am doing to script up 
                                                1st time
                                            <SET UP CONFIG> - create a script to modify these values???????
                                            run init.js
                                            
                                                each time after
                                            killall
                                            <ADJUSTING CONFIG FILE FOR SERVER NUMBER>
                                            run refresh.js
                                            run dispatch.js

                                            run buyserver.js <NEWSERVER>
                                            run cloudpush.js <NEWSERVER>
                                            run dispatch.js <NEWSERVER>

