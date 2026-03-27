function Syslib() {
    /////////////////////////////////////////////////////////////////////////////////
    // Private
    /////////////////////////////////////////////////////////////////////////////////


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
        this.show_loading('Authorizing user...');
        $CORD.ws.send({msg_id: 1, action: 'authorize', user: user, pass: pass}, msg => {
            console.log('AUTH', msg)
            this.hide_loading();
            if (msg.authorize) $CORD.set("main:token", user)
        });
        return false;
    };

    // this.show_login = async function() {
    //     this.hide_loading();
    //     await $CORD.create_container({id: 'login', tpl_ref: 'tpl-login'});
    // };

    // this.hide_login = function() {
    //     $CORD.destroy_container('login');
    // };

    // this.check_user_logged = async function() {
    //     if ($CORD.get('main:token') == null) {
    //         await this.show_login();
    //     } else {
    //         this.hide_login();
    //         this.hide_loading();
    //     }
    // };
}

const syslib = new Syslib();
