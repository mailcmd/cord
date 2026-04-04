/*
  TODO:
  - [x] Load/save config, permanent by user
  - [ ] Keep permanent register of active alerts
 */

document.querySelector('html').setAttribute('data-theme', 'dark');

const config = {
    createGlobals: false,
    strict: true,
    websocket: {
        url: 'ws://localhost:8080/websocket',
        onmessage: syslib.onmessage,
        reconnect_delay: 3000
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
            token: syslib.get_cookie('token'),
            loading: true,
            user: '',
            map_visible: false,
            alerts: []
        },
        options: {
            visible: false,
            channels: [],
            subs: [],
            colors: [
                'yellow',
                'red',
                'green',
                'blue',
                'blueviolet',
                'coral',
                'darkorange'
            ]
        }
    }
};

window.addEventListener('cordready', e => {
    $CORD.init(config);
});

window.addEventListener('cordwebsocketready', e => {
    syslib.check_session();
    setInterval(syslib.check_session, 30000);
});

