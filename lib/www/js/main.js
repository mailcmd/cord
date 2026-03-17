const config = {
    createGlobals: true
};
$CORD.init({
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
    counter: {
        value: 15
    }
}, config);

function update_clock() {
    const t = Temporal.Now.plainTimeISO();
    $CORD.update('clock-1', {
        hour: t.hour,
        min: t.minute,
        sec: t.second,
//        klass: t.second % 2 == 0 ? 'red' : 'blue'
    });
}         
setInterval(update_clock, 1000);
