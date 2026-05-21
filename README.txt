EmTee's Bitburner 1.0
Huge release. Fully usable and ready to smash the game. 


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
    run refresh.js
    run dispatch.js

    run buyserver.js <NEWSERVER>
    run cloudpush.js <NEWSERVER>
    run dispatch.js <NEWSERVER>
