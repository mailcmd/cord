document.querySelector('html').setAttribute('data-theme', 'dark');

const config = {
    createGlobals: false,
    strict: true,
    websocket: {
        url: 'ws://localhost:8080/websocket',
        onmessage: console.log // generic message receiver 
    },
    containers: {
        loading: {
            message: 'Loading...'
        },
        header: {
            title: 'SPI Down Monitor'
        },
        main: {
            token: null,
            loading: false
        }
    }
};

window.addEventListener('cordready', e => {
    $CORD.init(config);
});
    

