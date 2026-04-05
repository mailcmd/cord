const markers = {};
var map;
var first_time = true;


function Syslib() {
    const $this = this;
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

    const init_session = function(user, msg) {
        // login ok
        if ($CORD.$.main.token != msg.token) {
            $CORD.update('main', {
                token: msg.token,
                user: user
            });
            // cookies
            set_cookie('token', msg.token);
            set_cookie('user', user);
        }

        if (!$CORD.$.options.channels.is_equal(msg.channels)
            || !$CORD.$.options.subs.is_equal(msg.subs)) {
            $CORD.update('options', {
                channels: msg.channels,
                subs: msg.subs
            });
        }

        // load config if it is first time
        if (first_time) $this.load_config();

        // init map
        if (!map) $this.map_load(msg.lat, msg.lng);
        first_time = false;
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Default message receiver
    /////////////////////////////////////////////////////////////////////////////////
    const attend_broadcast = function(msg) {
        switch (msg.action) {
        case 'add_channel':
            $CORD.update_object(
                'options',
                'channels',
                {action: 'push', datas: [msg.target]}
            );
            break;
        case 'remove_channel':
            const channels = $CORD.get('options:channels');
            const i = channels.indexOf(msg.target);
            $CORD.update_object(
                'options',
                'channels',
                {action: 'remove', datas: [i]}
            );
            break;
        }
    };

    const attend_events = function(msg) {
        let i;
        switch (msg.action) {
        case 'add_alert':
            i = $CORD.$.options.channels.findIndex( c => c == msg.channel);
            $CORD.update_object('main', 'alerts', {
                action: 'push',
                datas: [{
                    channel: msg.channel,
                    ...msg.alert,
                    color: $CORD.$.options.colors[i]
                }]
            });
            $this.map_add_circle(
                msg.alert.lat,
                msg.alert.lng,
                msg.alert.rad,
                msg.alert.name,
                $CORD.$.options.colors[i]
            );
            break;
            
        case 'remove_alert':
            i = $CORD.$.main.alerts.findIndex(a => a.name == msg.alert.name);
            $CORD.update_object('main', 'alerts', {
                action: 'remove',
                datas: [i]
            });
            $this.map_remove_circle(msg.alert.name);
            break;
        }
    };

    this.onmessage = function(msg) {
        console.log('SYSLIB_ONMESSAGE', msg)
        switch (msg.channel) {
        case 'broadcast':
            attend_broadcast(msg);
            break;

        default:
            attend_events(msg);
            break;
        }
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////

    // I need to do public these 3 functions
    this.set_cookie = set_cookie;
    this.get_cookie = get_cookie;
    this.delete_cookie = delete_cookie;

    this.save_config = function() {
        const config = {
            options: {
                subs: $CORD.$.options.subs,
                colors: $CORD.$.options.colors
            }
        };
        send('save_config', {user: $CORD.$.main.user, config: config}, msg => {
            if (msg.result_ok) {
                notify.log("Config saved ok!")
            } else {
                notify.error("Config save failed!")
            }
        });
    };

    this.load_config = function() {
        send('load_config', {user: $CORD.$.main.user}, msg => {
            for (let cord_id in msg.config) {
                $CORD.update(cord_id, msg.config[cord_id]);
            }
        });
    };

    this.refresh_color = function(channel, value) {
        const i = $CORD.$.options.channels.findIndex( c => c == channel);
        $CORD.$.options.$colors[i] = value;
        for (let a of $CORD.$.main.alerts) {
            a.color = value;
            $this.map_add_circle(
                a.lat,
                a.lng,
                a.rad,
                a.name,
                a.color
            );
        }
        $CORD.refresh('main');
    };
    
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
                    init_session(user, msg);
                } else {
                    // login fail
                    $CORD.set("login:error", "Incorrect user or password!")
                }
            }
        );
    };

    this.logout = function() {
        $CORD.set('main:token', null);
        $CORD.set("main:user", '')
        delete_cookie('token');
        delete_cookie('user');
    };

    this.check_session = function() {
        console.log('CHECK_SESSION')
        const token = get_cookie('token');
        if (token === null) {
            this.hide_loading();
            return;
        }
        // this.show_loading('Checking session opened...');

        send(
            'check_session',
            {token: token},
            msg => {
                if (!msg.token) {
                    // This block is never reached
                    // (cord-update message is intercepted)
                    $CORD.set('main:token', null);
                    $CORD.set("login:error", "Session exired!")
                } else {
                    // session open 
                    init_session(get_cookie('user'), msg);
                }
                this.hide_loading();
            }
        );
    };

    this.subscription = function(channel, status) {
        if (status) {
            this.subscribe(channel);
        } else {
            this.unsubscribe(channel);
        }
    };
    
    this.subscribe = function(channel) {
        send(
            'subscribe',
            {channel: channel},
            msg => {
                if (!msg.result_ok) {
                    notify.warn(`Subscription to channel '${channel}' failed!`);
                } else {
                    $CORD.set('options:subs', msg.subs)
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
                    $CORD.set('options:subs', msg.subs)
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

    this.map_load = function(lat, lng) {
        map = L.map('map-board').setView([lat, lng], 12);
        L.tileLayer(
            'http://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            {
                maxZoom: 18,
                attribution: '&copy; OpenStreetMap',
                zoomControl: false,
                ext: 'png'
            }
        ).addTo(map);
        map.zoomControl.remove();
    };

    this.map_clear_circles = function() {
        for (let n in markers) { markers[n].remove() }
    };
    
    this.map_add_circle = function(lat, lng, rad, text, color) {
        this.map_remove_circle(text);
        let circle = L.circle([lat, lng], {
            color: '#555',
            weight: 1,
            fillColor: color,
            fillOpacity: 0.7,
            radius: rad
        }).addTo(map);
        circle.bindPopup(text);
        markers[text] = circle;
    };
    
    this.map_remove_circle = function(text) {
        markers[text] && markers[text].remove()
    };
    
}

const syslib = new Syslib();
