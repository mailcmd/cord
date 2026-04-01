document.querySelector('html').setAttribute('data-theme', 'dark');

const config = {
    createGlobals: false,
    strict: true,
    websocket: {
        url: 'ws://localhost:8080/websocket',
        onmessage: syslib.onmessage
    },
    containers: {
        loading: {
            message: 'Loading...'
        },
        login: {
            error: ''
        },
        header: {
            title: document.head.querySelector('title').innerText
        },
        main: {
            token: null,
            loading: true,
            username: ""
        },
        options: {
            visible: false,
            channels: []
        }
    }
};

window.addEventListener('cordready', e => {
    $CORD.init(config);
});

window.addEventListener('cordwebsocketready', e => {
    syslib.check_session();
});


    

