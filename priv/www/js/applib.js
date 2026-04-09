const markers = {};
var map;

function Applib() {
    const $this = this;
    /////////////////////////////////////////////////////////////////////////////////
    // Private
    /////////////////////////////////////////////////////////////////////////////////
    const send = function(action, data, callback = console.log) {
        $CORD.ws.send(
            {
                ...{msg_id: syslib.random_id(), action: action, token: $CORD.get("main:token")},
                ...data
            },
            callback
        );
    };

    // login ok
    const init_session = function(user, msg) {
        if ($CORD.$.main.token != msg.token || $CORD.$.main.user != msg.user) {
            $CORD.update('main', {
                token: msg.token,
                user: msg.user
            });
            // cookies
            syslib.set_cookie('token', msg.token);
            syslib.set_cookie('user', user);
        }

        // load config if it is first time
        if ($CORD.$.main.first_time) $this.load_config();

        if (!$CORD.$.options.channels.is_equal(msg.channels)
            || !$CORD.$.options.subs.is_equal(msg.subs)) {
            $CORD.update('options', {
                channels: msg.channels,
                colors: msg.channels.reduce( (o, c, i) => (o[c] = colors[i],o), {}),
                subs: msg.subs
            });
        }

        // init map
        if (!map) syslib.map_load(msg.lat, msg.lng);
        $CORD.$.main.first_time = false;
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
            $CORD.update_object('main', 'alerts', {
                action: 'push',
                datas: [{
                    channel: msg.channel,
                    ts: Temporal.Instant.fromEpochMilliseconds(msg.ts*1000).toLocaleString(),
                    ...msg.alert,
                    color: $CORD.$.options.colors[msg.channel]
                }]
            });
            if (msg.alert.lat) {
                syslib.map_add_circle(
                    msg.alert.id,
                    msg.alert.lat,
                    msg.alert.lng,
                    msg.alert.rad,
                    msg.alert.description,
                    $CORD.$.options.colors[msg.channel]
                );
            }
            break;

        case 'remove_alert':
            i = $CORD.$.main.alerts.findIndex(a => a.id == msg.alert.id);
            $CORD.update_object('main', 'alerts', {
                action: 'remove',
                datas: [i]
            });
            syslib.map_remove_circle(msg.alert.id);
            break;
        }
    };

    this.onmessage = function(msg) {
        console.log('APPLIB_ONMESSAGE', msg)
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

    this.alert_box_action = function(ev, id) {
        ev.stopPropagation();
        $CORD.update('context_menu', {
            menu: [
                {
                    text: "⊟ Copy to clipboard",
                    onclick:
                    `applib.alert_box_copy('${id}');$CORD.set('context_menu:visible', false)`
                },
                {
                    text: "⊝ Remove alert",
                    onclick:
                    `applib.alert_box_remove('${id}');$CORD.set('context_menu:visible', false)`
                }
            ],
            visible: true,
            y: ev.pageY,
            x: ev.pageX
        });
    };

    this.alert_box_copy = function(id) {
        syslib.clipboard_copy(document.querySelector('[alert-box-id="'+id+'"]'));
    };
    
    this.alert_box_remove = function(id) {
        send('remove_alert', {id: id}, msg => {
            const i = $CORD.$.main.alerts.findIndex( a=> a.id == id);
            $CORD.update_object('main', 'alerts', {action: 'remove', datas: [i]});
            syslib.map_remove_circle(id);
        });
    };

    this.save_config = function() {
        const config = {
            options: {
                colors: $CORD.$.options.colors
            }
        };
        send('save_config', {user: $CORD.$.main.user, config: config}, msg => {
            if (msg.result_ok) {
                syslib.notify.log("Config saved ok!")
            } else {
                syslib.notify.error("Config save failed!")
            }
        });
    };

    this.load_config = function() {
        send('load_config', {user: $CORD.$.main.user}, msg => {
            console.log('LOAD_CONFIG', msg);
            
            if (msg.version) $CORD.$.header.$version = msg.version;
            
            // this first for paint alerts with saved colors (not default colors)
            if (msg.config?.options?.colors) {
                $CORD.$.options.colors = msg.config.options.colors;
            }
            
            // SORRY: I do not like this...            
            for (let a of (msg.config?.main?.alerts||[])) {
                a.ts = Temporal.Instant.fromEpochMilliseconds(a.ts*1000).toLocaleString();
            }

            // Set containers updates
            for (let cord_id in msg.config) {
                $CORD.update(cord_id, msg.config[cord_id]);
            }

            // Draw alerts on map if required
            for (let a of $CORD.$.main.alerts) {
                if (a.lat) {
                    syslib.map_add_circle(
                        a.id,
                        a.lat,
                        a.lng,
                        a.rad,
                        a.description,
                        $CORD.$.options.colors[a.channel]
                    );
                }
            }
        });
    };

    this.refresh_color = function(channel, value) {
        $CORD.$.options.colors[channel] = value;
        for (let a of $CORD.$.main.alerts) {
            if (a.lat && a.channel == channel) {
                syslib.map_add_circle(
                    a.id,
                    a.lat,
                    a.lng,
                    a.rad,
                    a.description,
                    value
                );
            }
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
        syslib.delete_cookie('token');
        syslib.delete_cookie('user');
    };

    this.check_session = function() {
        // console.log('CHECK_SESSION')
        const token = syslib.get_cookie('token');
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
                    init_session(syslib.get_cookie('user'), msg);
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
                    syslib.notify.warn(`Subscription to channel '${channel}' failed!`);
                } else {
                    $CORD.set('options:subs', msg.subs)
                    syslib.notify.log(`Subscription to channel '${channel}' ok!`);
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
                    syslib.notify.warn(`Unsubscription from channel '${channel}' failed!`);
                } else {
                    $CORD.set('options:subs', msg.subs)
                    syslib.notify.log(`Unsubscription from channel '${channel}' ok!`);
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
                    syslib.notify.warn(`Renew token failed!`);
                } else {
                    syslib.set_cookie('token', msg.token);
                    syslib.notify.log('New token assigned:', msg.token);
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

const applib = new Applib();
