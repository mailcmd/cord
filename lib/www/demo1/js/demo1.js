const config = {
    createGlobals: true,
    strict: true,
    containers: {
        'tasks-list': {
            tasks: [ {desc: "tarea 1"} ]
        },
        counter: {
            value: 0
        }
    }
};

$CORD.init(config);
