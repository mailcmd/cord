const config = {
    createGlobals: true,
    strict: true,
    initials: {
        'tasks-list': {
            tasks: [ {desc: "tarea 1"} ]
        }
    }
};

$CORD.init(config);
