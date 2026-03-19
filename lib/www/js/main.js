const config = {
    createGlobals: true,
    strict: true,
    // websocket: {
    //     url: 'ws://localhost:8080/websocket',
    //     reconnect: true,
    //     reconnect_delay: 1000
    // },
    initials: {
        'clock-1': {
            hour: 10,
            min: 20,
            sec: 30,
            klass: 'red',
            margin_left: 0,
            rows: [
                {a: 1, b: 2},
                {a: 3, b: 4}
            ]        
        },
        'clock-2': {
            klass: 'red',
            hour: 1000,
            min: 2000,
            sec: 3000
        },
        counter: {
            value: 15
        }
    }
};

$CORD.init(config);

function update_clock() {
    const t = Temporal.Now.plainTimeISO();
    $CORD.update('clock-1', {
        hour: t.hour,
        min: t.minute,
        sec: t.second,
//        klass: t.second % 2 == 0 ? 'red' : 'blue'
    });
}         
//setInterval(update_clock, 1000);
