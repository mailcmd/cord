document.querySelector('html').setAttribute('data-theme', 'dark');

const config = {
    createGlobals: false,
    strict: true,
    containers: {
        'tasks-list': {
            tasks: [ {desc: "tarea 1"} ]
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
    

