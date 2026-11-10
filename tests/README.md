# Yamb Café tests

Automated checks that run the real game in headless browsers ("phones").

    cd tests
    npm install            # once; also needs Playwright (npm i playwright && npx playwright install chromium)
    node online.js         # games on several phones: about 25 cases, 7 minutes
    node online.js pause   # only the cases whose name contains "pause"
    SEED=7 node online.js soak   # the random soak test with another seed
    node ai-bench.js       # how well the computer players and the coach play

`online.js` starts its own web server and its own PeerJS server, so nothing touches the live game.
Every case ends by checking that all phones show exactly the same game.
