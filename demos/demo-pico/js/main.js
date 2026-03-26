document.querySelector('html').setAttribute('data-theme', 'dark');

const config = {
    createGlobals: false,
    strict: true,
    containers: {
        'tasks-list': {
            tasks: [
                { nro: 1, desc: "tarea 1"},
                {nro: 2, desc: "tarea 2"}
            ]
        },
        'demo-counter': {
            counter: 0
        }
    }
};

async function add_clock() {
    await $CORD.add_template('@demo-pico/templates/clock.thtml');
    
    const t = Temporal.Now.plainTimeISO();
    const hour = t.hour.toString().padStart(2, '0');
    const minute = t.minute.toString().padStart(2, '0');
    const second = t.second.toString().padStart(2, '0');    
    
    await $CORD.create_container({
        id: 'clock',
        tpl_ref: 'clock',
        datas: {
            hour: hour,
            minute: minute,
            second: second,
            destroy: ()=>clearInterval(clock_task)
        }
    });
}

window.addEventListener('cordready', e => {
    $CORD.init(config);
    desc.focus();
});
    

