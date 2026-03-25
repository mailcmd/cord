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

window.addEventListener('cordready', e => {
    $CORD.init(config);
    desc.focus();
});
    

