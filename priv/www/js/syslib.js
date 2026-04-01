function Syslib() {
    /////////////////////////////////////////////////////////////////////////////////
    // Private
    /////////////////////////////////////////////////////////////////////////////////
    const set_cookie = function(name, value, minutes_to_expire = 60) {
        let cookie = name + "=" + encodeURIComponent(value);
        if (typeof minutes_to_expire === "number") {
            cookie += "; max-age=" + parseInt(minutes_to_expire*60);
            document.cookie = cookie;
        }
    };

    const get_cookie = function(name) {
        let cookieArr = document.cookie.split(";");
        for(let i = 0; i < cookieArr.length; i++) {
            let cookiePair = cookieArr[i].split("=");
            if(name == cookiePair[0].trim()) {
                return decodeURIComponent(cookiePair[1]);
            }
        }
        return null;
    };

    const delete_cookie = function(name) {
        set_cookie(name, 'none', 0);
    };

    const random_id = function() {
        return Math.random().toString().slice(2)
    };

    const send = function(action, data, callback = console.log) {
        $CORD.ws.send(
            {
                ...{msg_id: random_id(), action: action, token: $CORD.get("main:token")},
                ...data
            },
            callback
        );
    };

    const notify = {
        log: function() {
            console.log(...arguments)
        },
        warn: function() {
            console.warn(...arguments)
        },
        error: function() {
            console.error(...arguments)
        },
    };

    const attend_broadcast = function(msg) {
        switch (msg.action) {
        case 'add_channel':
            $CORD.update_object('options', 'channels', {action: 'push', datas: [msg.target]})
            break;
        }
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Default message receiver
    /////////////////////////////////////////////////////////////////////////////////
    this.onmessage = function(msg) {
        console.log('SYSLIB_ONMESSAGE', msg)
        switch (msg.channel) {
        case 'broadcast':
            attend_broadcast(msg);
            break;

        case '':
            break

        default:
            console.warn(`TODO: manage messages to channel = ${msg.channel} - msg:`, msg)
        }
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////

    this.show_loading = function(text = 'Loading...') {
        $CORD.set('loading:message', text);
        $CORD.set('main:loading', true);
    };

    this.hide_loading = function() {
        $CORD.set('main:loading', false);
    };

    this.authorize_user = function(user, pass) {
        $CORD.set("login:error", "")
        this.show_loading('Authorizing user...');

        send(
            'authorize',
            {user: user, pass: pass},
            msg => {
                console.log('AUTH', msg)
                this.hide_loading();
                if (msg.token) {
                    // login ok
                    $CORD.set("main:token", msg.token)
                    $CORD.set("main:user", user)
                    $CORD.set('options:channels', msg.subs);
                    set_cookie('token', msg.token);
                    set_cookie('user', user);
                } else {
                    // login fail
                    $CORD.set("login:error", "Incorrect user or password!")
                }
            }
        );
    };

    this.check_session = function() {
        const token = get_cookie('token');
        if (token === null) {
            this.hide_loading();
            return;
        }
        this.show_loading('Checking session opened...');

        send(
            'check_session',
            {token: token},
            msg => {
                if (!msg.token) {
                    // This block is never reached (cord-update message is intercepted)
                    $CORD.set('main:token', null);
                    $CORD.set("login:error", "Session exired!")
                } else {
                    $CORD.set('main:token', token);
                    $CORD.set('main:user', get_cookie('user'));
                    $CORD.set('options:channels', msg.subs);
                }
                this.hide_loading();
            }
        );
    };

    this.subscribe = function(channel) {
        send(
            'subscribe',
            {channel: channel},
            msg => {
                if (!msg.result_ok) {
                    notify.warn(`Subscription to channel '${channel}' failed!`);
                } else {
                    notify.log(`Subscription to channel '${channel}' ok!`);
                }
            }
        );
    };

    this.unsubscribe = function(channel) {
        send(
            'unsubscribe',
            {channel: channel},
            msg => {
                if (!msg.result_ok) {
                    notify.warn(`Unsubscription from channel '${channel}' failed!`);
                } else {
                    notify.log(`Unsubscription from channel '${channel}' ok!`);
                }
            }
        );
    };

    this.renew_token = function() {
        send(
            'renew_token',
            {},
            msg => {
                if (!msg.token) {
                    notify.warn(`Renew token failed!`);
                } else {
                    set_cookie('token', msg.token);
                    notify.log('New token assigned:', msg.token);
                }
            }
        );
    };

    this.get_channels = function(callback = console.log) {
        send(
            'get_channels',
            {},
            callback
        );
    };
}

const syslib = new Syslib();
