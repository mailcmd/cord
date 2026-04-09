
/*
  TODO:
  - [x] Load/save config, permanent by user
  - [ ] Keep permanent register of active alerts
 */

const colors = [
    'yellow',
    'red',
    'green',
    'blue',
    'blueviolet',
    'coral',
    'darkorange'
];


document.querySelector('html').setAttribute('data-theme', 'dark');

const config = {
    createGlobals: false,
    strict: true,
    websocket: {
        url: 'ws://localhost:8080/websocket',
        onmessage: applib.onmessage,
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
            title: document.head.querySelector('title').innerText,
            version: ''
        },
        main: {
            token: syslib.get_cookie('token'),
            loading: true,
            user: '',
            map_visible: false,
            alerts: [],
            first_time: true,
            search: ''
        },
        options: {
            visible: false,
            channels: [],
            subs: [],
            colors: {}
        },
        messages: {
            show: false,
            text: '',
            color: 'green'
        },
        context_menu: {
            menu: [],
            visible: false,
            y: 0,
            x: 0
        }
    }
};

window.addEventListener('cordready', e => {
    $CORD.init(config);
    setInterval(applib.check_session.bind(applib), 30000);
});

window.addEventListener('cordwebsocketready', e => {
    applib.check_session();
    
    document.body.querySelector('main').addEventListener('click', e => {
        $CORD.$.options.$visible = false;
        $CORD.$.context_menu.$visible = false;
    });
});

