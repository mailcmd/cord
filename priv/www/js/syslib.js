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

    const clipboard_select_el = function(el) {
      var body = document.body, range, sel;
      if (document.createRange && window.getSelection) {
          range = document.createRange();
          sel = window.getSelection();
          sel.removeAllRanges();
          try {
              range.selectNodeContents(el);
              sel.addRange(range);
          } catch (e) {
              range.selectNode(el);
              sel.addRange(range);
          }
      } else if (body.createTextRange) {
          range = body.createTextRange();
          range.moveToElementText(el);
          range.select();
      }
    }

    const clipboard_copy_selection = function() {
        var copysuccess; // var to check whether execCommand successfully executed
        try {
            // run command to copy selected text to clipboard
            copysuccess = document.execCommand("copy");
        } catch (e) {
            copysuccess = false;
        }
        return copysuccess;
    }

    const clipboard_clear_selection = function() {
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        } else if (document.selection) {
            document.selection.empty();
        }
    }

    const notify = {
        log: function() {
            console.log(...arguments),
            notification(arguments[0], 'lime', 3000);
        },
        warn: function() {
            console.warn(...arguments)
            notification(arguments[0], 'gold', 4000);
        },
        error: function() {
            console.error(...arguments)
            notification(arguments[0], 'tomato', 5000);
        },
    };

    const notification = function(text, color = 'green', timeout = 3000) {
        $CORD.update('messages', {
            text: text,
            color: color,
            show: true
        });
        setTimeout(()=>$CORD.set('messages:show', false), timeout);
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////

    // I need to do public these functions
    this.set_cookie = set_cookie;
    this.get_cookie = get_cookie;
    this.delete_cookie = delete_cookie;
    this.notify = notify;
    this.random_id = random_id;

    this.clipboard_copy = function(el) {
        clipboard_select_el(el);
        clipboard_copy_selection();
        clipboard_clear_selection();
        notify.log('Copied to clipboard!');
    };

    this.map_clear_circles = function() {
        for (let n in markers) { markers[n].remove() }
    };

    this.map_add_circle = function(id, lat, lng, rad, text, color) {
        this.map_remove_circle(id);
        let circle = L.circle([lat, lng], {
            color: '#555',
            weight: 1,
            fillColor: color,
            fillOpacity: 0.7,
            radius: rad
        }).addTo(map);
        circle.bindPopup(text);
        markers[id] = circle;
    };

    this.map_remove_circle = function(id) {
        markers[id] && markers[id].remove()
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
}

const syslib = new Syslib();
