# Yamb Café tests

Automated checks that run the real game in headless browsers ("phones").

    cd tests
    npm install            # once; also needs Playwright (npm i playwright && npx playwright install chromium)
    node online.js         # games on several phones: about 25 cases, 7 minutes
    node online.js pause   # only the cases whose name contains "pause"
    SEED=7 node online.js soak   # the random soak test with another seed
    node ai-bench.js       # average score of each computer player on classic rules (about 8 minutes)
    node ai-bench.js --check   # release check: review agrees with the Professor, characters keep their order
    node ai-bench.js --who profesor --rules quick,family,full --games 300

`online.js` starts its own web server and its own PeerJS server, so nothing touches the live game.
Every case ends by checking that all phones show exactly the same game.

`ai-bench.js` lets each computer player play whole games alone. The dice are seeded and every turn has its own dice,
so two versions of `ai.js` meet the same luck and can be compared game by game (`--ai path/to/other/ai.js`).
